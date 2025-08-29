const WalleCore = require('./src/walle-core');
const fs = require('fs');
const path = require('path');

async function verifySignatureFix() {
    console.log('🔧 验证APK签名修正...');
    
    const inputApk = 'test/test-app.apk';
    const outputApk = 'test/output/verified-signature.apk';
    const channel = 'verified_channel';
    
    try {
        // 确保输出目录存在
        const outputDir = path.dirname(outputApk);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        console.log('📱 检查原始APK支持情况...');
        const walleCore = new WalleCore();
        const isSupported = await walleCore.checkWalleSupport(inputApk);
        console.log(`   Walle支持: ${isSupported}`);
        
        if (!isSupported) {
            console.log('❌ 原始APK不支持Walle，无法进行测试');
            return;
        }
        
        console.log('📦 生成渠道包...');
        await walleCore.writeChannelToApk(inputApk, channel, { test: 'signature_verification' });
        
        // 复制到输出路径
        fs.copyFileSync(inputApk, outputApk);
        
        console.log('✅ 渠道包生成成功!');
        console.log(`   输出文件: ${outputApk}`);
        
        // 检查文件大小
        const stats = fs.statSync(outputApk);
        console.log(`   文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        console.log('📖 验证渠道信息...');
        const channelData = await walleCore.readChannelFromApk(outputApk);
        console.log('   读取到的渠道信息:', JSON.stringify(channelData, null, 2));
        
        if (channelData && channelData.channel === channel) {
            console.log('✅ 渠道信息验证成功!');
        } else {
            console.log('❌ 渠道信息验证失败!');
            console.log(`   期望渠道: ${channel}`);
            console.log(`   实际渠道: ${channelData ? channelData.channel : 'null'}`);
        }
        
        console.log('🎯 验证完成! 请手动测试APK安装。');
        
    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        if (error.stack) {
            console.error('详细错误:', error.stack);
        }
    }
}

verifySignatureFix();