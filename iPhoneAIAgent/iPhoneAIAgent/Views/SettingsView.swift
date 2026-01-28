import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: GoogleAuthManager
    @State private var wakeWord = GoogleConfig.wakeWord
    @State private var openAIKey = GoogleConfig.openAIAPIKey
    @State private var showAPIKey = false

    var body: some View {
        NavigationStack {
            Form {
                // Google アカウント
                googleAccountSection

                // ウェイクワード設定
                wakeWordSection

                // AI 設定
                aiSettingsSection

                // アプリ情報
                appInfoSection
            }
            .navigationTitle("設定")
        }
    }

    // MARK: - Google アカウント

    private var googleAccountSection: some View {
        Section {
            if authManager.isAuthenticated {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                    VStack(alignment: .leading) {
                        Text("ログイン済み")
                            .font(.headline)
                        if let email = authManager.userEmail {
                            Text(email)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Button("ログアウト", role: .destructive) {
                    authManager.signOut()
                }
            } else {
                HStack {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.red)
                    Text("未ログイン")
                }

                Button("Googleアカウントでログイン") {
                    Task { await authManager.signIn() }
                }
                .buttonStyle(.borderedProminent)
            }

            if let error = authManager.errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.red)
            }
        } header: {
            Text("Google アカウント")
        } footer: {
            Text("Gmail、Googleカレンダー、Google Tasksへのアクセスに必要です")
        }
    }

    // MARK: - ウェイクワード

    private var wakeWordSection: some View {
        Section {
            TextField("ウェイクワード", text: $wakeWord)
                .onChange(of: wakeWord) { _, newValue in
                    GoogleConfig.wakeWord = newValue
                }

            VStack(alignment: .leading, spacing: 4) {
                Text("使い方")
                    .font(.caption)
                    .fontWeight(.medium)
                Text("設定したウェイクワードを話すとエージェントが起動し、続けてコマンドを話してください")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        } header: {
            Text("ウェイクワード")
        } footer: {
            Text("デフォルト: 「ヘイエージェント」")
        }
    }

    // MARK: - AI 設定

    private var aiSettingsSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 8) {
                Text("OpenAI API キー（オプション）")
                    .font(.subheadline)

                HStack {
                    if showAPIKey {
                        TextField("sk-...", text: $openAIKey)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(.body, design: .monospaced))
                    } else {
                        SecureField("sk-...", text: $openAIKey)
                            .textFieldStyle(.roundedBorder)
                    }

                    Button {
                        showAPIKey.toggle()
                    } label: {
                        Image(systemName: showAPIKey ? "eye.slash" : "eye")
                    }
                }

                Button("保存") {
                    GoogleConfig.openAIAPIKey = openAIKey
                }
                .buttonStyle(.bordered)
                .disabled(openAIKey == GoogleConfig.openAIAPIKey)
            }
        } header: {
            Text("AI 設定")
        } footer: {
            Text("OpenAI APIキーを設定すると、より高度な自然言語理解が利用できます。未設定の場合はルールベースの解析を使用します。")
        }
    }

    // MARK: - アプリ情報

    private var appInfoSection: some View {
        Section {
            LabeledContent("バージョン", value: "1.0.0")
            LabeledContent("対応サービス", value: "Gmail, Calendar, Tasks")

            VStack(alignment: .leading, spacing: 4) {
                Text("対応コマンド")
                    .font(.subheadline)
                    .fontWeight(.medium)

                Group {
                    commandExample("メール送信", example: "〜にメールして")
                    commandExample("メール確認", example: "未読メールを確認して")
                    commandExample("予定作成", example: "明日の10時に会議を入れて")
                    commandExample("予定確認", example: "今日の予定を教えて")
                    commandExample("タスク作成", example: "〜をリマインドして")
                    commandExample("タスク一覧", example: "タスクを確認して")
                }
            }
        } header: {
            Text("アプリ情報")
        }
    }

    private func commandExample(_ title: String, example: String) -> some View {
        HStack {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .frame(width: 80, alignment: .leading)
            Text("「\(example)」")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}
