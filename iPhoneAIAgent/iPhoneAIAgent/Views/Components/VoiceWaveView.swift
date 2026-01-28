import SwiftUI

struct VoiceWaveView: View {
    let isActive: Bool

    @State private var phase: CGFloat = 0

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { timeline in
            Canvas { context, size in
                let midY = size.height / 2
                let width = size.width

                if isActive {
                    // アクティブ時: 動く波形
                    for waveIndex in 0..<3 {
                        let opacity = 1.0 - Double(waveIndex) * 0.3
                        let amplitude = (size.height / 4) * (1.0 - Double(waveIndex) * 0.2)
                        let frequency = 2.0 + Double(waveIndex) * 0.5
                        let phaseOffset = Double(waveIndex) * 0.5

                        var path = Path()
                        path.move(to: CGPoint(x: 0, y: midY))

                        for x in stride(from: 0, through: width, by: 2) {
                            let relativeX = x / width
                            let envelope = sin(.pi * relativeX)
                            let y = midY + sin(relativeX * .pi * 2 * frequency + phase + phaseOffset) * amplitude * envelope
                            path.addLine(to: CGPoint(x: x, y: y))
                        }

                        context.stroke(
                            path,
                            with: .linearGradient(
                                Gradient(colors: [.blue.opacity(opacity), .cyan.opacity(opacity)]),
                                startPoint: .leading,
                                endPoint: .trailing
                            ),
                            lineWidth: 2
                        )
                    }
                } else {
                    // 非アクティブ時: フラットな線
                    var path = Path()
                    path.move(to: CGPoint(x: 0, y: midY))
                    path.addLine(to: CGPoint(x: width, y: midY))
                    context.stroke(path, with: .color(.gray.opacity(0.3)), lineWidth: 1)
                }
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                phase = .pi * 2
            }
        }
    }
}
