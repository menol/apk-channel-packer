const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const ApkSignatureBlock = require('./apk-signature-block');

/**
 * Node.js版本的Walle多渠道打包核心模块
 * 基于美团Walle原理实现，无需外部依赖
 */
class WalleCore {
    constructor() {
        this.CHANNEL_FILE = 'META-INF/channel';
        this.CHANNEL_INFO_FILE = 'META-INF/channel_info';
        this.apkSigBlock = new ApkSignatureBlock();
    }

    /**
     * 批量生成多渠道APK
     * @param {string} apkPath - 原始APK文件路径
     * @param {Array} channels - 渠道列表
     * @param {string} outputDir - 输出目录
     * @param {Function} progressCallback - 进度回调函数
     * @returns {Promise<Array>} 生成的APK文件路径列表
     */
    async batchGenerate(apkPath, channels, outputDir, progressCallback = null) {
        if (!fs.existsSync(apkPath)) {
            throw new Error(`APK文件不存在: ${apkPath}`);
        }

        if (!fs.existsSync(outputDir)) {
            await fs.ensureDir(outputDir);
        }

        const results = [];
        const total = channels.length;

        for (let i = 0; i < channels.length; i++) {
            const channel = channels[i];
            const progress = Math.round(((i + 1) / total) * 100);
            
            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total: total,
                    progress: progress,
                    channel: channel,
                    message: `正在处理渠道: ${channel}`
                });
            }

            try {
                const outputPath = await this.generateChannelApk(apkPath, channel, outputDir);
                results.push({
                    channel: channel,
                    path: outputPath,
                    success: true
                });
            } catch (error) {
                results.push({
                    channel: channel,
                    path: null,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * 生成单个渠道APK
     * @param {string} apkPath - 原始APK文件路径
     * @param {string} channel - 渠道名称
     * @param {string} outputDir - 输出目录
     * @returns {Promise<string>} 生成的APK文件路径
     */
    async generateChannelApk(apkPath, channel, outputDir) {
        const apkName = path.basename(apkPath, '.apk');
        const outputPath = path.join(outputDir, `${apkName}_${channel}.apk`);

        // 复制原始APK文件
        await fs.copy(apkPath, outputPath);

        // 写入渠道信息
        await this.writeChannelToApk(outputPath, channel);

        return outputPath;
    }

    /**
     * 向APK文件写入渠道信息
     * @param {string} apkPath - APK文件路径
     * @param {string} channel - 渠道名称
     * @param {Object} extraInfo - 额外信息（可选）
     */
    async writeChannelToApk(apkPath, channel, extraInfo = null) {
        // 使用APK Signature Block方式写入渠道信息
        await this.apkSigBlock.addChannelInfo(apkPath, channel, extraInfo);
    }

    /**
     * 创建渠道数据
     * @param {string} channel - 渠道名称
     * @param {Object} extraInfo - 额外信息
     * @returns {string} 渠道数据字符串
     */
    createChannelData(channel, extraInfo = null) {
        const data = {
            channel: channel,
            timestamp: Date.now(),
            version: '1.0.0'
        };

        if (extraInfo) {
            data.extra = extraInfo;
        }

        return JSON.stringify(data);
    }

    /**
     * 读取APK中的渠道信息
     * @param {string} apkPath - APK文件路径
     * @returns {Object|null} 渠道信息对象
     */
    async readChannelFromApk(apkPath) {
        try {
            // 使用APK Signature Block方式读取渠道信息
            return await this.apkSigBlock.readChannelInfo(apkPath);
        } catch (error) {
            console.error('读取渠道信息失败:', error.message);
            return null;
        }
    }

    /**
     * 检查APK是否支持Walle多渠道打包
     * 检查APK是否使用Android Signature V2 Scheme签名
     * @param {string} apkPath - APK文件路径
     * @returns {boolean} 是否支持
     */
    async checkWalleSupport(apkPath) {
        try {
            // 使用APK Signature Block方式检查支持
            return await this.apkSigBlock.checkWalleSupport(apkPath);
        } catch (error) {
            console.error('检查Walle支持失败:', error.message);
            return false;
        }
    }

    /**
     * 解析渠道配置文件
     * @param {string} channelFilePath - 渠道配置文件路径
     * @returns {Array} 渠道列表
     */
    async parseChannelFile(channelFilePath) {
        const content = await fs.readFile(channelFilePath, 'utf8');
        const lines = content.split('\n');
        const channels = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                // 支持 channel_name 或 channel_name=extra_info 格式
                const channelName = trimmedLine.split('=')[0].trim();
                if (channelName) {
                    channels.push(channelName);
                }
            }
        }

        return channels;
    }

    /**
     * 获取APK文件信息
     * @param {string} apkPath - APK文件路径
     * @returns {Object} APK信息
     */
    async getApkInfo(apkPath) {
        const stats = await fs.stat(apkPath);
        const zip = new AdmZip(apkPath);
        const entries = zip.getEntries();
        
        return {
            path: apkPath,
            name: path.basename(apkPath),
            size: stats.size,
            sizeFormatted: this.formatFileSize(stats.size),
            modifiedTime: stats.mtime,
            entryCount: entries.length,
            walleSupported: await this.checkWalleSupport(apkPath),
            existingChannel: await this.readChannelFromApk(apkPath)
        };
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化后的大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 验证渠道名称
     * @param {string} channel - 渠道名称
     * @returns {boolean} 是否有效
     */
    validateChannelName(channel) {
        if (!channel || typeof channel !== 'string') {
            return false;
        }
        
        // 渠道名称只能包含字母、数字、下划线和连字符
        const regex = /^[a-zA-Z0-9_-]+$/;
        return regex.test(channel.trim());
    }

    /**
     * 清理临时文件
     * @param {Array} filePaths - 文件路径列表
     */
    async cleanupTempFiles(filePaths) {
        for (const filePath of filePaths) {
            try {
                if (await fs.pathExists(filePath)) {
                    await fs.remove(filePath);
                }
            } catch (error) {
                console.warn(`清理临时文件失败: ${filePath}`, error.message);
            }
        }
    }
}

module.exports = WalleCore;