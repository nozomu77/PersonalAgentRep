import SwiftUI

struct CommandHistoryView: View {
    @ObservedObject var viewModel: AgentViewModel

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.commandHistory.isEmpty {
                    emptyState
                } else {
                    historyList
                }
            }
            .navigationTitle("コマンド履歴")
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            Text("まだコマンド履歴がありません")
                .font(.headline)
                .foregroundColor(.secondary)
            Text("音声またはテキストでコマンドを実行すると\nここに履歴が表示されます")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    private var historyList: some View {
        List {
            ForEach(viewModel.commandHistory) { result in
                historyRow(result)
            }
        }
        .listStyle(.insetGrouped)
    }

    private func historyRow(_ result: CommandResult) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: result.intent.iconName)
                    .foregroundColor(result.success ? .blue : .red)
                Text(result.intent.displayName)
                    .font(.headline)
                Spacer()
                Text(result.success ? "成功" : "失敗")
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(
                        Capsule()
                            .fill(result.success ? Color.green.opacity(0.2) : Color.red.opacity(0.2))
                    )
                    .foregroundColor(result.success ? .green : .red)
            }

            Text(result.rawText)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(2)

            Text(result.response)
                .font(.body)
                .lineLimit(3)

            Text(formatDate(result.timestamp))
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ja_JP")
        formatter.dateFormat = "yyyy/MM/dd HH:mm:ss"
        return formatter.string(from: date)
    }
}
