import Foundation

class GoogleTasksService {
    private let baseURL = "https://tasks.googleapis.com/tasks/v1"
    private let authManager: GoogleAuthManager

    private var defaultTaskListID: String?

    init(authManager: GoogleAuthManager) {
        self.authManager = authManager
    }

    // MARK: - タスクリストの取得

    private func getDefaultTaskListID() async throws -> String {
        if let cached = defaultTaskListID {
            return cached
        }

        let accessToken = try await authManager.getAccessToken()

        var request = URLRequest(url: URL(string: "\(baseURL)/users/@me/lists")!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, _) = try await URLSession.shared.data(for: request)
        let taskLists = try JSONDecoder().decode(TaskList.self, from: data)

        guard let firstList = taskLists.items?.first else {
            throw GoogleServiceError.noTaskList
        }

        defaultTaskListID = firstList.id
        return firstList.id
    }

    // MARK: - タスク作成

    func createTask(title: String, notes: String = "", dueDate: String? = nil) async throws -> String {
        let accessToken = try await authManager.getAccessToken()
        let listID = try await getDefaultTaskListID()

        var dueDateISO: String?
        if let dueDate, !dueDate.isEmpty {
            let resolved = resolveDate(dueDate)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime]
            dueDateISO = formatter.string(from: resolved)
        }

        let task = TaskItemCreate(
            title: title,
            notes: notes.isEmpty ? nil : notes,
            due: dueDateISO
        )

        var request = URLRequest(url: URL(string: "\(baseURL)/lists/\(listID)/tasks")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(task)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw GoogleServiceError.createFailed
        }

        return "タスク「\(title)」を追加しました"
    }

    // MARK: - タスク一覧取得

    func getTasks(showCompleted: Bool = false) async throws -> [TaskItem] {
        let accessToken = try await authManager.getAccessToken()
        let listID = try await getDefaultTaskListID()

        var components = URLComponents(string: "\(baseURL)/lists/\(listID)/tasks")!
        components.queryItems = [
            URLQueryItem(name: "showCompleted", value: showCompleted ? "true" : "false"),
            URLQueryItem(name: "maxResults", value: "20")
        ]

        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let (data, _) = try await URLSession.shared.data(for: request)
        let taskItems = try JSONDecoder().decode(TaskItemList.self, from: data)

        return taskItems.items ?? []
    }

    // MARK: - タスク完了

    func completeTask(taskID: String) async throws -> String {
        let accessToken = try await authManager.getAccessToken()
        let listID = try await getDefaultTaskListID()

        var request = URLRequest(url: URL(string: "\(baseURL)/lists/\(listID)/tasks/\(taskID)")!)
        request.httpMethod = "PATCH"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: String] = ["status": "completed"]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw GoogleServiceError.updateFailed
        }

        return "タスクを完了しました"
    }

    // MARK: - タスクの要約生成

    func formatTasksSummary(_ tasks: [TaskItem]) -> String {
        if tasks.isEmpty {
            return "未完了のタスクはありません"
        }

        var summary = "タスクが\(tasks.count)件あります:\n"
        for (index, task) in tasks.enumerated() {
            let title = task.title ?? "(タイトルなし)"
            let status = task.isCompleted ? "[完了]" : "[未完了]"
            summary += "\(index + 1). \(status) \(title)\n"
        }
        return summary
    }

    // MARK: - 日付ヘルパー

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
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            return formatter.date(from: date) ?? today
        }
    }
}

// MARK: - Google Service Errors

enum GoogleServiceError: LocalizedError {
    case sendFailed
    case createFailed
    case updateFailed
    case fetchFailed
    case noTaskList

    var errorDescription: String? {
        switch self {
        case .sendFailed: return "送信に失敗しました"
        case .createFailed: return "作成に失敗しました"
        case .updateFailed: return "更新に失敗しました"
        case .fetchFailed: return "取得に失敗しました"
        case .noTaskList: return "タスクリストが見つかりません"
        }
    }
}
