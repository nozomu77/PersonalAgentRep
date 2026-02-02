# AI Agent PWA

音声コマンドでGoogle サービス（Gmail、Googleカレンダー、Google Tasks）を操作できるPWAアプリ。

## 機能

- **音声コマンド認識**: マイクボタンを押して話しかける
- **実行前確認**: 書き込み系操作は確認ダイアログを表示
- **Gmail連携**: メールの送信・未読確認
- **Googleカレンダー連携**: 予定の作成・確認
- **Google Tasks連携**: タスク・リマインダーの作成・管理
- **オフライン対応**: Service Workerによるキャッシュ

## 対応コマンド例

| 発話例 | 動作 |
|--------|------|
| 「明日の10時に会議を入れて」 | Googleカレンダーに予定を作成 |
| 「田中さんにメールして」 | Gmailでメール送信 |
| 「買い物リストをリマインドして」 | Google Tasksにタスクを追加 |
| 「今日の予定を教えて」 | Googleカレンダーの予定を読み上げ |
| 「未読メールを確認して」 | Gmailの未読メールを読み上げ |

## アーキテクチャ

```
┌─────────────────────────────────────────┐
│              index.html                 │
│     (Home / History / Settings タブ)     │
├─────────────────────────────────────────┤
│               app.js                    │
│     (状態管理・UIとサービスの橋渡し)        │
├─────────────────────────────────────────┤
│              agent.js                   │
│   (意図解析・コマンドルーティング)          │
├──────────┬──────────┬───────────────────┤
│  Gmail   │ Calendar │   Google Tasks   │
│          │          │                  │
├──────────┴──────────┴───────────────────┤
│     google-services.js / auth.js        │
│   (Google Identity Services OAuth)      │
├─────────────────────────────────────────┤
│             speech.js                   │
│          (Web Speech API)               │
└─────────────────────────────────────────┘
```

## セットアップ

### 1. Google Cloud Console の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 以下のAPIを有効化:
   - Gmail API
   - Google Calendar API
   - Google Tasks API
3. OAuth 2.0 クライアントIDを作成（**ウェブアプリケーション**を選択）
4. 承認済みJavaScriptオリジンを設定:
   - `https://yourusername.github.io`（GitHub Pages用）
   - `http://localhost:8000`（ローカル開発用）

### 2. デプロイ

```bash
# GitHub Pagesの場合（リポジトリをpublicにする必要あり）
git push origin main
# Settings > Pages > Source: Deploy from branch (main)
```

### 3. アプリの設定

1. デプロイしたURLにアクセス
2. 設定タブでGoogle OAuth クライアントIDを入力
3. 「Googleでサインイン」でログイン
4. マイクボタンを押して音声コマンドを実行

### 4. OpenAI API キー（オプション）

高度な自然言語理解を使う場合:
1. [OpenAI Platform](https://platform.openai.com/) でAPIキーを取得
2. 設定画面でキーを入力

## 技術スタック

- **UI**: HTML/CSS/JavaScript (Vanilla)
- **音声認識**: Web Speech API
- **認証**: Google Identity Services (OAuth 2.0)
- **API連携**: Fetch API + Google REST API
- **意図解析**: ルールベース + OpenAI API（オプション）
- **オフライン**: Service Worker

## ブラウザ対応

| ブラウザ | 音声認識 | 備考 |
|---------|---------|------|
| Chrome (Android) | ○ | 推奨 |
| Chrome (iOS) | ○ | 推奨 |
| Safari (iOS) | △ | 制限あり |
| Edge | ○ | |
| Firefox | × | Web Speech API未対応 |

## 注意事項

- **Google Keep**: 公開APIが存在しないため、Google Tasks APIを使用
- **HTTPS必須**: 音声認識はHTTPS環境でのみ動作
- **iOSのSafari**: 一部制限があるためChromeを推奨
