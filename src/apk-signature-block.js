const fs = require('fs');
const crypto = require('crypto');

/**
 * APK Signature Block 操作模块
 * 基于Android官方APK签名方案v2/v3实现
 * 参考: https://source.android.com/docs/security/features/apksigning/v2
 */
class ApkSignatureBlock {
    constructor() {
        // APK Signature Block 魔数值
        this.APK_SIG_BLOCK_MAGIC = Buffer.from('APK Sig Block 42', 'ascii');
        // Walle渠道信息的自定义ID (类似于v2签名的0x7109871a)
        this.WALLE_CHANNEL_BLOCK_ID = 0x71777777; // Walle使用的ID
    }

    /**
     * 读取APK文件并解析其结构
     * @param {string} apkPath - APK文件路径
     * @returns {Object} APK结构信息
     */
    async parseApkStructure(apkPath) {
        const buffer = await fs.promises.readFile(apkPath);
        const fileSize = buffer.length;

        // 1. 找到ZIP End of Central Directory (EOCD)
        const eocd = this.findEocd(buffer);
        if (!eocd) {
            throw new Error('无法找到ZIP End of Central Directory');
        }

        // 2. 获取Central Directory的偏移量
        const centralDirOffset = eocd.centralDirOffset;
        
        // 3. 检查是否存在APK Signature Block
        const sigBlock = this.findApkSignatureBlock(buffer, centralDirOffset);
        
        return {
            buffer,
            fileSize,
            eocd,
            centralDirOffset,
            sigBlock,
            hasSignatureBlock: !!sigBlock
        };
    }

    /**
     * 查找ZIP End of Central Directory
     * @param {Buffer} buffer - APK文件缓冲区
     * @returns {Object|null} EOCD信息
     */
    findEocd(buffer) {
        // EOCD signature: 0x06054b50
        const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
        
        // 从文件末尾开始搜索EOCD
        for (let i = buffer.length - 22; i >= 0; i--) {
            if (buffer.subarray(i, i + 4).equals(eocdSignature)) {
                // 读取Central Directory的偏移量 (小端序)
                const centralDirOffset = buffer.readUInt32LE(i + 16);
                const centralDirSize = buffer.readUInt32LE(i + 12);
                
                return {
                    offset: i,
                    centralDirOffset,
                    centralDirSize,
                    signature: eocdSignature
                };
            }
        }
        return null;
    }

    /**
     * 查找APK Signature Block
     * @param {Buffer} buffer - APK文件缓冲区
     * @param {number} centralDirOffset - Central Directory偏移量
     * @returns {Object|null} Signature Block信息
     */
    findApkSignatureBlock(buffer, centralDirOffset) {
        // 检查Central Directory前是否有APK Signature Block
        if (centralDirOffset < 32) {
            return null; // 空间不足，无法包含signature block
        }

        // 检查magic值 (在Central Directory前16字节)
        const magicOffset = centralDirOffset - 16;
        const magic = buffer.subarray(magicOffset, centralDirOffset);
        
        if (!magic.equals(this.APK_SIG_BLOCK_MAGIC)) {
            return null; // 没有找到APK Signature Block
        }

        // 读取block size (在magic前8字节)
        const blockSizeOffset = magicOffset - 8;
        const blockSize = buffer.readBigUInt64LE(blockSizeOffset);
        
        // 计算block的起始位置
        const blockStart = centralDirOffset - Number(blockSize) - 8;
        
        if (blockStart < 0) {
            return null; // 无效的block size
        }

        // 验证block开头的size字段
        const blockStartSize = buffer.readBigUInt64LE(blockStart);
        if (blockStartSize !== blockSize) {
            return null; // size字段不匹配
        }

        return {
            start: blockStart,
            size: Number(blockSize),
            end: centralDirOffset - 8,
            magic,
            data: buffer.subarray(blockStart + 8, centralDirOffset - 24) // 去除size和magic
        };
    }

    /**
     * 解析APK Signature Block中的ID-Value对
     * @param {Buffer} blockData - Signature Block数据
     * @returns {Array} ID-Value对数组
     */
    parseIdValuePairs(blockData) {
        const pairs = [];
        let offset = 0;

        // APK Signature Block格式：uint64长度前缀的ID-Value对序列
        while (offset + 12 <= blockData.length) { // 至少需要12字节 (8字节长度 + 4字节ID)
            // 读取pair的长度 (小端序, uint64)
            const pairLengthLow = blockData.readUInt32LE(offset);
            const pairLengthHigh = blockData.readUInt32LE(offset + 4);
            
            // 检查高32位是否为0（我们只处理小于4GB的pair）
            if (pairLengthHigh !== 0) {
                console.log(`ID-Value对长度过大: ${pairLengthHigh}:${pairLengthLow}`);
                break;
            }
            
            const pairLength = pairLengthLow;
            if (pairLength < 4 || offset + 8 + pairLength > blockData.length) {
                console.log(`解析ID-Value对时遇到边界问题: offset=${offset}, pairLength=${pairLength}, blockData.length=${blockData.length}`);
                break;
            }

            // 读取ID (小端序)
            const id = blockData.readUInt32LE(offset + 8);
            
            // 读取value
            const valueLength = pairLength - 4;
            const value = blockData.subarray(offset + 12, offset + 12 + valueLength);

            pairs.push({
                id: id,
                length: pairLength,
                value: value
            });

            offset += 8 + pairLength; // 移动到下一个pair (8字节长度前缀 + pair内容)
        }

        return pairs;
    }

    /**
     * 创建ID-Value对的二进制数据
     * @param {number} id - ID值
     * @param {Buffer} value - Value数据
     * @returns {Buffer} 二进制数据
     */
    createIdValuePair(id, value) {
        const pairLength = 4 + value.length; // ID长度 + value长度
        const buffer = Buffer.allocUnsafe(8 + pairLength); // 8字节长度前缀 + pair内容
        
        let offset = 0;
        // 写入pair长度 (小端序, uint64)
        buffer.writeUInt32LE(pairLength, offset);
        buffer.writeUInt32LE(0, offset + 4); // 高32位为0
        offset += 8;
        
        // 写入ID (小端序)
        buffer.writeUInt32LE(id, offset);
        offset += 4;
        
        // 写入value
        value.copy(buffer, offset);
        
        return buffer;
    }

    /**
     * 创建APK Signature Block
     * @param {Array} idValuePairs - ID-Value对数组
     * @returns {Buffer} Signature Block二进制数据
     */
    createApkSignatureBlock(idValuePairs) {
        // 计算所有pairs的总长度
        let pairsLength = 0;
        const pairBuffers = [];
        
        for (const pair of idValuePairs) {
            const pairBuffer = this.createIdValuePair(pair.id, pair.value);
            pairBuffers.push(pairBuffer);
            pairsLength += pairBuffer.length;
        }

        // 计算整个block的大小 (不包括开头的size字段)
        const blockSize = BigInt(pairsLength + 8 + 16); // pairs + size + magic
        
        // 创建完整的signature block
        const totalSize = 8 + Number(blockSize); // 包括开头的size字段
        const buffer = Buffer.allocUnsafe(totalSize);
        
        let offset = 0;
        
        // 写入开头的block size (小端序)
        buffer.writeBigUInt64LE(blockSize, offset);
        offset += 8;
        
        // 写入所有ID-Value pairs
        for (const pairBuffer of pairBuffers) {
            pairBuffer.copy(buffer, offset);
            offset += pairBuffer.length;
        }
        
        // 写入结尾的block size (小端序)
        buffer.writeBigUInt64LE(blockSize, offset);
        offset += 8;
        
        // 写入magic
        this.APK_SIG_BLOCK_MAGIC.copy(buffer, offset);
        
        return buffer;
    }

    /**
     * 向APK添加渠道信息
     * @param {string} apkPath - APK文件路径
     * @param {string} channel - 渠道名称
     * @param {Object} extraInfo - 额外信息
     * @returns {Promise<void>}
     */
    async addChannelInfo(apkPath, channel, extraInfo = null) {
        const apkStructure = await this.parseApkStructure(apkPath);
        const { buffer, centralDirOffset, eocd, sigBlock } = apkStructure;

        // 创建渠道信息数据
        const channelData = {
            channel: channel,
            timestamp: Date.now(),
            version: '1.0.0'
        };
        
        if (extraInfo) {
            channelData.extra = extraInfo;
        }
        
        const channelBuffer = Buffer.from(JSON.stringify(channelData), 'utf8');
        
        // 准备ID-Value pairs
        const idValuePairs = [];
        
        // 如果已存在signature block，保留其他pairs
        if (sigBlock) {
            const existingPairs = this.parseIdValuePairs(sigBlock.data);
            // 过滤掉已存在的Walle渠道信息
            for (const pair of existingPairs) {
                if (pair.id !== this.WALLE_CHANNEL_BLOCK_ID) {
                    idValuePairs.push(pair);
                }
            }
        }
        
        // 添加新的渠道信息
        idValuePairs.push({
            id: this.WALLE_CHANNEL_BLOCK_ID,
            value: channelBuffer
        });
        
        // 创建新的signature block
        const newSignatureBlock = this.createApkSignatureBlock(idValuePairs);
        
        // 重新构建APK文件
        await this.rebuildApkWithSignatureBlock(apkPath, buffer, newSignatureBlock, centralDirOffset, eocd);
    }

    /**
     * 从APK读取渠道信息
     * @param {string} apkPath - APK文件路径
     * @returns {Promise<Object|null>} 渠道信息
     */
    async readChannelInfo(apkPath) {
        try {
            const apkStructure = await this.parseApkStructure(apkPath);
            const { sigBlock } = apkStructure;
            
            if (!sigBlock) {
                return null; // 没有signature block
            }
            
            const pairs = this.parseIdValuePairs(sigBlock.data);
            
            // 查找Walle渠道信息
            for (const pair of pairs) {
                if (pair.id === this.WALLE_CHANNEL_BLOCK_ID) {
                    const channelData = JSON.parse(pair.value.toString('utf8'));
                    return channelData;
                }
            }
            
            return null; // 没有找到渠道信息
        } catch (error) {
            console.error('读取渠道信息失败:', error.message);
            return null;
        }
    }

    /**
     * 重新构建包含Signature Block的APK文件
     * @param {string} apkPath - APK文件路径
     * @param {Buffer} originalBuffer - 原始APK缓冲区
     * @param {Buffer} signatureBlock - 新的Signature Block
     * @param {number} originalCentralDirOffset - 原始Central Directory偏移量
     * @param {Object} eocd - EOCD信息
     */
    async rebuildApkWithSignatureBlock(apkPath, originalBuffer, signatureBlock, originalCentralDirOffset, eocd) {
        // 检查是否已存在Signature Block
        const apkStructure = await this.parseApkStructure(apkPath);
        const existingSigBlock = apkStructure.sigBlock;
        
        let zipEntriesEnd = originalCentralDirOffset;
        let sizeDifference = signatureBlock.length;
        
        if (existingSigBlock) {
            // 如果已存在Signature Block，替换它
            zipEntriesEnd = existingSigBlock.start;
            sizeDifference = signatureBlock.length - (existingSigBlock.end + 8 - existingSigBlock.start);
        }
        
        // 计算新的Central Directory偏移量
        const newCentralDirOffset = originalCentralDirOffset + sizeDifference;
        
        // 创建新的APK缓冲区
        const newApkSize = originalBuffer.length + sizeDifference;
        const newBuffer = Buffer.allocUnsafe(newApkSize);
        
        let offset = 0;
        
        // 1. 复制ZIP entries (从开头到Signature Block位置)
        originalBuffer.copy(newBuffer, offset, 0, zipEntriesEnd);
        offset += zipEntriesEnd;
        
        // 2. 插入新的Signature Block
        signatureBlock.copy(newBuffer, offset);
        offset += signatureBlock.length;
        
        // 3. 复制Central Directory
        const centralDirStart = originalCentralDirOffset;
        const centralDirEnd = eocd.offset;
        originalBuffer.copy(newBuffer, offset, centralDirStart, centralDirEnd);
        offset += (centralDirEnd - centralDirStart);
        
        // 4. 复制并更新EOCD
        const eocdStart = eocd.offset;
        const eocdEnd = originalBuffer.length;
        originalBuffer.copy(newBuffer, offset, eocdStart, eocdEnd);
        
        // 更新EOCD中的Central Directory偏移量
        newBuffer.writeUInt32LE(newCentralDirOffset, offset + 16);
        
        // 写入新的APK文件
        await fs.promises.writeFile(apkPath, newBuffer);
    }

    /**
     * 检查APK是否支持Walle渠道打包
     * @param {string} apkPath - APK文件路径
     * @returns {Promise<boolean>} 是否支持
     */
    async checkWalleSupport(apkPath) {
        try {
            const apkStructure = await this.parseApkStructure(apkPath);
            // 只要APK结构完整就支持添加渠道信息
            return apkStructure.eocd !== null;
        } catch (error) {
            console.error('检查Walle支持失败:', error.message);
            return false;
        }
    }
}

module.exports = ApkSignatureBlock;