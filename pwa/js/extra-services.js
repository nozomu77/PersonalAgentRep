// ============================================
// 追加機能サービス (Due連携)
// ============================================

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
      // ローカル時間でISO 8601形式: 2024-01-15T09:00:00
      const d = dateTime instanceof Date ? dateTime : new Date(dateTime);
      if (!isNaN(d.getTime())) {
        const pad = n => n.toString().padStart(2, '0');
        const localISO = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        params.set('duedate', localISO);
      }
    }

    const url = `due://x-callback-url/add?${params.toString()}`;

    // Dueアプリを開く
    window.location.href = url;

    const timeStr = dateTime ? ` (${dateTime.toLocaleString('ja-JP')})` : '';
    return `Dueアプリでリマインダーを作成します: ${title}${timeStr}`;
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
