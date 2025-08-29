const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');

/**
 * 创建测试用的APK文件
 * 这个脚本会创建一个包含META-INF/channel文件的模拟APK，用于测试walle功能
 */
async function createTestApk() {
    const testDir = path.join(__dirname);
    const apkPath = path.join(testDir, 'test-app.apk');
    
    // 确保测试目录存在
    await fs.ensureDir(testDir);
    
    // 创建ZIP文件（APK本质上是ZIP文件）
    const zip = new AdmZip();
    
    // 添加基本的APK结构
    zip.addFile('AndroidManifest.xml', Buffer.from('<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.test.app">\n</manifest>'));
    
    // 添加classes.dex（模拟）
    zip.addFile('classes.dex', Buffer.from('模拟的dex文件内容'));
    
    // 添加资源文件
    zip.addFile('resources.arsc', Buffer.from('模拟的资源文件'));
    
    // 重要：添加META-INF/channel文件，这是walle多渠道打包的标识
    zip.addFile('META-INF/MANIFEST.MF', Buffer.from('Manifest-Version: 1.0\nCreated-By: Test\n'));
    zip.addFile('META-INF/CERT.SF', Buffer.from('模拟的签名文件'));
    zip.addFile('META-INF/CERT.RSA', Buffer.from('模拟的证书文件'));
    zip.addFile('META-INF/channel', Buffer.from('walle'));
    
    // 保存APK文件
    zip.writeZip(apkPath);
    
    console.log(`测试APK文件已创建: ${apkPath}`);
    console.log('文件大小:', (await fs.stat(apkPath)).size, '字节');
    
    return apkPath;
}

if (require.main === module) {
    createTestApk().catch(console.error);
}

module.exports = createTestApk;