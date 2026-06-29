const GAS_URL = 'https://script.google.com/macros/s/AKfycbwKBdkQraIBssj2g3PRk0nlwrhNqsp0j7PHxUYC5TM73a8HP5FFvTyBE_CzUEetGHod/exec';
// 【セキュリティ改修】API通信保護用の簡易トークン
const API_TOKEN = 'SECRET_TOKEN_1234';

// 認証成功時に保持するパスワード（以降のAPIリクエストの検証用）
let adminPassword = '';
let allHistoryData = [];

// 1. 【セキュリティ改修】パスワード認証のバックエンド化
async function checkPassword() {
  const input = document.getElementById('adminPassword').value.trim();
  if (!input) {
    alert('パスワードを入力してください。');
    return;
  }

  try {
    // パスワード判定はフロントで行わず、GASにPOSTで送信して検証＆データ取得を一括で行う
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'getAdminData',
        token: API_TOKEN, // API通信保護用
        password: input   // 検証用のパスワード
      })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      adminPassword = input; // 認証成功したパスワードをメモリに保持
      document.getElementById('authSection').classList.add('hidden');
      document.getElementById('mainContent').classList.remove('hidden');
      
      // 履歴データを展開
      renderHistoryTable(result.history);
    } else {
      alert('認証エラー: ' + result.message);
    }
  } catch (error) {
    alert('通信に失敗しました。');
    console.error(error);
  }
}

// 2. 【セキュリティ改修】最新データの再取得処理（パスワードとトークンを付与してPOST）
async function loadAdminData() {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'getAdminData',
        token: API_TOKEN,
        password: adminPassword
      })
    });
    const result = await response.json();
    if (result.status === 'success') {
      renderHistoryTable(result.history);
    } else {
      alert('データの同期に失敗しました: ' + result.message);
    }
  } catch (error) {
    alert('データの読み込みに失敗しました。');
    console.error(error);
  }
}

// 履歴データをテーブルに描画する
function renderHistoryTable(historyList) {
  allHistoryData = historyList || [];
  
  const tbody = document.querySelector('#historyTable tbody');
  tbody.innerHTML = ''; // 一度クリア
  
  allHistoryData.forEach(row => {
    const tr = document.createElement('tr');
    
    // 日時のフォーマット整形
    const dateStr = row.timestamp ? new Date(row.timestamp).toLocaleString('ja-JP') : '';
    
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${row.empId}</td>
      <td>${row.empName}</td>
      <td>${row.siteId}</td>
      <td>${row.type}</td>
      <td>${row.result}</td>
      <td>${row.distance ? row.distance + 'm' : ''}</td>
      <td>${row.reason || ''}</td>
      <td><button class="btn btn-edit" onclick="openEditModal(${row.rowNo})">編集</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. 【セキュリティ改修】社員の新規登録（PINも一緒に送信）
async function addEmployee() {
  const id = document.getElementById('newEmpId').value.trim();
  const name = document.getElementById('newEmpName').value.trim();
  const pin = document.getElementById('newEmpPin').value.trim(); // 追加

  if (!id || !name || !pin) {
    return alert('ID、名前、および暗証番号(4桁)を入力してください。');
  }
  if (!/^\d{4}$/.test(pin)) {
    return alert('暗証番号は4桁の半角数字で入力してください。');
  }

  const success = await sendToGas({
    action: 'addEmployee',
    empId: id,
    empName: name,
    empPin: pin // GASにPINを渡してマスタに記録
  });

  if (success) {
    document.getElementById('newEmpId').value = '';
    document.getElementById('newEmpName').value = '';
    document.getElementById('newEmpPin').value = '';
    loadAdminData();
  }
}

// 4. 現場の新規登録
async function addSite() {
  const id = document.getElementById('newSiteId').value.trim();
  const name = document.getElementById('newSiteName').value.trim();
  const address = document.getElementById('newSiteAddress').value.trim();
  const radius = document.getElementById('newSiteRadius').value;

  if(!id || !name || !address || !radius) return alert('すべての項目を入力してください。');

  const success = await sendToGas({
    action: 'addSite',
    siteId: id,
    siteName: name,
    address: address,
    radius: Number(radius)
  });

  if (success) {
    document.getElementById('newSiteId').value = '';
    document.getElementById('newSiteName').value = '';
    document.getElementById('newSiteAddress').value = '';
    loadAdminData();
  }
}

// 5. 編集用ポップアップを開く
function openEditModal(rowNo) {
  const record = allHistoryData.find(r => r.rowNo === rowNo);
  if (!record) return;

  document.getElementById('editRowNo').textContent = rowNo;
  document.getElementById('editRowIndex').value = rowNo;
  document.getElementById('editType').value = record.type;
  document.getElementById('editResult').value = record.result;
  document.getElementById('editReason').value = record.reason || '';

  document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editModal').classList.add('hidden');
}

// 6. 編集データの保存実行
async function saveRowUpdate() {
  const rowNo = document.getElementById('editRowIndex').value;
  const type = document.getElementById('editType').value;
  const result = document.getElementById('editResult').value;
  const reason = document.getElementById('editReason').value.trim();

  const success = await sendToGas({
    action: 'updateHistory',
    rowNo: Number(rowNo),
    type: type,
    result: result,
    reason: reason
  });

  if (success) {
    closeEditModal();
    loadAdminData(); // 下の一覧を最新状態に更新
  }
}

// GASへの共通送信関数
async function sendToGas(payload) {
  try {
    // 【セキュリティ改修】すべてのアクションで API_TOKEN と adminPassword を常に同封して送信
    const fullPayload = {
      token: API_TOKEN,
      password: adminPassword,
      ...payload
    };

    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(fullPayload)
    });
    const result = await response.json();
    if(result.status === 'success') {
      alert(result.message);
      return true;
    } else {
      alert('エラー: ' + result.message);
      return false;
    }
  } catch (error) {
    alert('通信に失敗しました。');
    return false;
  }
}
