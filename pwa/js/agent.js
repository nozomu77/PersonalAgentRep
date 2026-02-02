// ============================================
// AI 意図解析エンジン
// ============================================

// 意図の種類
export const IntentType = {
  SEND_EMAIL: 'send_email',
  CHECK_EMAIL: 'check_email',
  CREATE_EVENT: 'create_event',
  CHECK_SCHEDULE: 'check_schedule',
  CREATE_TASK: 'create_task',
  LIST_TASKS: 'list_tasks',
  SET_REMINDER: 'set_reminder',
  // 新機能
  WEATHER: 'weather',
  WEB_SEARCH: 'web_search',
  TRANSLATE: 'translate',
  CALCULATE: 'calculate',
  NEWS: 'news',
  SET_TIMER: 'set_timer',
  SAVE_NOTE: 'save_note',
  LIST_NOTES: 'list_notes',
  HELP: 'help',
  UNKNOWN: 'unknown',
};

const IntentLabels = {
  [IntentType.SEND_EMAIL]: 'メール送信',
  [IntentType.CHECK_EMAIL]: 'メール確認',
  [IntentType.CREATE_EVENT]: '予定作成',
  [IntentType.CHECK_SCHEDULE]: '予定確認',
  [IntentType.CREATE_TASK]: 'タスク作成',
  [IntentType.LIST_TASKS]: 'タスク一覧',
  [IntentType.SET_REMINDER]: 'リマインダー',
  [IntentType.WEATHER]: '天気',
  [IntentType.WEB_SEARCH]: 'ウェブ検索',
  [IntentType.TRANSLATE]: '翻訳',
  [IntentType.CALCULATE]: '計算',
  [IntentType.NEWS]: 'ニュース',
  [IntentType.SET_TIMER]: 'タイマー',
  [IntentType.SAVE_NOTE]: 'メモ保存',
  [IntentType.LIST_NOTES]: 'メモ一覧',
  [IntentType.HELP]: 'ヘルプ',
  [IntentType.UNKNOWN]: '不明',
};

export function getIntentLabel(type) {
  return IntentLabels[type] || '不明';
}

// ============================================
// メインの解析関数
// ============================================

export async function parseIntent(text) {
  const openAIKey = localStorage.getItem('openai_api_key') || '';

  // OpenAI APIが設定されていれば高度な解析
  if (openAIKey) {
    const result = await parseWithOpenAI(text, openAIKey);
    if (result) return result;
  }

  // ルールベースのフォールバック
  return parseWithRules(text);
}

// ============================================
// ルールベース解析
// ============================================

function parseWithRules(text) {
  const n = text.toLowerCase();

  // ヘルプ・機能一覧
  if (containsAny(n, ['どんな機能', '何ができる', '使い方', 'ヘルプ', '機能一覧', '何ができ', 'できること', '使える機能'])) {
    return { type: IntentType.HELP, params: {} };
  }

  // メール送信
  if (containsAny(n, ['メール', 'メールして', 'メールを送', 'mail', '送信して'])) {
    if (containsAny(n, ['未読', '確認', 'チェック', '受信', 'を見'])) {
      return { type: IntentType.CHECK_EMAIL, params: {} };
    }
    return {
      type: IntentType.SEND_EMAIL,
      params: {
        to: extractRecipient(text),
        subject: extractSubject(text),
        body: extractBody(text),
      },
    };
  }

  // メール確認
  if (containsAny(n, ['未読', 'メール確認', 'メールチェック', '受信メール', 'メールを見'])) {
    return { type: IntentType.CHECK_EMAIL, params: {} };
  }

  // 予定作成
  if (containsAny(n, ['予定を入れ', '予定を作', 'スケジュール', 'カレンダーに', '会議を入れ', '予定を追加', '予定入れ'])) {
    return {
      type: IntentType.CREATE_EVENT,
      params: {
        title: extractEventTitle(text),
        date: extractDate(text),
        time: extractTime(text),
      },
    };
  }

  // 予定確認
  if (containsAny(n, ['今日の予定', '予定を教え', 'スケジュール確認', '予定は', '予定を確認', '予定教え'])) {
    return {
      type: IntentType.CHECK_SCHEDULE,
      params: { date: extractDate(text) || 'today' },
    };
  }

  // リマインダー
  if (containsAny(n, ['リマインド', 'リマインダー', '忘れない', '思い出させ', '通知して'])) {
    return {
      type: IntentType.SET_REMINDER,
      params: {
        title: extractReminderTitle(text),
        date: extractDate(text),
        time: extractTime(text),
      },
    };
  }

  // タスク一覧
  if (containsAny(n, ['タスク一覧', 'タスクを見', 'やること一覧', 'タスク確認', 'タスクを確認'])) {
    return { type: IntentType.LIST_TASKS, params: {} };
  }

  // タスク作成
  if (containsAny(n, ['タスク', 'やること', 'todo', '追加して', '登録して'])) {
    return {
      type: IntentType.CREATE_TASK,
      params: {
        title: extractTaskTitle(text),
        notes: '',
      },
    };
  }

  // 天気
  if (containsAny(n, ['天気', '気温', '降水', '雨', '晴れ', '曇り', '気象'])) {
    return {
      type: IntentType.WEATHER,
      params: { location: extractLocation(text) },
    };
  }

  // ウェブ検索
  if (containsAny(n, ['検索', '調べて', 'ググ', '探して', 'サーチ'])) {
    return {
      type: IntentType.WEB_SEARCH,
      params: { query: extractSearchQuery(text) },
    };
  }

  // 翻訳
  if (containsAny(n, ['翻訳', '英語に', '日本語に', '通訳', '英訳', '和訳'])) {
    return {
      type: IntentType.TRANSLATE,
      params: {
        text: extractTranslateText(text),
        targetLang: extractTargetLang(text),
      },
    };
  }

  // 計算
  if (containsAny(n, ['計算', '足し', '引き', '掛け', '割り', 'いくら', 'いくつ', '何%', '何パーセント']) ||
      /[\d０-９]+\s*[+\-×÷*/＋−×÷]\s*[\d０-９]+/.test(n)) {
    return {
      type: IntentType.CALCULATE,
      params: { expression: extractMathExpression(text) },
    };
  }

  // ニュース
  if (containsAny(n, ['ニュース', '最新情報', 'ヘッドライン', '話題', 'トピック'])) {
    return {
      type: IntentType.NEWS,
      params: { category: extractNewsCategory(text) },
    };
  }

  // タイマー
  if (containsAny(n, ['タイマー', '分後', '秒後', '時間後', 'アラーム', 'カウントダウン'])) {
    return {
      type: IntentType.SET_TIMER,
      params: { seconds: extractTimerSeconds(text) },
    };
  }

  // メモ一覧
  if (containsAny(n, ['メモ一覧', 'メモを見', 'メモ確認', 'メモを確認', 'ノート一覧'])) {
    return { type: IntentType.LIST_NOTES, params: {} };
  }

  // メモ保存
  if (containsAny(n, ['メモ', 'ノート', '記録', '書いて', 'めも'])) {
    return {
      type: IntentType.SAVE_NOTE,
      params: { content: extractNoteContent(text) },
    };
  }

  return { type: IntentType.UNKNOWN, params: { rawText: text } };
}

// ============================================
// OpenAI API 解析
// ============================================

async function parseWithOpenAI(text, apiKey) {
  const prompt = `ユーザーの発話から意図を解析し、以下のJSON形式で返してください。

意図の種類:
- send_email: メール送信 (to, subject, body)
- check_email: メール確認
- create_event: 予定作成 (title, date, time)
- check_schedule: 予定確認 (date)
- create_task: タスク作成 (title, notes)
- list_tasks: タスク一覧
- set_reminder: リマインダー (title, date, time)
- weather: 天気 (location)
- web_search: ウェブ検索 (query)
- translate: 翻訳 (text, targetLang: ja/en/zh/ko)
- calculate: 計算 (expression)
- news: ニュース (category: general/sports/technology/entertainment/business)
- set_timer: タイマー (seconds)
- save_note: メモ保存 (content)
- list_notes: メモ一覧
- unknown: 不明

日付は today/tomorrow/day_after_tomorrow または YYYY-MM-DD 形式。
時間は HH:MM 形式。

発話: "${text}"

JSON形式で返答:`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '日本語の音声コマンドを解析するアシスタント。{"intent":"...","params":{...}}のJSON形式のみで返答。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed.intent && IntentType[parsed.intent.toUpperCase()]) {
      return { type: parsed.intent, params: parsed.params || {} };
    }
  } catch (e) {
    console.warn('OpenAI解析失敗, ルールベースにフォールバック:', e);
  }
  return null;
}

// ============================================
// テキスト抽出ヘルパー
// ============================================

function containsAny(text, keywords) {
  return keywords.some(k => text.includes(k));
}

function extractRecipient(text) {
  const patterns = [
    /(.+?)に(?:メール|送信)/,
    /(.+?)宛て/,
    /(.+?)へ(?:メール|送信)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function extractSubject(text) {
  const patterns = [
    /件名[はが](.+?)(?:で|、|$)/,
    /タイトル[はが](.+?)(?:で|、|$)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function extractBody(text) {
  const patterns = [
    /内容[はが](.+?)$/,
    /本文[はが](.+?)$/,
    /と伝えて$/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function extractEventTitle(text) {
  const m1 = text.match(/「(.+?)」/);
  if (m1) return m1[1];

  const m2 = text.match(/(.+?)(?:を|の)(?:予定|スケジュール|カレンダー)/);
  if (m2) return m2[1].trim();

  // 時間部分を除去して残りをタイトルに
  return text
    .replace(/明日|今日|明後日/g, '')
    .replace(/\d{1,2}時\d{0,2}分?/g, '')
    .replace(/(?:の|に|を|予定|入れて|追加|作成|して)/g, '')
    .trim() || text;
}

function extractDate(text) {
  if (text.includes('今日')) return 'today';
  if (text.includes('明後日')) return 'day_after_tomorrow';
  if (text.includes('明日')) return 'tomorrow';

  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );

  const m = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (m) {
    const year = new Date().getFullYear();
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return '';
}

function extractTime(text) {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );

  // 「9時30分」「10時」「15時半」パターン
  const m = normalized.match(/(\d{1,2})\s*時\s*(?:(\d{1,2})\s*分|半)?/);
  if (m) {
    const h = m[1].padStart(2, '0');
    let min = '00';
    if (m[2]) {
      min = m[2].padStart(2, '0');
    } else if (normalized.includes('半')) {
      min = '30';
    }
    return `${h}:${min}`;
  }
  return '';
}

function extractReminderTitle(text) {
  const m1 = text.match(/「(.+?)」/);
  if (m1) return m1[1];

  const m2 = text.match(/(.+?)を(?:リマインド|リマインダー|忘れない|通知)/);
  if (m2) {
    const r = m2[1].trim();
    if (r && !['リマインド', 'リマインダー', '通知'].includes(r)) return r;
  }

  const m3 = text.match(/(?:リマインド|リマインダー|通知)して(.+?)$/);
  if (m3) return m3[1].trim();

  return text;
}

function extractTaskTitle(text) {
  const m1 = text.match(/「(.+?)」/);
  if (m1) return m1[1];

  const m2 = text.match(/(.+?)を(?:タスク|追加|登録)/);
  if (m2) {
    const r = m2[1].trim();
    if (r && !['タスク', '追加', '登録'].includes(r)) return r;
  }
  return text;
}

// 天気の場所抽出
function extractLocation(text) {
  const m = text.match(/(.+?)(?:の天気|の気温|は[晴曇雨])/);
  if (m) {
    const loc = m[1].replace(/今日|明日|明後日/g, '').trim();
    if (loc) return loc;
  }
  return '東京';
}

// 検索クエリ抽出
function extractSearchQuery(text) {
  const m1 = text.match(/「(.+?)」/);
  if (m1) return m1[1];

  const m2 = text.match(/(.+?)(?:を|について|で)(?:検索|調べ|ググ|探)/);
  if (m2) return m2[1].trim();

  const m3 = text.match(/(?:検索|調べて|ググって)[：:\s]*(.+)/);
  if (m3) return m3[1].trim();

  return text.replace(/検索|調べて|ググって|探して/g, '').trim();
}

// 翻訳テキスト抽出
function extractTranslateText(text) {
  const m1 = text.match(/「(.+?)」/);
  if (m1) return m1[1];

  const m2 = text.match(/(.+?)を(?:翻訳|英語|日本語|英訳|和訳)/);
  if (m2) return m2[1].trim();

  return text.replace(/翻訳|英語に|日本語に|して/g, '').trim();
}

// 翻訳先言語抽出
function extractTargetLang(text) {
  if (containsAny(text, ['日本語', '和訳'])) return 'ja';
  if (containsAny(text, ['英語', '英訳'])) return 'en';
  if (containsAny(text, ['中国語'])) return 'zh';
  if (containsAny(text, ['韓国語'])) return 'ko';
  return 'en'; // デフォルト英語
}

// 数式抽出
function extractMathExpression(text) {
  // 全角を半角に
  let expr = text
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/＋/g, '+').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/')
    .replace(/掛ける/g, '*').replace(/割る/g, '/').replace(/足す/g, '+').replace(/引く/g, '-')
    .replace(/プラス/g, '+').replace(/マイナス/g, '-');

  // 数式部分を抽出
  const m = expr.match(/[\d.]+\s*[+\-*/]\s*[\d.]+(?:\s*[+\-*/]\s*[\d.]+)*/);
  if (m) return m[0];

  return expr.replace(/計算|して|は|いくつ|いくら/g, '').trim();
}

// ニュースカテゴリ抽出
function extractNewsCategory(text) {
  if (containsAny(text, ['スポーツ', '野球', 'サッカー'])) return 'sports';
  if (containsAny(text, ['テクノロジー', 'IT', 'テック', '技術'])) return 'technology';
  if (containsAny(text, ['エンタメ', '芸能', '映画', '音楽'])) return 'entertainment';
  if (containsAny(text, ['ビジネス', '経済', '株', '金融'])) return 'business';
  return 'general';
}

// タイマー秒数抽出
function extractTimerSeconds(text) {
  const normalized = text.replace(/[０-９]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );

  const mHour = normalized.match(/(\d+)\s*時間/);
  const mMin = normalized.match(/(\d+)\s*分/);
  const mSec = normalized.match(/(\d+)\s*秒/);

  let total = 0;
  if (mHour) total += parseInt(mHour[1]) * 3600;
  if (mMin) total += parseInt(mMin[1]) * 60;
  if (mSec) total += parseInt(mSec[1]);

  return total || 180; // デフォルト3分
}

// メモ内容抽出
function extractNoteContent(text) {
  const m1 = text.match(/「(.+?)」/);
  if (m1) return m1[1];

  const m2 = text.match(/(?:メモ|ノート|記録)[：:\s]*(.+)/);
  if (m2) return m2[1].trim();

  const m3 = text.match(/(.+?)を(?:メモ|ノート|記録)/);
  if (m3) return m3[1].trim();

  return text.replace(/メモ|ノート|記録|して|書いて/g, '').trim();
}
