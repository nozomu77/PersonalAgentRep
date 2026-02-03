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
    this.recognition.continuous = false; // モバイル互換のため false
    this.recognition.interimResults = true;

    this.isListening = false;
    this.wakeWord = localStorage.getItem('wake_word') || 'ヘイエージェント';

    // directMode: true = マイクボタン押下で即コマンド受付
    //             false = ウェイクワード待ち受け
    this.directMode = true;
    this.isWaitingForCommand = false;
    this.commandTimeout = null;
    this._lastFinal = '';
    this._silenceTimeout = null; // 沈黙検出タイマー
    this._accumulatedText = '';  // 蓄積テキスト

    // コールバック
    this.onWakeWord = null;
    this.onCommand = null;
    this.onInterim = null;
    this.onStateChange = null;

    this._setupRecognition();
  }

  setWakeWord(word) {
    this.wakeWord = word;
    localStorage.setItem('wake_word', word);
  }

  // ダイレクトモードで開始（ボタン押下 → 即コマンド受付）
  startDirect() {
    this.directMode = true;
    this._lastFinal = '';
    this._accumulatedText = '';
    clearTimeout(this._silenceTimeout);
    this._start();
    this.onStateChange?.('activated');
  }

  // ウェイクワードモードで開始（常時待ち受け）
  startWakeWord() {
    this.directMode = false;
    this.isWaitingForCommand = false;
    this._lastFinal = '';
    this._start();
    this.onStateChange?.('listening');
  }

  stop() {
    if (!this.isListening) return;
    this.isListening = false;
    this.isWaitingForCommand = false;
    this._accumulatedText = '';
    clearTimeout(this.commandTimeout);
    clearTimeout(this._silenceTimeout);
    try { this.recognition.stop(); } catch (e) { /* ignore */ }
    this.onStateChange?.('idle');
  }

  // 内部: 認識を開始
  _start() {
    if (!this.supported) return;
    if (this.isListening) {
      try { this.recognition.stop(); } catch (e) { /* ignore */ }
    }
    try {
      this.recognition.start();
      this.isListening = true;
    } catch (e) {
      console.error('音声認識の開始に失敗:', e);
    }
  }

  _setupRecognition() {
    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // 中間結果を画面に表示
      if (interimTranscript) {
        this.onInterim?.(interimTranscript);
      }

      // 確定結果を処理
      if (finalTranscript) {
        this._lastFinal = finalTranscript;

        if (this.directMode) {
          // ダイレクトモード: テキストを蓄積し、沈黙後に送信
          this._accumulatedText += (this._accumulatedText ? ' ' : '') + finalTranscript;
          this.onInterim?.(this._accumulatedText);
          this._scheduleSilenceCheck();
        } else {
          // ウェイクワードモード
          this.onInterim?.(finalTranscript);
          this._processWithWakeWord(finalTranscript);
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.warn('音声認識エラー:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'network') {
        if (this.isListening && !this.directMode) {
          this._restart();
        }
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        if (this.directMode) {
          // ダイレクトモード: 認識終了時、蓄積テキストがあれば送信
          if (this._accumulatedText) {
            clearTimeout(this._silenceTimeout);
            this._deliverCommand(this._accumulatedText);
            this._accumulatedText = '';
          }
          this.isListening = false;
          this.onStateChange?.('idle');
        } else {
          // ウェイクワードモード: 再起動して常時待ち受け
          this._restart();
        }
      }
    };
  }

  // 沈黙を検出してコマンド送信をスケジュール
  _scheduleSilenceCheck() {
    clearTimeout(this._silenceTimeout);
    // 1.5秒間新しい音声がなければコマンド送信
    this._silenceTimeout = setTimeout(() => {
      if (this._accumulatedText && this.isListening) {
        const text = this._accumulatedText;
        this._accumulatedText = '';
        this._deliverCommand(text);
        // 認識を停止
        try { this.recognition.stop(); } catch (e) { /* ignore */ }
      }
    }, 1500);
  }

  _restart() {
    setTimeout(() => {
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (e) { /* ignore */ }
      }
    }, 300);
  }

  _processWithWakeWord(text) {
    const lower = text.toLowerCase();
    const wakeWordLower = this.wakeWord.toLowerCase();

    const hasWakeWord = lower.includes(wakeWordLower) ||
                        lower.includes('ヘイエージェント') ||
                        lower.includes('hey agent');

    if (!this.isWaitingForCommand) {
      if (hasWakeWord) {
        this.isWaitingForCommand = true;
        this.onWakeWord?.();
        this.onStateChange?.('activated');

        // ウェイクワード後のテキストがあればコマンドとして処理
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
      // コマンド待ち中
      let command = text;
      const idx = lower.indexOf(wakeWordLower);
      if (idx >= 0) {
        command = text.substring(idx + this.wakeWord.length).trim();
      }
      if (command.length > 1) {
        this._deliverCommand(command);
      }
    }
  }

  _deliverCommand(command) {
    clearTimeout(this.commandTimeout);
    this.isWaitingForCommand = false;
    this.onCommand?.(command.trim());
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

  const voices = window.speechSynthesis.getVoices();
  const jaVoice = voices.find(v => v.lang.startsWith('ja'));
  if (jaVoice) utterance.voice = jaVoice;

  window.speechSynthesis.speak(utterance);
}
