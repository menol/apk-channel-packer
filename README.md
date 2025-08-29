# APK Channel Packer

一个基于 Electron 的 APK 多渠道打包工具，兼容美团 Walle 渠道包方案。

## 功能特性

- 🚀 **高效打包**：基于 APK Signature Block 的快速渠道包生成
- 🔧 **图形界面**：简洁易用的 Electron 桌面应用
- 📦 **批量处理**：支持单个和批量渠道包生成
- ✅ **完全兼容**：与美团 Walle 官方工具完全兼容
- 🔒 **签名保护**：不破坏 APK 原有签名信息
- 📱 **跨平台**：支持 Windows、macOS、Linux
- 🖱️ **拖拽支持**：支持文件拖拽操作，Linux 平台已优化兼容性

## 技术原理

本工具基于 Android APK Signature Scheme v2/v3 的 APK Signature Block 机制，将渠道信息写入到 APK 文件的签名块中，而不是传统的 META-INF 目录。这种方式具有以下优势：

- **不影响签名**：渠道信息写入不会破坏 APK 的数字签名
- **高效快速**：无需重新签名，打包速度极快
- **兼容性好**：与 Google Play 和各大应用商店兼容

## 安装使用

### 下载安装

1. 从 [Releases](https://github.com/your-username/apk-channel-packer/releases) 页面下载对应平台的安装包
2. 解压并运行应用程序

### 开发环境

```bash
# 克隆项目
git clone https://github.com/your-username/apk-channel-packer.git
cd apk-channel-packer

# 安装依赖
npm install

# 启动开发服务器
npm start

# 构建应用
npm run build
```

## 使用说明

### 图形界面使用

1. **选择 APK 文件**：
   - 点击"选择 APK 文件"按钮，选择需要打包的原始 APK
   - 或直接拖拽 APK 文件到指定区域（支持所有平台）
2. **选择渠道文件**：点击"选择渠道文件"按钮，选择包含渠道列表的文本文件
3. **设置输出目录**：选择渠道包的输出目录
4. **开始打包**：点击"开始打包"按钮，等待打包完成

### 渠道文件格式

渠道文件为纯文本格式，每行一个渠道名称：

```
huawei
xiaomi
vivo
oppo
baidu
360
```

### 命令行使用

```javascript
const WalleCore = require('./src/walle-core');

// 单个渠道打包
WalleCore.generateChannelApk(
  'input.apk',
  'output_huawei.apk',
  'huawei',
  { version: '1.0.0' }
);

// 批量渠道打包
WalleCore.generateMultiChannelApks(
  'input.apk',
  ['huawei', 'xiaomi', 'vivo'],
  './output/',
  { version: '1.0.0' }
);
```

## 项目结构

```
apk-channel-packer/
├── src/
│   ├── main.js                 # Electron 主进程
│   ├── walle-core.js          # Walle 核心功能
│   ├── apk-signature-block.js # APK 签名块处理
│   └── renderer/              # 渲染进程（UI）
│       ├── index.html
│       ├── renderer.js
│       └── styles.css
├── test/                      # 测试文件
├── dist/                      # 构建输出
├── package.json
└── README.md
```

## API 文档

### WalleCore

#### `generateChannelApk(inputApk, outputApk, channel, extraInfo)`

生成单个渠道包。

**参数：**
- `inputApk` (string): 输入 APK 文件路径
- `outputApk` (string): 输出 APK 文件路径
- `channel` (string): 渠道名称
- `extraInfo` (object): 额外信息，如版本号等

#### `generateMultiChannelApks(inputApk, channels, outputDir, extraInfo)`

批量生成多个渠道包。

**参数：**
- `inputApk` (string): 输入 APK 文件路径
- `channels` (array): 渠道名称数组
- `outputDir` (string): 输出目录路径
- `extraInfo` (object): 额外信息

#### `getChannelInfo(apkPath)`

读取 APK 文件中的渠道信息。

**参数：**
- `apkPath` (string): APK 文件路径

**返回：**
- `object`: 包含渠道信息的对象

## 兼容性

- **Android 版本**：支持 Android 7.0 (API 24) 及以上版本
- **签名方案**：支持 APK Signature Scheme v2/v3
- **Walle 兼容**：与美团 Walle 1.1.7+ 完全兼容

## 开发贡献

欢迎提交 Issue 和 Pull Request！

### 开发环境要求

- Node.js 16+
- npm 或 yarn

### 提交规范

请遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

## 致谢

- [美团 Walle](https://github.com/Meituan-Dianping/walle) - 渠道包方案的灵感来源
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架

## 故障排除

### Linux 平台拖拽文件问题

**问题**：在 Linux 系统上拖拽文件无法识别

**解决方案**：
1. 应用已内置 Linux 拖拽兼容性修复
2. 如果拖拽仍有问题，请使用"浏览"按钮手动选择文件
3. 运行测试：`npm run test-drag` 验证拖拽功能

**技术说明**：Linux 平台会自动创建临时文件来处理拖拽，详见 [LINUX_DRAG_DROP_FIX.md](LINUX_DRAG_DROP_FIX.md)

### 其他常见问题

**APK 签名验证失败**
- 确保使用的是已签名的 APK 文件
- 检查 APK 文件是否损坏

**渠道包安装失败**
- 验证原始 APK 可以正常安装
- 检查设备是否允许安装未知来源应用

## 更新日志

### v1.0.1

- 🐛 修复 Linux 平台拖拽文件无法识别的问题
- 🔧 优化跨平台文件拖拽兼容性
- 📝 添加拖拽功能测试工具
- 📚 完善故障排除文档

### v1.0.0

- ✨ 初始版本发布
- 🚀 支持基于 APK Signature Block 的渠道包生成
- 🔧 提供图形界面和命令行接口
- ✅ 与 Walle 官方工具完全兼容

---

如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！