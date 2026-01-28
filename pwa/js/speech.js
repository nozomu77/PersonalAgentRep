// ============================================
// 音声認識エンジン (Web Speech API)
// ============================================

export class SpeechEngine {
  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.supported = false;
      return;
    }

    this.supported = true;
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'ja-JP';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.isListening = false;
    this.wakeWord = localStorage.getItem('wake_word') || 'ヘイエージェント';
    this.isWaitingForCommand = false;
    this.commandTimeout = null;

    // コールバック
    this.onWakeWord = null;       // ウェイクワード検出時
    this.onCommand = null;        // コマンド確定時
    this.onInterim = null;        // 中間結果
    this.onStateChange = null;    // 状態変化

    this._setupRecognition();
  }

  // ウェイクワードを更新
  setWakeWord(word) {
    this.wakeWord = word;
    localStorage.setItem('wake_word', word);
  }

  // 音声認識を開始
  start() {
    if (!this.supported || this.isListening) return;
    try {
      this.recognition.start();
      this.isListening = true;
      this.isWaitingForCommand = false;
      this.onStateChange?.('listening');
    } catch (e) {
      console.error('音声認識の開始に失敗:', e);
    }
  }

  // 音声認識を停止
  stop() {
    if (!this.isListening) return;
    this.recognition.stop();
    this.isListening = false;
    this.isWaitingForCommand = false;
    clearTimeout(this.commandTimeout);
    this.onStateChange?.('idle');
  }

  // 内部: 認識エンジンのセットアップ
  _setupRecognition() {
    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // 中間結果を通知
      if (interimTranscript) {
        this.onInterim?.(interimTranscript);
        this._checkForWakeWord(interimTranscript);
      }

      // 確定結果を処理
      if (finalTranscript) {
        this.onInterim?.(finalTranscript);
        this._processTranscript(finalTranscript);
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('音声認識エラー:', event.error);
      // "no-speech" や "aborted" は無視して再起動
      if (event.error === 'no-speech' || event.error === 'aborted') {
        if (this.isListening) {
          this._restart();
        }
      }
    };

    this.recognition.onend = () => {
      // 自動再起動（リスニング中の場合）
      if (this.isListening) {
        this._restart();
      }
    };
  }

  _restart() {
    setTimeout(() => {
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {
          // already started の場合は無視
        }
      }
    }, 300);
  }

  _checkForWakeWord(text) {
    if (this.isWaitingForCommand) return;

    const lower = text.toLowerCase();
    const wakeWordLower = this.wakeWord.toLowerCase();

    if (lower.includes(wakeWordLower) ||
        lower.includes('ヘイエージェント') ||
        lower.includes('hey agent')) {
      this.isWaitingForCommand = true;
      this.onWakeWord?.();
      this.onStateChange?.('activated');
      this._startCommandTimeout();
    }
  }

  _processTranscript(text) {
    const lower = text.toLowerCase();
    const wakeWordLower = this.wakeWord.toLowerCase();

    if (!this.isWaitingForCommand) {
      // ウェイクワードを探す
      if (lower.includes(wakeWordLower) ||
          lower.includes('ヘイエージェント') ||
          lower.includes('hey agent')) {
        this.isWaitingForCommand = true;
        this.onWakeWord?.();
        this.onStateChange?.('activated');

        // ウェイクワード以降のテキストをコマンドとして抽出
        const idx = lower.indexOf(wakeWordLower);
        if (idx >= 0) {
          const after = text.substring(idx + this.wakeWord.length).trim();
          if (after.length > 2) {
            this._deliverCommand(after);
            return;
          }
        }
        this._startCommandTimeout();
      }
    } else {
      // コマンド待ち中 → テキストをコマンドとして送信
      const idx = lower.indexOf(wakeWordLower);
      let command = text;
      if (idx >= 0) {
        command = text.substring(idx + this.wakeWord.length).trim();
      }
      if (command.length > 2) {
        this._deliverCommand(command);
      }
    }
  }

  _deliverCommand(command) {
    clearTimeout(this.commandTimeout);
    this.isWaitingForCommand = false;
    this.onCommand?.(command);
  }

  _startCommandTimeout() {
    clearTimeout(this.commandTimeout);
    this.commandTimeout = setTimeout(() => {
      this.isWaitingForCommand = false;
      this.onStateChange?.('listening');
    }, 10000);
  }
}

// ============================================
// 音声読み上げ (Speech Synthesis)
// ============================================

export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1.0;

  // 日本語音声を優先選択
  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v => v.lang.startsWith('ja'));
  if (jaVoice) utterance.voice = jaVoice;

  window.speechSynthesis.speak(utterance);
}
