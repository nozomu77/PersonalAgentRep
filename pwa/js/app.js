// ============================================
// AI Agent PWA - メインアプリケーション
// ============================================

import { SpeechEngine } from './speech.js';
import { parseIntent, getIntentLabel, IntentType } from './agent.js';
import { initAuth, setupTokenClient, signIn, signOut, isAuthenticated } from './auth.js';
import { Gmail, Calendar, Tasks } from './google-services.js';
import { Weather, WebSearch, Translate, Calculator, News, Timer, Notes } from './extra-services.js';

// ============================================
// 状態管理
// ============================================

const state = {
  currentPage: 'home',
  agentState: 'idle', // idle | listening | activated | processing | responding
  history: JSON.parse(localStorage.getItem('command_history') || '[]'),
  clientId: localStorage.getItem('google_client_id') || '',
};

// ============================================
// DOM要素
// ============================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  // Header
  googleStatus: $('#google-status'),
  googleStatusText: $('#google-status-text'),

  // Home
  agentIcon: $('#agent-icon'),
  stateMessage: $('#state-message'),
  waveCanvas: $('#wave-canvas'),
  transcription: $('#transcription'),
  progressArea: $('#progress-area'),
  progressSteps: $$('.progress-step'),
  progressConnectors: $$('.progress-connector'),
  responseArea: $('#response-area'),
  responseText: $('#response-text'),
  btnMic: $('#btn-mic'),
  micIcon: $('#mic-icon'),
  btnKeyboard: $('#btn-keyboard'),
  manualInput: $('#manual-input'),
  inputCommand: $('#input-command'),
  btnSend: $('#btn-send'),

  // Settings
  inputClientId: $('#input-client-id'),
  btnSaveClientId: $('#btn-save-client-id'),
  btnGoogleAuth: $('#btn-google-auth'),
  authMessage: $('#auth-message'),
  inputWakeword: $('#input-wakeword'),
  inputOpenAIKey: $('#input-openai-key'),
  btnToggleKey: $('#btn-toggle-key'),
  btnSaveKey: $('#btn-save-key'),

  // History
  historyList: $('#history-list'),

  // Confirm Dialog
  confirmOverlay: $('#confirm-overlay'),
  confirmTitle: $('#confirm-title'),
  confirmBody: $('#confirm-body'),
  btnConfirmOk: $('#btn-confirm-ok'),
  btnConfirmCancel: $('#btn-confirm-cancel'),
};

// ============================================
// 音声認識エンジン
// ============================================

const speech = new SpeechEngine();
let isListening = false;
let waveAnimId = null;

// ============================================
// 初期化
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initHome();
  initSettings();
  initAuthModule();
  renderHistory();
  drawWave(false);

  // Web Speech API 非対応チェック
  if (!speech.supported) {
    dom.stateMessage.textContent = 'このブラウザは音声認識に非対応です (Chromeを推奨)';
    return;
  }

  // URLパラメータで自動起動
  const params = new URLSearchParams(window.location.search);
  if (params.get('listen') === '1' || params.has('listen')) {
    // 少し待ってから開始（DOMの準備完了を待つ）
    setTimeout(() => {
      toggleListening();
    }, 500);
    // パラメータをURLから削除（履歴を汚さない）
    window.history.replaceState({}, '', window.location.pathname);
  }
});

// ============================================
// タブ切り替え
// ============================================

function initTabs() {
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      $$('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      $$('.page').forEach(p => p.classList.remove('active'));
      $(`#page-${target}`).classList.add('active');
      state.currentPage = target;
    });
  });
}

// ============================================
// ホーム画面
// ============================================

function initHome() {
  // マイクボタン
  dom.btnMic.addEventListener('click', toggleListening);

  // キーボードボタン
  dom.btnKeyboard.addEventListener('click', () => {
    dom.manualInput.classList.toggle('hidden');
    if (!dom.manualInput.classList.contains('hidden')) {
      dom.inputCommand.focus();
    }
  });

  // テキスト送信
  dom.btnSend.addEventListener('click', sendManualCommand);
  dom.inputCommand.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendManualCommand();
  });

  // 音声認識コールバック
  speech.onWakeWord = () => {
    setAgentState('activated');
    showResponse('はい、何をしますか？');
  };

  speech.onCommand = (command) => {
    processCommand(command);
  };

  speech.onInterim = (text) => {
    dom.transcription.textContent = text;
  };

  speech.onStateChange = (newState) => {
    setAgentState(newState);
  };
}

function toggleListening() {
  if (isListening) {
    speech.stop();
    isListening = false;
    setAgentState('idle');
    dom.btnMic.classList.remove('recording');
    dom.micIcon.textContent = '🎙️';
  } else {
    // ダイレクトモード: ボタン押したら即コマンド受付
    speech.startDirect();
    isListening = true;
    setAgentState('activated');
    dom.btnMic.classList.add('recording');
    dom.micIcon.textContent = '⏹️';
  }
}

function sendManualCommand() {
  const text = dom.inputCommand.value.trim();
  if (!text) return;
  dom.inputCommand.value = '';
  processCommand(text);
}

async function processCommand(text) {
  setAgentState('processing');
  dom.transcription.textContent = text;
  showProgress('parse');

  try {
    // 意図解析
    const intent = await parseIntent(text);
    setProgressDone('parse');

    // 読み取り系は確認不要、書き込み系は確認を挟む
    const needsConfirm = [
      IntentType.SEND_EMAIL,
      IntentType.CREATE_EVENT,
      IntentType.CREATE_TASK,
      IntentType.SET_REMINDER,
      IntentType.SAVE_NOTE,
    ].includes(intent.type);

    if (needsConfirm) {
      // 確認ダイアログを表示して待つ
      hideProgress();
      const summary = buildConfirmSummary(intent, text);
      showResponse(summary.message);
      const confirmed = await showConfirmDialog(summary.title, summary.rows);

      if (!confirmed) {
        showResponse('キャンセルしました');
        resetToIdle();
        return;
      }
      showProgress('execute');
    } else {
      showProgress('execute');
    }

    // コマンド実行
    const result = await executeIntent(intent, text);
    setProgressDone('execute');
    showProgress('done');
    setProgressDone('done');

    // 結果表示 (少し待ってから表示)
    await sleep(300);
    hideProgress();
    showResponse(result.response);
    setAgentState('responding');
    addHistory(result);
  } catch (e) {
    hideProgress();
    const errorMsg = `エラー: ${e.message}`;
    showResponse(errorMsg);
    setAgentState('responding');
    addHistory({
      type: IntentType.UNKNOWN,
      rawText: text,
      response: errorMsg,
      success: false,
      timestamp: new Date().toISOString(),
    });
  }

  // 3秒後にアイドル状態に戻す
  setTimeout(resetToIdle, 3000);
}

function resetToIdle() {
  isListening = false;
  dom.btnMic.classList.remove('recording');
  dom.micIcon.textContent = '🎙️';
  setAgentState('idle');
  hideProgress();
}

// ============================================
// プログレス表示
// ============================================

function showProgress(step) {
  dom.progressArea.classList.remove('hidden');
  dom.responseArea.classList.add('hidden');

  const steps = ['parse', 'execute', 'done'];
  const stepIndex = steps.indexOf(step);

  dom.progressSteps.forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < stepIndex) {
      el.classList.add('done');
    } else if (i === stepIndex) {
      el.classList.add('active');
    }
  });

  dom.progressConnectors.forEach((el, i) => {
    el.classList.remove('done');
    if (i < stepIndex) {
      el.classList.add('done');
    }
  });
}

function setProgressDone(step) {
  const steps = ['parse', 'execute', 'done'];
  const stepIndex = steps.indexOf(step);

  if (stepIndex >= 0 && dom.progressSteps[stepIndex]) {
    dom.progressSteps[stepIndex].classList.remove('active');
    dom.progressSteps[stepIndex].classList.add('done');
  }
  if (stepIndex > 0 && dom.progressConnectors[stepIndex - 1]) {
    dom.progressConnectors[stepIndex - 1].classList.add('done');
  }
}

function hideProgress() {
  dom.progressArea.classList.add('hidden');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 確認ダイアログ
// ============================================

function buildConfirmSummary(intent, rawText) {
  const p = intent.params || {};
  const dateName = { today: '今日', tomorrow: '明日', day_after_tomorrow: '明後日' };

  switch (intent.type) {
    case IntentType.SEND_EMAIL:
      return {
        title: 'メール送信',
        message: `メール送信: ${p.to || '(宛先未指定)'} / 件名: ${p.subject || '(なし)'}`,
        rows: [
          { label: '宛先', value: p.to || '(未指定)' },
          { label: '件名', value: p.subject || '(なし)' },
          { label: '本文', value: p.body || '(なし)' },
        ],
      };
    case IntentType.CREATE_EVENT:
      return {
        title: '予定を作成',
        message: `予定作成: ${p.title || rawText} / ${dateName[p.date] || p.date || '今日'} ${p.time || '09:00'}`,
        rows: [
          { label: 'タイトル', value: p.title || rawText },
          { label: '日付', value: dateName[p.date] || p.date || '今日' },
          { label: '時間', value: p.time || '09:00 (デフォルト)' },
        ],
      };
    case IntentType.CREATE_TASK:
      return {
        title: 'タスクを作成',
        message: `タスク作成: ${p.title || rawText}`,
        rows: [
          { label: 'タスク名', value: p.title || rawText },
          { label: 'メモ', value: p.notes || '(なし)' },
        ],
      };
    case IntentType.SET_REMINDER:
      return {
        title: 'リマインダーを作成',
        message: `リマインダー: ${p.title || rawText}`,
        rows: [
          { label: '内容', value: p.title || rawText },
          { label: '日付', value: dateName[p.date] || p.date || '(未指定)' },
        ],
      };
    case IntentType.SAVE_NOTE:
      return {
        title: 'メモを保存',
        message: `メモ: ${p.content || rawText}`,
        rows: [
          { label: '内容', value: p.content || rawText },
        ],
      };
    default:
      return { title: '実行確認', message: rawText, rows: [{ label: '内容', value: rawText }] };
  }
}

function showConfirmDialog(title, rows) {
  return new Promise((resolve) => {
    dom.confirmTitle.textContent = title;
    // DOM APIで安全に要素を作成 (XSS対策)
    dom.confirmBody.textContent = '';
    rows.forEach(({ label, value }) => {
      const row = document.createElement('div');
      row.className = 'confirm-row';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'confirm-label';
      labelSpan.textContent = label;
      const valueSpan = document.createElement('span');
      valueSpan.textContent = value;
      row.appendChild(labelSpan);
      row.appendChild(valueSpan);
      dom.confirmBody.appendChild(row);
    });
    dom.confirmOverlay.classList.remove('hidden');

    const cleanup = () => {
      dom.confirmOverlay.classList.add('hidden');
      dom.btnConfirmOk.removeEventListener('click', onOk);
      dom.btnConfirmCancel.removeEventListener('click', onCancel);
    };

    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    dom.btnConfirmOk.addEventListener('click', onOk);
    dom.btnConfirmCancel.addEventListener('click', onCancel);
  });
}

async function executeIntent(intent, rawText) {
  let response;

  try {
    // Google認証不要の機能
    switch (intent.type) {
      case IntentType.WEATHER:
        response = await Weather.getWeather(intent.params.location || '東京');
        return { type: intent.type, rawText, response, success: true, timestamp: new Date().toISOString() };

      case IntentType.WEB_SEARCH:
        response = WebSearch.search(intent.params.query || rawText);
        return { type: intent.type, rawText, response, success: true, timestamp: new Date().toISOString() };

      case IntentType.TRANSLATE:
        response = await Translate.translate(
          intent.params.text || rawText,
          intent.params.targetLang || 'en'
        );
        return { type: intent.type, rawText, response, success: true, timestamp: new Date().toISOString() };

      case IntentType.CALCULATE:
        response = Calculator.calculate(intent.params.expression || rawText);
        return { type: intent.type, rawText, response, success: true, timestamp: new Date().toISOString() };

      case IntentType.NEWS:
        response = await News.getNews(intent.params.category || 'general');
        return { type: intent.type, rawText, response, success: true, timestamp: new Date().toISOString() };

      case IntentType.SET_TIMER:
        response = Timer.setTimer(intent.params.seconds || 180, () => {
          showResponse('タイマーが終了しました！');
        });
        return { type: intent.type, rawText, response, success: true, timestamp: new Date().toISOString() };

      case IntentType.SAVE_NOTE:
        response = Notes.saveNote(intent.params.content || rawText);
        return { type: intent.type, rawText, response, success: true, timestamp: new Date().toISOString() };

      case IntentType.LIST_NOTES:
        response = Notes.listNotes();
        return { type: intent.type, rawText, response, success: true, timestamp: new Date().toISOString() };

      case IntentType.HELP:
        response = `使える機能一覧:

【Google連携】※要ログイン
・メール送信「〇〇にメールして」
・メール確認「未読メール確認」
・予定作成「明日10時に会議」
・予定確認「今日の予定」
・タスク作成「〇〇をタスクに追加」
・タスク確認「タスク一覧」
・リマインダー「〇〇をリマインド」

【その他】※ログイン不要
・天気「東京の天気」「明日の天気」
・検索「〇〇を検索」
・翻訳「〇〇を英語に」
・計算「100+200」
・ニュース「ニュース」「スポーツニュース」
・タイマー「3分タイマー」
・メモ「〇〇をメモ」「メモ一覧」`;
        return { type: intent.type, rawText, response, success: true, timestamp: new Date().toISOString() };
    }

    // Google認証が必要な機能
    if (!isAuthenticated()) {
      return {
        type: intent.type,
        rawText,
        response: 'Googleアカウントにログインしてください（設定タブから）',
        success: false,
        timestamp: new Date().toISOString(),
      };
    }

    switch (intent.type) {
      case IntentType.SEND_EMAIL:
        response = await Gmail.sendEmail(
          intent.params.to || '',
          intent.params.subject || '',
          intent.params.body || ''
        );
        break;

      case IntentType.CHECK_EMAIL:
        response = await Gmail.getUnreadEmails();
        break;

      case IntentType.CREATE_EVENT:
        response = await Calendar.createEvent(
          intent.params.title || rawText,
          intent.params.date || '',
          intent.params.time || ''
        );
        break;

      case IntentType.CHECK_SCHEDULE:
        response = await Calendar.getEvents(intent.params.date || 'today');
        break;

      case IntentType.CREATE_TASK:
        response = await Tasks.createTask(
          intent.params.title || rawText,
          intent.params.notes || ''
        );
        break;

      case IntentType.LIST_TASKS:
        response = await Tasks.getTasks();
        break;

      case IntentType.SET_REMINDER:
        response = await Tasks.createTask(
          intent.params.title || rawText,
          'リマインダー',
          intent.params.date || null
        );
        break;

      default:
        response = `「${rawText}」を理解できませんでした。もう一度お試しください。`;
        return { type: intent.type, rawText, response, success: false, timestamp: new Date().toISOString() };
    }

    return { type: intent.type, rawText, response, success: true, timestamp: new Date().toISOString() };
  } catch (e) {
    return { type: intent.type, rawText, response: `エラー: ${e.message}`, success: false, timestamp: new Date().toISOString() };
  }
}

// ============================================
// 状態管理 & UI更新
// ============================================

function setAgentState(newState) {
  state.agentState = newState;

  // CSSクラスで状態を反映
  document.body.className = `state-${newState}`;

  // アイコン更新
  const icons = {
    idle: '🎤', listening: '🎤', activated: '👂',
    processing: '🧠', responding: '💬',
  };
  dom.agentIcon.textContent = icons[newState] || '🎤';

  // メッセージ更新
  const wakeWord = localStorage.getItem('wake_word') || 'ヘイエージェント';
  const messages = {
    idle: 'タップして開始',
    listening: `「${wakeWord}」と話しかけてください`,
    activated: 'コマンドをどうぞ',
    processing: '処理中...',
    responding: '応答中',
  };
  dom.stateMessage.textContent = messages[newState] || '';

  // 波形描画
  drawWave(newState === 'listening' || newState === 'activated');
}

function showResponse(text) {
  dom.responseArea.classList.remove('hidden');
  dom.responseText.textContent = text;
}

// ============================================
// 波形描画
// ============================================

function drawWave(active) {
  cancelAnimationFrame(waveAnimId);

  const canvas = dom.waveCanvas;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  let phase = 0;

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const midY = H / 2;

    if (active) {
      for (let wave = 0; wave < 3; wave++) {
        const alpha = 1.0 - wave * 0.3;
        const amp = (H / 4) * (1 - wave * 0.2);
        const freq = 2 + wave * 0.5;

        ctx.beginPath();
        ctx.moveTo(0, midY);
        for (let x = 0; x <= W; x += 2) {
          const relX = x / W;
          const envelope = Math.sin(Math.PI * relX);
          const y = midY + Math.sin(relX * Math.PI * 2 * freq + phase + wave * 0.5) * amp * envelope;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      phase += 0.05;
      waveAnimId = requestAnimationFrame(draw);
    } else {
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(W, midY);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  draw();
}

// ============================================
// 設定画面
// ============================================

function initSettings() {
  // クライアントID入力欄
  dom.inputClientId.value = state.clientId;
  dom.btnSaveClientId.addEventListener('click', () => {
    const id = dom.inputClientId.value.trim();
    if (!id) { alert('クライアントIDを入力してください'); return; }
    state.clientId = id;
    localStorage.setItem('google_client_id', id);
    setupTokenClient(id);
    alert('クライアントIDを保存しました。「ログイン」ボタンを押してください。');
  });

  // Google認証ボタン
  dom.btnGoogleAuth.addEventListener('click', () => {
    if (isAuthenticated()) {
      signOut();
    } else {
      if (!state.clientId) {
        alert('先にクライアントIDを入力して保存してください');
        return;
      }
      signIn();
    }
  });

  // ウェイクワード
  dom.inputWakeword.value = localStorage.getItem('wake_word') || 'ヘイエージェント';
  dom.inputWakeword.addEventListener('change', () => {
    speech.setWakeWord(dom.inputWakeword.value);
  });

  // OpenAI キー
  dom.inputOpenAIKey.value = localStorage.getItem('openai_api_key') || '';
  dom.btnToggleKey.addEventListener('click', () => {
    const input = dom.inputOpenAIKey;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  dom.btnSaveKey.addEventListener('click', () => {
    localStorage.setItem('openai_api_key', dom.inputOpenAIKey.value);
    alert('APIキーを保存しました');
  });
}

// ============================================
// 認証モジュール初期化
// ============================================

function initAuthModule() {
  initAuth((authenticated) => {
    updateAuthUI(authenticated);
  });

  if (state.clientId) {
    setupTokenClient(state.clientId);
  }

  // 現在の認証状態を反映
  updateAuthUI(isAuthenticated());
}

function updateAuthUI(authenticated) {
  if (authenticated) {
    dom.googleStatus.classList.add('connected');
    dom.googleStatus.classList.remove('disconnected');
    dom.googleStatusText.textContent = '接続中';
    dom.authMessage.textContent = 'ログイン済み';
    dom.btnGoogleAuth.textContent = 'ログアウト';
    dom.btnGoogleAuth.classList.remove('primary');
    dom.btnGoogleAuth.classList.add('danger');
  } else {
    dom.googleStatus.classList.remove('connected');
    dom.googleStatus.classList.add('disconnected');
    dom.googleStatusText.textContent = '未接続';
    dom.authMessage.textContent = '未ログイン';
    dom.btnGoogleAuth.textContent = 'Googleアカウントでログイン';
    dom.btnGoogleAuth.classList.add('primary');
    dom.btnGoogleAuth.classList.remove('danger');
  }
}

// ============================================
// 履歴管理
// ============================================

function addHistory(result) {
  state.history.unshift(result);
  if (state.history.length > 50) state.history.pop();
  localStorage.setItem('command_history', JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  // DOM APIで安全に要素を作成 (XSS対策)
  dom.historyList.textContent = '';

  if (state.history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const icon = document.createElement('p');
    icon.className = 'empty-icon';
    icon.textContent = '📋';
    const msg = document.createElement('p');
    msg.textContent = 'まだコマンド履歴がありません';
    const sub = document.createElement('p');
    sub.className = 'empty-sub';
    sub.textContent = '音声またはテキストでコマンドを実行するとここに履歴が表示されます';
    empty.appendChild(icon);
    empty.appendChild(msg);
    empty.appendChild(sub);
    dom.historyList.appendChild(empty);
    return;
  }

  state.history.forEach(item => {
    const label = getIntentLabel(item.type);
    const badgeClass = item.success ? 'success' : 'fail';
    const badgeText = item.success ? '成功' : '失敗';
    const time = new Date(item.timestamp).toLocaleString('ja-JP');

    const div = document.createElement('div');
    div.className = 'history-item';

    const header = document.createElement('div');
    header.className = 'history-header';
    const typeSpan = document.createElement('span');
    typeSpan.className = 'history-type';
    typeSpan.textContent = label;
    const badge = document.createElement('span');
    badge.className = `history-badge ${badgeClass}`;
    badge.textContent = badgeText;
    header.appendChild(typeSpan);
    header.appendChild(badge);

    const rawP = document.createElement('p');
    rawP.className = 'history-raw';
    rawP.textContent = item.rawText;

    const respP = document.createElement('p');
    respP.className = 'history-response';
    respP.textContent = item.response;

    const timeP = document.createElement('p');
    timeP.className = 'history-time';
    timeP.textContent = time;

    div.appendChild(header);
    div.appendChild(rawP);
    div.appendChild(respP);
    div.appendChild(timeP);
    dom.historyList.appendChild(div);
  });
}

// ============================================
// Service Worker 登録
// ============================================

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => {
    console.warn('Service Worker登録失敗:', err);
  });
}
