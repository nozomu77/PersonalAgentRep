// ============================================
// AI 意図解析エンジン
// ============================================

// 意図の種類
export const IntentType = {
  CREATE_EVENT: 'create_event',
  CHECK_SCHEDULE: 'check_schedule',
  SET_REMINDER: 'set_reminder',
  CAPTURE_RECEIPT: 'capture_receipt',
  HELP: 'help',
  UNKNOWN: 'unknown',
};

const IntentLabels = {
  [IntentType.CREATE_EVENT]: '予定作成',
  [IntentType.CHECK_SCHEDULE]: '予定確認',
  [IntentType.SET_REMINDER]: 'リマインダー',
  [IntentType.CAPTURE_RECEIPT]: '領収書登録',
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

  // 領収書登録
  if (containsAny(n, ['領収書', 'レシート', '経費', '精算'])) {
    return { type: IntentType.CAPTURE_RECEIPT, params: {} };
  }

  return { type: IntentType.UNKNOWN, params: { rawText: text } };
}

// ============================================
// OpenAI API 解析
// ============================================

async function parseWithOpenAI(text, apiKey) {
  const prompt = `ユーザーの発話から意図を解析し、以下のJSON形式で返してください。

意図の種類:
- create_event: 予定作成 (title, date, time)
- check_schedule: 予定確認 (date)
- set_reminder: リマインダー (title, date, time)
- capture_receipt: 領収書登録
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

