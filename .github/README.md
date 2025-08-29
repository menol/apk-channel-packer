# GitHub Actions 构建配置

本项目配置了自动化的 GitHub Actions 工作流，用于构建和发布多平台的 APK Channel Packer 应用。

## 工作流说明

### CI 工作流 (ci.yml)
- **触发条件**: 推送到 main/develop 分支或创建 Pull Request
- **功能**: 代码检查、依赖安装验证、运行测试
- **运行环境**: Ubuntu Latest

### 构建和发布工作流 (build.yml)
- **触发条件**: 
  - 推送到 main/develop 分支
  - 创建标签 (v*)
  - Pull Request 到 main 分支
- **功能**: 多平台构建、产物上传、自动发布

## 支持的平台和格式

### Windows
- **格式**: `.exe` (NSIS 安装包), `.zip` (便携版)
- **架构**: x64, ia32

### macOS
- **格式**: `.dmg` (磁盘镜像), `.zip` (便携版)
- **架构**: arm64 (Apple Silicon), x64 (Intel)

### Linux
- **格式**: `.AppImage`, `.deb`, `.rpm`, `.tar.gz`
- **架构**: x64

## 发布流程

1. **开发阶段**: 推送代码到 develop 分支触发 CI 检查和构建
2. **测试阶段**: 创建 Pull Request 到 main 分支进行最终验证
3. **发布阶段**: 创建版本标签 (如 `v1.0.0`) 触发自动发布

### 创建发布版本

```bash
# 创建并推送标签
git tag v1.0.0
git push origin v1.0.0
```

## 构建产物

构建完成后，产物将自动上传到 GitHub Actions 的 Artifacts 中：
- `linux-build`: Linux 平台的所有安装包
- `windows-build`: Windows 平台的所有安装包
- `macos-build`: macOS 平台的所有安装包

当推送标签时，这些产物会自动发布到 GitHub Releases 页面。

## 环境要求

- Node.js 18
- 自动安装项目依赖
- 使用 `npm ci` 确保依赖版本一致性

## 注意事项

1. **macOS 签名**: 当前配置未包含代码签名，发布的 macOS 应用需要用户手动允许运行
2. **Windows 签名**: 当前配置未包含代码签名，Windows 可能会显示安全警告
3. **自动发布**: 只有推送标签时才会触发自动发布到 GitHub Releases
4. **构建时间**: 多平台构建可能需要 10-20 分钟完成