# vrcrp

[erp.sex](https://erp.sex/) 的非官方 iOS 客户端，保留原网站的设计风格与使用习惯。

相比网页版，增加了：

- iOS 风格的页面导航和手势返回
- 原生底栏与更流畅的界面切换
- 更适合手机的键盘和聊天体验
- 配对消息系统通知与未读提醒
- 更及时的消息同步和常用页面缓存
- 应用内外链浏览与文字选择复制

从 [Releases](https://github.com/lolo-desu/vrcrp/releases) 下载未签名 IPA，自行签名安装。支持 iOS 15 及以上；应用关闭后不保证收到消息通知。

## 构建

在 macOS 安装完整 Xcode，克隆仓库后在项目目录运行：

```sh
bash scripts/build-unsigned.sh
```

产物为 `build/ERPStable-unsigned.ipa`。没有 Mac 也可 Fork 仓库，在 Actions 手动运行 **Build vrcrp website iOS IPA**，从 `vrcrp-web-unsigned` 构建产物中下载 IPA。

## 贡献

欢迎提交 Issue 或 PR。反馈问题请附上 iOS／应用版本和复现步骤；提交代码请简述改动，并运行相关检查。

本项目采用 [MIT 许可证](LICENSE)，与网站运营方无隶属关系。
