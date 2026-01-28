import Foundation

// エージェントの状態
enum AgentState: Equatable {
    case idle              // 待機中
    case listening         // ウェイクワード待ち
    case activated         // ウェイクワード検出、コマンド待ち
    case processing        // コマンド処理中
    case responding        // 結果を返答中
    case error(String)     // エラー
}

// ユーザーの意図
enum UserIntent: Equatable {
    case sendEmail(to: String, subject: String, body: String)
    case checkEmail
    case createEvent(title: String, date: String, time: String)
    case checkSchedule(date: String)
    case createTask(title: String, notes: String)
    case listTasks
    case setReminder(title: String, date: String, time: String)
    case unknown(rawText: String)

    var displayName: String {
        switch self {
        case .sendEmail: return "メール送信"
        case .checkEmail: return "メール確認"
        case .createEvent: return "予定作成"
        case .checkSchedule: return "予定確認"
        case .createTask: return "タスク作成"
        case .listTasks: return "タスク一覧"
        case .setReminder: return "リマインダー設定"
        case .unknown: return "不明なコマンド"
        }
    }

    var iconName: String {
        switch self {
        case .sendEmail: return "envelope.fill"
        case .checkEmail: return "envelope.open.fill"
        case .createEvent: return "calendar.badge.plus"
        case .checkSchedule: return "calendar"
        case .createTask: return "checklist"
        case .listTasks: return "list.bullet"
        case .setReminder: return "bell.fill"
        case .unknown: return "questionmark.circle"
        }
    }
}

// コマンド実行結果
struct CommandResult: Identifiable, Equatable {
    let id = UUID()
    let intent: UserIntent
    let rawText: String
    let response: String
    let success: Bool
    let timestamp: Date

    static func == (lhs: CommandResult, rhs: CommandResult) -> Bool {
        lhs.id == rhs.id
    }
}
