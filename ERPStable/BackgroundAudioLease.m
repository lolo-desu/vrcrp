#import "BackgroundAudioLease.h"
#import <AVFoundation/AVFoundation.h>

@interface BackgroundAudioLease () <AVAudioPlayerDelegate>
@property(nonatomic,strong) AVAudioPlayer *player;
@property(nonatomic) BOOL requested;
@property(nonatomic) BOOL activated;
@property(nonatomic) BOOL interrupted;
@property(nonatomic,copy,readwrite) NSString *reason;
@end
@implementation BackgroundAudioLease
- (instancetype)init {
    if(!(self=[super init]))return nil;self.reason=@"";
    NSNotificationCenter *center=NSNotificationCenter.defaultCenter;
    [center addObserver:self selector:@selector(interruption:) name:AVAudioSessionInterruptionNotification object:nil];
    [center addObserver:self selector:@selector(mediaReset:) name:AVAudioSessionMediaServicesWereResetNotification object:nil];
    [center addObserver:self selector:@selector(routeChanged:) name:AVAudioSessionRouteChangeNotification object:nil];
    return self;
}
- (void)dealloc { [NSNotificationCenter.defaultCenter removeObserver:self];[self.player stop]; }
- (BOOL)active { return self.requested&&!self.interrupted&&self.player.isPlaying; }
- (void)changed { if(self.onChange)self.onChange(); }
- (NSData *)silence {
    // One second of real, zero-amplitude mono PCM. No microphone permission,
    // audible sound, remote-control metadata, external files or network audio.
    const uint32_t length=16000;NSMutableData *data=[NSMutableData dataWithLength:44+length];
    uint8_t *p=data.mutableBytes;memcpy(p,"RIFF",4);uint32_t total=CFSwapInt32HostToLittle(36+length);memcpy(p+4,&total,4);
    memcpy(p+8,"WAVEfmt ",8);uint32_t format=CFSwapInt32HostToLittle(16);memcpy(p+16,&format,4);
    uint16_t pcm=CFSwapInt16HostToLittle(1),channels=pcm,bits=CFSwapInt16HostToLittle(16),align=CFSwapInt16HostToLittle(2);
    memcpy(p+20,&pcm,2);memcpy(p+22,&channels,2);uint32_t rate=CFSwapInt32HostToLittle(8000),bytes=CFSwapInt32HostToLittle(16000);
    memcpy(p+24,&rate,4);memcpy(p+28,&bytes,4);memcpy(p+32,&align,2);memcpy(p+34,&bits,2);memcpy(p+36,"data",4);
    uint32_t size=CFSwapInt32HostToLittle(length);memcpy(p+40,&size,4);return data;
}
- (BOOL)start {
    self.requested=YES;if(self.active)return YES;
    AVAudioSession *session=AVAudioSession.sharedInstance;
    if(self.interrupted||[session.category isEqual:AVAudioSessionCategoryRecord]||[session.category isEqual:AVAudioSessionCategoryPlayAndRecord]){
        self.reason=@"音频中断或录音期间暂停";[self changed];return NO;
    }
    NSError *error=nil;
    BOOL configured=[session setCategory:AVAudioSessionCategoryPlayback mode:AVAudioSessionModeDefault options:AVAudioSessionCategoryOptionMixWithOthers error:&error];
    if(configured)configured=[session setActive:YES error:&error];
    if(configured){self.activated=YES;self.player=[[AVAudioPlayer alloc] initWithData:[self silence] error:&error];self.player.delegate=self;self.player.numberOfLoops=-1;self.player.volume=1;configured=[self.player prepareToPlay]&&[self.player play];}
    self.reason=configured?@"":@"暂时无法启动后台监听";
    if(!configured){[self.player stop];self.player=nil;if(self.activated&&[session.category isEqual:AVAudioSessionCategoryPlayback])[session setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:nil];self.activated=NO;}
    [self changed];return self.active;
}
- (void)stop {
    self.requested=NO;self.interrupted=NO;[self.player stop];self.player=nil;self.reason=@"";
    AVAudioSession *session=AVAudioSession.sharedInstance;
    if(self.activated&&[session.category isEqual:AVAudioSessionCategoryPlayback])[session setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:nil];
    self.activated=NO;[self changed];
}
- (void)interruption:(NSNotification *)notification {
    dispatch_async(dispatch_get_main_queue(),^{
        BOOL began=[notification.userInfo[AVAudioSessionInterruptionTypeKey] unsignedIntegerValue]==AVAudioSessionInterruptionTypeBegan;
        if(began){self.interrupted=YES;[self.player pause];if(self.requested){self.reason=@"音频中断期间暂停";[self changed];}}
        else {self.interrupted=NO;if(self.requested){BOOL resume=([notification.userInfo[AVAudioSessionInterruptionOptionKey] unsignedIntegerValue]&AVAudioSessionInterruptionOptionShouldResume)!=0;if(resume)[self start];else {self.reason=@"音频中断后暂停，打开 App 可恢复";[self changed];}}}
    });
}
- (void)mediaReset:(NSNotification *)notification {
    dispatch_async(dispatch_get_main_queue(),^{self.player=nil;self.activated=NO;self.interrupted=NO;if(self.requested)[self start];});
}
- (void)routeChanged:(NSNotification *)notification {
    dispatch_async(dispatch_get_main_queue(),^{
        if(!self.requested)return;
        NSString *category=AVAudioSession.sharedInstance.category;
        if(![category isEqual:AVAudioSessionCategoryPlayback]){[self.player pause];self.reason=@"音频被录音或其他播放暂时占用";[self changed];}
    });
}
- (void)audioPlayerDecodeErrorDidOccur:(AVAudioPlayer *)player error:(NSError *)error {self.reason=@"后台音频已暂停，打开 App 可恢复";[self changed];}
@end
