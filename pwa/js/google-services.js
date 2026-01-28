// ============================================
// Google API サービス (Gmail / Calendar / Tasks)
// ============================================

import { getAccessToken } from './auth.js';

// ============================================
// 共通ヘルパー
// ============================================

async function apiRequest(url, options = {}) {
  const token = getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`API Error ${res.status}: ${errorBody}`);
  }

  // 204 No Content の場合
  if (res.status === 204) return null;
  return res.json();
}

function resolveDate(dateStr) {
  const today = new Date();
  switch (dateStr?.toLowerCase()) {
    case 'today': case '今日': case '':
      return today;
    case 'tomorrow': case '明日':
      return new Date(today.getTime() + 86400000);
    case 'day_after_tomorrow': case '明後日':
      return new Date(today.getTime() + 86400000 * 2);
    default: {
      const d = new Date(dateStr);
      return isNaN(d) ? today : d;
    }
  }
}

function formatDisplayDate(dateStr) {
  switch (dateStr?.toLowerCase()) {
    case 'today': case '今日': case '': case undefined: return '今日';
    case 'tomorrow': case '明日': return '明日';
    case 'day_after_tomorrow': case '明後日': return '明後日';
    default: return dateStr;
  }
}

function toISOStringWithTZ(date) {
  // Asia/Tokyo (UTC+9) 用のISO文字列
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const m = String(Math.abs(offset) % 60).padStart(2, '0');
  return date.toISOString().replace('Z', `${sign}${h}:${m}`);
}

// ============================================
// Gmail サービス
// ============================================

export const Gmail = {
  async sendEmail(to, subject, body) {
    // RFC 2822 形式のメール
    const email = [
      `To: ${to}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      btoa(unescape(encodeURIComponent(body))),
    ].join('\r\n');

    // Base64url エンコード
    const raw = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await apiRequest('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw }),
    });

    return `メールを ${to} に送信しました`;
  },

  async getUnreadEmails(maxResults = 5) {
    const list = await apiRequest(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=${maxResults}`
    );

    if (!list.messages || list.messages.length === 0) {
      return '未読メールはありません';
    }

    // 各メッセージの詳細を取得
    const details = await Promise.all(
      list.messages.slice(0, maxResults).map(msg =>
        apiRequest(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`
        )
      )
    );

    let summary = `未読メールが${details.length}件あります:\n`;
    details.forEach((msg, i) => {
      const headers = msg.payload?.headers || [];
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '不明';
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '(件名なし)';
      summary += `${i + 1}. ${from} - ${subject}\n`;
    });

    return summary;
  },
};

// ============================================
// Google Calendar サービス
// ============================================

export const Calendar = {
  async createEvent(title, dateStr, timeStr, durationMin = 60) {
    const target = resolveDate(dateStr);

    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      target.setHours(h, m, 0, 0);
    } else {
      target.setHours(9, 0, 0, 0);
    }

    const endDate = new Date(target.getTime() + durationMin * 60000);

    const event = {
      summary: title,
      start: { dateTime: toISOStringWithTZ(target), timeZone: 'Asia/Tokyo' },
      end: { dateTime: toISOStringWithTZ(endDate), timeZone: 'Asia/Tokyo' },
    };

    await apiRequest('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    const displayDate = formatDisplayDate(dateStr);
    const displayTime = timeStr || '09:00';
    return `「${title}」を${displayDate}の${displayTime}に登録しました`;
  },

  async getEvents(dateStr) {
    const target = resolveDate(dateStr);
    const startOfDay = new Date(target);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(target);
    endOfDay.setHours(23, 59, 59, 999);

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '10',
    });

    const data = await apiRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`
    );

    const events = data.items || [];
    const displayDate = formatDisplayDate(dateStr);

    if (events.length === 0) {
      return `${displayDate}の予定はありません`;
    }

    let summary = `${displayDate}の予定は${events.length}件です:\n`;
    events.forEach((evt, i) => {
      const title = evt.summary || '(タイトルなし)';
      let time = '終日';
      if (evt.start?.dateTime) {
        const d = new Date(evt.start.dateTime);
        time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }
      summary += `${i + 1}. ${time} ${title}\n`;
    });

    return summary;
  },
};

// ============================================
// Google Tasks サービス
// ============================================

let cachedTaskListId = null;

async function getDefaultTaskListId() {
  if (cachedTaskListId) return cachedTaskListId;

  const data = await apiRequest('https://tasks.googleapis.com/tasks/v1/users/@me/lists');
  const lists = data.items || [];
  if (lists.length === 0) throw new Error('タスクリストが見つかりません');

  cachedTaskListId = lists[0].id;
  return cachedTaskListId;
}

export const Tasks = {
  async createTask(title, notes = '', dueDate = null) {
    const listId = await getDefaultTaskListId();

    const task = { title };
    if (notes) task.notes = notes;
    if (dueDate) {
      const d = resolveDate(dueDate);
      task.due = d.toISOString();
    }

    await apiRequest(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    });

    return `タスク「${title}」を追加しました`;
  },

  async getTasks() {
    const listId = await getDefaultTaskListId();

    const data = await apiRequest(
      `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=false&maxResults=20`
    );

    const tasks = data.items || [];

    if (tasks.length === 0) {
      return '未完了のタスクはありません';
    }

    let summary = `タスクが${tasks.length}件あります:\n`;
    tasks.forEach((t, i) => {
      const title = t.title || '(タイトルなし)';
      summary += `${i + 1}. ${title}\n`;
    });

    return summary;
  },
};
