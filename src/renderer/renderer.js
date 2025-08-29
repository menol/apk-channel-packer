const { ipcRenderer } = require('electron');

class APKChannelPacker {
    constructor() {
        this.apkFile = null;
        this.channelFile = null;
        this.outputDir = null;
        this.channels = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkWalleStatus();
    }

    initializeElements() {
        // APK相关元素
        this.apkDropZone = document.getElementById('apk-drop-zone');
        this.apkInfo = document.getElementById('apk-info');
        this.apkName = document.getElementById('apk-name');
        this.browseApkBtn = document.getElementById('browse-apk');
        this.removeApkBtn = document.getElementById('remove-apk');

        // 渠道文件相关元素
        this.channelDropZone = document.getElementById('channel-drop-zone');
        this.channelInfo = document.getElementById('channel-info');
        this.channelName = document.getElementById('channel-name');
        this.browseChannelBtn = document.getElementById('browse-channel');
        this.removeChannelBtn = document.getElementById('remove-channel');
        this.channelPreview = document.getElementById('channel-preview');
        this.channelList = document.getElementById('channel-list');

        // 输出目录相关元素
        this.outputPath = document.getElementById('output-path');
        this.browseOutputBtn = document.getElementById('browse-output');

        // 打包相关元素
        this.packBtn = document.getElementById('pack-btn');
        this.progressSection = document.getElementById('progress-section');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');

        // 日志相关元素
        this.logSection = document.getElementById('log-section');
        this.logContainer = document.getElementById('log-container');
        this.clearLogBtn = document.getElementById('clear-log');

        // 状态栏元素
        this.walleStatus = document.getElementById('walle-status');

        // 模态框元素
        this.errorModal = document.getElementById('error-modal');
        this.errorMessage = document.getElementById('error-message');
        this.modalClose = document.getElementById('modal-close');
        this.errorOk = document.getElementById('error-ok');
    }

    setupEventListeners() {
        // APK文件拖拽
        this.setupDropZone(this.apkDropZone, this.handleApkDrop.bind(this));
        this.browseApkBtn.addEventListener('click', this.browseApkFile.bind(this));
        this.removeApkBtn.addEventListener('click', this.removeApkFile.bind(this));

        // 渠道文件拖拽
        this.setupDropZone(this.channelDropZone, this.handleChannelDrop.bind(this));
        this.browseChannelBtn.addEventListener('click', this.browseChannelFile.bind(this));
        this.removeChannelBtn.addEventListener('click', this.removeChannelFile.bind(this));

        // 输出目录选择
        this.browseOutputBtn.addEventListener('click', this.browseOutputDirectory.bind(this));

        // 打包按钮
        this.packBtn.addEventListener('click', this.startPacking.bind(this));

        // 日志清空
        this.clearLogBtn.addEventListener('click', this.clearLog.bind(this));

        // 模态框关闭
        this.modalClose.addEventListener('click', this.hideErrorModal.bind(this));
        this.errorOk.addEventListener('click', this.hideErrorModal.bind(this));
        this.errorModal.addEventListener('click', (e) => {
            if (e.target === this.errorModal) {
                this.hideErrorModal();
            }
        });

        // IPC事件监听
        ipcRenderer.on('walle-output', (event, data) => {
            this.appendLog(data, 'output');
        });

        ipcRenderer.on('walle-error', (event, data) => {
            this.appendLog(data, 'error');
        });

        ipcRenderer.on('walle-progress', (event, progress) => {
            this.updateProgress(progress.progress, `正在处理: ${progress.channel} (${progress.current}/${progress.total})`);
        });
    }

    setupDropZone(dropZone, handler) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            handler(e.dataTransfer.files);
        });
    }

    handleApkDrop(files) {
        const file = files[0];
        if (file && file.name.toLowerCase().endsWith('.apk')) {
            this.setApkFile(file.path);
        } else {
            this.showError('请拖拽有效的APK文件');
        }
    }

    handleChannelDrop(files) {
        const file = files[0];
        if (file && file.name.toLowerCase().endsWith('.txt')) {
            this.setChannelFile(file.path);
        } else {
            this.showError('请拖拽有效的TXT渠道配置文件');
        }
    }

    async browseApkFile() {
        try {
            const filePath = await ipcRenderer.invoke('select-apk-file');
            if (filePath) {
                this.setApkFile(filePath);
            }
        } catch (error) {
            this.showError('选择APK文件失败: ' + error.message);
        }
    }

    async browseChannelFile() {
        try {
            const filePath = await ipcRenderer.invoke('select-channel-file');
            if (filePath) {
                this.setChannelFile(filePath);
            }
        } catch (error) {
            this.showError('选择渠道文件失败: ' + error.message);
        }
    }

    async browseOutputDirectory() {
        try {
            const dirPath = await ipcRenderer.invoke('select-output-directory');
            if (dirPath) {
                this.setOutputDirectory(dirPath);
            }
        } catch (error) {
            this.showError('选择输出目录失败: ' + error.message);
        }
    }

    setApkFile(filePath) {
        this.apkFile = filePath;
        const fileName = filePath.split('/').pop();
        this.apkName.textContent = fileName;
        this.apkDropZone.style.display = 'none';
        this.apkInfo.style.display = 'flex';
        this.updatePackButton();
    }

    removeApkFile() {
        this.apkFile = null;
        this.apkDropZone.style.display = 'block';
        this.apkInfo.style.display = 'none';
        this.updatePackButton();
    }

    async setChannelFile(filePath) {
        try {
            this.channelFile = filePath;
            const fileName = filePath.split('/').pop();
            this.channelName.textContent = fileName;
            this.channelDropZone.style.display = 'none';
            this.channelInfo.style.display = 'flex';

            // 读取并预览渠道内容
            const content = await ipcRenderer.invoke('read-channel-file', filePath);
            this.parseChannels(content);
            this.updatePackButton();
        } catch (error) {
            this.showError('读取渠道文件失败: ' + error.message);
        }
    }

    removeChannelFile() {
        this.channelFile = null;
        this.channels = [];
        this.channelDropZone.style.display = 'block';
        this.channelInfo.style.display = 'none';
        this.channelPreview.style.display = 'none';
        this.updatePackButton();
    }

    parseChannels(content) {
        // 解析渠道文件内容
        const lines = content.split('\n').filter(line => line.trim());
        this.channels = [];
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                // 支持多种格式：channel_name 或 channel_name=extra_info
                const channelName = trimmedLine.split('=')[0].trim();
                if (channelName) {
                    this.channels.push(channelName);
                }
            }
        }

        // 显示渠道预览
        if (this.channels.length > 0) {
            this.channelList.textContent = `共 ${this.channels.length} 个渠道: ${this.channels.slice(0, 10).join(', ')}${this.channels.length > 10 ? '...' : ''}`;
            this.channelPreview.style.display = 'block';
        } else {
            this.channelPreview.style.display = 'none';
            this.showError('渠道文件中没有找到有效的渠道配置');
        }
    }

    setOutputDirectory(dirPath) {
        this.outputDir = dirPath;
        this.outputPath.value = dirPath;
        this.updatePackButton();
    }

    updatePackButton() {
        const canPack = this.apkFile && this.channelFile && this.outputDir && this.channels.length > 0;
        this.packBtn.disabled = !canPack;
    }

    async startPacking() {
        if (!this.apkFile || !this.channelFile || !this.outputDir) {
            this.showError('请确保已选择APK文件、渠道配置文件和输出目录');
            return;
        }

        try {
            this.packBtn.disabled = true;
            this.showProgress(true);
            this.showLog(true);
            this.clearLog();
            
            this.updateProgress(0, '开始打包...');
            this.appendLog('开始多渠道打包...\n', 'info');
            this.appendLog(`APK文件: ${this.apkFile}\n`, 'info');
            this.appendLog(`渠道文件: ${this.channelFile}\n`, 'info');
            this.appendLog(`输出目录: ${this.outputDir}\n`, 'info');
            this.appendLog(`渠道数量: ${this.channels.length}\n`, 'info');
            this.appendLog('\n正在执行Walle命令...\n', 'info');

            this.updateProgress(20, '执行Walle命令...');

            const result = await ipcRenderer.invoke('execute-walle', {
                apkPath: this.apkFile,
                channelFile: this.channelFile,
                outputDir: this.outputDir
            });

            if (result.success) {
                this.updateProgress(100, '打包完成!');
                this.appendLog('\n✅ 多渠道打包完成!\n', 'success');
                this.appendLog(`输出目录: ${this.outputDir}\n`, 'info');
            } else {
                throw new Error(result.error || '打包失败');
            }
            
        } catch (error) {
            this.updateProgress(0, '打包失败');
            this.appendLog(`\n❌ 打包失败: ${error.message}\n`, 'error');
            this.showError('打包失败: ' + error.message);
        } finally {
            this.packBtn.disabled = false;
        }
    }

    showProgress(show) {
        this.progressSection.style.display = show ? 'block' : 'none';
    }

    updateProgress(percent, text) {
        this.progressFill.style.width = percent + '%';
        this.progressText.textContent = text;
    }

    showLog(show) {
        this.logSection.style.display = show ? 'block' : 'none';
    }

    appendLog(text, type = 'output') {
        const logEntry = document.createElement('div');
        logEntry.style.color = this.getLogColor(type);
        logEntry.textContent = text;
        this.logContainer.appendChild(logEntry);
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    getLogColor(type) {
        switch (type) {
            case 'error': return '#e74c3c';
            case 'success': return '#2ecc71';
            case 'info': return '#3498db';
            default: return '#ecf0f1';
        }
    }

    clearLog() {
        this.logContainer.innerHTML = '';
    }

    async checkWalleStatus() {
        try {
            const isInstalled = await ipcRenderer.invoke('check-walle-installed');
            if (isInstalled) {
                this.walleStatus.textContent = '已安装';
                this.walleStatus.className = 'status-value success';
            } else {
                this.walleStatus.textContent = '未安装';
                this.walleStatus.className = 'status-value error';
                this.showError('Walle工具未安装，请先安装Walle CLI工具。\n\n安装方法：\npip install walle-cli');
            }
        } catch (error) {
            this.walleStatus.textContent = '检查失败';
            this.walleStatus.className = 'status-value error';
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorModal.style.display = 'flex';
    }

    hideErrorModal() {
        this.errorModal.style.display = 'none';
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new APKChannelPacker();
});