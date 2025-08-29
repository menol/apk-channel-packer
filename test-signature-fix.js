const WalleCore = require('./src/walle-core');
const fs = require('fs');
const path = require('path');

async function testSignatureFix() {
    console.log('🔧 测试APK签名修正...');
    
    const inputApk = 'test/test-app.apk';
    const outputApk = 'test/output/test-signature-fix.apk';
    const channel = 'test_signature';
    
    try {
        // 确保输出目录存在
        const outputDir = path.dirname(outputApk);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        console.log('📱 检查原始APK...');
        const walleCore = new WalleCore();
        const isSupported = await walleCore.checkWalleSupport(inputApk);
        console.log(`   支持Walle: ${isSupported}`);
        
        console.log('📦 生成渠道包...');
        await walleCore.generateChannelApk(
            inputApk,
            outputApk,
            channel,
            { test: 'signature_fix' }
        );
        
        console.log('✅ 渠道包生成成功!');
        
        console.log('📖 读取渠道信息...');
        const channelInfo = await walleCore.readChannelFromApk(outputApk);
        console.log('   渠道信息:', JSON.stringify(channelInfo, null, 2));
        
        console.log('🎯 测试完成!');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
    }
}

testSignatureFix();