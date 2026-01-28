import Foundation

class GmailService {
    private let baseURL = "https://gmail.googleapis.com/gmail/v1/users/me"
    private let authManager: GoogleAuthManager

    init(authManager: GoogleAuthManager) {
        self.authManager = authManager
    }

    // MARK: - メール送信

    func sendEmail(to: String, subject: String, body: String) async throws -> String {
        let accessToken = try await authManager.getAccessToken()

        // RFC 2822 形式のメールメッセージを作成
        let message = """
        To: \(to)
        Subject: =?UTF-8?B?\(Data(subject.utf8).base64EncodedString())?=
        Content-Type: text/plain; charset=UTF-8
        Content-Transfer-Encoding: base64

        \(Data(body.utf8).base64EncodedString())
        """

        // Base64url エンコード
        let rawMessage = Data(message.utf8)
            .base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")

        var request = URLRequest(url: URL(string: "\(baseURL)/messages/send")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let sendRequest = GmailSendRequest(raw: rawMessage)
        request.httpBody = try JSONEncoder().encode(sendRequest)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw GoogleServiceError.sendFailed
        }

        return "メールを \(to) に送信しました"
    }

    // MARK: - 未読メール取得

    func getUnreadEmails(maxResults: Int = 5) async throws -> [GmailMessage] {
        let accessToken = try await authManager.getAccessToken()

        var components = URLComponents(string: "\(baseURL)/messages")!
        components.queryItems = [
            URLQueryItem(name: "q", value: "is:unread"),
            URLQueryItem(name: "maxResults", value: "\(maxResults)")
        ]

        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, _) = try await URLSession.shared.data(for: request)
        let messageList = try JSONDecoder().decode(GmailMessageList.self, from: data)

        guard let messageRefs = messageList.messages else {
            return []
        }

        // 各メッセージの詳細を取得
        var messages: [GmailMessage] = []
        for ref in messageRefs.prefix(maxResults) {
            let message = try await getMessageDetail(id: ref.id, accessToken: accessToken)
            messages.append(message)
        }

        return messages
    }

    private func getMessageDetail(id: String, accessToken: String) async throws -> GmailMessage {
        var request = URLRequest(url: URL(string: "\(baseURL)/messages/\(id)?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date")!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(GmailMessage.self, from: data)
    }

    // MARK: - 未読メールの要約生成

    func formatUnreadSummary(_ messages: [GmailMessage]) -> String {
        if messages.isEmpty {
            return "未読メールはありません"
        }

        var summary = "未読メールが\(messages.count)件あります:\n"
        for (index, message) in messages.enumerated() {
            let from = message.from ?? "不明"
            let subject = message.subject ?? "(件名なし)"
            summary += "\(index + 1). \(from) - \(subject)\n"
        }
        return summary
    }
}
