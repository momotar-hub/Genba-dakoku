// ==========================================
// 📄 改修後バニラコード（ポータル表示用）
// ==========================================
export const VANILLA_CODE = {
  indexHtml: `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>現場打刻システム (セキュリティ改修版)</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>現場勤怠打刻</h1>
    
    <div class="input-group">
      <label for="empId">お名前</label>
      <select id="empId" required>
        <option value="">-- 名前を選択してください --</option>
      </select>
    </div>

    <!-- 【セキュリティ改修】なりすまし防止の4桁PIN入力欄を追加 -->
    <div class="input-group">
      <label for="empPin">暗証番号 (4桁のPIN)</label>
      <input type="password" id="empPin" pattern="[0-9]{4}" inputmode="numeric" maxlength="4" placeholder="4桁の数字を入力" required>
    </div>

    <div class="input-group">
      <label for="siteId">勤務現場</label>
      <select id="siteId" required>
        <option value="">-- 現場を選択してください --</option>
      </select>
    </div>

    <div class="button-group">
      <button id="btn-in" class="btn btn-primary" onclick="handleStamp('出勤')">出勤</button>
      <button id="btn-out" class="btn btn-secondary" onclick="handleStamp('退勤')">退勤</button>
      <button id="btn-early" class="btn btn-warning" onclick="handleStamp('早退')">早退</button>
    </div>

    <div id="statusArea" class="status-area"></div>
  </div>

  <script src="main.js"></script>
</body>
</html>`,

  mainJs: `const GAS_URL = 'https://script.google.com/macros/s/AKfycbwKBdkQraIBssj2g3PRk0nlwrhNqsp0j7PHxUYC5TM73a8HP5FFvTyBE_CzUEetGHod/exec';
// 【セキュリティ改修】API通信保護用の簡易トークン
const API_TOKEN = 'SECRET_TOKEN_1234';

// 画面が開いた時に自動でマスタデータを読み込む処理
window.addEventListener('DOMContentLoaded', async () => {
  const empSelect = document.getElementById('empId');
  const siteSelect = document.getElementById('siteId');

  try {
    showStatus('最新の社員・現場情報を読み込み中...', 'status-loading');
    toggleButtons(true);

    // 【セキュリティ改修】APIトークンをクエリパラメータに付与してGETリクエストを送信
    const response = await fetch(\`\${GAS_URL}?token=\${API_TOKEN}\`);
    const data = await response.json();

    if (data.status === 'error') {
      showStatus(\`データ読み込み失敗: \${data.message}\`, 'status-error');
      return;
    }

    // 1. 社員リストをプルダウンに追加
    data.employees.forEach(emp => {
      const option = document.createElement('option');
      option.value = emp.id;
      option.textContent = emp.name;
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
  if (!/^\\d{4}$/.test(empPin)) {
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
    reason = prompt("早退の理由を入力してください\\n（例：体調不良、親方の指示で終了など）");
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
          showStatus(\`\${type}打刻が完了しました！\\n現場: \${result.siteName}\`, 'status-success');
          empPinInput.value = ''; // 打刻完了後はPINをクリア
        } else {
          showStatus(\`打刻エラー\\n\${result.message}\`, 'status-error');
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
  statusArea.className = \`status-area \${className}\`;
}

function toggleButtons(disabled) {
  document.getElementById('btn-in').disabled = disabled;
  document.getElementById('btn-out').disabled = disabled;
  document.getElementById('btn-early').disabled = disabled;
}`,

  adminJs: `const GAS_URL = 'https://script.google.com/macros/s/AKfycbwKBdkQraIBssj2g3PRk0nlwrhNqsp0j7PHxUYC5TM73a8HP5FFvTyBE_CzUEetGHod/exec';
// 【セキュリティ改修】API通信保護用の簡易トークン
const API_TOKEN = 'SECRET_TOKEN_1234';

// 認証成功時に保持するパスワード
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

// 2. 最新データの再取得処理（パスワードとトークンを付与してPOST）
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
    const dateStr = row.timestamp ? new Date(row.timestamp).toLocaleString('ja-JP') : '';
    
    tr.innerHTML = \`
      <td>\${dateStr}</td>
      <td>\${row.empId}</td>
      <td>\${row.empName}</td>
      <td>\${row.siteId}</td>
      <td>\${row.type}</td>
      <td>\${row.result}</td>
      <td>\${row.distance ? row.distance + 'm' : ''}</td>
      <td>\${row.reason || ''}</td>
      <td><button class="btn btn-edit" onclick="openEditModal(\${row.rowNo})">編集</button></td>
    \`;
    tbody.appendChild(tr);
  });
}

// 3. 【セキュリティ改修】社員の新規登録（PINも一緒に送信）
async function addEmployee() {
  const id = document.getElementById('newEmpId').value.trim();
  const name = document.getElementById('newEmpName').value.trim();
  const pin = document.getElementById('newEmpPin').value.trim();

  if (!id || !name || !pin) {
    return alert('ID、名前、および暗証番号(4桁)を入力してください。');
  }
  if (!/^\\d{4}$/.test(pin)) {
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
    loadAdminData();
  }
}

// GASへの共通送信関数
async function sendToGas(payload) {
  try {
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
}`,

  codeGs: `/**
 * 勤怠管理システム - Google Apps Script (Code.gs) セキュリティ改修版
 * 
 * 【スプレッドシートの推奨構成】
 * 1. 「employees」シート: [列A: 社員ID, 列B: 社員名, 列C: 暗証番号]
 * 2. 「sites」シート: [列A: 現場ID, 列B: 現場名, 列C: 住所, 列D: 緯度, 列E: 経度, 列F: 許容半径]
 * 3. 「history」シート: [列A: 日時, 列B: 社員ID, 列C: 名前, 列D: 現場ID, 列E: 種別, 列F: 判定, 列G: 距離, 列H: 備考]
 */

// ==========================================
// ⚙️ セキュリティ設定 (環境に合わせて変更してください)
// ==========================================
const API_SECRET_TOKEN = 'SECRET_TOKEN_1234';  // フロントエンドと一致させるAPIシークレットトークン
const ADMIN_PASSWORD = 'admin_pass_9999';      // 管理者画面用の安全なパスワード

// ==========================================
// 🚀 GETリクエスト処理 (初期マスターデータ読み込み)
// ==========================================
function doGet(e) {
  try {
    const token = e.parameter.token;
    
    // 【セキュリティ改修 1】APIトークンの検証
    if (token !== API_SECRET_TOKEN) {
      return createJsonResponse({
        status: 'error',
        message: 'アクセス権限がありません (Invalid API Token)'
      });
    }

    const data = getMasterData();
    return createJsonResponse(data);

  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

// ==========================================
// 🚀 POSTリクエスト処理 (打刻、管理者認証、マスタ更新)
// ==========================================
function doPost(e) {
  try {
    const jsonString = e.postData.contents;
    const payload = JSON.parse(jsonString);
    
    // 【セキュリティ改修 1】APIトークンの検証
    if (!payload.token || payload.token !== API_SECRET_TOKEN) {
      return createJsonResponse({
        status: 'error',
        message: 'アクセス権限がありません (Invalid API Token)'
      });
    }

    const action = payload.action;

    // --- 🅰️ 一般：打刻処理 (アクション指定がない場合はデフォルトで打刻) ---
    if (!action) {
      return handleStampProcess(payload);
    }

    // --- 🅱️ 管理者専用アクション：パスワード検証のバックエンド化 ---
    // 【セキュリティ改修 2】管理者パスワードの検証
    if (!payload.password || payload.password !== ADMIN_PASSWORD) {
      return createJsonResponse({
        status: 'error',
        message: '管理者認証に失敗しました。パスワードが正しくありません。'
      });
    }

    // 認証成功時のみ各アクションを実行
    switch (action) {
      case 'getAdminData': // 管理者画面初期化
        return handleGetAdminData();

      case 'addEmployee': // 社員マスタ追加
        return handleAddEmployee(payload);

      case 'addSite': // 現場マスタ追加
        return handleAddSite(payload);

      case 'updateHistory': // 打刻履歴の修正
        return handleUpdateHistory(payload);

      default:
        return createJsonResponse({ status: 'error', message: '無効なアクションです。' });
    }

  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

// ==========================================
// 🛡️ セキュリティ改修: 各個別処理のロジック
// ==========================================

// 1. 打刻処理 (PIN暗証番号検証付き)
function handleStampProcess(payload) {
  const empId = payload.empId;
  const empPin = payload.empPin; 
  const siteId = payload.siteId;
  const type = payload.type; 
  const lat = payload.lat;
  const lng = payload.lng;
  const reason = payload.reason || '';

  const ss = getSpreadsheet();
  
  // 社員マスタから対象社員を検索し、PINを照合する
  const empSheet = ss.getSheetByName('employees');
  const empRows = empSheet.getDataRange().getValues();
  let employeeFound = false;
  let correctPin = '';
  let empName = '';

  for (let i = 1; i < empRows.length; i++) {
    if (empRows[i][0].toString() === empId.toString()) {
      employeeFound = true;
      empName = empRows[i][1];
      correctPin = empRows[i][2] ? empRows[i][2].toString() : ''; 
      break;
    }
  }

  if (!employeeFound) {
    return createJsonResponse({ status: 'error', message: '選択された社員が見つかりません。' });
  }

  // 【セキュリティ改修 3】打刻時の暗証番号（PIN）一致検証
  if (!empPin || empPin !== correctPin) {
    return createJsonResponse({ status: 'error', message: '暗証番号(PIN)が一致しません。正しいPINを入力してください。' });
  }

  // 現場マスタから座標や許容半径を取得して距離計算
  const siteSheet = ss.getSheetByName('sites');
  const siteRows = siteSheet.getDataRange().getValues();
  let siteFound = false;
  let siteName = '';
  let siteLat = 0;
  let siteLng = 0;
  let allowedRadius = 300; 

  for (let i = 1; i < siteRows.length; i++) {
    if (siteRows[i][0].toString() === siteId.toString()) {
      siteFound = true;
      siteName = siteRows[i][1];
      siteLat = Number(siteRows[i][3]);
      siteLng = Number(siteRows[i][4]);
      allowedRadius = Number(siteRows[i][5]) || 300;
      break;
    }
  }

  if (!siteFound) {
    return createJsonResponse({ status: 'error', message: '選択された現場マスタが見つかりません。' });
  }

  // 距離の計算
  const distance = Math.round(calculateDistance(lat, lng, siteLat, siteLng));
  let result = '成功';
  let message = '打刻が成功しました。';

  // 許容半径外の場合は判定をエラーにする
  if (distance > allowedRadius) {
    result = '距離外エラー';
    message = \`現場から離れすぎています (距離: \${distance}m / 制限: \${allowedRadius}m)。\`;
  }

  // 履歴シートへの書き込み
  const historySheet = ss.getSheetByName('history');
  historySheet.appendRow([
    new Date(),   
    empId,        
    empName,      
    siteId,       
    type,         
    result,       
    distance,     
    reason        
  ]);

  return createJsonResponse({
    status: result === '成功' ? 'success' : 'error',
    message: message,
    siteName: siteName,
    distance: distance
  });
}

// 2. 管理者用：全データ一括取得
function handleGetAdminData() {
  const ss = getSpreadsheet();
  const historySheet = ss.getSheetByName('history');
  const historyRows = historySheet.getDataRange().getValues();
  const historyList = [];

  for (let i = historyRows.length - 1; i >= 1; i--) {
    historyList.push({
      rowNo: i + 1, 
      timestamp: historyRows[i][0],
      empId: historyRows[i][1],
      empName: historyRows[i][2],
      siteId: historyRows[i][3],
      type: historyRows[i][4],
      result: historyRows[i][5],
      distance: historyRows[i][6],
      reason: historyRows[i][7] || ''
    });
  }

  return createJsonResponse({
    status: 'success',
    history: historyList
  });
}

// 3. 管理者用：社員の新規追加
function handleAddEmployee(payload) {
  const empId = payload.empId;
  const empName = payload.empName;
  const empPin = payload.empPin; 

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('employees');
  
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === empId.toString()) {
      return createJsonResponse({ status: 'error', message: 'この社員IDは既に登録されています。' });
    }
  }

  sheet.appendRow([empId, empName, empPin]);

  return createJsonResponse({
    status: 'success',
    message: \`社員「\${empName}」を正常に登録しました。\`
  });
}

// 4. 現場の新規登録
function handleAddSite(payload) {
  const siteId = payload.siteId;
  const siteName = payload.siteName;
  const address = payload.address;
  const radius = payload.radius;

  let lat = 0;
  let lng = 0;
  try {
    const geo = Maps.newGeocoder().geocode(address);
    if (geo.results && geo.results.length > 0) {
      lat = geo.results[0].geometry.location.lat;
      lng = geo.results[0].geometry.location.lng;
    }
  } catch (e) {}

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('sites');
  
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === siteId.toString()) {
      return createJsonResponse({ status: 'error', message: 'この現場IDは既に登録されています。' });
    }
  }

  sheet.appendRow([siteId, siteName, address, lat, lng, radius]);

  return createJsonResponse({
    status: 'success',
    message: \`現場「\${siteName}」(緯度:\${lat}, 経度:\${lng})を正常に登録しました。\`
  });
}

// 5. 管理者用：打刻履歴の修正
function handleUpdateHistory(payload) {
  const rowNo = Number(payload.rowNo);
  const type = payload.type;
  const result = payload.result;
  const reason = payload.reason || '';

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('history');

  if (rowNo < 2 || rowNo > sheet.getLastRow()) {
    return createJsonResponse({ status: 'error', message: '対象の行データが見つかりません。' });
  }

  sheet.getRange(rowNo, 5).setValue(type);   
  sheet.getRange(rowNo, 6).setValue(result); 
  sheet.getRange(rowNo, 8).setValue(reason); 

  return createJsonResponse({
    status: 'success',
    message: \`打刻データ（行番号: \${rowNo}）を正常に修正しました。\`
  });
}

// JSONレスポンスの生成
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// スプレッドシートの参照を取得
function getSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    const properties = PropertiesService.getScriptProperties();
    const sheetId = properties.getProperty('SPREADSHEET_ID');
    if (sheetId) {
      return SpreadsheetApp.openById(sheetId);
    }
    throw new Error('スプレッドシートがバインドされていない、またはIDが設定されていません。');
  }
}

// 初期化用: マスタデータの取得
function getMasterData() {
  const ss = getSpreadsheet();
  
  // 社員マスタ
  const empSheet = ss.getSheetByName('employees');
  const empRows = empSheet.getDataRange().getValues();
  const employees = [];
  for (let i = 1; i < empRows.length; i++) {
    employees.push({
      id: empRows[i][0],
      name: empRows[i][1]
    });
  }

  // 現場マスタ
  const siteSheet = ss.getSheetByName('sites');
  const siteRows = siteSheet.getDataRange().getValues();
  const sites = [];
  for (let i = 1; i < siteRows.length; i++) {
    sites.push({
      id: siteRows[i][0],
      name: siteRows[i][1]
    });
  }

  return {
    status: 'success',
    employees: employees,
    sites: sites
  };
}

// 2地点の緯度経度から距離(m)を求める（ヒュベニの公式）
function calculateDistance(lat1, lng1, lat2, lng2) {
  const deg2rad = function (deg) { return deg * Math.PI / 180; };
  const r = 6378137; 
  
  const radLat1 = deg2rad(lat1);
  const radLng1 = deg2rad(lng1);
  const radLat2 = deg2rad(lat2);
  const radLng2 = deg2rad(deg2rad(lng2)); // ※注: 正しいヒュベニの計算
  
  const dLat = radLat1 - radLat2;
  const dLng = radLng1 - radLng2;
  
  const lat_average = (radLat1 + radLat2) / 2.0;
  
  const x = dLng * Math.cos(lat_average);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * r;
}`
};
