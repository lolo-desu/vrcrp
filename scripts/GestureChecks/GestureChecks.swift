import XCTest
import UIKit

final class GestureChecks: XCTestCase {
    let app=XCUIApplication(bundleIdentifier:"local.erp.stable")
    override func setUpWithError() throws {
        continueAfterFailure=false
        app.launchArguments=["--verify-gestures"]
        app.launch()
        let chat=app.links["虚构会话"]
        XCTAssertTrue(chat.waitForExistence(timeout:15));chat.tap()
        openProfile()
    }
    func openProfile() {
        let link=app.links["打开资料"]
        XCTAssertTrue(link.waitForExistence(timeout:5));link.tap()
        XCTAssertTrue(app.staticTexts["资料已就绪"].waitForExistence(timeout:8))
    }
    func backFromPhoto() {
        let photo=app.buttons["资料照片"]
        XCTAssertTrue(photo.waitForExistence(timeout:3))
        photo.coordinate(withNormalizedOffset:CGVector(dx:0.12,dy:0.5)).press(forDuration:0.05,thenDragTo:photo.coordinate(withNormalizedOffset:CGVector(dx:0.95,dy:0.5)),withVelocity:.slow,thenHoldForDuration:0)
        XCTAssertTrue(app.staticTexts["聊天页面"].waitForExistence(timeout:5))
    }
    func displayedPixel(at point:CGPoint) -> [UInt8] {
        let image=app.screenshot().image.cgImage!
        let x=point.x*CGFloat(image.width)/app.frame.width,y=point.y*CGFloat(image.height)/app.frame.height
        let cropped=image.cropping(to:CGRect(x:x,y:y,width:1,height:1))!
        var pixel=[UInt8](repeating:0,count:4)
        pixel.withUnsafeMutableBytes { raw in
            let context=CGContext(data:raw.baseAddress,width:1,height:1,bitsPerComponent:8,bytesPerRow:4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
            context.draw(cropped,in:CGRect(x:0,y:0,width:1,height:1))
        }
        return Array(pixel.prefix(3))
    }
    func assertLivePhotoScroll(_ photo:XCUIElement) {
        let frame=photo.frame,point=CGPoint(x:frame.midX,y:frame.maxY-60),before=displayedPixel(at:point)
        photo.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.88)).press(forDuration:0.05,thenDragTo:photo.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.12)),withVelocity:.slow,thenHoldForDuration:0)
        let status=app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","页面滚动 ")).firstMatch
        expectation(for:NSPredicate { _,_ in status.exists && status.label != "页面滚动 0" },evaluatedWith:status)
        waitForExpectations(timeout:4)
        let after=displayedPixel(at:point)
        XCTAssertGreaterThan(zip(before,after).reduce(0){$0+abs(Int($1.0)-Int($1.1))},40,"A frozen preview hid the actual scroll despite updated DOM/AX state")
    }
    func testPhotoTapAndRightSwipeAfterLayout() {
        app.buttons["资料照片"].tap()
        XCTAssertTrue(app.staticTexts["照片点击 1"].waitForExistence(timeout:3))
        backFromPhoto()
        openProfile();backFromPhoto()
    }
    func testSlowVerticalScrollFromPhoto() {
        let photo=app.buttons["资料照片"]
        assertLivePhotoScroll(photo)
        XCTAssertFalse(app.links["打开资料"].exists,"Vertical scroll unexpectedly returned")
    }
    func testHorizontalAlbumKeepsItsGesture() {
        let album=app.staticTexts["相册 A"]
        album.coordinate(withNormalizedOffset:CGVector(dx:0.85,dy:0.5)).press(forDuration:0.05,thenDragTo:album.coordinate(withNormalizedOffset:CGVector(dx:0.1,dy:0.5)),withVelocity:.slow,thenHoldForDuration:0)
        let status=app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","相册位置 ")).firstMatch
        let moved=NSPredicate { _,_ in status.exists && status.label != "相册位置 0" }
        expectation(for:moved,evaluatedWith:status);waitForExpectations(timeout:4)
        XCTAssertTrue(app.staticTexts["个人资料"].exists)
        backFromPhoto()
    }
    func testStalledSnapshotCannotFreezeReturnedPage() {
        app.buttons["冻结截图测试"].tap();backFromPhoto()
        let photoReturn=app.links["打开资料"]
        XCTAssertTrue(photoReturn.isHittable,"Parent stayed covered after dropped snapshot callback")
        openProfile()
        let photo=app.buttons["资料照片"]
        assertLivePhotoScroll(photo)
    }
    func openLikeSheet() {
        let list=app.links["喜欢列表"]
        if list.exists { list.tap() }
        let open=app.buttons["打开喜欢详情"]
        XCTAssertTrue(open.waitForExistence(timeout:5));open.tap()
        XCTAssertTrue(app.staticTexts["喜欢详情标题"].waitForExistence(timeout:3))
    }
    func assertSheetClosed() {
        let open=app.buttons["打开喜欢详情"]
        expectation(for:NSPredicate { _,_ in open.isHittable && !self.app.staticTexts["喜欢详情标题"].exists },evaluatedWith:open)
        waitForExpectations(timeout:12)
    }
    func testLikeSheetRightSwipeAndShortDragCancellation() {
        openLikeSheet()
        let photo=app.buttons["喜欢资料照片"]
        photo.coordinate(withNormalizedOffset:CGVector(dx:0.25,dy:0.5)).press(forDuration:0.05,thenDragTo:photo.coordinate(withNormalizedOffset:CGVector(dx:0.43,dy:0.5)),withVelocity:.slow,thenHoldForDuration:0.2)
        XCTAssertTrue(app.staticTexts["喜欢详情标题"].exists,"Short sheet drag should cancel")
        photo.coordinate(withNormalizedOffset:CGVector(dx:0.12,dy:0.5)).press(forDuration:0.05,thenDragTo:photo.coordinate(withNormalizedOffset:CGVector(dx:0.98,dy:0.5)),withVelocity:.slow,thenHoldForDuration:0)
        assertSheetClosed()
    }
    func testLikeSheetBodyScrollAndDownSwipe() {
        openLikeSheet()
        let photo=app.buttons["喜欢资料照片"]
        photo.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.9)).press(forDuration:0.05,thenDragTo:photo.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.1)),withVelocity:.slow,thenHoldForDuration:0)
        let status=app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","弹层滚动 ")).firstMatch
        expectation(for:NSPredicate { _,_ in status.exists && status.label != "弹层滚动 0" },evaluatedWith:status);waitForExpectations(timeout:4)
        let content=app.staticTexts["弹层资料内容 3"]
        content.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.85)),withVelocity:.slow,thenHoldForDuration:0)
        XCTAssertTrue(app.staticTexts["喜欢详情标题"].exists,"Pulling scrolled content should scroll, not dismiss")
        let title=app.staticTexts["喜欢详情标题"]
        title.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.5)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.4,dy:0.7)),withVelocity:.slow,thenHoldForDuration:0)
        assertSheetClosed()
        openLikeSheet()
        app.buttons["喜欢资料照片"].coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.4)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.92)),withVelocity:.slow,thenHoldForDuration:0)
        assertSheetClosed()
    }
    func externalEdgeDrag(_ end:CGFloat) {
        app.coordinate(withNormalizedOffset:CGVector(dx:0.008,dy:0.45)).press(forDuration:0.05,thenDragTo:app.coordinate(withNormalizedOffset:CGVector(dx:end,dy:0.45)),withVelocity:.slow,thenHoldForDuration:0.2)
    }
    func testExternalRootSwipeCancellationAndReturn() {
        app.links["外链测试"].tap()
        XCTAssertTrue(app.staticTexts["External A"].firstMatch.waitForExistence(timeout:8))
        externalEdgeDrag(0.16)
        XCTAssertTrue(app.buttons["关闭外部网站"].exists,"Short external swipe must cancel")
        externalEdgeDrag(0.92)
        XCTAssertTrue(app.staticTexts["资料已就绪"].waitForExistence(timeout:5))
        XCTAssertFalse(app.buttons["关闭外部网站"].exists,"Root swipe did not return to the app")
    }
    func testExternalHistorySwipeThenReturnToApp() {
        app.links["外链测试"].tap()
        let next=app.links["Next page"]
        XCTAssertTrue(next.waitForExistence(timeout:8));next.tap()
        XCTAssertTrue(app.staticTexts["External B"].firstMatch.waitForExistence(timeout:8))
        externalEdgeDrag(0.92)
        XCTAssertTrue(app.staticTexts["External A"].firstMatch.waitForExistence(timeout:5))
        XCTAssertTrue(app.buttons["关闭外部网站"].exists,"History swipe closed the browser")
        externalEdgeDrag(0.92)
        XCTAssertTrue(app.staticTexts["资料已就绪"].waitForExistence(timeout:5))
    }
}
