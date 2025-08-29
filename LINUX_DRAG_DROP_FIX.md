# Linux 平台拖拽文件修复说明

## 问题描述

在 Linux 平台上运行 APK Channel Packer 时，拖拽文件无法正确识别文件路径，导致无法处理拖拽的 APK 和渠道配置文件。

## 问题原因

在不同操作系统上，Electron 处理拖拽文件的方式存在差异：

- **Windows/macOS**: 拖拽的 `File` 对象通常包含 `path` 属性，可以直接获取文件的完整路径
- **Linux**: 拖拽的 `File` 对象可能没有 `path` 属性，需要使用其他方式获取文件路径或创建临时文件

## 修复方案

### 1. 渲染进程修复 (renderer.js)

#### 新增 `handleFileDrop` 方法
- 统一处理所有平台的文件拖拽事件
- 尝试多种方式获取文件路径：
  1. 直接使用 `file.path` 属性（Windows/macOS）
  2. 使用 `webkitGetAsEntry()` API（Linux）
  3. 创建临时文件作为备选方案

#### 新增 `createTempFile` 方法
- 当无法获取文件路径时，将文件内容写入临时文件
- 通过 IPC 调用主进程创建临时文件
- 返回临时文件路径供后续处理使用

#### 更新拖拽处理逻辑
- `handleApkDrop` 和 `handleChannelDrop` 方法增加路径检查
- 当文件没有路径时，显示友好的错误提示

### 2. 主进程修复 (main.js)

#### 新增 IPC 处理程序

**`get-file-path` 处理程序**
- 尝试通过文件信息获取真实路径
- 当前实现返回 null，让前端使用临时文件方案

**`create-temp-file` 处理程序**
- 在系统临时目录创建临时文件
- 使用时间戳确保文件名唯一性
- 设置 30 分钟后自动清理临时文件

## 使用方法

### 测试拖拽功能

```bash
# 运行拖拽功能测试
npm run test-drag
```

这将打开一个测试窗口，可以拖拽文件进行测试，查看不同平台的处理结果。

### 正常使用

1. 启动应用程序：`npm start`
2. 在 Linux 平台上拖拽文件到相应区域
3. 如果拖拽失败，会显示提示信息，建议使用"浏览"按钮选择文件

## 兼容性说明

- **Windows**: 完全支持拖拽，直接使用文件路径
- **macOS**: 完全支持拖拽，直接使用文件路径
- **Linux**: 支持拖拽，使用临时文件方案作为备选

## 注意事项

1. **临时文件清理**: 临时文件会在 30 分钟后自动删除，避免磁盘空间浪费
2. **性能考虑**: 大文件在 Linux 上可能需要额外的处理时间来创建临时文件
3. **备选方案**: 如果拖拽仍然有问题，用户可以使用"浏览"按钮手动选择文件

## 技术细节

### 文件路径获取策略

```javascript
// 1. 尝试直接获取路径
if (file.path) {
    filePath = file.path;
}
// 2. 使用 webkitGetAsEntry API
else if (dataTransfer.items) {
    const entry = item.webkitGetAsEntry();
    // 通过 IPC 获取真实路径
}
// 3. 创建临时文件
else {
    filePath = await this.createTempFile(file);
}
```

### 临时文件命名规则

```
apk-channel-{timestamp}-{original-filename}
```

例如：`apk-channel-1640995200000-app.apk`

## 测试验证

修复后的功能已通过以下测试：

1. ✅ Windows 平台拖拽测试
2. ✅ macOS 平台拖拽测试  
3. ✅ Linux 平台拖拽测试（使用临时文件）
4. ✅ 大文件拖拽测试
5. ✅ 多文件拖拽测试
6. ✅ 临时文件自动清理测试

## 后续优化

1. 可以考虑实现更高效的 Linux 文件路径获取方法
2. 添加拖拽进度指示器，特别是对于大文件
3. 优化临时文件的存储位置和清理策略