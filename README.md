# iPhone AI Agent

自分専用のiPhone AIエージェントアプリ。音声コマンドでGoogle サービス（Gmail、Googleカレンダー、Google Tasks）を操作できます。

## 機能

- **ウェイクワード起動**: 「ヘイエージェント」と話しかけるとアプリが待ち受け状態に
- **音声コマンド認識**: 自然言語でタスクを指示
- **Gmail連携**: メールの送信・検索
- **Googleカレンダー連携**: 予定の作成・確認
- **Google Tasks連携**: タスク・リマインダーの作成・管理

## 対応コマンド例

| 発話例 | 動作 |
|--------|------|
| 「明日の10時に会議を入れて」 | Googleカレンダーに予定を作成 |
| 「田中さんにメールして、件名は会議について」 | Gmailでメール送信 |
| 「買い物リストをリマインドして」 | Google Tasksにタスクを追加 |
| 「今日の予定を教えて」 | Googleカレンダーの予定を読み上げ |
| 「未読メールを確認して」 | Gmailの未読メールを読み上げ |

## アーキテクチャ

```
┌─────────────────────────────────────────┐
│              SwiftUI Views              │
│  (HomeView / SettingsView / History)    │
├─────────────────────────────────────────┤
│            AgentViewModel               │
│     (状態管理・UIとサービスの橋渡し)       │
├─────────────────────────────────────────┤
│            AIAgentService               │
│   (意図解析・コマンドルーティング)          │
├──────────┬──────────┬───────────────────┤
│  Gmail   │ Calendar │   Google Tasks   │
│ Service  │ Service  │    Service       │
├──────────┴──────────┴───────────────────┤
│         GoogleAuthManager               │
│          (OAuth 2.0 認証)               │
├─────────────────────────────────────────┤
│         SpeechRecognizer                │
│   (ウェイクワード検出・音声認識)           │
└─────────────────────────────────────────┘
```

## セットアップ

### 1. Google Cloud Console の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 以下のAPIを有効化:
   - Gmail API
   - Google Calendar API
   - Google Tasks API
3. OAuth 2.0 クライアントIDを作成（iOSアプリケーション）
4. バンドルIDに `com.nozomu77.iPhoneAIAgent` を設定

### 2. OpenAI API キー（オプション）

高度な自然言語理解を使う場合:
1. [OpenAI Platform](https://platform.openai.com/) でAPIキーを取得
2. アプリの設定画面でキーを入力

### 3. ビルド & 実行

1. `iPhoneAIAgent.xcodeproj` を Xcode で開く
2. `GoogleConfig.swift` にクライアントIDを設定
3. 実機でビルド・実行（音声認識はシミュレータ非対応）

### 4. 権限設定

アプリ初回起動時に以下の権限を許可してください:
- マイクへのアクセス（音声認識用）
- 音声認識の使用

## 技術スタック

- **UI**: SwiftUI
- **音声認識**: Apple Speech Framework
- **認証**: OAuth 2.0 (PKCE)
- **API連携**: URLSession + Google REST API
- **意図解析**: ルールベース + OpenAI API（オプション）
- **最小iOS**: 17.0

## 注意事項

- **Google Keep**: 公開APIが存在しないため、代わりにGoogle Tasks APIを使用しています
- **音声認識**: 実機でのみ動作します（シミュレータ非対応）
- **バックグラウンド**: iOSの制約により、バックグラウンドでの常時音声認識はできません。アプリがフォアグラウンドの状態で使用してください
