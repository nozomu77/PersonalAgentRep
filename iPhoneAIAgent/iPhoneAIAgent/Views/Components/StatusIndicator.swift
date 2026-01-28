import SwiftUI

struct StatusIndicator: View {
    let state: AgentState
    let isAuthenticated: Bool

    var body: some View {
        HStack(spacing: 6) {
            // Google接続状態
            Circle()
                .fill(isAuthenticated ? Color.green : Color.red)
                .frame(width: 8, height: 8)

            Text(isAuthenticated ? "接続中" : "未接続")
                .font(.caption2)
                .foregroundColor(.secondary)

            // エージェント状態
            Circle()
                .fill(agentStateColor)
                .frame(width: 8, height: 8)

            Text(agentStateLabel)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(Color(.systemGray6))
        )
    }

    private var agentStateColor: Color {
        switch state {
        case .idle: return .gray
        case .listening: return .blue
        case .activated: return .green
        case .processing: return .orange
        case .responding: return .purple
        case .error: return .red
        }
    }

    private var agentStateLabel: String {
        switch state {
        case .idle: return "停止"
        case .listening: return "待機"
        case .activated: return "起動"
        case .processing: return "処理"
        case .responding: return "応答"
        case .error: return "エラー"
        }
    }
}
