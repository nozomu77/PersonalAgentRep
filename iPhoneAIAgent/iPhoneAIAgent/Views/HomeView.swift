import SwiftUI

struct HomeView: View {
    @ObservedObject var viewModel: AgentViewModel
    @EnvironmentObject var authManager: GoogleAuthManager
    @State private var manualInput = ""
    @State private var showManualInput = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                // ステータス表示
                statusSection

                // 音声波形アニメーション
                VoiceWaveView(isActive: viewModel.agentState == .listening || viewModel.agentState == .activated)
                    .frame(height: 80)
                    .padding(.horizontal)

                // 認識テキスト表示
                if !viewModel.currentTranscription.isEmpty {
                    Text(viewModel.currentTranscription)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .padding(.horizontal)
                        .multilineTextAlignment(.center)
                }

                // レスポンス表示
                if !viewModel.responseText.isEmpty {
                    Text(viewModel.responseText)
                        .font(.headline)
                        .foregroundColor(.primary)
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color(.systemGray6))
                        )
                        .padding(.horizontal)
                }

                Spacer()

                // コントロールボタン
                controlButtons

                // 手動入力
                if showManualInput {
                    manualInputSection
                }
            }
            .navigationTitle("AI エージェント")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    StatusIndicator(state: viewModel.agentState, isAuthenticated: authManager.isAuthenticated)
                }
            }
        }
    }

    // MARK: - ステータス表示

    private var statusSection: some View {
        VStack(spacing: 8) {
            Image(systemName: stateIcon)
                .font(.system(size: 60))
                .foregroundStyle(stateGradient)
                .symbolEffect(.pulse, isActive: viewModel.agentState == .listening || viewModel.agentState == .activated)

            Text(stateMessage)
                .font(.title3)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
        }
    }

    private var stateIcon: String {
        switch viewModel.agentState {
        case .idle: return "mic.slash.circle"
        case .listening: return "waveform.circle.fill"
        case .activated: return "ear.fill"
        case .processing: return "brain.fill"
        case .responding: return "speaker.wave.3.fill"
        case .error: return "exclamationmark.circle.fill"
        }
    }

    private var stateMessage: String {
        switch viewModel.agentState {
        case .idle: return "タップして開始"
        case .listening: return "「\(GoogleConfig.wakeWord)」と話しかけてください"
        case .activated: return "コマンドをどうぞ"
        case .processing: return "処理中..."
        case .responding: return "応答中"
        case .error(let msg): return msg
        }
    }

    private var stateGradient: LinearGradient {
        switch viewModel.agentState {
        case .idle:
            return LinearGradient(colors: [.gray], startPoint: .top, endPoint: .bottom)
        case .listening:
            return LinearGradient(colors: [.blue, .cyan], startPoint: .top, endPoint: .bottom)
        case .activated:
            return LinearGradient(colors: [.green, .mint], startPoint: .top, endPoint: .bottom)
        case .processing:
            return LinearGradient(colors: [.orange, .yellow], startPoint: .top, endPoint: .bottom)
        case .responding:
            return LinearGradient(colors: [.purple, .pink], startPoint: .top, endPoint: .bottom)
        case .error:
            return LinearGradient(colors: [.red, .orange], startPoint: .top, endPoint: .bottom)
        }
    }

    // MARK: - コントロールボタン

    private var controlButtons: some View {
        HStack(spacing: 20) {
            // 手動入力トグル
            Button {
                withAnimation { showManualInput.toggle() }
            } label: {
                Image(systemName: "keyboard")
                    .font(.title2)
                    .frame(width: 56, height: 56)
                    .background(Circle().fill(Color(.systemGray5)))
            }

            // メインボタン（マイク ON/OFF）
            Button {
                viewModel.toggleListening()
            } label: {
                Image(systemName: viewModel.isListeningEnabled ? "stop.fill" : "mic.fill")
                    .font(.title)
                    .foregroundColor(.white)
                    .frame(width: 72, height: 72)
                    .background(
                        Circle()
                            .fill(viewModel.isListeningEnabled ?
                                  LinearGradient(colors: [.red, .orange], startPoint: .top, endPoint: .bottom) :
                                  LinearGradient(colors: [.blue, .indigo], startPoint: .top, endPoint: .bottom))
                    )
                    .shadow(color: viewModel.isListeningEnabled ? .red.opacity(0.3) : .blue.opacity(0.3), radius: 8)
            }

            // ダミー（バランス用）
            Color.clear
                .frame(width: 56, height: 56)
        }
        .padding(.bottom, 20)
    }

    // MARK: - 手動入力

    private var manualInputSection: some View {
        HStack {
            TextField("コマンドを入力...", text: $manualInput)
                .textFieldStyle(.roundedBorder)
                .submitLabel(.send)
                .onSubmit { sendManualCommand() }

            Button("送信") { sendManualCommand() }
                .buttonStyle(.borderedProminent)
                .disabled(manualInput.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.horizontal)
        .padding(.bottom, 16)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    private func sendManualCommand() {
        let text = manualInput.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        viewModel.processManualCommand(text)
        manualInput = ""
    }
}
