import Foundation

class GoogleCalendarService {
    private let baseURL = "https://www.googleapis.com/calendar/v3"
    private let authManager: GoogleAuthManager

    init(authManager: GoogleAuthManager) {
        self.authManager = authManager
    }

    // MARK: - 予定作成

    func createEvent(title: String, date: String, time: String, duration: Int = 60) async throws -> String {
        let accessToken = try await authManager.getAccessToken()

        let (startDateTime, endDateTime) = buildDateTimes(date: date, time: time, durationMinutes: duration)

        let event = CalendarEventCreate(
            summary: title,
            description: nil,
            start: CalendarEvent.CalendarDateTime(dateTime: startDateTime, date: nil, timeZone: "Asia/Tokyo"),
            end: CalendarEvent.CalendarDateTime(dateTime: endDateTime, date: nil, timeZone: "Asia/Tokyo"),
            location: nil
        )

        var request = URLRequest(url: URL(string: "\(baseURL)/calendars/primary/events")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(event)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw GoogleServiceError.createFailed
        }

        return "「\(title)」を\(formatDisplayDate(date))の\(time.isEmpty ? "終日" : time)に登録しました"
    }

    // MARK: - 予定取得

    func getEvents(date: String) async throws -> [CalendarEvent] {
        let accessToken = try await authManager.getAccessToken()

        let (timeMin, timeMax) = buildDateRange(date: date)

        var components = URLComponents(string: "\(baseURL)/calendars/primary/events")!
        components.queryItems = [
            URLQueryItem(name: "timeMin", value: timeMin),
            URLQueryItem(name: "timeMax", value: timeMax),
            URLQueryItem(name: "singleEvents", value: "true"),
            URLQueryItem(name: "orderBy", value: "startTime"),
            URLQueryItem(name: "maxResults", value: "10")
        ]

        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, _) = try await URLSession.shared.data(for: request)
        let eventList = try JSONDecoder().decode(CalendarEventList.self, from: data)

        return eventList.items ?? []
    }

    // MARK: - 予定の要約生成

    func formatEventsSummary(_ events: [CalendarEvent], date: String) -> String {
        let displayDate = formatDisplayDate(date)

        if events.isEmpty {
            return "\(displayDate)の予定はありません"
        }

        var summary = "\(displayDate)の予定は\(events.count)件です:\n"
        for (index, event) in events.enumerated() {
            let title = event.summary ?? "(タイトルなし)"
            let time = event.displayTime
            summary += "\(index + 1). \(time) \(title)\n"
        }
        return summary
    }

    // MARK: - 日時ヘルパー

    private func buildDateTimes(date: String, time: String, durationMinutes: Int) -> (String, String) {
        let calendar = Calendar.current
        var targetDate = resolveDate(date)

        if !time.isEmpty {
            let parts = time.split(separator: ":").map { Int($0) ?? 0 }
            if parts.count >= 2 {
                var components = calendar.dateComponents([.year, .month, .day], from: targetDate)
                components.hour = parts[0]
                components.minute = parts[1]
                components.timeZone = TimeZone(identifier: "Asia/Tokyo")
                targetDate = calendar.date(from: components) ?? targetDate
            }
        }

        let endDate = calendar.date(byAdding: .minute, value: durationMinutes, to: targetDate) ?? targetDate

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(identifier: "Asia/Tokyo")

        return (formatter.string(from: targetDate), formatter.string(from: endDate))
    }

    private func buildDateRange(date: String) -> (String, String) {
        let calendar = Calendar.current
        let targetDate = resolveDate(date)
        let startOfDay = calendar.startOfDay(for: targetDate)
        let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(identifier: "Asia/Tokyo")

        return (formatter.string(from: startOfDay), formatter.string(from: endOfDay))
    }

    private func resolveDate(_ date: String) -> Date {
        let calendar = Calendar.current
        let today = Date()

        switch date.lowercased() {
        case "today", "今日", "":
            return today
        case "tomorrow", "明日":
            return calendar.date(byAdding: .day, value: 1, to: today)!
        case "day_after_tomorrow", "明後日":
            return calendar.date(byAdding: .day, value: 2, to: today)!
        default:
            // "YYYY-MM-DD" 形式
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            formatter.locale = Locale(identifier: "ja_JP")
            return formatter.date(from: date) ?? today
        }
    }

    private func formatDisplayDate(_ date: String) -> String {
        switch date.lowercased() {
        case "today", "今日", "":
            return "今日"
        case "tomorrow", "明日":
            return "明日"
        case "day_after_tomorrow", "明後日":
            return "明後日"
        default:
            return date
        }
    }
}
