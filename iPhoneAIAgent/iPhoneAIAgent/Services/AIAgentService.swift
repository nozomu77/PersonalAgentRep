import Foundation

class AIAgentService {

    // MARK: - 意図解析 (ルールベース)

    func parseIntent(from text: String) async -> UserIntent {
        let normalized = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        // OpenAI APIが設定されていれば高度な解析を試行
        if !GoogleConfig.openAIAPIKey.isEmpty {
            if let intent = await parseWithOpenAI(text: text) {
                return intent
            }
        }

        // ルールベースのフォールバック
        return parseWithRules(normalized: normalized, original: text)
    }

    // MARK: - ルールベース解析

    private func parseWithRules(normalized: String, original: String) -> UserIntent {
        // メール送信
        if containsAny(normalized, keywords: ["メール", "メールして", "メールを送", "mail", "送信"]) {
            let to = extractEmailRecipient(from: original)
            let subject = extractEmailSubject(from: original)
            let body = extractEmailBody(from: original)
            return .sendEmail(to: to, subject: subject, body: body)
        }

        // メール確認
        if containsAny(normalized, keywords: ["未読", "メール確認", "メールチェック", "受信", "メールを見"]) {
            return .checkEmail
        }

        // 予定作成
        if containsAny(normalized, keywords: ["予定を入れ", "予定を作", "スケジュール", "カレンダーに", "会議を入れ", "予定を追加"]) {
            let title = extractEventTitle(from: original)
            let date = extractDate(from: original)
            let time = extractTime(from: original)
            return .createEvent(title: title, date: date, time: time)
        }

        // 予定確認
        if containsAny(normalized, keywords: ["今日の予定", "予定を教え", "スケジュール確認", "予定は", "予定を確認"]) {
            let date = extractDate(from: original)
            return .checkSchedule(date: date.isEmpty ? "today" : date)
        }

        // リマインダー
        if containsAny(normalized, keywords: ["リマインド", "リマインダー", "忘れない", "思い出させ", "通知して"]) {
            let title = extractReminderTitle(from: original)
            let date = extractDate(from: original)
            let time = extractTime(from: original)
            return .setReminder(title: title, date: date, time: time)
        }

        // タスク作成
        if containsAny(normalized, keywords: ["タスク", "やること", "todo", "追加して", "登録して"]) {
            let title = extractTaskTitle(from: original)
            return .createTask(title: title, notes: "")
        }

        // タスク一覧
        if containsAny(normalized, keywords: ["タスク一覧", "タスクを見", "やること一覧", "タスク確認"]) {
            return .listTasks
        }

        return .unknown(rawText: original)
    }

    // MARK: - OpenAI API による高度な意図解析

    private func parseWithOpenAI(text: String) async -> UserIntent? {
        let apiKey = GoogleConfig.openAIAPIKey
        guard !apiKey.isEmpty else { return nil }

        let prompt = """
        ユーザーの発話から意図を解析し、以下のJSON形式で返してください。

        意図の種類:
        - send_email: メール送信 (to, subject, body)
        - check_email: メール確認
        - create_event: 予定作成 (title, date, time)
        - check_schedule: 予定確認 (date)
        - create_task: タスク作成 (title, notes)
        - list_tasks: タスク一覧
        - set_reminder: リマインダー (title, date, time)
        - unknown: 不明

        発話: "\(text)"

        JSON形式で返答:
        {"intent": "...", "params": {...}}
        """

        var request = URLRequest(url: URL(string: "https://api.openai.com/v1/chat/completions")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let requestBody: [String: Any] = [
            "model": "gpt-4o-mini",
            "messages": [
                ["role": "system", "content": "あなたは日本語の音声コマンドを解析するアシスタントです。指定されたJSON形式のみで返答してください。"],
                ["role": "user", "content": prompt]
            ],
            "temperature": 0.1,
            "max_tokens": 200
        ]

        request.httpBody = try? JSONSerialization.data(withJSONObject: requestBody)

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return parseOpenAIResponse(data)
        } catch {
            print("OpenAI API エラー: \(error)")
            return nil
        }
    }

    private func parseOpenAIResponse(_ data: Data) -> UserIntent? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let message = choices.first?["message"] as? [String: Any],
              let content = message["content"] as? String else {
            return nil
        }

        // JSONを抽出（コードブロック内にある場合も対応）
        let jsonString = content
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let jsonData = jsonString.data(using: .utf8),
              let parsed = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
              let intent = parsed["intent"] as? String,
              let params = parsed["params"] as? [String: String] else {
            return nil
        }

        switch intent {
        case "send_email":
            return .sendEmail(
                to: params["to"] ?? "",
                subject: params["subject"] ?? "",
                body: params["body"] ?? ""
            )
        case "check_email":
            return .checkEmail
        case "create_event":
            return .createEvent(
                title: params["title"] ?? "",
                date: params["date"] ?? "",
                time: params["time"] ?? ""
            )
        case "check_schedule":
            return .checkSchedule(date: params["date"] ?? "today")
        case "create_task":
            return .createTask(
                title: params["title"] ?? "",
                notes: params["notes"] ?? ""
            )
        case "list_tasks":
            return .listTasks
        case "set_reminder":
            return .setReminder(
                title: params["title"] ?? "",
                date: params["date"] ?? "",
                time: params["time"] ?? ""
            )
        default:
            return nil
        }
    }

    // MARK: - テキスト抽出ヘルパー

    private func containsAny(_ text: String, keywords: [String]) -> Bool {
        keywords.contains { text.contains($0) }
    }

    private func extractEmailRecipient(from text: String) -> String {
        // 「〜に」「〜宛て」パターン
        let patterns = [
            "(.+?)に(メール|送信)",
            "(.+?)宛て",
            "(.+?)へ(メール|送信)"
        ]
        for pattern in patterns {
            if let match = text.range(of: pattern, options: .regularExpression) {
                let matched = String(text[match])
                let name = matched
                    .replacingOccurrences(of: "にメール", with: "")
                    .replacingOccurrences(of: "に送信", with: "")
                    .replacingOccurrences(of: "宛て", with: "")
                    .replacingOccurrences(of: "へメール", with: "")
                    .replacingOccurrences(of: "へ送信", with: "")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if !name.isEmpty { return name }
            }
        }
        return ""
    }

    private func extractEmailSubject(from text: String) -> String {
        let patterns = [
            "件名は(.+?)(?:で|、|$)",
            "タイトルは(.+?)(?:で|、|$)",
            "について(.+?)(?:を|、|$)"
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let range = Range(match.range(at: 1), in: text) {
                return String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return ""
    }

    private func extractEmailBody(from text: String) -> String {
        let patterns = [
            "内容は(.+?)$",
            "本文は(.+?)$",
            "と伝えて(.+?)$"
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let range = Range(match.range(at: 1), in: text) {
                return String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return ""
    }

    private func extractEventTitle(from text: String) -> String {
        let patterns = [
            "「(.+?)」",
            "(.+?)を(予定|スケジュール|カレンダー)",
            "(.+?)の(予定|会議|ミーティング)"
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let range = Range(match.range(at: 1), in: text) {
                return String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return text
    }

    private func extractDate(from text: String) -> String {
        // 今日・明日・明後日
        if text.contains("今日") { return "today" }
        if text.contains("明日") { return "tomorrow" }
        if text.contains("明後日") { return "day_after_tomorrow" }

        // X月X日パターン
        if let regex = try? NSRegularExpression(pattern: "(\\d{1,2})月(\\d{1,2})日"),
           let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
           let monthRange = Range(match.range(at: 1), in: text),
           let dayRange = Range(match.range(at: 2), in: text) {
            let month = String(text[monthRange])
            let day = String(text[dayRange])
            let year = Calendar.current.component(.year, from: Date())
            return "\(year)-\(month.padLeft(toLength: 2))-\(day.padLeft(toLength: 2))"
        }

        return ""
    }

    private func extractTime(from text: String) -> String {
        // X時X分パターン
        if let regex = try? NSRegularExpression(pattern: "(\\d{1,2})時(\\d{1,2})?分?"),
           let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
           let hourRange = Range(match.range(at: 1), in: text) {
            let hour = String(text[hourRange])
            var minute = "00"
            if let minuteRange = Range(match.range(at: 2), in: text) {
                minute = String(text[minuteRange])
            }
            return "\(hour.padLeft(toLength: 2)):\(minute.padLeft(toLength: 2))"
        }

        return ""
    }

    private func extractReminderTitle(from text: String) -> String {
        let patterns = [
            "「(.+?)」",
            "(.+?)を(リマインド|リマインダー|忘れない|通知)",
            "(リマインド|リマインダー|通知)して(.+?)$"
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) {
                let captureIndex = match.numberOfRanges > 2 ? 2 : 1
                if let range = Range(match.range(at: captureIndex), in: text) {
                    let result = String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !result.isEmpty && !["リマインド", "リマインダー", "通知"].contains(result) {
                        return result
                    }
                }
            }
        }
        return text
    }

    private func extractTaskTitle(from text: String) -> String {
        let patterns = [
            "「(.+?)」",
            "(.+?)を(タスク|追加|登録)",
            "(タスク|追加|登録)して(.+?)$"
        ]
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) {
                let captureIndex = match.numberOfRanges > 2 ? 2 : 1
                if let range = Range(match.range(at: captureIndex), in: text) {
                    let result = String(text[range]).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !result.isEmpty && !["タスク", "追加", "登録"].contains(result) {
                        return result
                    }
                }
            }
        }
        return text
    }
}

// MARK: - String Extension

extension String {
    func padLeft(toLength length: Int, withPad character: Character = "0") -> String {
        let deficit = length - count
        if deficit <= 0 { return self }
        return String(repeating: character, count: deficit) + self
    }
}
