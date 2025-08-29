const { app, BrowserWindow } = require('electron');
const path = require('path');

// 测试拖拽功能的脚本
function createTestWindow() {
  const testWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 创建测试页面内容
  const testHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>拖拽功能测试</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .drop-zone {
          width: 300px;
          height: 200px;
          border: 2px dashed #ccc;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 20px 0;
          transition: all 0.3s ease;
        }
        .drop-zone.drag-over {
          border-color: #007bff;
          background-color: #f0f8ff;
        }
        .result {
          margin-top: 20px;
          padding: 10px;
          background-color: #f8f9fa;
          border-radius: 5px;
        }
      </style>
    </head>
    <body>
      <h1>拖拽功能测试</h1>
      <p>请拖拽文件到下面的区域进行测试：</p>
      
      <div id="drop-zone" class="drop-zone">
        拖拽文件到这里
      </div>
      
      <div id="result" class="result">
        等待文件拖拽...
      </div>
      
      <script>
        const { ipcRenderer } = require('electron');
        
        const dropZone = document.getElementById('drop-zone');
        const result = document.getElementById('result');
        
        function log(message) {
          console.log(message);
          result.innerHTML += '<div>' + message + '</div>';
        }
        
        dropZone.addEventListener('dragover', (e) => {
          e.preventDefault();
          dropZone.classList.add('drag-over');
          log('文件悬停在拖拽区域上');
        });
        
        dropZone.addEventListener('dragleave', (e) => {
          e.preventDefault();
          dropZone.classList.remove('drag-over');
        });
        
        dropZone.addEventListener('drop', async (e) => {
          e.preventDefault();
          dropZone.classList.remove('drag-over');
          
          log('检测到文件拖拽事件');
          log('文件数量: ' + e.dataTransfer.files.length);
          
          const files = Array.from(e.dataTransfer.files);
          
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            log('文件 ' + (i + 1) + ':');
            log('  名称: ' + file.name);
            log('  大小: ' + file.size + ' bytes');
            log('  类型: ' + file.type);
            log('  路径属性: ' + (file.path ? file.path : '无path属性'));
            
            // 测试新的文件处理逻辑
            if (!file.path) {
              log('  检测到Linux平台，尝试创建临时文件...');
              try {
                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const tempPath = await ipcRenderer.invoke('create-temp-file', {
                  name: file.name,
                  data: buffer
                });
                log('  临时文件路径: ' + tempPath);
              } catch (error) {
                log('  创建临时文件失败: ' + error.message);
              }
            }
          }
          
          // 测试 dataTransfer.items
          if (e.dataTransfer.items) {
            log('DataTransfer items 数量: ' + e.dataTransfer.items.length);
            const items = Array.from(e.dataTransfer.items);
            for (let i = 0; i < items.length; i++) {
              const item = items[i];
              log('Item ' + (i + 1) + ':');
              log('  kind: ' + item.kind);
              log('  type: ' + item.type);
              
              if (item.webkitGetAsEntry) {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                  log('  webkitGetAsEntry: ' + entry.name);
                  log('  fullPath: ' + (entry.fullPath || '无'));
                  log('  isFile: ' + entry.isFile);
                }
              }
            }
          }
        });
        
        log('拖拽测试页面已加载');
        log('平台: ' + process.platform);
        log('Electron版本: ' + process.versions.electron);
      </script>
    </body>
    </html>
  `;
  
  testWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(testHTML));
  
  testWindow.webContents.openDevTools();
  
  testWindow.on('closed', () => {
    app.quit();
  });
}

app.whenReady().then(createTestWindow);

app.on('window-all-closed', () => {
  app.quit();
});

console.log('拖拽功能测试启动中...');
console.log('请在打开的窗口中拖拽文件进行测试');