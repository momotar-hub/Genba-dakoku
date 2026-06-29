const GAS_URL = 'https://script.google.com/macros/s/AKfycbwKBdkQraIBssj2g3PRk0nlwrhNqsp0j7PHxUYC5TM73a8HP5FFvTyBE_CzUEetGHod/exec';
// 【セキュリティ改修】API通信保護用の簡易トークン
const API_TOKEN = 'SECRET_TOKEN_1234';

// 画面が開いた時に自動でマスタデータを読み込む処理
window.addEventListener('DOMContentLoaded', async () => {
  const empSelect = document.getElementById('empId');
  const siteSelect = document.getElementById('siteId');

  try {
    showStatus('最新の社員・現場情報を読み込み中...', 'status-loading');
    toggleButtons(true); // 読み込み中はボタンを押せないようにする

    // 【セキュリティ改修】APIトークンをクエリパラメータに付与してGETリクエストを送信
    const response = await fetch(`${GAS_URL}?token=${API_TOKEN}`);
    const data = await response.json();

    if (data.status === 'error') {
      showStatus(`データ読み込み失敗: ${data.message}`, 'status-error');
      return;
    }

    // 1. 社員リストをプルダウンに追加
    data.employees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.id;       // 裏側で送信される値は「ID」
      option.textContent = emp.name; // 画面上に表示されるのは「名前」
      empSelect.appendChild(option);
    });

    // 2. 現場リストをプルダウンに追加
    data.sites.forEach(site => {
      const option = document.createElement('option');
      option.value = site.id;
      option.textContent = site.name;
      siteSelect.appendChild(option);
    });

    showStatus('準備完了。名前、暗証番号、現場を選択して打刻してください。', '');
    toggleButtons(false);

  } catch (error) {
    showStatus('データの読み込みに失敗しました。画面を再読み込みしてください。', 'status-error');
    console.error('マスター読み込みエラー:', error);
  }
});

// 打刻処理
async function handleStamp(type) {
  const empIdInput = document.getElementById('empId');
  const empPinInput = document.getElementById('empPin'); // 【セキュリティ改修】PIN入力欄の取得
  const siteIdInput = document.getElementById('siteId');

  const empId = empIdInput.value;
  const empPin = empPinInput.value.trim(); // 【セキュリティ改修】PIN値の取得
  const siteId = siteIdInput.value;

  if (!empId) {
    alert('名前を選択してください。');
    empIdInput.focus();
    return;
  }
  
  // 【セキュリティ改修】PINの入力検証
  if (!empPin) {
    alert('暗証番号(PIN)を入力してください。');
    empPinInput.focus();
    return;
  }
  if (!/^\d{4}$/.test(empPin)) {
    alert('暗証番号は4桁の半角数字で入力してください。');
    empPinInput.focus();
    return;
  }

  if (!siteId) {
    alert('勤務現場を選択してください。');
    siteIdInput.focus();
    return;
  }

  // 早退ボタンが押された場合、理由を入力させる
  let reason = "";
  if (type === '早退') {
    reason = prompt("早退の理由を入力してください\n（例：体調不良、親方の指示で終了など）");
    if (!reason) {
      alert("早退の理由が入力されなかったため、打刻をキャンセルしました。");
      return;
    }
  }

  toggleButtons(true);
  showStatus('位置情報を取得中...', 'status-loading');

  if (!navigator.geolocation) {
    showStatus('お使いのブラウザは位置情報APIをサポートしていません。', 'status-error');
    toggleButtons(false);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // 【セキュリティ改修】トークン、PINを含めた送信データ(payload)
      const payload = {
        token: API_TOKEN, // API通信保護用
        empId: empId,
        empPin: empPin,   // 代理打刻防止用
        siteId: siteId,
        type: type,
        lat: lat,
        lng: lng,
        reason: reason
      };

      try {
        showStatus('位置と暗証番号を判定中...', 'status-loading');

        const response = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 'success') {
          showStatus(`${type}打刻が完了しました！\n現場: ${result.siteName}`, 'status-success');
          empPinInput.value = ''; // 打刻完了後はPINをクリア
        } else {
          showStatus(`打刻エラー\n${result.message}`, 'status-error');
        }
      } catch (error) {
        showStatus('通信エラーが発生しました。', 'status-error');
        console.error(error);
      } finally {
        toggleButtons(false);
      }
    },
    (error) => {
      let errorMessage = '位置情報の取得に失敗しました。';
      if (error.code === error.PERMISSION_DENIED) {
        errorMessage = '位置情報の利用が許可されていません。端末の設定を確認してください。';
      }
      showStatus(errorMessage, 'status-error');
      toggleButtons(false);
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function showStatus(message, className) {
  const statusArea = document.getElementById('statusArea');
  statusArea.textContent = message;
  statusArea.className = `status-area ${className}`;
}

function toggleButtons(disabled) {
  document.getElementById('btn-in').disabled = disabled;
  document.getElementById('btn-out').disabled = disabled;
  document.getElementById('btn-early').disabled = disabled;
}
