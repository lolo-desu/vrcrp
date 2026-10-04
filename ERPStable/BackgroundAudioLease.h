#import <Foundation/Foundation.h>
NS_ASSUME_NONNULL_BEGIN
// Optional, best-effort runtime lease for a user-enabled background listener.
// This is not a daemon or APNs: iOS can interrupt or terminate the process.
@interface BackgroundAudioLease : NSObject
@property(nonatomic,readonly) BOOL active;
@property(nonatomic,copy,readonly) NSString *reason;
@property(nonatomic,copy,nullable) dispatch_block_t onChange;
- (BOOL)start;
- (void)stop;
@end
NS_ASSUME_NONNULL_END
