// ============================================
// Google OAuth 認証 (Google Identity Services)
// ============================================

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/tasks.readonly',
].join(' ');

let tokenClient = null;
let accessToken = null;
let tokenExpiry = null;

// コールバック
let onAuthChange = null;

// ============================================
// 初期化
// ============================================

export function initAuth(callback) {
  onAuthChange = callback;

  // 保存済みトークンを復元
  const saved = localStorage.getItem('gauth_token');
  const savedExpiry = localStorage.getItem('gauth_expiry');
  if (saved && savedExpiry && Date.now() < parseInt(savedExpiry)) {
    accessToken = saved;
    tokenExpiry = parseInt(savedExpiry);
    onAuthChange?.(true);
  }
}

export function setupTokenClient(clientId) {
  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID') {
    console.warn('Google Client IDが未設定です');
    return;
  }

  // GIS ライブラリがロードされるまで待つ
  const waitForGIS = () => {
    if (window.google?.accounts?.oauth2) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: handleTokenResponse,
      });
    } else {
      setTimeout(waitForGIS, 200);
    }
  };
  waitForGIS();
}

// ============================================
// ログイン / ログアウト
// ============================================

export function signIn() {
  if (!tokenClient) {
    throw new Error('Google Client IDを設定画面で入力してください');
  }
  tokenClient.requestAccessToken();
}

export function signOut() {
  if (accessToken) {
    try {
      window.google.accounts.oauth2.revoke(accessToken);
    } catch (e) {
      // revoke失敗は無視
    }
  }
  accessToken = null;
  tokenExpiry = null;
  localStorage.removeItem('gauth_token');
  localStorage.removeItem('gauth_expiry');
  onAuthChange?.(false);
}

export function isAuthenticated() {
  return !!accessToken && Date.now() < (tokenExpiry || 0);
}

// ============================================
// アクセストークン取得
// ============================================

export function getAccessToken() {
  if (!accessToken) {
    throw new Error('ログインが必要です');
  }
  if (Date.now() >= (tokenExpiry || 0)) {
    // トークン期限切れ → 再認証が必要
    signIn();
    throw new Error('トークンの有効期限が切れました。再ログインしてください');
  }
  return accessToken;
}

// ============================================
// 内部処理
// ============================================

function handleTokenResponse(response) {
  if (response.error) {
    console.error('認証エラー:', response.error);
    onAuthChange?.(false);
    return;
  }

  accessToken = response.access_token;
  // トークンの有効期限（通常1時間）
  tokenExpiry = Date.now() + (response.expires_in || 3600) * 1000;

  localStorage.setItem('gauth_token', accessToken);
  localStorage.setItem('gauth_expiry', tokenExpiry.toString());

  onAuthChange?.(true);
}
