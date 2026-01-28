import Foundation

enum GoogleConfig {
    // Google Cloud Console で取得したクライアントID
    // 例: "123456789-abcdef.apps.googleusercontent.com"
    static let clientID = "YOUR_GOOGLE_CLIENT_ID"

    // リダイレクトURI (クライアントIDの逆ドメイン形式)
    // 例: "com.googleusercontent.apps.123456789-abcdef:/oauth2callback"
    static var redirectURI: String {
        let reversed = clientID.components(separatedBy: ".").reversed().joined(separator: ".")
        return "\(reversed):/oauth2callback"
    }

    // URLスキーム (Info.plistにも登録が必要)
    static var urlScheme: String {
        clientID.components(separatedBy: ".").reversed().joined(separator: ".")
    }

    // OAuth 2.0 エンドポイント
    static let authEndpoint = "https://accounts.google.com/o/oauth2/v2/auth"
    static let tokenEndpoint = "https://oauth2.googleapis.com/token"

    // APIスコープ
    static let scopes = [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/tasks",
        "https://www.googleapis.com/auth/tasks.readonly"
    ]

    // OpenAI API キー（オプション: 高度なNLU用）
    static var openAIAPIKey: String {
        get { UserDefaults.standard.string(forKey: "openai_api_key") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "openai_api_key") }
    }

    // ウェイクワード設定
    static var wakeWord: String {
        get { UserDefaults.standard.string(forKey: "wake_word") ?? "ヘイエージェント" }
        set { UserDefaults.standard.set(newValue, forKey: "wake_word") }
    }
}
