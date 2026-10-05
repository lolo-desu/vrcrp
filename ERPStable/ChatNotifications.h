#import <WebKit/WebKit.h>
NS_ASSUME_NONNULL_BEGIN
@interface ChatNotifications : NSObject
@property(nonatomic, copy) NSString *activePath;
@property(nonatomic, readonly) BOOL authenticated;
@property(nonatomic) BOOL backgroundListeningEnabled;
@property(nonatomic,copy,nullable) void (^onBackgroundStateChanged)(NSDictionary *state);
- (NSDictionary *)backgroundState;
- (void)prepareBackgroundListening;
- (instancetype)initWithCookieStore:(WKHTTPCookieStore *)store;
- (void)handleEvent:(NSDictionary *)event;
- (BOOL)shouldPresentNotificationInfo:(NSDictionary *)info;
- (void)beginBackgroundSync;
- (void)endBackgroundSync;
#if ERP_TESTING
- (NSDictionary *)verifyNotificationContent;
- (NSDictionary *)verifyBackgroundState;
#endif
@end
NS_ASSUME_NONNULL_END
