#import "ChatNotifications.h"
#import "BackgroundAudioLease.h"
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <ImageIO/ImageIO.h>
#import <Intents/Intents.h>

static BOOL VRValidID(id value) {
    return [value isKindOfClass:NSString.class] && [value length]>0 && [value length]<=120 &&
        [value rangeOfString:@"^[A-Za-z0-9_-]+$" options:NSRegularExpressionSearch].location!=NSNotFound;
}
static NSString *VRText(id value, NSUInteger limit, NSString *fallback) {
    if (![value isKindOfClass:NSString.class] || ![value length]) return fallback;
    NSString *text=value;
    if (text.length>limit) text=[text substringWithRange:[text rangeOfComposedCharacterSequencesForRange:NSMakeRange(0,limit)]];
    return text;
}
static NSString *VRFingerprint(NSDictionary *last) {
    if(![last isKindOfClass:NSDictionary.class])return @"";
    NSArray *parts=@[VRText(last[@"createdAt"],80,@""),VRText(last[@"senderId"],120,@""),VRText(last[@"type"],80,@""),VRText(last[@"text"],100000,@"")];
    return [[NSString alloc] initWithData:[NSJSONSerialization dataWithJSONObject:parts options:NSJSONWritingWithoutEscapingSlashes error:nil] encoding:NSUTF8StringEncoding]?:@"";
}
static NSDate *VRMessageDate(id value) {
    if(![value isKindOfClass:NSString.class]||[value length]>80)return nil;
    NSISO8601DateFormatter *formatter=[NSISO8601DateFormatter new];
    formatter.formatOptions=NSISO8601DateFormatWithInternetDateTime|NSISO8601DateFormatWithFractionalSeconds;
    NSDate *date=[formatter dateFromString:value];
    if(!date){formatter.formatOptions=NSISO8601DateFormatWithInternetDateTime;date=[formatter dateFromString:value];}
    return date;
}
@interface ChatNotifications ()
@property(nonatomic, strong) WKHTTPCookieStore *store;
@property(nonatomic, copy) NSString *userID;
@property(nonatomic, copy) NSDictionary *headers;
@property(nonatomic, strong) NSMutableDictionary *latest;
@property(nonatomic, strong) NSMutableOrderedSet *seen;
@property(nonatomic,strong) NSMutableOrderedSet *readIDs;
@property(nonatomic,strong) NSMutableDictionary *readThrough;
@property(nonatomic,strong) NSMutableDictionary *notificationEvents;
@property(nonatomic,strong) NSMutableOrderedSet *notificationOrder;
@property(nonatomic, strong) NSURLSession *session;
@property(nonatomic, strong) NSDate *started;
@property(nonatomic, strong) NSTimer *backgroundTimer;
@property(nonatomic) UIBackgroundTaskIdentifier backgroundTask;
@property(nonatomic) NSInteger unread;
@property(nonatomic) NSUInteger generation;
@property(nonatomic) NSTimeInterval detailedAt;
@property(nonatomic) BOOL requesting;
@property(nonatomic, strong) NSCache<NSString *, NSData *> *avatars;
@property(nonatomic, strong) NSMutableDictionary<NSString *, NSMutableArray *> *avatarWaiters;
@property(nonatomic,strong) BackgroundAudioLease *audioLease;
@property(nonatomic) BOOL backgroundRequested;
@property(nonatomic) BOOL sessionExpired;
@property(nonatomic) NSUInteger backgroundEpoch;
@property(nonatomic) NSUInteger requestCycle;
@property(nonatomic,strong) NSArray<NSHTTPCookie *> *ownedCookies;
@property(nonatomic,strong) NSDate *lastBackgroundSuccess;
@property(nonatomic) NSTimeInterval nextBackgroundPoll;
@property(nonatomic) NSUInteger backgroundFailures;
#if ERP_TESTING
@property(nonatomic) NSUInteger backgroundPolls;
@property(nonatomic,strong) NSMutableArray *backgroundDelivered;
#endif
@end
@implementation ChatNotifications
- (instancetype)initWithCookieStore:(WKHTTPCookieStore *)store {
    if (!(self=[super init])) return nil;
    self.store=store; self.userID=@""; self.activePath=@""; self.headers=@{};
    self.latest=[NSMutableDictionary new]; self.seen=[NSMutableOrderedSet new];
    self.readIDs=[NSMutableOrderedSet new];self.readThrough=[NSMutableDictionary new];
    self.notificationEvents=[NSMutableDictionary new];self.notificationOrder=[NSMutableOrderedSet new];
    self.avatars=[NSCache new];self.avatars.countLimit=32;self.avatars.totalCostLimit=4*1024*1024;
    self.avatarWaiters=[NSMutableDictionary new];
    self.backgroundTask=UIBackgroundTaskInvalid; self.unread=-1; self.started=NSDate.date;
    NSURLSessionConfiguration *config=NSURLSessionConfiguration.ephemeralSessionConfiguration;
    config.timeoutIntervalForRequest=12; config.timeoutIntervalForResource=18;
    config.HTTPShouldSetCookies=NO; self.session=[NSURLSession sessionWithConfiguration:config];
    self.audioLease=[BackgroundAudioLease new];self.ownedCookies=@[];
    _backgroundListeningEnabled=[NSUserDefaults.standardUserDefaults boolForKey:@"VRBackgroundListening"];
    __weak ChatNotifications *weakSelf=self;
    self.audioLease.onChange=^{
        ChatNotifications *owner=weakSelf;if(!owner)return;
        if(owner.backgroundRequested&&owner.backgroundListeningEnabled&&owner.audioLease.active&&!owner.backgroundTimer)[owner startBackgroundTimer];
        if(owner.backgroundRequested&&![owner backgroundSyncActive]){[owner.backgroundTimer invalidate];owner.backgroundTimer=nil;owner.backgroundEpoch++;owner.requestCycle++;owner.requesting=NO;}
        [owner publishBackgroundState];
    };
#if ERP_TESTING
    self.backgroundDelivered=[NSMutableArray new];
#endif
    return self;
}
- (void)dealloc { [self.backgroundTimer invalidate];[self.audioLease stop];[self.session invalidateAndCancel]; }
- (BOOL)authenticated { return self.userID.length>0; }
- (BOOL)backgroundSyncActive { return self.backgroundRequested&&!self.sessionExpired&&self.authenticated&&(self.backgroundTask!=UIBackgroundTaskInvalid||self.backgroundListeningEnabled&&self.audioLease.active); }
- (NSDictionary *)backgroundState {
    NSString *state=!self.backgroundListeningEnabled?@"off":self.sessionExpired?@"expired":!self.authenticated?@"login":!self.backgroundRequested?@"foreground":self.audioLease.active?@"listening":@"paused";
    NSString *description=[@{@"off":@"后台监听已关闭",@"expired":@"登录已过期，打开 App 登录后恢复",@"login":@"登录后可启用后台监听",@"foreground":@"前台同步中，离开 App 后尝试后台监听",@"listening":@"后台监听中",@"paused":self.audioLease.reason.length?self.audioLease.reason:@"后台监听已暂停，打开 App 可恢复"} objectForKey:state];
    return @{@"enabled":@(self.backgroundListeningEnabled),@"state":state,@"description":description,@"lastSync":self.lastBackgroundSuccess?@([self.lastBackgroundSuccess timeIntervalSince1970]*1000):NSNull.null,@"networkRetry":@(self.backgroundFailures>0)};
}
- (void)publishBackgroundState { if(self.onBackgroundStateChanged)self.onBackgroundStateChanged([self backgroundState]); }
- (void)setBackgroundListeningEnabled:(BOOL)enabled {
    if(_backgroundListeningEnabled==enabled){[self publishBackgroundState];return;}
    _backgroundListeningEnabled=enabled;[NSUserDefaults.standardUserDefaults setBool:enabled forKey:@"VRBackgroundListening"];
    if(enabled){if(self.backgroundRequested&&self.authenticated&&!self.sessionExpired){[self.audioLease start];[self startBackgroundTimer];}}
    else{[self.audioLease stop];if(self.backgroundRequested){[self endBackgroundSync];[self beginBackgroundSync];}}
    [self publishBackgroundState];
}
- (void)refreshOwnedCookies {
    NSUInteger generation=self.generation;
    [self.store getAllCookies:^(NSArray<NSHTTPCookie *> *cookies){
        dispatch_async(dispatch_get_main_queue(),^{if(generation!=self.generation)return;NSMutableArray *owned=[NSMutableArray new];for(NSHTTPCookie *cookie in cookies)if([cookie.domain isEqual:@"erp.sex"]||[cookie.domain isEqual:@".erp.sex"])[owned addObject:cookie];self.ownedCookies=owned;});
    }];
}
- (void)prepareBackgroundListening {
    [self refreshOwnedCookies];if(self.backgroundListeningEnabled&&self.authenticated&&!self.sessionExpired)[self.audioLease start];
}
- (NSURL *)APIURL:(NSString *)path {
#if ERP_TESTING
    if([NSProcessInfo.processInfo.arguments containsObject:@"--verify-background"])return [NSURL URLWithString:[@"http://127.0.0.1:18765" stringByAppendingString:path]];
#endif
    return [NSURL URLWithString:[@"https://erp.sex" stringByAppendingString:path]];
}
- (void)remember:(NSString *)messageID {
    [self.seen addObject:messageID]; if(self.seen.count>512) [self.seen removeObjectAtIndex:0];
}
- (BOOL)isReadEvent:(NSDictionary *)event {
    NSString *messageID=event[@"messageId"],*matchID=event[@"matchId"];
    if(!VRValidID(messageID)||!VRValidID(matchID))return NO;
    if([self.readIDs containsObject:messageID])return YES;
    NSDictionary *read=self.readThrough[matchID];if(!read)return NO;
    if([messageID isEqual:read[@"lastMessageId"]])return YES;
    NSDate *created=VRMessageDate(event[@"createdAt"]),*through=VRMessageDate(read[@"createdAt"]);
    return created&&through&&[created compare:through]==NSOrderedAscending;
}
- (BOOL)canSendEvent:(NSDictionary *)event {
    NSString *messageID=event[@"messageId"],*path=[@"/matches/" stringByAppendingString:event[@"matchId"]];
    return self.authenticated&&self.notificationEvents[messageID]==event&&![self isReadEvent:event]&&
        !(UIApplication.sharedApplication.applicationState==UIApplicationStateActive&&[self.activePath isEqual:path]);
}
- (void)removeNotificationIDs:(NSArray *)identifiers {
    if(!identifiers.count)return;
    [UNUserNotificationCenter.currentNotificationCenter removePendingNotificationRequestsWithIdentifiers:identifiers];
    [UNUserNotificationCenter.currentNotificationCenter removeDeliveredNotificationsWithIdentifiers:identifiers];
}
- (void)cancelEventsMatching:(BOOL (^)(NSDictionary *))predicate {
    NSMutableArray *ids=[NSMutableArray new];
    for(NSString *messageID in [self.notificationEvents.allKeys copy])if(predicate(self.notificationEvents[messageID])){
        [ids addObject:[@"vrcrp-message-" stringByAppendingString:messageID]];
        [self.notificationEvents removeObjectForKey:messageID];[self.notificationOrder removeObject:messageID];
    }
    [self removeNotificationIDs:ids];
}
- (void)setActivePath:(NSString *)path {
    BOOL entering=![_activePath isEqual:path];_activePath=[path copy];
    if(entering&&UIApplication.sharedApplication.applicationState==UIApplicationStateActive&&
        [path rangeOfString:@"^/matches/[A-Za-z0-9_-]{1,120}$" options:NSRegularExpressionSearch].location!=NSNotFound){
        NSString *thread=[path substringFromIndex:9];
        [self cancelEventsMatching:^BOOL(NSDictionary *event){return [event[@"matchId"] isEqual:thread];}];
        [self removeNotificationIDs:@[@"vrcrp-unread"]];
    }
}
- (void)acknowledgeRead:(NSDictionary *)event {
    NSString *thread=event[@"matchId"],*messageID=event[@"lastMessageId"];
    if(![event[@"userId"] isEqual:self.userID]||!VRValidID(thread)||!VRValidID(messageID))return;
    [self.readIDs addObject:messageID];[self remember:messageID];
    if([event[@"messageIds"] isKindOfClass:NSArray.class]&&[event[@"messageIds"] count]<=512)
        for(id value in event[@"messageIds"])if(VRValidID(value)){[self.readIDs addObject:value];[self remember:value];}
    while(self.readIDs.count>2048)[self.readIDs removeObjectAtIndex:0];
    NSDictionary *prior=self.readThrough[thread];NSDate *before=VRMessageDate(prior[@"createdAt"]),*next=VRMessageDate(event[@"createdAt"]);
    if(!prior||!before||next&&[next compare:before]!=NSOrderedAscending)
        self.readThrough[thread]=@{@"lastMessageId":messageID,@"createdAt":VRText(event[@"createdAt"],80,@"")};
    if(self.readThrough.count>256)[self.readThrough removeObjectForKey:self.readThrough.allKeys.firstObject];
    [self cancelEventsMatching:^BOOL(NSDictionary *notice){return [notice[@"matchId"] isEqual:thread]&&[self isReadEvent:notice];}];
    [self removeNotificationIDs:@[@"vrcrp-unread"]];
    NSUInteger generation=self.generation;
    void (^removeRead)(NSArray *)=^(NSArray *requests){
        dispatch_async(dispatch_get_main_queue(),^{
            if(generation!=self.generation)return;
            NSMutableArray *ids=[NSMutableArray new];
            for(UNNotificationRequest *request in requests){
                NSDictionary *info=request.content.userInfo;
                BOOL legacy=!VRValidID(info[@"messageId"])&&[info[@"path"] isEqual:[@"/matches/" stringByAppendingString:thread]];
                if(legacy||[info[@"owner"] isEqual:self.userID]&&[self isReadEvent:info])[ids addObject:request.identifier];
            }
            [self removeNotificationIDs:ids];
        });
    };
    [UNUserNotificationCenter.currentNotificationCenter getPendingNotificationRequestsWithCompletionHandler:removeRead];
    [UNUserNotificationCenter.currentNotificationCenter getDeliveredNotificationsWithCompletionHandler:^(NSArray<UNNotification *> *notifications){
        removeRead([notifications valueForKey:@"request"]);
    }];
}
- (BOOL)shouldPresentNotificationInfo:(NSDictionary *)info {
    if(![info[@"owner"] isEqual:self.userID]||!VRValidID(info[@"messageId"])||!VRValidID(info[@"matchId"]))return NO;
    NSDictionary *event=self.notificationEvents[info[@"messageId"]];
    return event&&[self canSendEvent:event];
}
- (void)updateBadge:(NSInteger)count {
    if(count<0||count>100000)return; self.unread=count;
    [UNUserNotificationCenter.currentNotificationCenter getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings){
        if(settings.authorizationStatus==UNAuthorizationStatusAuthorized||settings.authorizationStatus==UNAuthorizationStatusProvisional)
            dispatch_async(dispatch_get_main_queue(),^{if(self.unread==count)UIApplication.sharedApplication.applicationIconBadgeNumber=count;});
    }];
}
- (void)deliver:(NSDictionary *)event {
    NSString *messageID=event[@"messageId"], *matchID=event[@"matchId"];
    if(!self.authenticated||!VRValidID(messageID)||!VRValidID(matchID)||[self.seen containsObject:messageID])return;
    [self remember:messageID]; self.detailedAt=NSDate.timeIntervalSinceReferenceDate;
    if([event[@"senderId"] isEqual:self.userID]||[self isReadEvent:event])return;
    NSString *path=[@"/matches/" stringByAppendingString:matchID];
    if(UIApplication.sharedApplication.applicationState==UIApplicationStateActive&&[self.activePath isEqual:path])return;
    self.notificationEvents[messageID]=event;[self.notificationOrder addObject:messageID];
    while(self.notificationOrder.count>512){NSString *old=self.notificationOrder.firstObject;[self.notificationEvents removeObjectForKey:old];[self.notificationOrder removeObjectAtIndex:0];}
#if ERP_TESTING
    if([NSProcessInfo.processInfo.arguments containsObject:@"--verify-background"])[self.backgroundDelivered addObject:@{@"id":messageID,@"body":event[@"body"]?:@"",@"background":@(UIApplication.sharedApplication.applicationState==UIApplicationStateBackground)}];
#endif
    [UNUserNotificationCenter.currentNotificationCenter removePendingNotificationRequestsWithIdentifiers:@[@"vrcrp-unread"]];
    [UNUserNotificationCenter.currentNotificationCenter removeDeliveredNotificationsWithIdentifiers:@[@"vrcrp-unread"]];
    [self notifyMessage:event path:path identifier:[@"vrcrp-message-" stringByAppendingString:messageID] thread:matchID];
}
- (NSData *)avatarData:(NSData *)data {
    if(!data.length||data.length>2*1024*1024)return nil;
    CGImageSourceRef source=CGImageSourceCreateWithData((__bridge CFDataRef)data,NULL);if(!source)return nil;
    NSDictionary *options=@{(__bridge NSString *)kCGImageSourceCreateThumbnailFromImageAlways:@YES,(__bridge NSString *)kCGImageSourceCreateThumbnailWithTransform:@YES,(__bridge NSString *)kCGImageSourceThumbnailMaxPixelSize:@256};
    CGImageRef thumbnail=CGImageSourceCreateThumbnailAtIndex(source,0,(__bridge CFDictionaryRef)options);CFRelease(source);if(!thumbnail)return nil;
    UIImage *image=[UIImage imageWithCGImage:thumbnail];CGImageRelease(thumbnail);
    UIGraphicsImageRendererFormat *format=[UIGraphicsImageRendererFormat new];format.scale=1;
    UIImage *small=[[[UIGraphicsImageRenderer alloc] initWithSize:CGSizeMake(144,144) format:format] imageWithActions:^(UIGraphicsImageRendererContext *context){
        [[UIBezierPath bezierPathWithOvalInRect:CGRectMake(0,0,144,144)] addClip];
        CGFloat scale=MAX(144/image.size.width,144/image.size.height);CGSize size=CGSizeMake(image.size.width*scale,image.size.height*scale);
        [image drawInRect:CGRectMake((144-size.width)/2,(144-size.height)/2,size.width,size.height)];
    }];return UIImagePNGRepresentation(small);
}
- (void)loadAvatar:(NSString *)value completion:(void (^)(NSData *))completion {
    NSURL *url=[value isKindOfClass:NSString.class]&&value.length<4096?[NSURL URLWithString:value]:nil;
    if(![url.scheme.lowercaseString isEqual:@"https"]||!url.host.length||url.user.length||url.password.length){completion(nil);return;}
    NSData *cached=[self.avatars objectForKey:value];if(cached){completion(cached);return;}
    if(self.avatarWaiters[value]){[self.avatarWaiters[value] addObject:[completion copy]];return;}
    self.avatarWaiters[value]=[NSMutableArray arrayWithObject:[completion copy]];NSUInteger generation=self.generation;
    NSMutableURLRequest *request=[NSMutableURLRequest requestWithURL:url];request.timeoutInterval=3;request.HTTPShouldHandleCookies=NO;
    [[self.session dataTaskWithRequest:request completionHandler:^(NSData *data,NSURLResponse *response,NSError *error){
        dispatch_async(dispatch_get_main_queue(),^{
            if(generation!=self.generation)return;
            NSData *avatar=!error&&[(NSHTTPURLResponse *)response statusCode]==200?[self avatarData:data]:nil;
            NSArray *waiters=[self.avatarWaiters[value] copy];[self.avatarWaiters removeObjectForKey:value];
            if(avatar)[self.avatars setObject:avatar forKey:value cost:avatar.length];
            for(void (^callback)(NSData *) in waiters)callback(avatar);
        });
    }] resume];
}
- (NSData *)initialAvatar:(NSString *)title {
    UIGraphicsImageRendererFormat *format=[UIGraphicsImageRendererFormat new];format.scale=1;
    UIImage *image=[[[UIGraphicsImageRenderer alloc] initWithSize:CGSizeMake(144,144) format:format] imageWithActions:^(UIGraphicsImageRendererContext *context){
        [[UIColor colorWithRed:.22 green:.24 blue:.3 alpha:1] setFill];[[UIBezierPath bezierPathWithOvalInRect:CGRectMake(0,0,144,144)] fill];
        NSString *initial=title.length?[title substringWithRange:[title rangeOfComposedCharacterSequenceAtIndex:0]]:@"聊";
        NSDictionary *attributes=@{NSFontAttributeName:[UIFont systemFontOfSize:65 weight:UIFontWeightSemibold],NSForegroundColorAttributeName:UIColor.whiteColor};
        CGSize size=[initial sizeWithAttributes:attributes];[initial drawAtPoint:CGPointMake((144-size.width)/2,(144-size.height)/2) withAttributes:attributes];
    }];return UIImagePNGRepresentation(image);
}
- (INSendMessageIntent *)communicationIntent:(NSDictionary *)event path:(NSString *)path avatar:(NSData *)avatar {
    NSString *sender=VRText(event[@"displayId"],120,VRText(event[@"senderId"],120,@"unknown"));
    NSString *name=VRText(event[@"title"],80,@"聊天联系人");
    INImage *image=[INImage imageWithImageData:avatar?:[self initialAvatar:name]];
    INPerson *person=[[INPerson alloc] initWithPersonHandle:[[INPersonHandle alloc] initWithValue:sender type:INPersonHandleTypeUnknown] nameComponents:nil displayName:name image:image contactIdentifier:nil customIdentifier:sender];
    INSendMessageIntent *intent=[[INSendMessageIntent alloc] initWithRecipients:nil outgoingMessageType:INOutgoingMessageTypeOutgoingMessageText content:VRText(event[@"body"],180,@"你有新的聊天消息") speakableGroupName:nil conversationIdentifier:path serviceName:@"vrcrp" sender:person attachments:nil];
    [intent setImage:image forParameterNamed:@"sender"];return intent;
}
- (UNMutableNotificationContent *)messageContent:(NSDictionary *)event path:(NSString *)path thread:(NSString *)thread avatar:(NSData *)avatar {
    UNMutableNotificationContent *content=[UNMutableNotificationContent new];
    content.title=VRText(event[@"title"],80,@"新聊天消息");content.body=VRText(event[@"body"],180,@"你有新的聊天消息");
    content.subtitle=@"";
    content.sound=UNNotificationSound.defaultSound;if(self.unread>=0)content.badge=@(self.unread);
    content.threadIdentifier=thread;content.categoryIdentifier=@"VRCRP_CHAT";
    content.userInfo=@{@"path":path,@"owner":self.userID,@"messageId":VRText(event[@"messageId"],120,@""),@"matchId":thread,@"createdAt":VRText(event[@"createdAt"],80,@"")};
    NSData *picture=avatar?:[self initialAvatar:content.title];
    // The sender photo belongs to the communication identity on the left.
    // A content attachment would duplicate it as a thumbnail on the right.
    content.attachments=@[];
    INSendMessageIntent *intent=[self communicationIntent:event path:path avatar:picture];
    NSError *error=nil;UNNotificationContent *updated=[content contentByUpdatingWithProvider:intent error:&error];
    if(updated&&!error){
        UNMutableNotificationContent *rich=[updated mutableCopy];
        rich.title=content.title;rich.subtitle=content.subtitle;rich.body=content.body;
        rich.attachments=@[];
        NSMutableDictionary *info=[rich.userInfo mutableCopy]?:[NSMutableDictionary new];[info addEntriesFromDictionary:content.userInfo];rich.userInfo=info;
        rich.categoryIdentifier=content.categoryIdentifier;rich.threadIdentifier=content.threadIdentifier;
        content=rich;
    }
    return content;
}
- (void)notifyMessage:(NSDictionary *)event path:(NSString *)path identifier:(NSString *)identifier thread:(NSString *)thread {
    NSUInteger generation=self.generation;
    [UNUserNotificationCenter.currentNotificationCenter getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings){
        if(settings.authorizationStatus!=UNAuthorizationStatusAuthorized&&settings.authorizationStatus!=UNAuthorizationStatusProvisional)return;
        dispatch_async(dispatch_get_main_queue(),^{
            if(generation!=self.generation||![self canSendEvent:event])return;
            __block BOOL finished=NO;
            void (^deliver)(NSData *)=^(NSData *avatar){
                if(finished||generation!=self.generation||!self.authenticated)return;finished=YES;
                if(![self canSendEvent:event])return;
                INInteraction *interaction=[[INInteraction alloc] initWithIntent:[self communicationIntent:event path:path avatar:avatar] response:nil];interaction.direction=INInteractionDirectionIncoming;
                [interaction donateInteractionWithCompletion:^(NSError *error){}];
                UNMutableNotificationContent *content=[self messageContent:event path:path thread:thread avatar:avatar];
                [UNUserNotificationCenter.currentNotificationCenter addNotificationRequest:[UNNotificationRequest requestWithIdentifier:identifier content:content trigger:nil] withCompletionHandler:^(NSError *error){
                    dispatch_async(dispatch_get_main_queue(),^{if(generation!=self.generation||![self canSendEvent:event])[self removeNotificationIDs:@[identifier]];});
                }];
            };
            [self loadAvatar:event[@"avatarURL"] completion:deliver];
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW,750*NSEC_PER_MSEC),dispatch_get_main_queue(),^{deliver(nil);});
        });
    }];
}
- (void)handleEvent:(NSDictionary *)event {
    NSString *kind=event[@"kind"];
    if([kind isEqual:@"session"]) {
        self.sessionExpired=NO;
        NSString *user=VRValidID(event[@"userId"])?event[@"userId"]:@"";
        if(![self.userID isEqual:user]) {
            [self endBackgroundSync]; self.generation++; self.userID=user; self.started=NSDate.date;
            self.ownedCookies=@[];self.lastBackgroundSuccess=nil;self.backgroundFailures=0;
            [self.latest removeAllObjects]; [self.seen removeAllObjects]; self.unread=-1;
            [self.readIDs removeAllObjects];[self.readThrough removeAllObjects];[self.notificationEvents removeAllObjects];[self.notificationOrder removeAllObjects];
            [UNUserNotificationCenter.currentNotificationCenter removeAllPendingNotificationRequests];
            [UNUserNotificationCenter.currentNotificationCenter removeAllDeliveredNotifications];
            [self.avatars removeAllObjects];[self.avatarWaiters removeAllObjects];
            if(!user.length) { [self updateBadge:0]; [UNUserNotificationCenter.currentNotificationCenter removeAllDeliveredNotifications]; }
        }
        NSMutableDictionary *headers=[NSMutableDictionary dictionaryWithObject:@"application/json" forKey:@"Accept"];
        if([@[@"sfw",@"mixed",@"r18",@"nsfw"] containsObject:event[@"mode"]])headers[@"X-Content-Mode"]=event[@"mode"];
        for(NSString *key in @[@"language",@"userAgent"]) {
            NSString *value=event[key];
            if([value isKindOfClass:NSString.class]&&value.length<600&&[value rangeOfCharacterFromSet:NSCharacterSet.newlineCharacterSet].location==NSNotFound)
                headers[[key isEqual:@"language"]?@"Accept-Language":@"User-Agent"]=value;
        }
        if(self.headers.count&&![self.headers isEqual:headers]){
            self.generation++;[self.latest removeAllObjects];self.started=NSDate.date;
            [self.avatars removeAllObjects];[self.avatarWaiters removeAllObjects];
        }
        self.headers=headers;
        [self refreshOwnedCookies];[self publishBackgroundState];
    } else if([kind isEqual:@"counters"]&&[event[@"unread"] isKindOfClass:NSNumber.class]) [self updateBadge:[event[@"unread"] integerValue]];
    else if([kind isEqual:@"chatRead"]) [self acknowledgeRead:event];
    else if([kind isEqual:@"chatMessage"]) [self deliver:event];
    else if([kind isEqual:@"snapshot"]&&[event[@"items"] isKindOfClass:NSArray.class]) {
        if([event[@"items"] count]>200)return;
        for(id item in event[@"items"]) if([item isKindOfClass:NSDictionary.class]&&VRValidID(item[@"matchId"])) {
            self.latest[item[@"matchId"]]=@{@"messageId":item[@"messageId"]?:@"",@"createdAt":item[@"createdAt"]?:@"",@"fingerprint":item[@"fingerprint"]?:@"",@"unread":item[@"unread"]?:@0}; if(![item[@"baseline"] isEqual:@NO]&&VRValidID(item[@"messageId"])) [self remember:item[@"messageId"]];
        }
        NSUInteger generation=self.generation;
        [UNUserNotificationCenter.currentNotificationCenter getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings){
            if(settings.authorizationStatus!=UNAuthorizationStatusAuthorized&&settings.authorizationStatus!=UNAuthorizationStatusProvisional)return;
            dispatch_async(dispatch_get_main_queue(),^{if(generation!=self.generation||!self.authenticated)return;
                NSArray *items=event[@"items"];for(NSDictionary *item in [items subarrayWithRange:NSMakeRange(0,MIN(8,items.count))])if([item isKindOfClass:NSDictionary.class])[self loadAvatar:item[@"avatarURL"] completion:^(NSData *data){}];
            });
        }];
    }
}
- (void)startBackgroundTimer {
    if(![self backgroundSyncActive]||self.backgroundTimer)return;
    __weak ChatNotifications *weakSelf=self;
    self.backgroundTimer=[NSTimer timerWithTimeInterval:10 repeats:YES block:^(NSTimer *timer){[weakSelf backgroundPoll];}];
    [NSRunLoop.mainRunLoop addTimer:self.backgroundTimer forMode:NSRunLoopCommonModes];
}
- (void)finishBackgroundGrace {
    if(self.backgroundTask!=UIBackgroundTaskInvalid){UIBackgroundTaskIdentifier task=self.backgroundTask;self.backgroundTask=UIBackgroundTaskInvalid;[UIApplication.sharedApplication endBackgroundTask:task];}
    if(![self backgroundSyncActive]){[self.backgroundTimer invalidate];self.backgroundTimer=nil;self.backgroundEpoch++;self.requestCycle++;self.requesting=NO;}
    [self publishBackgroundState];
}
- (void)beginBackgroundSync {
    if(!self.authenticated||self.sessionExpired||self.backgroundRequested)return;
    self.backgroundRequested=YES;self.backgroundEpoch++;self.nextBackgroundPoll=0;
    __weak ChatNotifications *weakSelf=self;
    self.backgroundTask=[UIApplication.sharedApplication beginBackgroundTaskWithName:@"Finish chat synchronization" expirationHandler:^{[weakSelf finishBackgroundGrace];}];
    if(self.backgroundListeningEnabled&&!self.audioLease.active)[self.audioLease start];
    [self backgroundPoll];
    [self startBackgroundTimer];
    UIBackgroundTaskIdentifier task=self.backgroundTask;
    NSUInteger epoch=self.backgroundEpoch;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,22*NSEC_PER_SEC),dispatch_get_main_queue(),^{if(weakSelf.backgroundTask==task&&weakSelf.backgroundEpoch==epoch)[weakSelf finishBackgroundGrace];});
    [self publishBackgroundState];
}
- (void)endBackgroundSync {
    self.backgroundRequested=NO;self.backgroundEpoch++;self.requestCycle++;self.requesting=NO;
    [self.backgroundTimer invalidate]; self.backgroundTimer=nil;
    if(self.backgroundTask!=UIBackgroundTaskInvalid) {
        UIBackgroundTaskIdentifier task=self.backgroundTask; self.backgroundTask=UIBackgroundTaskInvalid;
        [UIApplication.sharedApplication endBackgroundTask:task];
    }
    [self.audioLease stop];[self publishBackgroundState];
}
- (void)deliverBackgroundMessage:(NSDictionary *)last item:(NSDictionary *)item {
    if([last[@"recalled"] isEqual:@YES]||!VRValidID(last[@"id"])||!VRValidID(item[@"id"]))return;
    NSString *body=VRText(last[@"text"],180,@"你有新的聊天消息");
    if([last[@"type"] isEqual:@"image"])body=@"[图片]";
    if([last[@"type"] isEqual:@"voice"])body=@"[语音]";
    if([last[@"type"] isEqual:@"vrc_link"])body=@"[VRChat 链接]";
    NSDictionary *peer=[item[@"user"] isKindOfClass:NSDictionary.class]?item[@"user"]:@{};
    NSDictionary *media=[peer[@"avatar"] isKindOfClass:NSDictionary.class]?peer[@"avatar"]:@{};
    NSString *avatar=[media[@"view"] isEqual:@"show"]?VRText(media[@"thumbUrl"],4096,VRText(media[@"url"],4096,@"")):@"";
    [self deliver:@{@"messageId":last[@"id"],@"matchId":item[@"id"],@"createdAt":VRText(last[@"createdAt"],80,@""),@"senderId":last[@"senderId"]?:@"",@"displayId":VRText(peer[@"id"],120,VRText(last[@"senderId"],120,@"")),@"avatarURL":avatar,@"title":VRText(peer[@"displayName"],80,@"新聊天消息"),@"body":body}];
}
- (void)hydrateBackgroundMatch:(NSDictionary *)item request:(NSURLRequest *)request delta:(NSInteger)delta changed:(BOOL)changed generation:(NSUInteger)generation epoch:(NSUInteger)epoch {
    NSMutableURLRequest *detail=[request mutableCopy];
    detail.URL=[self APIURL:[NSString stringWithFormat:@"/api/v1/matches/%@/messages?limit=20",item[@"id"]]];
    [[self.session dataTaskWithRequest:detail completionHandler:^(NSData *data,NSURLResponse *response,NSError *error){
        id raw=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]:nil;
        dispatch_async(dispatch_get_main_queue(),^{
            if(generation!=self.generation||epoch!=self.backgroundEpoch||![self backgroundSyncActive]||error||[(NSHTTPURLResponse *)response statusCode]!=200||![raw isKindOfClass:NSDictionary.class])return;
            id value=[raw[@"data"] isKindOfClass:NSDictionary.class]?raw[@"data"]:raw;
            if(![value[@"items"] isKindOfClass:NSArray.class])return;
            NSMutableArray *candidates=[NSMutableArray new];
            NSISO8601DateFormatter *formatter=[NSISO8601DateFormatter new];
            for(id message in value[@"items"])if([message isKindOfClass:NSDictionary.class]&&VRValidID(message[@"id"])&&![self.seen containsObject:message[@"id"]]&&![message[@"senderId"] isEqual:self.userID]&&![message[@"recalled"] isEqual:@YES]){
                formatter.formatOptions=NSISO8601DateFormatWithInternetDateTime|NSISO8601DateFormatWithFractionalSeconds;
                NSDate *created=[formatter dateFromString:VRText(message[@"createdAt"],80,@"")];
                if(!created){formatter.formatOptions=NSISO8601DateFormatWithInternetDateTime;created=[formatter dateFromString:VRText(message[@"createdAt"],80,@"")];}
                BOOL fresh=created&&[created compare:self.started]!=NSOrderedAscending;
                if(delta>0||fresh||changed&&[VRFingerprint(message) isEqual:VRFingerprint(item[@"lastMessage"])])[candidates addObject:message];
            }
            [candidates sortUsingComparator:^NSComparisonResult(NSDictionary *a,NSDictionary *b){return [VRText(a[@"createdAt"],80,@"") compare:VRText(b[@"createdAt"],80,@"")];}];
            NSUInteger limit=delta>0?MIN(20,delta):1,start=candidates.count>limit?candidates.count-limit:0;
            for(NSDictionary *message in [candidates subarrayWithRange:NSMakeRange(start,candidates.count-start)])[self deliverBackgroundMessage:message item:item];
        });
    }] resume];
}
- (void)backgroundPoll {
    if(![self backgroundSyncActive]||self.requesting||NSDate.timeIntervalSinceReferenceDate<self.nextBackgroundPoll)return;
    self.requesting=YES;NSUInteger generation=self.generation,epoch=self.backgroundEpoch,cycle=++self.requestCycle;
    void (^poll)(NSArray<NSHTTPCookie *> *)=^(NSArray<NSHTTPCookie *> *cookies){
        if(generation!=self.generation||epoch!=self.backgroundEpoch||![self backgroundSyncActive]){if(cycle==self.requestCycle)self.requesting=NO;return;}
        NSMutableArray *owned=[NSMutableArray new];
        for(NSHTTPCookie *cookie in cookies)if(([cookie.domain isEqual:@"erp.sex"]||[cookie.domain isEqual:@".erp.sex"])&&(!cookie.expiresDate||[cookie.expiresDate timeIntervalSinceNow]>0)) [owned addObject:cookie];
        NSMutableURLRequest *request=[NSMutableURLRequest requestWithURL:[self APIURL:@"/api/v1/matches?state=active"]];
        request.allHTTPHeaderFields=self.headers;
        for(NSString *key in [NSHTTPCookie requestHeaderFieldsWithCookies:owned]) [request setValue:[NSHTTPCookie requestHeaderFieldsWithCookies:owned][key] forHTTPHeaderField:key];
        NSMutableURLRequest *counterRequest=[request mutableCopy]; counterRequest.URL=[self APIURL:@"/api/v1/me/counters"];
        [[self.session dataTaskWithRequest:counterRequest completionHandler:^(NSData *data,NSURLResponse *response,NSError *error){
            id value=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]:nil;
            dispatch_async(dispatch_get_main_queue(),^{
                if(generation!=self.generation||epoch!=self.backgroundEpoch||![self backgroundSyncActive]||error||[(NSHTTPURLResponse *)response statusCode]!=200||![value isKindOfClass:NSDictionary.class])return;
                id payload=[value[@"data"] isKindOfClass:NSDictionary.class]?value[@"data"]:value;
                if([payload[@"unreadMessages"] isKindOfClass:NSNumber.class])[self updateBadge:[payload[@"unreadMessages"] integerValue]];
            });
        }] resume];
        [[self.session dataTaskWithRequest:request completionHandler:^(NSData *data,NSURLResponse *response,NSError *error){
            id value=data?[NSJSONSerialization JSONObjectWithData:data options:0 error:nil]:nil;
            dispatch_async(dispatch_get_main_queue(),^{
                if(cycle==self.requestCycle)self.requesting=NO;
                if(generation!=self.generation||epoch!=self.backgroundEpoch||![self backgroundSyncActive])return;
                if([(NSHTTPURLResponse *)response statusCode]==401){self.sessionExpired=YES;[self endBackgroundSync];return;}
                if(error||[(NSHTTPURLResponse *)response statusCode]!=200||![value isKindOfClass:NSDictionary.class]){self.backgroundFailures=MIN(4,self.backgroundFailures+1);self.nextBackgroundPoll=NSDate.timeIntervalSinceReferenceDate+MIN(60,10*(1<<self.backgroundFailures));[self publishBackgroundState];return;}
                id payload=[value[@"data"] isKindOfClass:NSDictionary.class]?value[@"data"]:value;
                if(![payload[@"items"] isKindOfClass:NSArray.class])return;
                self.backgroundFailures=0;self.nextBackgroundPoll=0;self.lastBackgroundSuccess=NSDate.date;
#if ERP_TESTING
                self.backgroundPolls++;
#endif
                [self publishBackgroundState];
                NSInteger unread=0;
                for(id item in payload[@"items"])if([item isKindOfClass:NSDictionary.class]){
                    NSInteger count=[item[@"unreadCount"] isKindOfClass:NSNumber.class]?MAX(0,[item[@"unreadCount"] integerValue]):0;
                    unread+=count;
                    id last=item[@"lastMessage"]; NSString *matchID=item[@"id"];
                    if(!VRValidID(matchID))continue;
                    NSDictionary *previous=self.latest[matchID];
                    NSString *print=VRFingerprint(last);
                    self.latest[matchID]=@{@"messageId":[last isKindOfClass:NSDictionary.class]?last[@"id"]?:@"":@"",@"fingerprint":print,@"unread":@(count)};
                    NSInteger delta=previous?MAX(0,count-[previous[@"unread"] integerValue]):0;
                    BOOL changed=previous&&![print isEqual:previous[@"fingerprint"]];
                    NSISO8601DateFormatter *formatter=[NSISO8601DateFormatter new];formatter.formatOptions=NSISO8601DateFormatWithInternetDateTime|NSISO8601DateFormatWithFractionalSeconds;
                    NSString *timestamp=[last isKindOfClass:NSDictionary.class]?VRText(last[@"createdAt"],80,@""):@"";
                    NSDate *created=[formatter dateFromString:timestamp];
                    if(!created){formatter.formatOptions=NSISO8601DateFormatWithInternetDateTime;created=[formatter dateFromString:timestamp];}
                    BOOL recent=created&&[created compare:self.started]!=NSOrderedAscending;
                    if(count>0&&(changed||delta>0||!previous&&recent)){
                        if([last isKindOfClass:NSDictionary.class]&&VRValidID(last[@"id"])&&(![last[@"type"] isEqual:@"text"]||[last[@"text"] isKindOfClass:NSString.class]))[self deliverBackgroundMessage:last item:item];
                        else [self hydrateBackgroundMatch:item request:request delta:delta changed:changed generation:generation epoch:epoch];
                    }else if([last isKindOfClass:NSDictionary.class]&&VRValidID(last[@"id"]))[self remember:last[@"id"]];
                }
                // This response may be paginated: do not replace the account's
                // total badge with the first page's partial count.
                (void)unread;
            });
        }] resume];
    };
    // WebKit's cookie process can sleep while the native listener is awake.
    // Capture only this site's cookies while foregrounded; never poll WebKit
    // IPC on each background tick or persist login credentials to disk.
    if(self.ownedCookies.count)poll(self.ownedCookies);
    else [self.store getAllCookies:^(NSArray<NSHTTPCookie *> *cookies){dispatch_async(dispatch_get_main_queue(),^{poll(cookies);});}];
}
#if ERP_TESTING
- (NSDictionary *)verifyBackgroundState {
    NSMutableDictionary *state=[[self backgroundState] mutableCopy];state[@"audioActive"]=@(self.audioLease.active);state[@"polls"]=@(self.backgroundPolls);state[@"unread"]=@(self.unread);state[@"delivered"]=[self.backgroundDelivered copy];state[@"syncActive"]=@([self backgroundSyncActive]);state[@"graceEnded"]=@(self.backgroundTask==UIBackgroundTaskInvalid);return state;
}
- (NSDictionary *)verifyNotificationContent {
    NSDictionary *event=@{@"title":@"测试联系人",@"displayId":@"peer-test-id",@"senderId":@"peer-test-id",@"body":@"测试消息内容"};
    NSData *avatar=[self initialAvatar:@"測"];
    UNMutableNotificationContent *content=[self messageContent:event path:@"/matches/thread" thread:@"thread" avatar:avatar];
    UIImage *image=[UIImage imageWithData:avatar];
    NSString *hydratedID=@"peer-hydrated-test";
    [self handleEvent:@{@"kind":@"snapshot",@"items":@[@{@"matchId":@"hydrated-thread",@"messageId":hydratedID,@"fingerprint":@"summary",@"unread":@1,@"baseline":@NO}]}];
    BOOL baselineAllowsHydration=![self.seen containsObject:hydratedID];
    [self.latest removeObjectForKey:@"hydrated-thread"];
    INSendMessageIntent *intent=[self communicationIntent:event path:@"/matches/thread" avatar:avatar];
    ChatNotifications *probe=[[ChatNotifications alloc] initWithCookieStore:self.store];probe.userID=@"read-fixture-self";probe.activePath=@"/matches";
    NSDictionary *queued=@{@"messageId":@"read-fixture-old",@"matchId":@"read-fixture-thread",@"createdAt":@"2026-01-02T00:00:00Z"};
    probe.notificationEvents[queued[@"messageId"]]=queued;BOOL initiallyAllowed=[probe canSendEvent:queued];
    probe.activePath=@"/matches/read-fixture-thread";probe.activePath=@"/posts";
    BOOL visitCancelsDelayed=![probe canSendEvent:queued];
    probe.notificationEvents[queued[@"messageId"]]=queued;
    NSDictionary *read=@{@"userId":@"read-fixture-self",@"matchId":@"read-fixture-thread",@"lastMessageId":@"read-fixture-old",@"createdAt":@"2026-01-02T00:00:00Z",@"messageIds":@[@"read-fixture-old"]};
    [probe acknowledgeRead:read];BOOL readCancelsDelayed=![probe canSendEvent:queued];
    NSDictionary *older=@{@"messageId":@"read-fixture-hydrated",@"matchId":@"read-fixture-thread",@"createdAt":@"2026-01-01T00:00:00Z"};
    NSDictionary *next=@{@"messageId":@"read-fixture-next",@"matchId":@"read-fixture-thread",@"createdAt":@"2026-01-03T00:00:00Z"};
    NSDictionary *equal=@{@"messageId":@"read-fixture-equal",@"matchId":@"read-fixture-thread",@"createdAt":@"2026-01-02T00:00:00Z"};
    probe.notificationEvents[next[@"messageId"]]=next;probe.notificationEvents[equal[@"messageId"]]=equal;
    [probe acknowledgeRead:read];
    NSDictionary *info=@{@"owner":probe.userID,@"messageId":next[@"messageId"],@"matchId":next[@"matchId"],@"createdAt":next[@"createdAt"]};
    BOOL canPresentNew=[probe shouldPresentNotificationInfo:info];
    NSMutableDictionary *foreign=[info mutableCopy];foreign[@"owner"]=@"previous-account";
    NSDictionary *races=@{@"initiallyAllowed":@(initiallyAllowed),@"visitCancelsDelayed":@(visitCancelsDelayed),@"readCancelsDelayed":@(readCancelsDelayed),@"olderHydrationSuppressed":@([probe isReadEvent:older]),@"newMessagePreserved":@([probe canSendEvent:next]),@"sameTimestampNewPreserved":@([probe canSendEvent:equal]),@"presentationGateAllowsNew":@(canPresentNew),@"foreignAccountBlocked":@(![probe shouldPresentNotificationInfo:foreign])};
    return @{@"readRaces":races,@"summaryHydrationAllowed":@(baselineAllowsHydration),@"intentSender":intent.sender.displayName?:@"",@"intentAvatar":@(intent.sender.image!=nil),@"title":content.title,@"subtitle":content.subtitle,@"body":content.body,@"attachmentCount":@(content.attachments.count),@"avatarWidth":@(image.size.width),@"avatarHeight":@(image.size.height),@"thread":content.threadIdentifier,@"path":content.userInfo[@"path"],@"sound":@(content.sound!=nil)};
}
#endif
@end
