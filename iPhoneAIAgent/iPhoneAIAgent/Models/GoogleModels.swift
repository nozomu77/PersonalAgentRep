import Foundation

// MARK: - OAuth Token

struct OAuthToken: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: Int
    let tokenType: String
    let scope: String?

    var expirationDate: Date?

    var isExpired: Bool {
        guard let expirationDate else { return true }
        return Date() >= expirationDate
    }

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresIn = "expires_in"
        case tokenType = "token_type"
        case scope
    }
}

// MARK: - Gmail

struct GmailMessageList: Codable {
    let messages: [GmailMessageRef]?
    let resultSizeEstimate: Int?
}

struct GmailMessageRef: Codable {
    let id: String
    let threadId: String
}

struct GmailMessage: Codable {
    let id: String
    let threadId: String
    let snippet: String?
    let payload: GmailPayload?

    var subject: String? {
        payload?.headers?.first(where: { $0.name.lowercased() == "subject" })?.value
    }

    var from: String? {
        payload?.headers?.first(where: { $0.name.lowercased() == "from" })?.value
    }

    var date: String? {
        payload?.headers?.first(where: { $0.name.lowercased() == "date" })?.value
    }
}

struct GmailPayload: Codable {
    let headers: [GmailHeader]?
}

struct GmailHeader: Codable {
    let name: String
    let value: String
}

struct GmailSendRequest: Codable {
    let raw: String
}

// MARK: - Google Calendar

struct CalendarEventList: Codable {
    let items: [CalendarEvent]?
}

struct CalendarEvent: Codable, Identifiable {
    let id: String?
    let summary: String?
    let description: String?
    let start: CalendarDateTime?
    let end: CalendarDateTime?
    let location: String?

    struct CalendarDateTime: Codable {
        let dateTime: String?
        let date: String?
        let timeZone: String?
    }

    var displayTime: String {
        if let dateTime = start?.dateTime {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dateTime) {
                let displayFormatter = DateFormatter()
                displayFormatter.locale = Locale(identifier: "ja_JP")
                displayFormatter.dateFormat = "M/d HH:mm"
                return displayFormatter.string(from: date)
            }
        }
        return start?.date ?? "時間未定"
    }
}

struct CalendarEventCreate: Codable {
    let summary: String
    let description: String?
    let start: CalendarEvent.CalendarDateTime
    let end: CalendarEvent.CalendarDateTime
    let location: String?
}

// MARK: - Google Tasks

struct TaskList: Codable {
    let items: [TaskListEntry]?
}

struct TaskListEntry: Codable {
    let id: String
    let title: String
}

struct TaskItemList: Codable {
    let items: [TaskItem]?
}

struct TaskItem: Codable, Identifiable {
    let id: String?
    let title: String?
    let notes: String?
    let due: String?
    let status: String?

    var isCompleted: Bool {
        status == "completed"
    }
}

struct TaskItemCreate: Codable {
    let title: String
    let notes: String?
    let due: String?
}
