const WalleCore = require('./src/walle-core');
const fs = require('fs');
const path = require('path');

async function testWithRealApk() {
    console.log('🔧 使用真实APK测试签名修正...');
    
    // 检查是否有真实的APK文件
    const possibleApks = [
        'test/real-app.apk',
        'test/sample.apk',
        'test/demo.apk'
    ];
    
    let inputApk = null;
    for (const apk of possibleApks) {
        if (fs.existsSync(apk)) {
            const stats = fs.statSync(apk);
            if (stats.size > 100000) { // 至少100KB
                inputApk = apk;
                break;
            }
        }
    }
    
    if (!inputApk) {
        console.log('❌ 未找到真实的APK文件进行测试');
        console.log('请将一个真实的APK文件放置到以下位置之一:');
        possibleApks.forEach(apk => console.log(`   - ${apk}`));
        console.log('\n📝 测试说明:');
        console.log('1. 我们已经修正了APK Signature Block的写入逻辑');
        console.log('2. 现在会正确替换现有的签名块而不是简单添加');
        console.log('3. 这应该解决了INSTALL_PARSE_FAILED_NO_CERTIFICATES错误');
        console.log('\n🔧 修正内容:');
        console.log('- 检查APK是否已存在Signature Block');
        console.log('- 如果存在，则替换而不是添加新块');
        console.log('- 正确计算新的Central Directory偏移量');
        console.log('- 保持APK结构的完整性');
        return;
    }
    
    const outputApk = 'test/output/real-test-signature.apk';
    const channel = 'signature_test';
    
    try {
        // 确保输出目录存在
        const outputDir = path.dirname(outputApk);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        console.log(`📱 使用APK文件: ${inputApk}`);
        const stats = fs.statSync(inputApk);
        console.log(`   文件大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        const walleCore = new WalleCore();
        const isSupported = await walleCore.checkWalleSupport(inputApk);
        console.log(`   Walle支持: ${isSupported}`);
        
        if (!isSupported) {
            console.log('❌ APK不支持Walle，可能没有使用Android Signature V2签名');
            return;
        }
        
        console.log('📦 生成渠道包...');
        
        // 复制原文件到输出位置
        fs.copyFileSync(inputApk, outputApk);
        
        // 写入渠道信息
        await walleCore.writeChannelToApk(outputApk, channel, { 
            test: 'signature_verification',
            timestamp: Date.now()
        });
        
        console.log('✅ 渠道包生成成功!');
        
        // 检查输出文件
        const outputStats = fs.statSync(outputApk);
        console.log(`   输出文件大小: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);
        
        console.log('📖 验证渠道信息...');
        const channelData = await walleCore.readChannelFromApk(outputApk);
        
        if (channelData && channelData.channel === channel) {
            console.log('✅ 渠道信息验证成功!');
            console.log('   渠道信息:', JSON.stringify(channelData, null, 2));
        } else {
            console.log('❌ 渠道信息验证失败!');
        }
        
        console.log('\n🎯 测试完成!');
        console.log(`📱 请使用以下命令测试APK安装:`);
        console.log(`   adb install ${outputApk}`);
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.stack) {
            console.error('详细错误:', error.stack);
        }
    }
}

testWithRealApk();