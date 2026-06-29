/**
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

    // スプレッドシートの取得 (※未設定時のためのTry-Catch & モックフォールバック)
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
      case 'getAdminData': // 管理者画面初期化（マスタ ＋ 打刻履歴取得）
        return handleGetAdminData();

      case 'addEmployee': // 社員マスタ追加（暗証番号も併せて保存）
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

=========== 1. 打刻処理 (PIN暗証番号検証付き) ===========
function handleStampProcess(payload) {
  const empId = payload.empId;
  const empPin = payload.empPin; // フロントエンドから送信されたPIN
  const siteId = payload.siteId;
  const type = payload.type; // 出勤/退勤/早退
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
      correctPin = empRows[i][2] ? empRows[i][2].toString() : ''; // A:ID, B:名前, C:暗証番号
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
  let allowedRadius = 300; // デフォルト 300m

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

  // 距離の計算 (ヒュベニの公式、または簡易緯度経度距離計算)
  const distance = Math.round(calculateDistance(lat, lng, siteLat, siteLng));
  let result = '成功';
  let message = '打刻が成功しました。';

  // 許容半径外の場合は判定をエラーにする
  if (distance > allowedRadius) {
    result = '距離外エラー';
    message = `現場から離れすぎています (距離: ${distance}m / 制限: ${allowedRadius}m)。`;
  }

  // 履歴シートへの書き込み
  const historySheet = ss.getSheetByName('history');
  historySheet.appendRow([
    new Date(),   // A: 日時
    empId,        // B: 社員ID
    empName,      // C: 名前
    siteId,       // D: 現場ID
    type,         // E: 種別 (出勤/退勤/早退)
    result,       // F: 判定
    distance,     // G: 距離
    reason        // H: 備考 (早退理由など)
  ]);

  return createJsonResponse({
    status: result === '成功' ? 'success' : 'error',
    message: message,
    siteName: siteName,
    distance: distance
  });
}

=========== 2. 管理者用：全データ一括取得 ===========
function handleGetAdminData() {
  const ss = getSpreadsheet();
  
  // 打刻履歴一覧の取得
  const historySheet = ss.getSheetByName('history');
  const historyRows = historySheet.getDataRange().getValues();
  const historyList = [];

  // 2行目(インデックス1)から開始し、逆順(最新順)で取得
  for (let i = historyRows.length - 1; i >= 1; i--) {
    historyList.push({
      rowNo: i + 1, // スプレッドシートの実行番号 (編集用)
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

=========== 3. 管理者用：社員の新規追加 (PIN対応) ===========
function handleAddEmployee(payload) {
  const empId = payload.empId;
  const empName = payload.empName;
  const empPin = payload.empPin; // 新規追加時の暗証番号

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('employees');
  
  // 重複チェック
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === empId.toString()) {
      return createJsonResponse({ status: 'error', message: 'この社員IDは既に登録されています。' });
    }
  }

  // [ID, 名前, 暗証番号] を追記
  sheet.appendRow([empId, empName, empPin]);

  return createJsonResponse({
    status: 'success',
    message: `社員「${empName}」を正常に登録しました。`
  });
}

=========== 4. 管理者用：現場の新規追加 ===========
function handleAddSite(payload) {
  const siteId = payload.siteId;
  const siteName = payload.siteName;
  const address = payload.address;
  const radius = payload.radius;

  // 住所から緯度経度を自動取得 (Google Maps APIを内部利用)
  let lat = 0;
  let lng = 0;
  try {
    const geo = Maps.newGeocoder().geocode(address);
    if (geo.results && geo.results.length > 0) {
      lat = geo.results[0].geometry.location.lat;
      lng = geo.results[0].geometry.location.lng;
    }
  } catch (e) {
    // ジオコーディングに失敗した場合は 0 のまま
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('sites');
  
  // 重複チェック
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0].toString() === siteId.toString()) {
      return createJsonResponse({ status: 'error', message: 'この現場IDは既に登録されています。' });
    }
  }

  // [現場ID, 現場名, 住所, 緯度, 経度, 許容半径] を追記
  sheet.appendRow([siteId, siteName, address, lat, lng, radius]);

  return createJsonResponse({
    status: 'success',
    message: `現場「${siteName}」(緯度:${lat}, 経度:${lng})を正常に登録しました。`
  });
}

=========== 5. 管理者用：打刻履歴の修正 ===========
function handleUpdateHistory(payload) {
  const rowNo = Number(payload.rowNo);
  const type = payload.type;
  const result = payload.result;
  const reason = payload.reason || '';

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('history');

  // スプレッドシートの有効な行番号であるか検証
  if (rowNo < 2 || rowNo > sheet.getLastRow()) {
    return createJsonResponse({ status: 'error', message: '対象の行データが見つかりません。' });
  }

  // 該当行の各カラムを更新 (1-indexed: E列は5, F列は6, H列は8)
  sheet.getRange(rowNo, 5).setValue(type);   // 種別
  sheet.getRange(rowNo, 6).setValue(result); // 判定結果
  sheet.getRange(rowNo, 8).setValue(reason); // 備考

  return createJsonResponse({
    status: 'success',
    message: `打刻データ（行番号: ${rowNo}）を正常に修正しました。`
  });
}


// ==========================================
// 🛠️ ユーティリティ・関数群
// ==========================================

// JSONレスポンスの生成
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// スプレッドシートの参照を取得（無ければ自動生成、またはダミーシート作成）
function getSpreadsheet() {
  try {
    // スプレッドシートにコンテナバインドしている場合はgetActiveSpreadsheet()でOK
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    // スタンドアロンGASなどの場合、スクリプトプロパティや固定IDから開く
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
      // 暗証番号（PIN）はセキュリティ上、doGetマスタ取得ではクライアントに送信しない！
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
  const r = 6378137; // 地球の赤道半径(m)
  
  const radLat1 = deg2rad(lat1);
  const radLng1 = deg2rad(lng1);
  const radLat2 = deg2rad(lat2);
  const radLng2 = deg2rad(lng2);
  
  const dLat = radLat1 - radLat2;
  const dLng = radLng1 - radLng2;
  
  const lat_average = (radLat1 + radLat2) / 2.0;
  
  // 簡易距離計算（平面近似）
  const x = dLng * Math.cos(lat_average);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * r;
}
