import XCTest
@testable import iPhoneAIAgent

final class AIAgentServiceTests: XCTestCase {
    private var agentService: AIAgentService!

    override func setUp() {
        super.setUp()
        agentService = AIAgentService()
    }

    // MARK: - メール関連の意図解析テスト

    func testParseEmailSendIntent() async {
        let intent = await agentService.parseIntent(from: "田中さんにメールして")
        if case .sendEmail(let to, _, _) = intent {
            XCTAssertEqual(to, "田中さん")
        } else {
            XCTFail("Expected sendEmail intent, got \(intent)")
        }
    }

    func testParseEmailCheckIntent() async {
        let intent = await agentService.parseIntent(from: "未読メールを確認して")
        if case .checkEmail = intent {
            // OK
        } else {
            XCTFail("Expected checkEmail intent, got \(intent)")
        }
    }

    // MARK: - カレンダー関連の意図解析テスト

    func testParseCreateEventIntent() async {
        let intent = await agentService.parseIntent(from: "明日の10時に会議を予定に入れて")
        if case .createEvent(_, let date, let time) = intent {
            XCTAssertEqual(date, "tomorrow")
            XCTAssertEqual(time, "10:00")
        } else {
            XCTFail("Expected createEvent intent, got \(intent)")
        }
    }

    func testParseCheckScheduleIntent() async {
        let intent = await agentService.parseIntent(from: "今日の予定を教えて")
        if case .checkSchedule(let date) = intent {
            XCTAssertEqual(date, "today")
        } else {
            XCTFail("Expected checkSchedule intent, got \(intent)")
        }
    }

    // MARK: - タスク関連の意図解析テスト

    func testParseReminderIntent() async {
        let intent = await agentService.parseIntent(from: "買い物をリマインドして")
        if case .setReminder(let title, _, _) = intent {
            XCTAssertFalse(title.isEmpty)
        } else {
            XCTFail("Expected setReminder intent, got \(intent)")
        }
    }

    // MARK: - 時間抽出テスト

    func testTimeExtraction() async {
        let intent = await agentService.parseIntent(from: "15時30分に会議を予定に入れて")
        if case .createEvent(_, _, let time) = intent {
            XCTAssertEqual(time, "15:30")
        } else {
            XCTFail("Expected createEvent intent with time, got \(intent)")
        }
    }

    // MARK: - 日付抽出テスト

    func testDateExtractionTomorrow() async {
        let intent = await agentService.parseIntent(from: "明日の予定を確認して")
        if case .checkSchedule(let date) = intent {
            XCTAssertEqual(date, "tomorrow")
        } else {
            XCTFail("Expected checkSchedule with 'tomorrow', got \(intent)")
        }
    }

    // MARK: - 不明なコマンドのテスト

    func testUnknownIntent() async {
        let intent = await agentService.parseIntent(from: "こんにちは")
        if case .unknown = intent {
            // OK
        } else {
            XCTFail("Expected unknown intent, got \(intent)")
        }
    }

    // MARK: - String Extension テスト

    func testPadLeft() {
        XCTAssertEqual("5".padLeft(toLength: 2), "05")
        XCTAssertEqual("12".padLeft(toLength: 2), "12")
        XCTAssertEqual("123".padLeft(toLength: 2), "123")
    }
}
