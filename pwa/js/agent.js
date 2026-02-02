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
