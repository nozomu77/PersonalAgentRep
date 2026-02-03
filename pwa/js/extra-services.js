// ============================================
// 追加機能サービス (検索, 翻訳, 計算, タイマー, メモ, Due連携)
// ============================================

// ============================================
// ウェブ検索サービス
// ============================================

export const WebSearch = {
  search(query) {
    // Google検索を開く
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
    return `「${query}」をGoogleで検索しました`;
  },
};

// ============================================
// 翻訳サービス (MyMemory API - 無料)
// ============================================

const TRANSLATE_API = 'https://api.mymemory.translated.net/get';

export const Translate = {
  async translate(text, targetLang = 'en') {
    // 元言語を推定
    const isJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    const sourceLang = isJapanese ? 'ja' : 'en';

    // 同じ言語なら反転
    const actualTarget = sourceLang === targetLang ?
      (sourceLang === 'ja' ? 'en' : 'ja') : targetLang;

    const params = new URLSearchParams({
      q: text,
      langpair: `${sourceLang}|${actualTarget}`,
    });

    const res = await fetch(`${TRANSLATE_API}?${params}`);
    const data = await res.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const langNames = { ja: '日本語', en: '英語', zh: '中国語', ko: '韓国語' };
      return `${langNames[actualTarget] || actualTarget}訳:\n${data.responseData.translatedText}`;
    }

    throw new Error('翻訳に失敗しました');
  },
};

// ============================================
// 計算サービス (安全なパーサーベース実装)
// ============================================

// 再帰下降パーサーで安全に数式を評価
function safeEvaluate(expr) {
  const tokens = tokenize(expr);
  let pos = 0;

  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }

  // expr = term (('+' | '-') term)*
  function parseExpr() {
    let left = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  // term = factor (('*' | '/') factor)*
  function parseTerm() {
    let left = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      if (op === '/' && right === 0) throw new Error('Division by zero');
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  // factor = number | '(' expr ')' | '-' factor
  function parseFactor() {
    const token = peek();
    if (token === '-') {
      consume();
      return -parseFactor();
    }
    if (token === '(') {
      consume(); // '('
      const result = parseExpr();
      if (peek() !== ')') throw new Error('Missing )');
      consume(); // ')'
      return result;
    }
    if (typeof token === 'number') {
      consume();
      return token;
    }
    throw new Error('Unexpected token');
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error('Unexpected token');
  return result;
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[+\-*/()]/.test(c)) { tokens.push(c); i++; continue; }
    if (/[\d.]/.test(c)) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) { num += expr[i++]; }
      tokens.push(parseFloat(num));
      continue;
    }
    throw new Error('Invalid character');
  }
  return tokens;
}

export const Calculator = {
  calculate(expression) {
    // 数字と演算子のみ許可
    const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');

    if (!sanitized || sanitized.trim() === '') {
      return '計算式を認識できませんでした';
    }

    try {
      // % を /100 に変換
      const expr = sanitized.replace(/(\d+)%/g, '($1/100)');
      const result = safeEvaluate(expr);

      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        const formatted = Number.isInteger(result) ? result : result.toFixed(6).replace(/\.?0+$/, '');
        return `${expression} = ${formatted}`;
      }
    } catch {
      // 計算エラー
    }

    return `「${expression}」を計算できませんでした`;
  },
};

// ============================================
// タイマーサービス
// ============================================

let activeTimer = null;

export const Timer = {
  setTimer(seconds, onComplete) {
    // 既存タイマーをクリア
    if (activeTimer) {
      clearTimeout(activeTimer.id);
    }

    const endTime = Date.now() + seconds * 1000;

    activeTimer = {
      id: setTimeout(() => {
        // 通知を表示
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('タイマー終了', {
            body: 'タイマーが終了しました',
            icon: '/pwa/icons/icon-192.png',
          });
        }
        onComplete?.();
        activeTimer = null;
      }, seconds * 1000),
      endTime,
    };

    // 通知許可を要求
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    let timeStr = '';
    if (mins > 0) timeStr += `${mins}分`;
    if (secs > 0) timeStr += `${secs}秒`;

    return `タイマーを${timeStr || seconds + '秒'}にセットしました`;
  },

  cancelTimer() {
    if (activeTimer) {
      clearTimeout(activeTimer.id);
      activeTimer = null;
      return 'タイマーをキャンセルしました';
    }
    return 'アクティブなタイマーはありません';
  },

  getRemaining() {
    if (!activeTimer) return null;
    const remaining = Math.max(0, Math.ceil((activeTimer.endTime - Date.now()) / 1000));
    return remaining;
  },
};

// ============================================
// メモサービス (localStorage)
// ============================================

const NOTES_KEY = 'agent_notes';

export const Notes = {
  saveNote(content) {
    const notes = this.getAllNotes();
    const note = {
      id: Date.now().toString(),
      content,
      createdAt: new Date().toISOString(),
    };
    notes.unshift(note);
    // 最大50件保持
    if (notes.length > 50) notes.pop();
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    return `メモを保存しました: ${content}`;
  },

  getAllNotes() {
    try {
      return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    } catch {
      return [];
    }
  },

  listNotes() {
    const notes = this.getAllNotes();
    if (notes.length === 0) {
      return 'メモはありません';
    }

    let result = `メモ一覧 (${notes.length}件):\n\n`;
    notes.slice(0, 10).forEach((note, i) => {
      const date = new Date(note.createdAt).toLocaleDateString('ja-JP');
      const preview = note.content.length > 30 ?
        note.content.slice(0, 30) + '...' : note.content;
      result += `${i + 1}. [${date}] ${preview}\n`;
    });

    return result;
  },

  deleteNote(id) {
    const notes = this.getAllNotes().filter(n => n.id !== id);
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    return 'メモを削除しました';
  },
};

// ============================================
// Due連携サービス (iOS リマインダーアプリ)
// ============================================

export const Due = {
  // Dueアプリでリマインダーを作成
  createReminder(title, dateTime = null) {
    // Due URL Scheme: due://x-callback-url/add?title=...&duedate=...
    const params = new URLSearchParams();
    params.set('title', title);

    if (dateTime) {
      // ISO 8601形式: 2024-01-15T09:00:00
      const d = dateTime instanceof Date ? dateTime : new Date(dateTime);
      if (!isNaN(d.getTime())) {
        const iso = d.toISOString().slice(0, 19); // 秒まで
        params.set('duedate', iso);
      }
    }

    const url = `due://x-callback-url/add?${params.toString()}`;

    // Dueアプリを開く
    window.location.href = url;

    return `Dueアプリでリマインダーを作成します: ${title}`;
  },

  // Due使用設定を確認
  isEnabled() {
    return localStorage.getItem('use_due_app') === 'true';
  },

  // Due使用設定を切り替え
  setEnabled(enabled) {
    localStorage.setItem('use_due_app', enabled ? 'true' : 'false');
  },
};
