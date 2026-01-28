import Foundation
import Speech
import AVFoundation

@MainActor
class SpeechRecognizer: ObservableObject {
    @Published var transcribedText = ""
    @Published var isListening = false
    @Published var wakeWordDetected = false
    @Published var authorizationStatus: SFSpeechRecognizerAuthorizationStatus = .notDetermined

    private let speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    var onWakeWordDetected: (() -> Void)?
    var onCommandReceived: ((String) -> Void)?

    private var commandTimeout: Task<Void, Never>?
    private var isWaitingForCommand = false

    init() {
        speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "ja-JP"))
    }

    // MARK: - 権限リクエスト

    func requestAuthorization() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor in
                self?.authorizationStatus = status
            }
        }

        AVAudioApplication.requestRecordPermission { _ in }
    }

    // MARK: - 音声認識の開始（ウェイクワード待ち受けモード）

    func startListening() {
        guard !isListening else { return }
        guard authorizationStatus == .authorized else {
            requestAuthorization()
            return
        }

        do {
            try startAudioEngine()
            isListening = true
            wakeWordDetected = false
            isWaitingForCommand = false
        } catch {
            print("音声認識の開始に失敗: \(error)")
        }
    }

    // MARK: - 音声認識の停止

    func stopListening() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil
        isListening = false
        wakeWordDetected = false
        isWaitingForCommand = false
        commandTimeout?.cancel()
    }

    // MARK: - 内部処理

    private func startAudioEngine() throws {
        recognitionTask?.cancel()
        recognitionTask = nil

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest else {
            throw NSError(domain: "SpeechRecognizer", code: 1, userInfo: [NSLocalizedDescriptionKey: "リクエスト作成失敗"])
        }

        recognitionRequest.shouldReportPartialResults = true
        recognitionRequest.addsPunctuation = true

        guard let speechRecognizer, speechRecognizer.isAvailable else {
            throw NSError(domain: "SpeechRecognizer", code: 2, userInfo: [NSLocalizedDescriptionKey: "音声認識が利用不可"])
        }

        recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }

                if let result {
                    let text = result.bestTranscription.formattedString
                    self.transcribedText = text
                    self.processTranscription(text)
                }

                if error != nil || (result?.isFinal ?? false) {
                    // 認識が終了したら再起動
                    if self.isListening {
                        self.restartRecognition()
                    }
                }
            }
        }

        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            self.recognitionRequest?.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()
    }

    private func restartRecognition() {
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionRequest = nil
        recognitionTask = nil

        Task {
            try? await Task.sleep(nanoseconds: 500_000_000) // 0.5秒待機
            if isListening {
                try? startAudioEngine()
            }
        }
    }

    private func processTranscription(_ text: String) {
        let wakeWord = GoogleConfig.wakeWord
        let lowered = text.lowercased()

        if !isWaitingForCommand {
            // ウェイクワード検出
            if lowered.contains(wakeWord.lowercased()) ||
               lowered.contains("ヘイエージェント") ||
               lowered.contains("hey agent") {
                wakeWordDetected = true
                isWaitingForCommand = true
                onWakeWordDetected?()
                startCommandTimeout()

                // ウェイクワード以降のテキストがあればそれをコマンドとして処理
                if let range = lowered.range(of: wakeWord.lowercased()) {
                    let afterWakeWord = String(text[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                    if !afterWakeWord.isEmpty {
                        deliverCommand(afterWakeWord)
                    }
                }
            }
        } else {
            // コマンド待ち受けモード: ウェイクワード以降のテキストを取得
            let wakeWordLower = wakeWord.lowercased()
            if let range = lowered.range(of: wakeWordLower) {
                let commandText = String(text[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
                if commandText.count > 3 {
                    deliverCommand(commandText)
                }
            } else if text.count > 3 {
                deliverCommand(text)
            }
        }
    }

    private func deliverCommand(_ command: String) {
        commandTimeout?.cancel()
        isWaitingForCommand = false
        wakeWordDetected = false
        onCommandReceived?(command)
    }

    private func startCommandTimeout() {
        commandTimeout?.cancel()
        commandTimeout = Task {
            try? await Task.sleep(nanoseconds: 10_000_000_000) // 10秒タイムアウト
            if !Task.isCancelled {
                isWaitingForCommand = false
                wakeWordDetected = false
            }
        }
    }
}
