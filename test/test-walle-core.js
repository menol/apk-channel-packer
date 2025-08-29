const WalleCore = require('../src/walle-core');
const path = require('path');
const fs = require('fs-extra');

/**
 * 测试walle核心功能
 */
async function testWalleCore() {
    console.log('开始测试Walle核心功能...');
    
    const walleCore = new WalleCore();
    const testApkPath = path.join(__dirname, 'test-app.apk');
    const channelFilePath = path.join(__dirname, '../example-channels.txt');
    const outputDir = path.join(__dirname, 'output');
    
    try {
        // 1. 检查APK是否支持Walle
        console.log('\n1. 检查APK是否支持Walle...');
        const isSupported = await walleCore.checkWalleSupport(testApkPath);
        console.log(`APK支持Walle: ${isSupported}`);
        
        if (!isSupported) {
            console.log('❌ 测试APK不支持Walle，测试结束');
            return;
        }
        
        // 2. 获取APK信息
        console.log('\n2. 获取APK信息...');
        const apkInfo = await walleCore.getApkInfo(testApkPath);
        console.log('APK信息:', {
            name: apkInfo.name,
            size: apkInfo.sizeFormatted,
            walleSupported: apkInfo.walleSupported
        });
        
        // 3. 解析渠道文件
        console.log('\n3. 解析渠道文件...');
        const channels = await walleCore.parseChannelFile(channelFilePath);
        console.log(`找到 ${channels.length} 个渠道:`, channels.slice(0, 5), channels.length > 5 ? '...' : '');
        
        // 4. 测试单个渠道APK生成
        console.log('\n4. 测试单个渠道APK生成...');
        await fs.ensureDir(outputDir);
        const testChannel = channels[0];
        const singleApkPath = await walleCore.generateChannelApk(testApkPath, testChannel, outputDir);
        console.log(`单个渠道APK生成成功: ${path.basename(singleApkPath)}`);
        
        // 5. 验证渠道信息
        console.log('\n5. 验证渠道信息...');
        const channelInfo = await walleCore.readChannelFromApk(singleApkPath);
        console.log('读取到的渠道信息:', channelInfo);
        
        // 6. 批量生成测试（只测试前3个渠道）
        console.log('\n6. 批量生成测试（前3个渠道）...');
        const testChannels = channels.slice(0, 3);
        const results = await walleCore.batchGenerate(
            testApkPath,
            testChannels,
            outputDir,
            (progress) => {
                console.log(`进度: ${progress.progress}% - ${progress.message}`);
            }
        );
        
        // 7. 统计结果
        console.log('\n7. 测试结果统计:');
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        console.log(`成功: ${successCount} 个`);
        console.log(`失败: ${failCount} 个`);
        
        if (failCount > 0) {
            console.log('失败详情:');
            results.filter(r => !r.success).forEach(r => {
                console.log(`  - ${r.channel}: ${r.error}`);
            });
        }
        
        // 8. 清理测试文件
        console.log('\n8. 清理测试文件...');
        const outputFiles = await fs.readdir(outputDir);
        console.log(`生成的文件数量: ${outputFiles.length}`);
        
        console.log('\n✅ Walle核心功能测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
    }
}

if (require.main === module) {
    testWalleCore().catch(console.error);
}

module.exports = testWalleCore;