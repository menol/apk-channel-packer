const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WalleCore = require('./walle-core');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.loadFile('src/renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 开发模式下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC处理器
ipcMain.handle('select-apk-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'APK Files', extensions: ['apk'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('select-channel-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Text Files', extensions: ['txt'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('read-channel-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content;
  } catch (error) {
    throw new Error(`读取渠道文件失败: ${error.message}`);
  }
});

ipcMain.handle('select-output-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('execute-walle', async (event, { apkPath, channelFile, outputDir }) => {
  try {
    const walleCore = new WalleCore();
    
    // 发送开始消息
    event.sender.send('walle-output', '开始多渠道打包...\n');
    
    // 检查APK是否支持Walle
    const isSupported = await walleCore.checkWalleSupport(apkPath);
    if (!isSupported) {
      throw new Error('APK文件不支持Walle多渠道打包，请确保APK中包含META-INF/channel文件');
    }
    
    // 解析渠道文件
    event.sender.send('walle-output', '解析渠道配置文件...\n');
    const channels = await walleCore.parseChannelFile(channelFile);
    
    if (channels.length === 0) {
      throw new Error('渠道配置文件中没有找到有效的渠道信息');
    }
    
    event.sender.send('walle-output', `找到 ${channels.length} 个渠道\n`);
    
    // 批量生成渠道APK
    const results = await walleCore.batchGenerate(
      apkPath,
      channels,
      outputDir,
      (progress) => {
        event.sender.send('walle-progress', progress);
        event.sender.send('walle-output', `${progress.message} (${progress.current}/${progress.total})\n`);
      }
    );
    
    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    event.sender.send('walle-output', `\n打包完成！\n`);
    event.sender.send('walle-output', `成功: ${successCount} 个\n`);
    if (failCount > 0) {
      event.sender.send('walle-output', `失败: ${failCount} 个\n`);
      results.filter(r => !r.success).forEach(r => {
        event.sender.send('walle-output', `  - ${r.channel}: ${r.error}\n`);
      });
    }
    
    return { 
      success: true, 
      output: `成功生成 ${successCount} 个渠道包`,
      results: results
    };
    
  } catch (error) {
    const errorMessage = error.message || error.toString() || '未知错误';
    event.sender.send('walle-output', `错误: ${errorMessage}\n`);
    return { success: false, error: errorMessage };
  }
});

ipcMain.handle('check-walle-installed', async () => {
  try {
    const walleCore = new WalleCore();
    return true; // 内置walle模块始终可用
  } catch (error) {
    return false;
  }
});

// 处理Linux平台文件路径获取
ipcMain.handle('get-file-path', async (event, fileInfo) => {
  try {
    // 在Linux上，我们可能需要通过文件信息来查找文件
    // 这里返回null，让前端使用临时文件方案
    return null;
  } catch (error) {
    console.error('获取文件路径失败:', error);
    return null;
  }
});

// 创建临时文件
ipcMain.handle('create-temp-file', async (event, { name, data }) => {
  try {
    const tempDir = os.tmpdir();
    const tempFileName = `apk-channel-${Date.now()}-${name}`;
    const tempPath = path.join(tempDir, tempFileName);
    
    // 写入临时文件
    fs.writeFileSync(tempPath, data);
    
    // 设置清理定时器（30分钟后删除）
    setTimeout(() => {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
          console.log('临时文件已清理:', tempPath);
        }
      } catch (error) {
        console.warn('清理临时文件失败:', error);
      }
    }, 30 * 60 * 1000); // 30分钟
    
    return tempPath;
  } catch (error) {
    console.error('创建临时文件失败:', error);
    throw error;
  }
});