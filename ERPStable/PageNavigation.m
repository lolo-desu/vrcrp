#import "PageNavigation.h"
#import <math.h>

@interface VRPageImage : NSObject
@property(nonatomic,strong) UIImage *image;
@property(nonatomic,strong) UIColor *header;
@property(nonatomic,copy) NSString *path;
@property(nonatomic) NSUInteger cost;
@end
@implementation VRPageImage
@end

@interface PageNavigation ()
@property(nonatomic,weak) WKWebView *web;
@property(nonatomic,weak) UIView *navigation;
@property(nonatomic,weak) UIView *header;
@property(nonatomic,strong) NSCache<NSString *,VRPageImage *> *images;
@property(nonatomic,strong) NSMutableDictionary<NSString *,NSString *> *paths;
@property(nonatomic,strong) NSMutableDictionary<NSString *,VRPageImage *> *retainedPages;
@property(nonatomic,copy) NSArray<NSString *> *ancestors;
@property(nonatomic,strong) UIColor *surfaceColor;
@property(nonatomic,strong) UIColor *canvasColor;
@property(nonatomic,strong) UIColor *inkColor;
@property(nonatomic,copy) NSString *surfaceTitle;
@property(nonatomic,strong) UIImageView *underlay;
@property(nonatomic,strong) UIView *shade;
@property(nonatomic,strong) UIImageView *outgoing;
@property(nonatomic,copy,readwrite) NSString *currentKey;
@property(nonatomic,copy) NSString *parentKey;
@property(nonatomic,copy) NSString *parentPath;
@property(nonatomic,copy) NSString *currentPath;
@property(nonatomic,copy,readwrite) NSString *previewKey;
@property(nonatomic,readwrite) BOOL transitioning;
@property(nonatomic,readwrite) BOOL interactive;
@property(nonatomic,readwrite) CGFloat progress;
@property(nonatomic) BOOL waitingReturn;
@property(nonatomic) BOOL animationDone;
@property(nonatomic) BOOL routeReady;
@property(nonatomic,readwrite) BOOL handoff;
@property(nonatomic,strong) UIImageView *handoffView;
@property(nonatomic) BOOL paintRequested;
@property(nonatomic) BOOL foregroundPreview;
@property(nonatomic) NSUInteger generation;
@property(nonatomic) NSUInteger captureGeneration;
@property(nonatomic,strong) UIColor *fromHeader;
@property(nonatomic,strong) UIColor *toHeader;
@property(nonatomic,strong) NSMutableDictionary<NSString *,NSDictionary *> *placeholderLayouts;
@property(nonatomic,strong) UIView *rowFeedback;
@property(nonatomic,copy) NSString *pressedEntry;
@property(nonatomic) CGRect pressedFrame;
@property(nonatomic,strong) UIColor *pressedInk;
@property(nonatomic) NSTimeInterval pressDeadline;
@property(nonatomic) NSUInteger pressGeneration;
@end

@implementation PageNavigation
- (instancetype)initWithWebView:(WKWebView *)web navigation:(UIView *)navigation header:(UIView *)header {
    if(!(self=[super init]))return nil;
    self.web=web;self.navigation=navigation;self.header=header;self.currentKey=@"";self.currentPath=@"";
    self.images=[NSCache new];self.images.countLimit=24;self.images.totalCostLimit=48*1024*1024;self.paths=[NSMutableDictionary new];
    self.retainedPages=[NSMutableDictionary new];self.ancestors=@[];self.placeholderLayouts=[NSMutableDictionary new];
    self.underlay=[UIImageView new];self.underlay.contentMode=UIViewContentModeTopLeft;self.underlay.clipsToBounds=YES;self.underlay.hidden=YES;self.underlay.userInteractionEnabled=NO;
    [web.superview insertSubview:self.underlay belowSubview:web];
    self.shade=[UIView new];self.shade.backgroundColor=UIColor.blackColor;[self.underlay addSubview:self.shade];
    self.outgoing=[UIImageView new];self.outgoing.contentMode=UIViewContentModeTopLeft;self.outgoing.clipsToBounds=YES;self.outgoing.hidden=YES;self.outgoing.userInteractionEnabled=NO;
    [web.superview addSubview:self.outgoing];
    return self;
}
- (CGRect)viewport { CGSize size=self.web.bounds.size;return CGRectMake(self.web.center.x-size.width/2,self.web.center.y-size.height/2,size.width,size.height); }
- (void)layout {
    CGRect frame=[self viewport];
    for(UIView *view in @[self.underlay,self.outgoing]){view.bounds=CGRectMake(0,0,frame.size.width,frame.size.height);view.center=CGPointMake(CGRectGetMidX(frame),CGRectGetMidY(frame));}
    self.shade.frame=self.underlay.bounds;
    self.web.layer.shadowPath=[UIBezierPath bezierPathWithRect:self.web.bounds].CGPath;
}
- (VRPageImage *)pageForKey:(NSString *)key { VRPageImage *page=key.length?self.retainedPages[key]?:[self.images objectForKey:key]:nil;return page&&fabs(page.image.size.width-self.web.bounds.size.width)<2?page:nil; }
- (BOOL)blankImage:(UIImage *)image {
    if(!image.CGImage)return YES;
    uint8_t pixels[48*72*4]={0};CGColorSpaceRef space=CGColorSpaceCreateDeviceRGB();
    CGContextRef ctx=CGBitmapContextCreate(pixels,48,72,8,48*4,space,kCGImageAlphaPremultipliedLast|kCGBitmapByteOrder32Big);CGColorSpaceRelease(space);
    if(!ctx)return NO;
    CGContextSetRGBFillColor(ctx,1,1,1,1);CGContextFillRect(ctx,CGRectMake(0,0,48,72));CGContextDrawImage(ctx,CGRectMake(0,0,48,72),image.CGImage);CGContextRelease(ctx);
    NSUInteger marked=0;for(NSUInteger i=0;i<48*72;i++)if(MIN(pixels[i*4],MIN(pixels[i*4+1],pixels[i*4+2]))<235)marked++;
    return marked<3;
}
- (void)trimRetainedPages {
    NSUInteger cost=0;for(VRPageImage *page in self.retainedPages.allValues)cost+=page.cost;
    for(NSString *key in self.ancestors){if(cost<=40*1024*1024)break;if([key isEqual:self.parentKey]||[key isEqual:self.currentKey])continue;VRPageImage *page=self.retainedPages[key];cost-=page.cost;[self.retainedPages removeObjectForKey:key];}
}
- (BOOL)canPreviewParent { return [self pageForKey:self.parentKey]!=nil; }
- (BOOL)canPreviewOverlay { return [self pageForKey:self.currentKey]!=nil; }
- (UIColor *)color:(id)value fallback:(UIColor *)fallback {
    if(![value isKindOfClass:NSArray.class]||[value count]!=4)return fallback;
    for(id component in value)if(![component isKindOfClass:NSNumber.class]||!isfinite([component doubleValue])||[component doubleValue]<0||[component doubleValue]>1)return fallback;
    return [UIColor colorWithRed:[value[0] doubleValue] green:[value[1] doubleValue] blue:[value[2] doubleValue] alpha:[value[3] doubleValue]];
}
- (void)configureSurface:(NSDictionary *)model {
    self.parentPath=[model[@"parentPath"] isKindOfClass:NSString.class]?model[@"parentPath"]:nil;
    self.surfaceColor=[self color:model[@"surfaceColor"] fallback:self.header.backgroundColor?:UIColor.systemBackgroundColor];
    self.canvasColor=[self color:model[@"canvasColor"] fallback:self.surfaceColor];
    self.inkColor=[self color:model[@"inkColor"] fallback:UIColor.labelColor];
    self.surfaceTitle=[model[@"title"] isKindOfClass:NSString.class]?model[@"title"]:@"";
    NSDictionary *layout=[model[@"placeholderLayout"] isKindOfClass:NSDictionary.class]?model[@"placeholderLayout"]:nil;
    NSString *path=[model[@"path"] isKindOfClass:NSString.class]?model[@"path"]:nil;
    if(layout&&path&&[layout[@"layers"] isKindOfClass:NSArray.class]&&[layout[@"layers"] count]<=256){
        self.placeholderLayouts[path]=layout;
        if(self.placeholderLayouts.count>24)for(NSString *other in self.placeholderLayouts.allKeys)if(![other isEqual:path]){[self.placeholderLayouts removeObjectForKey:other];break;}
    }
    NSArray *keys=[model[@"ancestors"] isKindOfClass:NSArray.class]?model[@"ancestors"]:@[];
    NSMutableArray *safe=[NSMutableArray new];for(id key in keys)if([key isKindOfClass:NSString.class]&&[key length]<=180&&safe.count<24)[safe addObject:key];self.ancestors=safe;
    NSSet *keep=[NSSet setWithArray:[safe arrayByAddingObject:self.currentKey?:@""]];
    for(NSString *key in self.retainedPages.allKeys)if(![keep containsObject:key])[self.retainedPages removeObjectForKey:key];
    NSUInteger cost=0;for(VRPageImage *page in self.retainedPages.allValues)cost+=page.cost;
    // Pin the actual return stack, starting with the nearest parent. NSCache
    // eviction alone must not turn a recently visited parent into a blank page.
    for(NSString *key in safe.reverseObjectEnumerator){VRPageImage *page=[self pageForKey:key];if(page&&!self.retainedPages[key]&&cost+page.cost<=40*1024*1024){self.retainedPages[key]=page;cost+=page.cost;}}
}
- (CGRect)surfaceRect:(id)value {
    if(![value isKindOfClass:NSDictionary.class])return CGRectZero;
    for(NSString *key in @[@"x",@"y",@"width",@"height"]){id n=value[key];if(![n isKindOfClass:NSNumber.class]||!isfinite([n doubleValue])||fabs([n doubleValue])>20000)return CGRectZero;}
    return CGRectMake([value[@"x"] doubleValue],[value[@"y"] doubleValue],MAX(0,[value[@"width"] doubleValue]),MAX(0,[value[@"height"] doubleValue]));
}
- (UIBezierPath *)surfacePath:(CGRect)r radii:(NSArray *)radii {
    CGFloat c[4]={0,0,0,0};for(NSUInteger i=0;i<MIN(4,radii.count);i++)if([radii[i] isKindOfClass:NSNumber.class])c[i]=MAX(0,MIN(MIN(r.size.width,r.size.height)/2,[radii[i] doubleValue]));
    CGFloat l=CGRectGetMinX(r),t=CGRectGetMinY(r),right=CGRectGetMaxX(r),b=CGRectGetMaxY(r);
    UIBezierPath *p=[UIBezierPath bezierPath];[p moveToPoint:CGPointMake(l+c[0],t)];[p addLineToPoint:CGPointMake(right-c[1],t)];
    [p addQuadCurveToPoint:CGPointMake(right,t+c[1]) controlPoint:CGPointMake(right,t)];[p addLineToPoint:CGPointMake(right,b-c[2])];
    [p addQuadCurveToPoint:CGPointMake(right-c[2],b) controlPoint:CGPointMake(right,b)];[p addLineToPoint:CGPointMake(l+c[3],b)];
    [p addQuadCurveToPoint:CGPointMake(l,b-c[3]) controlPoint:CGPointMake(l,b)];[p addLineToPoint:CGPointMake(l,t+c[0])];
    [p addQuadCurveToPoint:CGPointMake(l+c[0],t) controlPoint:CGPointMake(l,t)];[p closePath];return p;
}
- (void)drawSurfaceLayout:(NSDictionary *)layout context:(CGContextRef)context {
    for(id item in layout[@"layers"]){
        if(![item isKindOfClass:NSDictionary.class])continue;
        CGRect rect=[self surfaceRect:item[@"rect"]],clip=[self surfaceRect:item[@"clip"]];if(CGRectIsEmpty(rect)||CGRectIsEmpty(clip))continue;
        CGContextSaveGState(context);CGContextClipToRect(context,clip);
        if([item[@"opacity"] isKindOfClass:NSNumber.class])CGContextSetAlpha(context,MAX(0,MIN(1,[item[@"opacity"] doubleValue])));
        NSArray *radii=[item[@"radius"] isKindOfClass:NSArray.class]?item[@"radius"]:@[];UIBezierPath *shape=[self surfacePath:rect radii:radii];
        UIColor *fill=[self color:item[@"fill"] fallback:UIColor.clearColor];
        NSDictionary *shadow=[item[@"shadow"] isKindOfClass:NSDictionary.class]?item[@"shadow"]:nil;
        if(shadow)CGContextSetShadowWithColor(context,CGSizeMake([shadow[@"x"] doubleValue],[shadow[@"y"] doubleValue]),MAX(0,MIN(60,[shadow[@"blur"] doubleValue])),[self color:shadow[@"color"] fallback:UIColor.clearColor].CGColor);
        [fill setFill];[shape fill];CGContextSetShadowWithColor(context,CGSizeZero,0,NULL);
        NSArray *borders=[item[@"border"] isKindOfClass:NSArray.class]?item[@"border"]:@[];
        if(borders.count==4){
            CGFloat widths[4];BOOL uniform=YES;for(NSUInteger i=0;i<4;i++){widths[i]=MAX(0,MIN(12,[borders[i][@"width"] doubleValue]));if(i&&widths[i]!=widths[0])uniform=NO;}
            if(uniform&&widths[0]>0){UIBezierPath *border=[self surfacePath:CGRectInset(rect,widths[0]/2,widths[0]/2) radii:radii];[[self color:borders[0][@"color"] fallback:UIColor.clearColor] setStroke];border.lineWidth=widths[0];[border stroke];}
            else for(NSUInteger i=0;i<4;i++)if(widths[i]>0){
                CGRect edge=i==0?CGRectMake(rect.origin.x,rect.origin.y,rect.size.width,widths[i]):i==1?CGRectMake(CGRectGetMaxX(rect)-widths[i],rect.origin.y,widths[i],rect.size.height):i==2?CGRectMake(rect.origin.x,CGRectGetMaxY(rect)-widths[i],rect.size.width,widths[i]):CGRectMake(rect.origin.x,rect.origin.y,widths[i],rect.size.height);
                [[self color:borders[i][@"color"] fallback:UIColor.clearColor] setFill];UIRectFill(edge);
            }
        }
        NSString *pixels=[item[@"image"] isKindOfClass:NSString.class]?item[@"image"]:nil;
        if(pixels.length>0&&pixels.length<300000){
            NSData *data=[[NSData alloc] initWithBase64EncodedString:pixels options:0];
            UIImage *image=data?[UIImage imageWithData:data scale:2]:nil;
            if(image&&image.size.width<=1200&&image.size.height<=120)[image drawInRect:rect];
        }else if([item[@"text"] isKindOfClass:NSString.class]){
            UIFont *font=[UIFont systemFontOfSize:MAX(10,MIN(30,[item[@"fontSize"] doubleValue])) weight:[item[@"weight"] doubleValue]>=600?UIFontWeightBold:UIFontWeightRegular];
            [item[@"text"] drawInRect:rect withAttributes:@{NSFontAttributeName:font,NSForegroundColorAttributeName:[self color:item[@"ink"] fallback:self.inkColor?:UIColor.labelColor]}];
        }
        if([item[@"glyph"] isEqual:@"back"]){CGFloat x=CGRectGetMidX(rect),y=CGRectGetMidY(rect);UIBezierPath *back=[UIBezierPath bezierPath];[back moveToPoint:CGPointMake(x+3,y-9)];[back addLineToPoint:CGPointMake(x-5,y)];[back addLineToPoint:CGPointMake(x+3,y+9)];back.lineWidth=2.5;[self.inkColor?:UIColor.labelColor setStroke];[back stroke];}
        CGContextRestoreGState(context);
    }
}
- (void)clearRowFeedback {
    self.pressGeneration++;self.pressedEntry=nil;self.pressDeadline=0;[self.rowFeedback.layer removeAllAnimations];[self.rowFeedback removeFromSuperview];self.rowFeedback=nil;
}
- (void)fadeRowFeedback {
    if(!self.rowFeedback||self.pressDeadline<=0)return;
    NSUInteger owner=++self.pressGeneration;NSTimeInterval delay=MAX(0,self.pressDeadline-NSDate.date.timeIntervalSinceReferenceDate-.10);
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)(delay*NSEC_PER_SEC)),dispatch_get_main_queue(),^{
        if(owner!=self.pressGeneration)return;UIView *feedback=self.rowFeedback;
        [UIView animateWithDuration:.10 delay:0 options:UIViewAnimationOptionAllowUserInteraction animations:^{feedback.alpha=0;} completion:^(BOOL finished){if(owner==self.pressGeneration)[self clearRowFeedback];}];
    });
}
- (void)updateRowPress:(NSDictionary *)model {
    if([model[@"active"] isEqual:@YES]){
        if([model[@"released"] isEqual:@YES]){
            self.pressDeadline=NSDate.date.timeIntervalSinceReferenceDate+.26;[self fadeRowFeedback];
        }else{
            [self clearRowFeedback];self.pressedEntry=self.currentKey;self.pressedFrame=[self surfaceRect:model[@"rect"]];self.pressedInk=[self color:model[@"ink"] fallback:[UIColor.blackColor colorWithAlphaComponent:.12]];
        }
    }else if(![model[@"reason"] isEqual:@"navigation"])[self clearRowFeedback];
}
- (UIImage *)placeholderForPath:(NSString *)path {
    CGSize size=self.web.bounds.size;if(size.width<1||size.height<1)return nil;
    UIColor *paper=self.surfaceColor?:self.header.backgroundColor?:UIColor.systemBackgroundColor;
    UIColor *canvas=self.canvasColor?:paper,*ink=self.inkColor?:UIColor.labelColor;
    UIGraphicsImageRendererFormat *format=[UIGraphicsImageRendererFormat preferredFormat];format.scale=1.5;format.opaque=YES;
    UIGraphicsImageRenderer *renderer=[[UIGraphicsImageRenderer alloc] initWithSize:size format:format];
    return [renderer imageWithActions:^(UIGraphicsImageRendererContext *ctx){
        [canvas setFill];UIRectFill(CGRectMake(0,0,size.width,size.height));
        NSDictionary *layout=self.placeholderLayouts[path];
        if(layout&&fabs([layout[@"width"] doubleValue]-size.width)<2&&[layout[@"layers"] count]){[self drawSurfaceLayout:layout context:ctx.CGContext];return;}
        [paper setFill];UIRectFill(CGRectMake(0,0,size.width,56));
        void(^block)(CGRect,CGFloat)=^(CGRect rect,CGFloat radius){[[ink colorWithAlphaComponent:.1] setFill];[[UIBezierPath bezierPathWithRoundedRect:rect cornerRadius:radius] fill];};
        void(^card)(CGRect)=^(CGRect rect){[paper setFill];UIBezierPath *shape=[UIBezierPath bezierPathWithRoundedRect:rect cornerRadius:16];[shape fill];[[ink colorWithAlphaComponent:.12] setStroke];shape.lineWidth=1;[shape stroke];};
        BOOL chat=[path rangeOfString:@"^/matches/[^/]+/?$" options:NSRegularExpressionSearch].location!=NSNotFound;
        BOOL list=[@[@"/likes",@"/likes/sent",@"/matches",@"/notifications",@"/visitors"] containsObject:path]||[path hasPrefix:@"/settings"];
        BOOL detail=![@[@"/discover",@"/browse",@"/likes",@"/likes/sent",@"/matches",@"/posts",@"/me"] containsObject:path];
        if(detail){[ink setStroke];UIBezierPath *back=[UIBezierPath bezierPath];[back moveToPoint:CGPointMake(27,20)];[back addLineToPoint:CGPointMake(19,28)];[back addLineToPoint:CGPointMake(27,36)];back.lineWidth=2.5;[back stroke];}
        if(chat){block(CGRectMake(50,8,40,40),20);block(CGRectMake(102,18,110,12),6);}
        else{NSString *title=self.surfaceTitle?:@"";[title drawAtPoint:CGPointMake(detail?64:16,18) withAttributes:@{NSFontAttributeName:[UIFont systemFontOfSize:17 weight:UIFontWeightSemibold],NSForegroundColorAttributeName:ink}];}
        CGFloat width=MIN(size.width-24,744),x=(size.width-width)/2;
        if(chat){
            for(NSUInteger i=0;i<5;i++){CGFloat w=width*(i%2?.68:.54),y=80+i*88;card(CGRectMake(i%2?x+width-w:x,y,w,i==1?76:58));block(CGRectMake((i%2?x+width-w:x)+16,y+18,w-32,12),6);}
            CGFloat y=MAX(80,size.height-66-self.web.safeAreaInsets.bottom);card(CGRectMake(x,y,width,56));block(CGRectMake(x+16,y+21,width-74,12),6);
        }else if(list){
            card(CGRectMake(x,76,width,MIN(570,size.height-96)));
            for(NSUInteger i=0;i<6;i++){CGFloat y=96+i*88;if(y+48>size.height-24)break;block(CGRectMake(x+16,y,48,48),24);block(CGRectMake(x+78,y+7,width*.42,12),6);block(CGRectMake(x+78,y+31,width-102,10),5);}
        }else{
            CGFloat h=MIN(360,MAX(220,size.height*.5));card(CGRectMake(x,76,width,h));block(CGRectMake(x+16,92,48,48),24);block(CGRectMake(x+78,100,width*.4,12),6);block(CGRectMake(x+78,124,width*.56,10),5);
            block(CGRectMake(x+16,158,width-32,h-168),12);block(CGRectMake(x+16,76+h-40,width-32,12),6);
            card(CGRectMake(x,92+h,width,120));block(CGRectMake(x+16,110+h,width-32,12),6);block(CGRectMake(x+16,138+h,width*.68,12),6);block(CGRectMake(x+16,166+h,width*.8,12),6);
        }
    }];
}
- (void)cancelCapture { self.captureGeneration++; }
- (void)capture {
    if(self.captureAllowed&&!self.captureAllowed())return;
    if(!self.currentKey.length||!self.routeReady||self.transitioning||self.handoff||self.web.alpha<.99)return;
    NSString *key=self.currentKey,*path=self.currentPath;NSUInteger generation=++self.captureGeneration;
    CGRect viewport=[self viewport];if(viewport.size.width<100||viewport.size.height<100)return;
    WKSnapshotConfiguration *config=[WKSnapshotConfiguration new];config.afterScreenUpdates=YES;
    [self.web takeSnapshotWithConfiguration:config completionHandler:^(UIImage *image,NSError *error){
        if(!image||[self blankImage:image]||generation!=self.captureGeneration||![self.currentKey isEqual:key]||self.transitioning||self.handoff)return;
        UIGraphicsImageRendererFormat *format=[UIGraphicsImageRendererFormat preferredFormat];format.scale=MIN(1.5,UIScreen.mainScreen.scale);format.opaque=YES;format.preferredRange=UIGraphicsImageRendererFormatRangeStandard;
        UIGraphicsImageRenderer *renderer=[[UIGraphicsImageRenderer alloc] initWithSize:viewport.size format:format];
        UIImage *composite=[renderer imageWithActions:^(UIGraphicsImageRendererContext *context){
            [image drawInRect:CGRectMake(0,0,viewport.size.width,viewport.size.height)];
            if(!self.navigation.hidden) {
                CGRect nav=self.navigation.frame;CGContextSaveGState(context.CGContext);
                CGContextTranslateCTM(context.CGContext,nav.origin.x-viewport.origin.x,nav.origin.y-viewport.origin.y);
                [self.navigation.layer renderInContext:context.CGContext];CGContextRestoreGState(context.CGContext);
            }
        }];
        VRPageImage *page=[VRPageImage new];page.image=composite;page.header=self.header.backgroundColor?:UIColor.systemBackgroundColor;page.path=path;
        NSUInteger cost=(NSUInteger)(composite.size.width*composite.size.height*format.scale*format.scale*4);
        page.cost=cost;
        [self.images setObject:page forKey:key cost:cost];self.paths[path]=key;
        if([key isEqual:self.currentKey]||[self.ancestors containsObject:key])self.retainedPages[key]=page;
        [self trimRetainedPages];
        if(self.paths.count>20){for(NSString *p in self.paths.allKeys)if(![self.images objectForKey:self.paths[p]])[self.paths removeObjectForKey:p];}
    }];
}
- (void)setRunning:(BOOL)value {
    // Animation is presentation, never a lock on the router or its controls.
    self.transitioning=value;self.web.userInteractionEnabled=YES;
    if(self.onTransitionChange)self.onTransitionChange(value);
}
- (void)shadow:(BOOL)visible {
    self.web.layer.shadowColor=UIColor.blackColor.CGColor;self.web.layer.shadowOpacity=visible?.2:0;
    self.web.layer.shadowRadius=12;self.web.layer.shadowOffset=CGSizeMake(-4,0);
}
- (void)headerAtProgress:(CGFloat)progress {
    CGFloat a[4]={1,1,1,1},b[4]={1,1,1,1};[self.fromHeader getRed:&a[0] green:&a[1] blue:&a[2] alpha:&a[3]];[self.toHeader getRed:&b[0] green:&b[1] blue:&b[2] alpha:&b[3]];
    UIColor *color=[UIColor colorWithRed:a[0]+(b[0]-a[0])*progress green:a[1]+(b[1]-a[1])*progress blue:a[2]+(b[2]-a[2])*progress alpha:1];
    if(self.onHeaderColor)self.onHeaderColor(color);
}
- (void)complete {
    [self clearRowFeedback];
    self.generation++;self.waitingReturn=NO;self.interactive=NO;self.progress=0;
    self.handoff=NO;self.handoffView=nil;self.paintRequested=NO;self.foregroundPreview=NO;
    [self.web.layer removeAllAnimations];[self.underlay.layer removeAllAnimations];[self.outgoing.layer removeAllAnimations];[self.shade.layer removeAllAnimations];
    self.web.transform=CGAffineTransformIdentity;self.web.alpha=1;[self shadow:NO];
    self.underlay.hidden=YES;self.underlay.image=nil;self.underlay.transform=CGAffineTransformIdentity;
    self.outgoing.hidden=YES;self.outgoing.image=nil;self.outgoing.transform=CGAffineTransformIdentity;self.previewKey=nil;
    self.underlay.alpha=1;self.outgoing.alpha=1;[self.web.superview insertSubview:self.underlay belowSubview:self.web];
    [self setRunning:NO];
    [self capture];
}
- (void)holdCover:(UIImageView *)cover {
    self.generation++;self.handoff=YES;self.handoffView=cover;self.paintRequested=NO;self.animationDone=YES;
    cover.hidden=NO;cover.alpha=1;cover.transform=CGAffineTransformIdentity;
    self.web.transform=CGAffineTransformIdentity;[self shadow:NO];[self setRunning:NO];
    // This cover never owns input. A new gesture/navigation can replace it.
    NSUInteger owner=self.generation;
    [self probeReadiness:owner];
    [self revealPaintedPage];
}
- (void)probeReadiness:(NSUInteger)owner {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,500*NSEC_PER_MSEC),dispatch_get_main_queue(),^{
        if(owner!=self.generation||!self.handoff)return;
        [self.web evaluateJavaScript:@"window.__vrcrpPaintState?.()" completionHandler:^(id result,NSError *error){
            if(owner!=self.generation||!self.handoff)return;
            if(!self.waitingReturn&&[result isKindOfClass:NSDictionary.class]&&[result[@"key"] isEqual:self.currentKey]&&[result[@"ready"] isEqual:@YES])[self painted:self.currentKey];
            if(self.handoff&&!self.paintRequested)[self probeReadiness:owner];
        }];
    });
}
- (void)finishHandoffWithImage:(UIImage *)image owner:(NSUInteger)owner key:(NSString *)key cover:(UIImageView *)cover {
    if(owner!=self.generation||![key isEqual:self.currentKey]||cover!=self.handoffView||!self.handoff)return;
    // A snapshot is a compositor barrier. Never swap the cached parent for
    // a newly returned (possibly empty) bitmap immediately before the fade.
    // Invalidate all competing snapshot/deadline callbacks before fading.
    NSUInteger fadeOwner=++self.generation;
    [UIView animateWithDuration:UIAccessibilityIsReduceMotionEnabled()?0:.14 delay:0 options:UIViewAnimationOptionAllowUserInteraction|UIViewAnimationOptionBeginFromCurrentState animations:^{cover.alpha=0;}
      completion:^(BOOL finished){if(fadeOwner==self.generation)[self complete];}];
}
- (void)revealPaintedPage {
    if(!self.handoff||self.waitingReturn||self.interactive||!self.routeReady||self.paintRequested)return;
    self.paintRequested=YES;NSUInteger owner=self.generation;NSString *key=self.currentKey;UIImageView *cover=self.handoffView;
    __block BOOL replied=NO;
    WKSnapshotConfiguration *config=[WKSnapshotConfiguration new];config.afterScreenUpdates=YES;
    [self.web takeSnapshotWithConfiguration:config completionHandler:^(UIImage *image,NSError *error){
        replied=YES;
        if(owner!=self.generation||![key isEqual:self.currentKey])return;
        if(image&&[self blankImage:image]){self.paintRequested=NO;self.routeReady=NO;[self probeReadiness:owner];return;}
        // The snapshot is a WebKit rendering barrier, not a cached route signal.
        // Keep a single parent surface throughout the handoff, then reveal live UI.
        [self finishHandoffWithImage:image owner:owner key:key cover:cover];
    }];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,450*NSEC_PER_MSEC),dispatch_get_main_queue(),^{
        if(!replied)[self finishHandoffWithImage:nil owner:owner key:key cover:cover];
    });
}
- (void)moveToKey:(NSString *)key parent:(NSString *)parent path:(NSString *)path direction:(NSString *)direction {
    if(!key.length)return;
    NSString *oldKey=self.currentKey,*oldPath=self.currentPath;VRPageImage *old=[self pageForKey:oldKey];UIImage *oldImage=self.handoff?self.handoffView.image:old.image;
    self.currentKey=key;self.parentKey=parent;self.currentPath=path;
    if([oldKey isEqual:key]&&[oldPath isEqual:path])return;
    [self cancelCapture];self.routeReady=NO;
    BOOL returned=self.waitingReturn;
    if(returned){
        self.waitingReturn=NO;self.routeReady=NO;
        [self holdCover:self.handoffView?:self.underlay];return;
    }
    NSString *pressedEntry=self.pressedEntry;CGRect pressedFrame=self.pressedFrame;UIColor *pressedInk=self.pressedInk;NSTimeInterval pressDeadline=self.pressDeadline;
    if(self.transitioning||self.handoff)[self complete];
    // A second tap can arrive during the previous handoff's fade. Completing
    // that presentation must not erase the newly pressed row's feedback.
    if([direction isEqual:@"push"]&&[pressedEntry isEqual:oldKey]){self.pressedEntry=pressedEntry;self.pressedFrame=pressedFrame;self.pressedInk=pressedInk;self.pressDeadline=pressDeadline;}
    // Query/history entries belonging to a modal are not another page. Never
    // replay a cached list as a returning destination when the path is equal.
    if([oldKey isEqual:key]||[oldPath isEqual:path])return;
    VRPageImage *destination=[self pageForKey:key]?:[self pageForKey:self.paths[path]];
    if(![destination.path isEqual:path])destination=nil;
    UIImage *destinationImage=destination.image?:[self placeholderForPath:path];
    if(!oldKey.length||[direction isEqual:@"none"]||[direction isEqual:@"tab"]||UIAccessibilityIsReduceMotionEnabled()){
        [self layout];self.outgoing.image=destinationImage;self.outgoing.backgroundColor=destination.header?:self.surfaceColor;[self holdCover:self.outgoing];return;
    }
    [self layout];NSUInteger generation=++self.generation;CGFloat width=self.web.bounds.size.width;
    self.routeReady=NO;self.animationDone=NO;[self setRunning:YES];
    if([direction isEqual:@"push"]) {
        self.underlay.image=oldImage?:[self placeholderForPath:oldPath];self.underlay.backgroundColor=old.header?:self.header.backgroundColor;self.underlay.hidden=NO;self.previewKey=oldKey;
        [self.web.superview insertSubview:self.underlay aboveSubview:self.web];
        // Press feedback belongs only to this departing presentation. Cached
        // parent images remain clean, so returning cannot restore a selection.
        if([self.pressedEntry isEqual:oldKey]&&!CGRectIsEmpty(self.pressedFrame)&&(!self.pressDeadline||self.pressDeadline>NSDate.date.timeIntervalSinceReferenceDate)){
            self.rowFeedback=[[UIView alloc] initWithFrame:self.pressedFrame];self.rowFeedback.backgroundColor=self.pressedInk;self.rowFeedback.userInteractionEnabled=NO;
            [self.underlay insertSubview:self.rowFeedback belowSubview:self.shade];
            [self fadeRowFeedback];
        }
        self.underlay.transform=CGAffineTransformIdentity;self.shade.alpha=0;
        self.outgoing.image=destinationImage;self.outgoing.backgroundColor=destination.header?:self.surfaceColor;self.outgoing.hidden=NO;
        self.outgoing.transform=CGAffineTransformMakeTranslation(width,0);
        // WebKit still contains the departing list during a React transition.
        // Slide a distinct destination surface, never translate that live list
        // into the foreground as though it were the incoming chat/profile.
        self.web.transform=CGAffineTransformIdentity;
        [UIView animateWithDuration:.24 delay:0 options:UIViewAnimationOptionCurveEaseOut|UIViewAnimationOptionAllowUserInteraction|UIViewAnimationOptionBeginFromCurrentState animations:^{
            self.outgoing.transform=CGAffineTransformIdentity;self.underlay.transform=CGAffineTransformMakeTranslation(-width*.27,0);self.shade.alpha=.2;
        } completion:^(BOOL finished){if(generation!=self.generation)return;self.animationDone=YES;self.underlay.hidden=YES;[self holdCover:self.outgoing];}];
    } else {
        [self clearRowFeedback];
        self.underlay.image=destinationImage;self.previewKey=key;
        self.underlay.backgroundColor=destination.header?:self.surfaceColor;self.underlay.hidden=NO;
        [self.web.superview insertSubview:self.underlay aboveSubview:self.web];
        self.underlay.transform=CGAffineTransformMakeTranslation(-width*.27,0);self.shade.alpha=.2;
        self.outgoing.image=oldImage?:[self placeholderForPath:oldPath];self.outgoing.hidden=NO;
        // Keep WebKit visible so painting, focus and JS acknowledgements run.
        [UIView animateWithDuration:.22 delay:0 options:UIViewAnimationOptionCurveEaseOut|UIViewAnimationOptionAllowUserInteraction|UIViewAnimationOptionBeginFromCurrentState animations:^{
            self.outgoing.transform=CGAffineTransformMakeTranslation(width,0);self.underlay.transform=CGAffineTransformIdentity;self.shade.alpha=0;
        } completion:^(BOOL finished){if(generation!=self.generation)return;self.outgoing.hidden=YES;[self holdCover:self.underlay];}];
    }
}
- (void)settled:(NSString *)key {
    // Restored scroll/draft state does not establish that WebKit painted it.
}
- (void)painted:(NSString *)key {
    if(![key isEqual:self.currentKey]||self.waitingReturn)return;
    self.routeReady=YES;[self revealPaintedPage];
}
- (BOOL)beginInteractive {
    return [self beginInteractiveKey:self.parentKey];
}
- (BOOL)beginOverlayInteractive { return [self beginInteractiveKey:self.currentKey]; }
- (BOOL)beginInteractiveKey:(NSString *)key {
    if(!key.length||self.interactive||self.waitingReturn)return NO;
    BOOL foreground=self.handoff,painted=self.routeReady;UIImage *front=self.handoffView.image;UIColor *frontColor=self.handoffView.backgroundColor;
    if(self.transitioning||self.handoff)[self complete];
    VRPageImage *target=[self pageForKey:key];
    [self layout];self.generation++;
    // A cold/evicted snapshot reduces preview detail, never back availability.
    self.underlay.image=target.image?:[self placeholderForPath:target.path?:self.parentPath?:self.currentPath];self.underlay.backgroundColor=target.header?:self.header.backgroundColor;self.underlay.hidden=NO;self.previewKey=key;
    self.fromHeader=self.header.backgroundColor;self.toHeader=target.header?:self.fromHeader;
    self.interactive=YES;self.waitingReturn=NO;self.animationDone=NO;self.routeReady=painted;self.progress=0;
    self.foregroundPreview=foreground;self.outgoing.image=front;self.outgoing.backgroundColor=frontColor;self.outgoing.hidden=!foreground;
    [self shadow:YES];[self setRunning:YES];[self updateInteractive:0];return YES;
}
- (void)updateInteractive:(CGFloat)distance {
    if(!self.interactive)return;CGFloat width=self.web.bounds.size.width;if(width<=0)return;
    self.progress=MAX(0,MIN(1,distance/width));self.web.transform=CGAffineTransformMakeTranslation(width*self.progress,0);
    if(self.foregroundPreview)self.outgoing.transform=self.web.transform;
    self.underlay.transform=CGAffineTransformMakeTranslation(-width*.27*(1-self.progress),0);self.shade.alpha=.2*(1-self.progress);[self headerAtProgress:self.progress];
}
- (void)finishInteractive:(CGFloat)distance velocity:(CGFloat)velocity cancelled:(BOOL)cancelled {
    if(!self.interactive)return;CGFloat width=self.web.bounds.size.width;
    BOOL commit=!cancelled&&velocity>-150&&(distance+velocity*.16>width*.36 || (velocity>700&&distance>12));
    NSUInteger generation=self.generation;CGFloat endpoint=commit?1:0;
    NSTimeInterval duration=MAX(.12,MIN(.32,.3*fabs(endpoint-self.progress)));
    [UIView animateWithDuration:duration delay:0 options:UIViewAnimationOptionCurveEaseOut|UIViewAnimationOptionBeginFromCurrentState|UIViewAnimationOptionAllowUserInteraction animations:^{[self updateInteractive:endpoint*width];}
      completion:^(BOOL finished){
        if(generation!=self.generation)return;
        if(!commit){[self headerAtProgress:0];self.interactive=NO;if(self.foregroundPreview){self.underlay.hidden=YES;[self holdCover:self.outgoing];}else[self complete];return;}
        self.interactive=NO;self.waitingReturn=YES;self.routeReady=NO;self.foregroundPreview=NO;self.outgoing.hidden=YES;
        // Promote the already-visible parent before restoring WebKit's frame.
        // Removing it on route announcement would expose the departing child.
        [self.web.superview insertSubview:self.underlay aboveSubview:self.web];[self holdCover:self.underlay];
        if(self.onRequestBack)self.onRequestBack();else[self abortReturn];
        NSUInteger requestOwner=self.generation;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW,350*NSEC_PER_MSEC),dispatch_get_main_queue(),^{if(requestOwner==self.generation&&self.waitingReturn)[self abortReturn];});
      }];
}
- (void)abortReturn { if(self.fromHeader&&self.onHeaderColor)self.onHeaderColor(self.fromHeader);[self complete]; }
- (void)clear { [self complete];[self.images removeAllObjects];[self.retainedPages removeAllObjects];[self.paths removeAllObjects];[self.placeholderLayouts removeAllObjects];self.ancestors=@[];self.captureGeneration++; }
@end
