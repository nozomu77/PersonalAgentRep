import Foundation
import AVFoundation

@MainActor
class AgentViewModel: ObservableObject {
    @Published var agentState: AgentState = .idle
    @Published var currentTranscription = ""
    @Published var responseText = ""
    @Published var commandHistory: [CommandResult] = []
    @Published var isListeningEnabled = false

    private let speechRecognizer = SpeechRecognizer()
    private let agentService = AIAgentService()
    private var authManager: GoogleAuthManager?
    private var gmailService: GmailService?
    private var calendarService: GoogleCalendarService?
    private var tasksService: GoogleTasksService?

    private let synthesizer = AVSpeechSynthesizer()

    init() {
        setupSpeechCallbacks()
    }

    func setAuthManager(_ authManager: GoogleAuthManager) {
        self.authManager = authManager
        self.gmailService = GmailService(authManager: authManager)
        self.calendarService = GoogleCalendarService(authManager: authManager)
        self.tasksService = GoogleTasksService(authManager: authManager)
    }

    // MARK: - 音声認識の制御

    func toggleListening() {
        if isListeningEnabled {
            stopListening()
        } else {
            startListening()
        }
    }

    func startListening() {
        speechRecognizer.requestAuthorization()
        speechRecognizer.startListening()
        isListeningEnabled = true
        agentState = .listening
    }

    func stopListening() {
        speechRecognizer.stopListening()
        isListeningEnabled = false
        agentState = .idle
    }

    // MARK: - 手動コマンド入力

    func processManualCommand(_ text: String) {
        Task {
            await processCommand(text)
        }
    }

    // MARK: - セットアップ

    private func setupSpeechCallbacks() {
        speechRecognizer.onWakeWordDetected = { [weak self] in
            Task { @MainActor in
                self?.agentState = .activated
                self?.responseText = "はい、何をしますか？"
                self?.speak("はい、何をしますか？")
            }
        }

        speechRecognizer.onCommandReceived = { [weak self] command in
            Task { @MainActor in
                await self?.processCommand(command)
            }
        }
    }

    // MARK: - コマンド処理

    private func processCommand(_ text: String) async {
        agentState = .processing
        currentTranscription = text
        responseText = "処理中..."

        // 意図解析
        let intent = await agentService.parseIntent(from: text)

        // コマンド実行
        let result = await executeIntent(intent, rawText: text)

        // 結果を保存
        commandHistory.insert(result, at: 0)

        // 結果を表示・読み上げ
        responseText = result.response
        agentState = .responding
        speak(result.response)

        // 3秒後にリスニング状態に戻る
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            if isListeningEnabled {
                agentState = .listening
            } else {
                agentState = .idle
            }
        }
    }

    private func executeIntent(_ intent: UserIntent, rawText: String) async -> CommandResult {
        guard authManager?.isAuthenticated == true else {
            return CommandResult(
                intent: intent,
                rawText: rawText,
                response: "Googleアカウントにログインしてください",
                success: false,
                timestamp: Date()
            )
        }

        do {
            let response: String

            switch intent {
            case .sendEmail(let to, let subject, let body):
                guard let gmailService else { throw GoogleServiceError.sendFailed }
                response = try await gmailService.sendEmail(to: to, subject: subject, body: body)

            case .checkEmail:
                guard let gmailService else { throw GoogleServiceError.fetchFailed }
                let messages = try await gmailService.getUnreadEmails()
                response = gmailService.formatUnreadSummary(messages)

            case .createEvent(let title, let date, let time):
                guard let calendarService else { throw GoogleServiceError.createFailed }
                response = try await calendarService.createEvent(title: title, date: date, time: time)

            case .checkSchedule(let date):
                guard let calendarService else { throw GoogleServiceError.fetchFailed }
                let events = try await calendarService.getEvents(date: date)
                response = calendarService.formatEventsSummary(events, date: date)

            case .createTask(let title, let notes):
                guard let tasksService else { throw GoogleServiceError.createFailed }
                response = try await tasksService.createTask(title: title, notes: notes)

            case .listTasks:
                guard let tasksService else { throw GoogleServiceError.fetchFailed }
                let tasks = try await tasksService.getTasks()
                response = tasksService.formatTasksSummary(tasks)

            case .setReminder(let title, let date, _):
                guard let tasksService else { throw GoogleServiceError.createFailed }
                response = try await tasksService.createTask(
                    title: title,
                    notes: "リマインダー",
                    dueDate: date.isEmpty ? nil : date
                )

            case .unknown(let rawText):
                response = "「\(rawText)」を理解できませんでした。もう一度お試しください。"
            }

            return CommandResult(
                intent: intent,
                rawText: rawText,
                response: response,
                success: true,
                timestamp: Date()
            )
        } catch {
            return CommandResult(
                intent: intent,
                rawText: rawText,
                response: "エラー: \(error.localizedDescription)",
                success: false,
                timestamp: Date()
            )
        }
    }

    // MARK: - 音声読み上げ

    private func speak(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "ja-JP")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        synthesizer.speak(utterance)
    }
}
