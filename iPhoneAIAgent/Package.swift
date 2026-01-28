// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "iPhoneAIAgent",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "iPhoneAIAgent",
            targets: ["iPhoneAIAgent"]
        )
    ],
    targets: [
        .target(
            name: "iPhoneAIAgent",
            path: "iPhoneAIAgent"
        ),
        .testTarget(
            name: "iPhoneAIAgentTests",
            dependencies: ["iPhoneAIAgent"],
            path: "iPhoneAIAgentTests"
        )
    ]
)
