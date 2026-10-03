import Foundation
import AVFoundation
import CoreVideo

let asset=AVURLAsset(url:URL(fileURLWithPath:CommandLine.arguments[1]))
let reader=try AVAssetReader(asset:asset)
let output=AVAssetReaderTrackOutput(track:asset.tracks(withMediaType:.video).first!,outputSettings:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA])
reader.add(output)
guard reader.startReading() else { fatalError("Cannot read displayed frames") }
var started=false,frames=0,blankFrames=0,blueFrames=0
while let sample=output.copyNextSampleBuffer(),let buffer=CMSampleBufferGetImageBuffer(sample) {
    CVPixelBufferLockBaseAddress(buffer,.readOnly)
    let w=CVPixelBufferGetWidth(buffer),h=CVPixelBufferGetHeight(buffer),stride=CVPixelBufferGetBytesPerRow(buffer)
    let p=CVPixelBufferGetBaseAddress(buffer)!.assumingMemoryBound(to:UInt8.self)
    let center=(h/2)*stride+(w/2)*4
    let rgb=[Int(p[center+2]),Int(p[center+1]),Int(p[center])]
    if zip(rgb,[23,105,170]).reduce(0,{$0+abs($1.0-$1.1)})<30 {started=true;blueFrames += 1}
    if started {
        var marked=0
        for y in 0..<36 { for x in 0..<48 {
            let offset=Int(Double(h)*(0.2+Double(y)*0.62/36))*stride+Int(Double(w)*(0.12+Double(x)*0.76/48))*4
            if min(p[offset],min(p[offset+1],p[offset+2]))<235 {marked += 1}
        }}
        frames += 1;if marked<3 {blankFrames += 1}
    }
    CVPixelBufferUnlockBaseAddress(buffer,.readOnly)
}
guard reader.status == .completed else {fatalError("Incomplete recording")}
let report:[String:Any]=["frames":frames,"blankFrames":blankFrames,"cachedParentFrames":blueFrames]
let data=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys])
try data.write(to:URL(fileURLWithPath:CommandLine.arguments[2]));print(String(data:data,encoding:.utf8)!)
guard frames>30,blueFrames>5,blankFrames==0 else {fatalError("White frame appeared during displayed navigation: \(report)")}
print("PASS: actual iOS slow-entry/tab/back recording contains zero white frames after the first rendered page")
