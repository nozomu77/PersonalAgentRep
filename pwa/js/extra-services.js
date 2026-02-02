// ============================================
// 追加機能サービス (天気, 検索, 翻訳, 計算, ニュース, タイマー, メモ)
// ============================================

// ============================================
// 天気サービス (Open-Meteo API - 無料)
// ============================================

const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

// 主要都市の座標
const CITY_COORDS = {
  '東京': { lat: 35.6762, lon: 139.6503 },
  '大阪': { lat: 34.6937, lon: 135.5023 },
  '名古屋': { lat: 35.1815, lon: 136.9066 },
  '福岡': { lat: 33.5904, lon: 130.4017 },
  '札幌': { lat: 43.0618, lon: 141.3545 },
  '仙台': { lat: 38.2682, lon: 140.8694 },
  '広島': { lat: 34.3853, lon: 132.4553 },
  '京都': { lat: 35.0116, lon: 135.7681 },
  '横浜': { lat: 35.4437, lon: 139.6380 },
  '神戸': { lat: 34.6901, lon: 135.1956 },
};

const WEATHER_CODES = {
  0: '快晴', 1: '晴れ', 2: '一部曇り', 3: '曇り',
  45: '霧', 48: '霧氷', 51: '小雨', 53: '雨', 55: '大雨',
  61: '小雨', 63: '雨', 65: '大雨', 71: '小雪', 73: '雪', 75: '大雪',
  77: '霧雪', 80: 'にわか雨', 81: 'にわか雨', 82: '激しいにわか雨',
  85: 'にわか雪', 86: '激しいにわか雪', 95: '雷雨',
};

export const Weather = {
  async getWeather(location = '東京') {
    let lat, lon;

    // キャッシュされた座標を使用
    if (CITY_COORDS[location]) {
      ({ lat, lon } = CITY_COORDS[location]);
    } else {
      // ジオコーディングで座標取得
      try {
        const geoRes = await fetch(`${GEOCODING_API}?name=${encodeURIComponent(location)}&count=1&language=ja`);
        const geoData = await geoRes.json();
        if (geoData.results?.[0]) {
          lat = geoData.results[0].latitude;
          lon = geoData.results[0].longitude;
        } else {
          // 見つからなければ東京
          lat = CITY_COORDS['東京'].lat;
          lon = CITY_COORDS['東京'].lon;
          location = '東京';
        }
      } catch {
        lat = CITY_COORDS['東京'].lat;
        lon = CITY_COORDS['東京'].lon;
        location = '東京';
      }
    }

    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'Asia/Tokyo',
      forecast_days: 3,
    });

    const res = await fetch(`${WEATHER_API}?${params}`);
    const data = await res.json();

    const current = data.current;
    const daily = data.daily;
    const weatherDesc = WEATHER_CODES[current.weather_code] || '不明';

    let result = `${location}の天気:\n`;
    result += `現在: ${weatherDesc} ${current.temperature_2m}°C\n`;
    result += `湿度: ${current.relative_humidity_2m}% / 風速: ${current.wind_speed_10m}km/h\n\n`;

    const days = ['今日', '明日', '明後日'];
    for (let i = 0; i < 3; i++) {
      const dayWeather = WEATHER_CODES[daily.weather_code[i]] || '不明';
      result += `${days[i]}: ${dayWeather} ${daily.temperature_2m_min[i]}〜${daily.temperature_2m_max[i]}°C 降水${daily.precipitation_probability_max[i]}%\n`;
    }

    return result;
  },
};

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
// ニュースサービス (RSS2JSON API - 無料)
// ============================================

const RSS_API = 'https://api.rss2json.com/v1/api.json';

// 日本語ニュースRSSフィード
const NEWS_FEEDS = {
  general: 'https://news.yahoo.co.jp/rss/topics/top-picks.xml',
  sports: 'https://news.yahoo.co.jp/rss/topics/sports.xml',
  technology: 'https://news.yahoo.co.jp/rss/topics/it.xml',
  entertainment: 'https://news.yahoo.co.jp/rss/topics/entertainment.xml',
  business: 'https://news.yahoo.co.jp/rss/topics/business.xml',
};

export const News = {
  async getNews(category = 'general') {
    const feedUrl = NEWS_FEEDS[category] || NEWS_FEEDS.general;

    try {
      const res = await fetch(`${RSS_API}?rss_url=${encodeURIComponent(feedUrl)}`);
      const data = await res.json();

      if (data.status !== 'ok' || !data.items?.length) {
        return 'ニュースを取得できませんでした';
      }

      const categoryNames = {
        general: '総合', sports: 'スポーツ', technology: 'テクノロジー',
        entertainment: 'エンタメ', business: 'ビジネス',
      };

      let result = `${categoryNames[category] || ''}ニュース:\n\n`;
      data.items.slice(0, 5).forEach((item, i) => {
        result += `${i + 1}. ${item.title}\n`;
      });

      return result;
    } catch {
      return 'ニュースを取得できませんでした';
    }
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
