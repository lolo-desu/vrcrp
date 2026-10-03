# 自行签名

Release 提供未签名 IPA。应用内附带 `Communication.entitlements`，源码中的同名文件也可直接交给支持自定义权限的签名工具。

通信通知的联系人头像样式使用 `com.apple.developer.usernotifications.communication`。签名工具及所用描述文件需要支持该权限；仅将 plist 放在应用中不会授予权限。若不能保留该权限，应用仍通过普通通知显示联系人、ID、正文，并附带头像图片。

系统是否隐藏正文由 iOS 的「显示预览」设置决定。应用被系统终止后无法保证持续接收消息。
