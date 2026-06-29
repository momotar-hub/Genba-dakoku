import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Smartphone, 
  User, 
  MapPin, 
  Check, 
  AlertTriangle, 
  Key, 
  Plus, 
  Settings,
  X,
  Clock,
  LogOut,
  RefreshCw,
  Search,
  Lock,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Users,
  Navigation,
  FileText,
  Eye,
  EyeOff,
  Edit
} from 'lucide-react';

// ==========================================
// 🗄️ 初期モックデータベース (LocalStorage用)
// ==========================================
const DEFAULT_EMPLOYEES = [
  { id: 'E001', name: '山田 太郎', pin: '1234' },
  { id: 'E002', name: '佐藤 花子', pin: '5678' },
  { id: 'E003', name: '鈴木 一郎', pin: '9012' }
];

const DEFAULT_SITES = [
  { id: 'GENBA001', name: '渋谷サクラステージ現場', address: '東京都渋谷区桜丘町1', lat: 35.6561, lng: 139.7025, radius: 300 },
  { id: 'GENBA002', name: '横浜みなとみらい新築工事', address: '神奈川県横浜市西区みなとみらい3', lat: 35.4578, lng: 139.6324, radius: 200 },
  { id: 'GENBA003', name: '新宿オフィス内装工事', address: '東京都新宿区新宿3', lat: 35.6905, lng: 139.7005, radius: 150 }
];

const DEFAULT_HISTORY = [
  { rowNo: 2, timestamp: '2026-06-28T09:00:00.000Z', empId: 'E001', empName: '山田 太郎', siteId: 'GENBA001', type: '出勤', result: '成功', distance: 12, reason: '' },
  { rowNo: 3, timestamp: '2026-06-28T18:05:00.000Z', empId: 'E001', empName: '山田 太郎', siteId: 'GENBA001', type: '退勤', result: '成功', distance: 24, reason: '' },
  { rowNo: 4, timestamp: '2026-06-29T08:45:00.000Z', empId: 'E002', empName: '佐藤 花子', siteId: 'GENBA002', type: '出勤', result: '成功', distance: 5, reason: '' },
  { rowNo: 5, timestamp: '2026-06-29T15:30:00.000Z', empId: 'E002', empName: '佐藤 花子', siteId: 'GENBA002', type: '早退', result: '成功', distance: 8, reason: '体調不良のため' },
  { rowNo: 6, timestamp: '2026-06-29T17:00:00.000Z', empId: 'E003', empName: '鈴木 一郎', siteId: 'GENBA003', type: '出勤', result: '距離外エラー', distance: 850, reason: '自宅から打刻しようとしたため' }
];

// 2地点の距離計算 (m)
function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6378137;
  const deg2rad = (deg: number) => deg * Math.PI / 180;
  const radLat1 = deg2rad(lat1);
  const radLng1 = deg2rad(lng1);
  const radLat2 = deg2rad(lat2);
  const radLng2 = deg2rad(lng2);
  const dLat = radLat1 - radLat2;
  const dLng = radLng1 - radLng2;
  const lat_average = (radLat1 + radLat2) / 2.0;
  const x = dLng * Math.cos(lat_average);
  const y = dLat;
  return Math.sqrt(x * x + y * y) * r;
}

export default function App() {
  // 画面モード: 'stamp' (打刻画面) | 'admin_login' (ログイン画面) | 'admin_dashboard' (管理者画面)
  const [viewMode, setViewMode] = useState<'stamp' | 'admin_login' | 'admin_dashboard'>('stamp');
  
  // 管理者のタブ選択
  const [adminTab, setAdminTab] = useState<'history' | 'employees' | 'sites' | 'settings'>('history');

  // 接続設定
  const [gasUrl, setGasUrl] = useState(() => {
    return localStorage.getItem('attendance_gas_url') || 'https://script.google.com/macros/s/AKfycbwKBdkQraIBssj2g3PRk0nlwrhNqsp0j7PHxUYC5TM73a8HP5FFvTyBE_CzUEetGHod/exec';
  });
  const [isGasMode, setIsGasMode] = useState(() => {
    return localStorage.getItem('attendance_is_gas_mode') === 'true';
  });
  const [apiToken, setApiToken] = useState(() => {
    return localStorage.getItem('attendance_api_token') || 'SECRET_TOKEN_1234';
  });
  const [adminPasswordSetting, setAdminPasswordSetting] = useState(() => {
    return localStorage.getItem('attendance_admin_password') || 'admin_pass_9999';
  });

  // ローカルDB状態
  const [employees, setEmployees] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // 一般打刻フォーム
  const [selectedEmp, setSelectedEmp] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [stampStatus, setStampStatus] = useState<{ text: string; type: 'success' | 'error' | 'loading' | '' }>({ text: '', type: '' });
  const [isStamping, setIsStamping] = useState(false);

  // 管理者認証
  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  // 新規登録フォーム (社員)
  const [newEmpId, setNewEmpId] = useState('');
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPin, setNewEmpPin] = useState('');

  // 新規登録フォーム (現場)
  const [newSiteId, setNewSiteId] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteAddress, setNewSiteAddress] = useState('');
  const [newSiteRadius, setNewSiteRadius] = useState(300);

  // 編集モーダルの状態
  const [editingHistoryItem, setEditingHistoryItem] = useState<any | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [editingSite, setEditingSite] = useState<any | null>(null);

  // パスワード確認用の表示切り替え
  const [showPins, setShowPins] = useState<{ [key: string]: boolean }>({});

  // 検索用
  const [empSearch, setEmpSearch] = useState('');
  const [siteSearch, setSiteSearch] = useState('');

  // 履歴の絞り込み状態 (社員ID)
  const [historyFilterEmp, setHistoryFilterEmp] = useState('');

  // 履歴の改ページ (10件ずつ)
  const [historyPage, setHistoryPage] = useState(1);

  // ローカル時間表示用
  const [currentTime, setCurrentTime] = useState(new Date());

  // 測位状態
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // ローカルDB初期化
  useEffect(() => {
    const localEmps = localStorage.getItem('attendance_employees');
    const localSites = localStorage.getItem('attendance_sites');
    const localHist = localStorage.getItem('attendance_history');

    if (localEmps) {
      setEmployees(JSON.parse(localEmps));
    } else {
      setEmployees(DEFAULT_EMPLOYEES);
      localStorage.setItem('attendance_employees', JSON.stringify(DEFAULT_EMPLOYEES));
    }

    if (localSites) {
      setSites(JSON.parse(localSites));
    } else {
      setSites(DEFAULT_SITES);
      localStorage.setItem('attendance_sites', JSON.stringify(DEFAULT_SITES));
    }

    if (localHist) {
      setHistory(JSON.parse(localHist));
    } else {
      setHistory(DEFAULT_HISTORY);
      localStorage.setItem('attendance_history', JSON.stringify(DEFAULT_HISTORY));
    }

    // 時計の更新
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 位置情報の自動取得
  useEffect(() => {
    if (navigator.geolocation) {
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setGpsLoading(false);
        },
        () => {
          setGpsLoading(false);
        }
      );
    }
  }, []);

  // データ保存ヘルパー
  const saveEmployees = (newVal: any[]) => {
    setEmployees(newVal);
    localStorage.setItem('attendance_employees', JSON.stringify(newVal));
  };
  const saveSites = (newVal: any[]) => {
    setSites(newVal);
    localStorage.setItem('attendance_sites', JSON.stringify(newVal));
  };
  const saveHistory = (newVal: any[]) => {
    setHistory(newVal);
    localStorage.setItem('attendance_history', JSON.stringify(newVal));
    setHistoryPage(1); // 履歴の変動があったら1ページ目に戻す
  };

  // 模擬API呼び出し
  const simulateGasCall = async (action: string, payload: any) => {
    await new Promise(resolve => setTimeout(resolve, 600));

    // 1. 打刻処理
    if (action === 'stamp') {
      const { empId, empPin, siteId, type, lat, lng, reason } = payload;
      const employee = employees.find(e => e.id === empId);
      if (!employee) {
        return { status: 'error', message: '選択された社員が見つかりません。' };
      }
      if (employee.pin !== empPin) {
        return { status: 'error', message: '暗証番号（PIN）が一致しません。正しい4桁を入力してください。' };
      }
      const site = sites.find(s => s.id === siteId);
      if (!site) {
        return { status: 'error', message: '選択された現場が見つかりません。' };
      }

      const distance = Math.round(calcDistance(lat, lng, site.lat, site.lng));
      let result = '成功';
      let message = '打刻が成功しました。';

      if (distance > site.radius) {
        result = '距離外エラー';
        message = `現場から離れすぎています（現場まで ${distance}m / 制限 ${site.radius}m）。\n現場の近くでやり直してください。`;
      }

      const newRecord = {
        rowNo: history.length > 0 ? Math.max(...history.map(h => h.rowNo)) + 1 : 2,
        timestamp: new Date().toISOString(),
        empId,
        empName: employee.name,
        siteId,
        type,
        result,
        distance,
        reason: reason || ''
      };

      const updated = [newRecord, ...history];
      saveHistory(updated);

      return {
        status: result === '成功' ? 'success' : 'error',
        message,
        siteName: site.name,
        distance
      };
    }

    // 2. 履歴修正
    if (action === 'updateHistory') {
      const { rowNo, type, result, reason } = payload;
      const updated = history.map(item => {
        if (item.rowNo === rowNo) {
          return { ...item, type, result, reason };
        }
        return item;
      });
      saveHistory(updated);
      return { status: 'success', message: '履歴を修正しました。' };
    }

    // 3. 履歴削除
    if (action === 'deleteHistory') {
      const { rowNo } = payload;
      const updated = history.filter(item => item.rowNo !== rowNo);
      saveHistory(updated);
      return { status: 'success', message: '履歴を削除しました。' };
    }

    return { status: 'error', message: '不明な操作です。' };
  };

  // 打刻を実行する
  const handleStamp = async (type: '出勤' | '退勤' | '早退') => {
    if (!selectedEmp) {
      alert('「1. お名前」を選んでください。');
      return;
    }
    if (!enteredPin) {
      alert('「2. 暗証番号」を入力してください。');
      return;
    }
    if (enteredPin.length !== 4) {
      alert('暗証番号は4桁の数字です。');
      return;
    }
    if (!selectedSite) {
      alert('「3. 勤務現場」を選んでください。');
      return;
    }

    let reason = '';
    if (type === '早退') {
      reason = prompt('早退の理由を入力してください（例: 体調不良、作業早期終了など）') || '';
      if (!reason.trim()) {
        alert('早退の理由を入力しないと打刻できません。');
        return;
      }
    }

    setIsStamping(true);
    setStampStatus({ text: '現在地を測定しています。そのまま少しお待ちください...', type: 'loading' });

    let lat = 35.6561;
    let lng = 139.7025;

    try {
      if (navigator.geolocation) {
        const position: any = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        setGpsCoords({ lat, lng });
      }
    } catch (error) {
      console.warn('GPS取得失敗。予備座標を使用します。');
      if (gpsCoords) {
        lat = gpsCoords.lat;
        lng = gpsCoords.lng;
      }
    }

    setStampStatus({ text: '暗証番号と現場までの距離を確認しています...', type: 'loading' });

    const payload = {
      empId: selectedEmp,
      empPin: enteredPin,
      siteId: selectedSite,
      type,
      lat,
      lng,
      reason
    };

    try {
      let res: any;
      if (isGasMode) {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            token: apiToken,
            ...payload
          })
        });
        res = await response.json();
      } else {
        res = await simulateGasCall('stamp', payload);
      }

      if (res.status === 'success') {
        let textMsg = '';
        if (type === '出勤') {
          textMsg = `✅ 出勤打刻に成功しました！\n本日もよろしくお願いします！\n現場: ${res.siteName}`;
        } else if (type === '退勤') {
          textMsg = `✅ 退勤打刻に成功しました！\n本日も一日お疲れ様です。\n現場: ${res.siteName}`;
        } else {
          textMsg = `✅ 早退打刻に成功しました！\nお疲れ様でした。お体に気をつけてください。\n現場: ${res.siteName}`;
        }

        setStampStatus({
          text: textMsg,
          type: 'success'
        });
        setEnteredPin(''); // 暗証番号をクリア
      } else {
        setStampStatus({
          text: `❌ 打刻できませんでした。\n理由: ${res.message}`,
          type: 'error'
        });
      }
    } catch (err: any) {
      setStampStatus({
        text: `⚠️ 通信エラーが発生しました。\n管理者にお問い合わせください。\n(詳細: ${err.message})`,
        type: 'error'
      });
    } finally {
      setIsStamping(false);
    }
  };

  // 管理者ログインを実行
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput === adminPasswordSetting) {
      setViewMode('admin_dashboard');
      setAdminPasswordInput('');
      setAdminTab('history');
      
      if (isGasMode) {
        try {
          const response = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
              action: 'getAdminData',
              token: apiToken,
              password: adminPasswordSetting
            })
          });
          const res = await response.json();
          if (res.status === 'success' && res.history) {
            setHistory(res.history);
          }
        } catch (err) {
          console.error('GAS履歴の取得失敗:', err);
        }
      }
    } else {
      alert('パスワードが正しくありません。');
    }
  };

  // 社員新規登録 (管理者)
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpId || !newEmpName || !newEmpPin) {
      alert('すべての項目を入力してください。');
      return;
    }
    if (newEmpPin.length !== 4 || isNaN(Number(newEmpPin))) {
      alert('暗証番号は4桁の数字にしてください。');
      return;
    }
    if (employees.some(emp => emp.id === newEmpId)) {
      alert('この社員番号(ID)はすでに使われています。別のIDを入力してください。');
      return;
    }

    const newEmp = { id: newEmpId, name: newEmpName, pin: newEmpPin };
    const updated = [...employees, newEmp];
    saveEmployees(updated);
    
    alert(`社員「${newEmpName}」を新しく登録しました。`);
    setNewEmpId('');
    setNewEmpName('');
    setNewEmpPin('');
  };

  // 社員の編集保存
  const handleSaveEmployeeEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee.name || !editingEmployee.pin) {
      alert('すべての項目を入力してください。');
      return;
    }
    if (editingEmployee.pin.length !== 4 || isNaN(Number(editingEmployee.pin))) {
      alert('暗証番号は4桁の数字にしてください。');
      return;
    }

    const updated = employees.map(emp => emp.id === editingEmployee.id ? editingEmployee : emp);
    saveEmployees(updated);
    alert('社員情報を変更しました。');
    setEditingEmployee(null);
  };

  // 社員の削除
  const handleDeleteEmployee = (id: string, name: string) => {
    if (!confirm(`本当に「${name}」さんを名簿から削除しますか？\n（※過去の打刻履歴データは消えません）`)) return;
    const updated = employees.filter(emp => emp.id !== id);
    saveEmployees(updated);
  };

  // 現場新規登録 (管理者)
  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteId || !newSiteName || !newSiteAddress) {
      alert('すべての項目を入力してください。');
      return;
    }
    if (sites.some(s => s.id === newSiteId)) {
      alert('この現場IDはすでに使われています。別のIDを入力してください。');
      return;
    }

    // 模擬的に現在の位置または少しずらした位置を現場緯度経度にする
    const baseLat = gpsCoords?.lat || 35.6561;
    const baseLng = gpsCoords?.lng || 139.7025;
    const lat = baseLat + (Math.random() - 0.5) * 0.0015;
    const lng = baseLng + (Math.random() - 0.5) * 0.0015;

    const newSite = {
      id: newSiteId,
      name: newSiteName,
      address: newSiteAddress,
      lat,
      lng,
      radius: Number(newSiteRadius)
    };

    const updated = [...sites, newSite];
    saveSites(updated);
    alert(`現場「${newSiteName}」を追加しました。`);
    setNewSiteId('');
    setNewSiteName('');
    setNewSiteAddress('');
  };

  // 現場の編集保存
  const handleSaveSiteEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite.name || !editingSite.address) {
      alert('すべての項目を入力してください。');
      return;
    }
    const updated = sites.map(s => s.id === editingSite.id ? editingSite : s);
    saveSites(updated);
    alert('現場情報を変更しました。');
    setEditingSite(null);
  };

  // 現場の削除
  const handleDeleteSite = (id: string, name: string) => {
    if (!confirm(`本当に「${name}」現場を削除しますか？`)) return;
    const updated = sites.filter(s => s.id !== id);
    saveSites(updated);
  };

  // 履歴修正の送信
  const submitEditHistory = async () => {
    if (!editingHistoryItem) return;

    const payload = {
      rowNo: editingHistoryItem.rowNo,
      type: editingHistoryItem.type,
      result: editingHistoryItem.result,
      reason: editingHistoryItem.reason,
      password: adminPasswordSetting
    };

    if (isGasMode) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'updateHistory',
            token: apiToken,
            ...payload
          })
        });
        const res = await response.json();
        if (res.status === 'success') {
          alert(res.message);
          const updated = history.map(h => h.rowNo === editingHistoryItem.rowNo ? editingHistoryItem : h);
          saveHistory(updated);
          setEditingHistoryItem(null);
        } else {
          alert(res.message);
        }
      } catch (err: any) {
        alert('エラー: ' + err.message);
      }
    } else {
      const res = await simulateGasCall('updateHistory', payload);
      if (res.status === 'success') {
        alert(res.message);
        setEditingHistoryItem(null);
      } else {
        alert(res.message);
      }
    }
  };

  // 履歴削除の送信
  const handleDeleteHistory = async (rowNo: number) => {
    if (!confirm('この打刻履歴を削除してもよろしいですか？')) return;

    const payload = {
      rowNo,
      password: adminPasswordSetting
    };

    if (isGasMode) {
      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'deleteHistory',
            token: apiToken,
            ...payload
          })
        });
        const res = await response.json();
        if (res.status === 'success') {
          alert(res.message);
          saveHistory(history.filter(h => h.rowNo !== rowNo));
        } else {
          alert(res.message);
        }
      } catch (err: any) {
        alert('エラー: ' + err.message);
      }
    } else {
      const res = await simulateGasCall('deleteHistory', payload);
      if (res.status === 'success') {
        alert(res.message);
      } else {
        alert(res.message);
      }
    }
  };

  // 暗証番号表示の切り替え
  const togglePinVisibility = (id: string) => {
    setShowPins(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 連携設定の保存
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('attendance_gas_url', gasUrl);
    localStorage.setItem('attendance_is_gas_mode', String(isGasMode));
    localStorage.setItem('attendance_api_token', apiToken);
    localStorage.setItem('attendance_admin_password', adminPasswordSetting);
    alert('設定を保存しました。');
  };

  // 社員検索フィルタ
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(empSearch.toLowerCase()) || 
    emp.id.toLowerCase().includes(empSearch.toLowerCase())
  );

  // 現場検索フィルタ
  const filteredSites = sites.filter(site => 
    site.name.toLowerCase().includes(siteSearch.toLowerCase()) || 
    site.address.toLowerCase().includes(siteSearch.toLowerCase()) ||
    site.id.toLowerCase().includes(siteSearch.toLowerCase())
  );

  // 履歴のフィルタリング
  const filteredHistory = historyFilterEmp 
    ? history.filter(h => h.empId === historyFilterEmp)
    : history;

  // 履歴のページネーション計算
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased">
      
      {/* 📱 現場打刻ビュー (デフォルト・携帯/現場職人向け) */}
      {viewMode === 'stamp' && (
        <div className="flex-1 flex flex-col max-w-md mx-auto w-full bg-white shadow-2xl min-h-screen relative pb-6">
          
          {/* ヘッダー: 職人さんが見やすい超シンプル設計 */}
          <header className="bg-gradient-to-b from-blue-600 to-blue-700 text-white p-6 rounded-b-[2rem] shadow-lg flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-3 border border-white/20">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-wider">現場かんたん打刻</h1>
            <p className="text-xs text-blue-100 mt-1">
              名前を選び、4桁の番号を入力してボタンを押すだけ！
            </p>

            {/* 現在時刻の大きな表示 (見やすさ重視) */}
            <div className="mt-4 bg-white/10 px-5 py-2.5 rounded-2xl border border-white/20 w-full flex flex-col items-center">
              <span className="text-[10px] text-blue-200 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> 現在時刻
              </span>
              <span className="text-3xl font-mono font-black mt-0.5 tracking-wider text-white">
                {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="text-xs text-blue-100 font-medium mt-1">
                {currentTime.toLocaleDateString('ja-JP', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
          </header>

          {/* 打刻フォーム本体 */}
          <main className="flex-1 px-6 py-6 space-y-5">

            {/* ステップ1：お名前の選択 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">1</span>
                <span>あなたのお名前をタップしてください</span>
              </label>
              <div className="relative">
                <select
                  value={selectedEmp}
                  onChange={(e) => setSelectedEmp(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:bg-white outline-none appearance-none text-base font-bold text-slate-800 transition-all cursor-pointer"
                >
                  <option value="">-- タップして名前を選ぶ --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            </div>

            {/* ステップ2：暗証番号(PIN)入力 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">2</span>
                <span>暗証番号を4桁で入力してください</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  pattern="[0-9]{4}"
                  inputMode="numeric"
                  maxLength={4}
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="数字4桁を入力"
                  className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-800 tracking-[1em] text-center font-black text-xl focus:border-blue-500 focus:bg-white outline-none transition-all"
                />
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            </div>

            {/* ステップ3：勤務現場の選択 */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">3</span>
                <span>本日の勤務現場をタップしてください</span>
              </label>
              <div className="relative">
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="w-full h-14 pl-12 pr-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:bg-white outline-none appearance-none text-base font-bold text-slate-800 transition-all cursor-pointer"
                >
                  <option value="">-- タップして現場を選ぶ --</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            </div>

            {/* GPS位置ステータスの簡易表示 */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${gpsCoords ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span className="font-bold">
                  {gpsCoords ? 'GPS位置：測定完了 🟢' : 'GPS位置：測定中... ⏳'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {gpsCoords ? `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}` : '検出中'}
              </span>
            </div>

            {/* 打刻判定・処理中のステータス表示エリア */}
            {stampStatus.text && (
              <div className={`p-4 rounded-2xl text-sm border-2 font-bold ${
                stampStatus.type === 'loading' ? 'bg-blue-50 text-blue-800 border-blue-200 animate-pulse' :
                stampStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-300 animate-fadeIn' :
                'bg-rose-50 text-rose-800 border-rose-300 animate-fadeIn'
              }`}>
                <div className="flex items-start gap-3">
                  {stampStatus.type === 'success' ? (
                    <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : stampStatus.type === 'loading' ? (
                    <RefreshCw className="w-5 h-5 text-blue-600 shrink-0 animate-spin mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="whitespace-pre-line leading-relaxed text-sm">{stampStatus.text}</div>
                </div>
              </div>
            )}

            {/* 打刻実行ボタン（携帯で押しやすい巨大ボタン） */}
            <div className="pt-2 space-y-3">
              <div className="grid grid-cols-2 gap-3.5">
                <button
                  onClick={() => handleStamp('出勤')}
                  disabled={isStamping}
                  className="h-20 bg-emerald-600 active:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xl rounded-2xl shadow-lg transition-all flex flex-col items-center justify-center gap-1 border-b-4 border-emerald-800"
                  id="btn-出勤"
                >
                  <span className="text-xl">出 勤</span>
                  <span className="text-[9px] text-emerald-100 tracking-wider uppercase font-normal">本日の作業開始</span>
                </button>
                <button
                  onClick={() => handleStamp('退勤')}
                  disabled={isStamping}
                  className="h-20 bg-rose-600 active:bg-rose-700 disabled:bg-slate-300 text-white font-black text-xl rounded-2xl shadow-lg transition-all flex flex-col items-center justify-center gap-1 border-b-4 border-rose-800"
                  id="btn-退勤"
                >
                  <span className="text-xl">退 勤</span>
                  <span className="text-[9px] text-rose-100 tracking-wider uppercase font-normal">本日の作業終了</span>
                </button>
              </div>

              <button
                onClick={() => handleStamp('早退')}
                disabled={isStamping}
                className="w-full h-14 bg-amber-500 active:bg-amber-600 disabled:bg-slate-300 text-white font-black text-base rounded-2xl shadow-md transition-all flex flex-col items-center justify-center gap-0.5 border-b-4 border-amber-700"
                id="btn-早退"
              >
                <span>早 退 する</span>
                <span className="text-[9px] text-amber-100 tracking-wider font-normal">途中で現場を離れる場合</span>
              </button>
            </div>

          </main>

          {/* 控えめな管理者への切り替えリンク（最下部に配置して職人さんが間違えないように） */}
          <footer className="py-4 px-6 border-t border-slate-100 bg-slate-50 rounded-t-[2rem] text-center mt-6">
            <button
              onClick={() => setViewMode('admin_login')}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold flex items-center justify-center gap-1 mx-auto py-1"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>管理者ログインはこちら</span>
            </button>
          </footer>
        </div>
      )}

      {/* 🔐 管理者ログイン画面 */}
      {viewMode === 'admin_login' && (
        <div className="flex-1 flex items-center justify-center p-6 max-w-md mx-auto w-full">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl w-full space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <span>管理者ログイン</span>
              </h2>
              <button
                onClick={() => setViewMode('stamp')}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  管理者用のパスワードを入力してください
                </label>
                <input
                  type="password"
                  placeholder="パスワードを入力"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full h-12 px-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-blue-500 outline-none text-slate-800 text-base font-bold transition-all"
                  id="admin-password-input"
                />
              </div>

              <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-xs leading-relaxed border border-blue-100">
                💡 初期設定のパスワード：<span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded shadow-sm text-blue-600 border border-blue-200">admin_pass_9999</span>
                <p className="mt-1 text-[11px] text-blue-600">※ ログイン後、「システム設定」メニューからいつでも自由なパスワードに変更できます。</p>
              </div>

              <button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-100 transition"
              >
                ログイン
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🛡️ 管理者ダッシュボード (パソコンが苦手な管理者でも迷わないシンプル設計) */}
      {viewMode === 'admin_dashboard' && (
        <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-6 md:px-6 md:py-8 space-y-6">
          
          {/* ダッシュボードヘッダー */}
          <header className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-black text-slate-800">打刻システム 管理画面</h1>
                <p className="text-xs text-slate-500 font-medium">社員や現場の追加・編集、打刻データの確認がかんたんに行えます</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 self-stretch md:self-auto">
              <span className="text-[11px] md:text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 flex-1 md:flex-none text-center">
                {isGasMode ? '🟢 GASスプレッドシート連動中' : '⚠️ 模擬動作モード（ブラウザのみ）'}
              </span>
              <button
                onClick={() => setViewMode('stamp')}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-1.5 text-xs rounded-lg transition flex items-center gap-1.5 whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                <span>現場打刻画面へ戻る</span>
              </button>
            </div>
          </header>

          {/* 🌟 管理者向けナビゲーションタブ (パソコンが苦手な人が迷わないように大きく、わかりやすく) */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => { setAdminTab('history'); setHistoryPage(1); }}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-black transition-all border-b-4 ${
                adminTab === 'history' 
                  ? 'bg-blue-600 text-white border-blue-800 shadow-md' 
                  : 'bg-white text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>📊 ① 打刻履歴の確認・修正</span>
            </button>
            
            <button
              onClick={() => setAdminTab('employees')}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-black transition-all border-b-4 ${
                adminTab === 'employees' 
                  ? 'bg-blue-600 text-white border-blue-800 shadow-md' 
                  : 'bg-white text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>👥 ② 社員名簿と新規登録</span>
            </button>

            <button
              onClick={() => setAdminTab('sites')}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-black transition-all border-b-4 ${
                adminTab === 'sites' 
                  ? 'bg-blue-600 text-white border-blue-800 shadow-md' 
                  : 'bg-white text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>📍 ③ 現場一覧と現場追加</span>
            </button>

            <button
              onClick={() => setAdminTab('settings')}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-xl text-sm font-black transition-all border-b-4 ${
                adminTab === 'settings' 
                  ? 'bg-blue-600 text-white border-blue-800 shadow-md' 
                  : 'bg-white text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>⚙️ ④ パスワード・システム設定</span>
            </button>
          </div>

          {/* 🌟 タブの内容 */}
          <div className="space-y-6">

            {/* TAB 1: 打刻履歴 */}
            {adminTab === 'history' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>打刻履歴の確認（1ページ10件ずつ表示されます）</span>
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">間違えて打刻した履歴は、右側の「修正」や「削除」ボタンから管理者が手動で直せます</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700">
                      <span>👤 社員で絞り込む:</span>
                      <select
                        value={historyFilterEmp}
                        onChange={(e) => {
                          setHistoryFilterEmp(e.target.value);
                          setHistoryPage(1); // 絞り込み条件が変わったら1ページ目に戻す
                        }}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none font-bold text-slate-800 cursor-pointer text-xs focus:border-blue-500"
                      >
                        <option value="">全員を表示 ({history.length}件)</option>
                        {employees.map(emp => {
                          const empCount = history.filter(h => h.empId === emp.id).length;
                          return (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} ({empCount}件)
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 text-center shrink-0">
                      表示中: {filteredHistory.length} 件 / 全 {history.length} 件
                    </span>
                  </div>
                </div>

                {/* 履歴のクリア・リセット（ローカルデモ用） */}
                {!isGasMode && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center justify-between">
                    <span>💡 現在は「お試し模擬データ」で動作しています。本物のスプレッドシートとは繋がっていません。</span>
                    <button
                      onClick={() => {
                        if (confirm('ローカルの履歴データを初期状態(山田・佐藤・鈴木さんの記録)に戻しますか？')) {
                          saveHistory(DEFAULT_HISTORY);
                        }
                      }}
                      className="text-amber-700 underline font-black hover:text-amber-900"
                    >
                      お試し履歴を初期状態に戻す
                    </button>
                  </div>
                )}

                {/* テーブル部分 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50">
                        <th className="py-3 px-3 whitespace-nowrap">打刻日時</th>
                        <th className="py-3 px-3 whitespace-nowrap">社員名</th>
                        <th className="py-3 px-3 whitespace-nowrap">現場名</th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">打刻種別</th>
                        <th className="py-3 px-3 text-center whitespace-nowrap">GPS判定</th>
                        <th className="py-3 px-3 whitespace-nowrap">早退理由 / 備考</th>
                        <th className="py-3 px-3 text-right whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {paginatedHistory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-bold text-sm">
                            履歴データがまだありません。
                          </td>
                        </tr>
                      ) : (
                        paginatedHistory.map((row) => (
                          <tr key={row.rowNo} className="hover:bg-slate-50/80 font-medium transition">
                            <td className="py-3.5 px-3 text-slate-500 font-mono whitespace-nowrap">
                              {new Date(row.timestamp).toLocaleString('ja-JP', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="py-3.5 px-3 font-bold text-slate-900 text-sm whitespace-nowrap">{row.empName}</td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              {sites.find(s => s.id === row.siteId)?.name || row.siteId}
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span className={`inline-block px-2.5 py-1 rounded-md font-bold text-xs whitespace-nowrap ${
                                row.type === '出勤' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                row.type === '退勤' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 
                                'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}>
                                {row.type}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs whitespace-nowrap ${
                                row.result === '成功' 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {row.result}
                                {row.distance !== undefined && ` (${row.distance}m)`}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 max-w-[180px] truncate font-bold text-slate-600" title={row.reason}>
                              {row.reason || <span className="text-slate-300">-</span>}
                            </td>
                            <td className="py-3.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => setEditingHistoryItem(row)}
                                className="text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-100 transition text-[11px]"
                              >
                                修正
                              </button>
                              <button
                                onClick={() => handleDeleteHistory(row.rowNo)}
                                className="text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-100 transition text-[11px]"
                              >
                                削除
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 🌟 10件ずつのページネーションコントロール */}
                {totalPages > 1 && (
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-bold">
                      {filteredHistory.length} 件中 { (historyPage - 1) * itemsPerPage + 1 } ～ { Math.min(historyPage * itemsPerPage, filteredHistory.length) } 件目を表示
                    </span>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setHistoryPage(prev => Math.max(prev - 1, 1))}
                        disabled={historyPage === 1}
                        className="px-3 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>前の10件</span>
                      </button>
                      
                      <span className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-blue-600">
                        {historyPage} / {totalPages} ページ
                      </span>
                      
                      <button
                        onClick={() => setHistoryPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={historyPage === totalPages}
                        className="px-3 py-2 bg-slate-100 border border-slate-200 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>次の10件</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: 社員管理 */}
            {adminTab === 'employees' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 新規登録フォーム */}
                <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <span>新しい社員の新規追加</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">現場で打刻を行う職人さんを新しく追加します</p>
                  </div>
                  
                  <form onSubmit={handleAddEmployee} className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500">① 社員番号 (ID)</label>
                      <input
                        type="text"
                        placeholder="例: E004"
                        value={newEmpId}
                        onChange={(e) => setNewEmpId(e.target.value)}
                        className="w-full h-11 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none text-slate-800 font-bold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">※ 他の社員と重複しない固有の英数字（E004など）を入力してください。</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500">② お名前</label>
                      <input
                        type="text"
                        placeholder="例: 新規 太郎"
                        value={newEmpName}
                        onChange={(e) => setNewEmpName(e.target.value)}
                        className="w-full h-11 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none text-slate-800 font-bold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">※ 打刻画面にそのまま表示されるお名前です。</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500">③ 4桁の暗証番号 (PIN)</label>
                      <input
                        type="password"
                        maxLength={4}
                        pattern="[0-9]{4}"
                        inputMode="numeric"
                        placeholder="例: 1234"
                        value={newEmpPin}
                        onChange={(e) => setNewEmpPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full h-11 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm tracking-widest text-center focus:border-blue-500 outline-none text-slate-800 font-black"
                        required
                      />
                      <p className="text-[10px] text-slate-400">※ 職人さん自身が打刻するときに入力する数字4桁です。</p>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full h-11 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>マスタに社員を登録する</span>
                    </button>
                  </form>
                </div>

                {/* 名簿一覧・編集・削除 */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-600" />
                        <span>登録済みの社員一覧（名簿）</span>
                      </h2>
                      <p className="text-xs text-slate-400">現在登録されているすべての社員です。編集や削除ができます</p>
                    </div>
                    
                    {/* 簡易検索ボックス */}
                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        placeholder="名前や社員番号で検索..."
                        value={empSearch}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:border-blue-500 focus:bg-white outline-none"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50">
                          <th className="py-2.5 px-3">社員番号 (ID)</th>
                          <th className="py-2.5 px-3">お名前</th>
                          <th className="py-2.5 px-3 text-center">打刻用暗証番号 (PIN)</th>
                          <th className="py-2.5 px-3 text-right">管理操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredEmployees.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                              該当する社員が見つかりません。
                            </td>
                          </tr>
                        ) : (
                          filteredEmployees.map((emp) => (
                            <tr key={emp.id} className="hover:bg-slate-50 font-medium">
                              <td className="py-3 px-3 font-mono text-slate-500">{emp.id}</td>
                              <td className="py-3 px-3 font-bold text-slate-900 text-sm">{emp.name}</td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="font-mono font-bold text-sm tracking-widest bg-slate-50 px-2 py-0.5 rounded border border-slate-150">
                                    {showPins[emp.id] ? emp.pin : '••••'}
                                  </span>
                                  <button
                                    onClick={() => togglePinVisibility(emp.id)}
                                    className="text-slate-400 hover:text-slate-600 focus:outline-none"
                                    title="暗証番号を表示/非表示"
                                  >
                                    {showPins[emp.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => setEditingEmployee(emp)}
                                  className="text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-100 transition text-[11px]"
                                >
                                  編集する
                                </button>
                                <button
                                  onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                                  className="text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-100 transition text-[11px]"
                                >
                                  削除
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: 現場管理 */}
            {adminTab === 'sites' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 新規登録フォーム */}
                <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-indigo-600" />
                      <span>新しい工事現場の新規追加</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">職人さんが働く新しい作業現場を追加します</p>
                  </div>
                  
                  <form onSubmit={handleAddSite} className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500">① 現場ID</label>
                      <input
                        type="text"
                        placeholder="例: GENBA004"
                        value={newSiteId}
                        onChange={(e) => setNewSiteId(e.target.value)}
                        className="w-full h-11 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none text-slate-800 font-bold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">※ 他の現場と重複しない識別用の英数字（GENBA004など）。</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500">② 現場名</label>
                      <input
                        type="text"
                        placeholder="例: 六本木アークヒルズ内装工事"
                        value={newSiteName}
                        onChange={(e) => setNewSiteName(e.target.value)}
                        className="w-full h-11 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none text-slate-800 font-bold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">※ 職人さんが選択する時の分かりやすい現場の名前です。</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500">③ 住所（位置確認用）</label>
                      <input
                        type="text"
                        placeholder="例: 東京都港区六本木1-1-1"
                        value={newSiteAddress}
                        onChange={(e) => setNewSiteAddress(e.target.value)}
                        className="w-full h-11 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none text-slate-800 font-bold"
                        required
                      />
                      <p className="text-[10px] text-slate-400">※ 住所をもとに現場のおおよその中心座標が自動的に設定されます。</p>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-slate-500">④ 打刻を許容する範囲 (半径)</label>
                      <select
                        value={newSiteRadius}
                        onChange={(e) => setNewSiteRadius(Number(e.target.value))}
                        className="w-full h-11 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none text-slate-800 font-bold cursor-pointer"
                      >
                        <option value={100}>100メートル (非常に厳しい制限)</option>
                        <option value={200}>200メートル (一般的な制限)</option>
                        <option value={300}>300メートル (標準的でおすすめ)</option>
                        <option value={500}>500メートル (広めの敷地用)</option>
                        <option value={1000}>1000メートル (広域)</option>
                      </select>
                      <p className="text-[10px] text-slate-400">※ この半径より外から打刻を試みると「距離外エラー」になります。</p>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>マスタに現場を登録する</span>
                    </button>
                  </form>
                </div>

                {/* 現場一覧 */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>登録済みの現場一覧</span>
                      </h2>
                      <p className="text-xs text-slate-400">現在稼働している現場情報です。打刻制限の半径などを変更できます</p>
                    </div>
                    
                    {/* 現場検索ボックス */}
                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        placeholder="現場名や住所で検索..."
                        value={siteSearch}
                        onChange={(e) => setSiteSearch(e.target.value)}
                        className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:border-blue-500 focus:bg-white outline-none"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-55">
                          <th className="py-2.5 px-3">現場ID</th>
                          <th className="py-2.5 px-3">現場名</th>
                          <th className="py-2.5 px-3">住所</th>
                          <th className="py-2.5 px-3 text-center">打刻許容半径</th>
                          <th className="py-2.5 px-3 text-right">管理操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filteredSites.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                              該当する現場が見つかりません。
                            </td>
                          </tr>
                        ) : (
                          filteredSites.map((site) => (
                            <tr key={site.id} className="hover:bg-slate-50 font-medium">
                              <td className="py-3 px-3 font-mono text-slate-500">{site.id}</td>
                              <td className="py-3 px-3 font-bold text-slate-900 text-sm">{site.name}</td>
                              <td className="py-3 px-3 text-slate-500 text-xs">{site.address}</td>
                              <td className="py-3 px-3 text-center">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200">
                                  半径 {site.radius}m
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => setEditingSite(site)}
                                  className="text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg border border-indigo-100 transition text-[11px]"
                                >
                                  編集する
                                </button>
                                <button
                                  onClick={() => handleDeleteSite(site.id, site.name)}
                                  className="text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg border border-rose-100 transition text-[11px]"
                                >
                                  削除
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 4: システム設定 */}
            {adminTab === 'settings' && (
              <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <h2 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Settings className="w-4 h-4 text-slate-600" />
                    <span>管理者アカウント ＆ システム接続設定</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    管理者用ログインパスワードの変更や、Googleスプレッドシート(GAS)との実データ同期を管理します
                  </p>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-6">
                  
                  {/* パスワード設定 */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">🔒 管理者ログインパスワード</label>
                    <input
                      type="text"
                      value={adminPasswordSetting}
                      onChange={(e) => setAdminPasswordSetting(e.target.value)}
                      className="w-full h-11 px-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none text-slate-800 font-black"
                      placeholder="新しいパスワードを入力してください"
                      required
                    />
                  </div>

                  {/* スプレッドシート連携オプション */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <label className="flex items-start gap-2.5 text-xs font-bold text-slate-700 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isGasMode}
                        onChange={(e) => setIsGasMode(e.target.checked)}
                        className="rounded text-blue-600 mt-0.5 w-4 h-4"
                      />
                      <div>
                        <span>本物スプレッドシート(GAS)と同期を行う</span>
                        <p className="text-[10px] text-slate-400 font-medium font-normal mt-0.5">
                          チェックを入れると、実際のGoogleスプレッドシートに入力情報がリアルタイムで記録・更新されます。
                        </p>
                      </div>
                    </label>

                    {isGasMode && (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-fadeIn text-xs">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-600">① GASの「ウェブアプリURL」</label>
                          <input
                            type="text"
                            value={gasUrl}
                            onChange={(e) => setGasUrl(e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                            placeholder="https://script.google.com/macros/s/..."
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-bold text-slate-600">② API接続用セキュリティトークン</label>
                          <input
                            type="text"
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 登録・保存ボタン */}
                  <button
                    type="submit"
                    className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs rounded-xl shadow-md transition"
                  >
                    設定内容を保存する
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ==========================================
          📝 モーダル：打刻履歴の修正
          ========================================== */}
      {editingHistoryItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">
                ✏️ 打刻履歴データの修正 ({editingHistoryItem.empName})
              </h3>
              <button onClick={() => setEditingHistoryItem(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">打刻種別</label>
                <select
                  value={editingHistoryItem.type}
                  onChange={(e) => setEditingHistoryItem({ ...editingHistoryItem, type: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none font-bold"
                >
                  <option value="出勤">出勤</option>
                  <option value="退勤">退勤</option>
                  <option value="早退">早退</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">GPS判定結果</label>
                <select
                  value={editingHistoryItem.result}
                  onChange={(e) => setEditingHistoryItem({ ...editingHistoryItem, result: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none font-bold"
                >
                  <option value="成功">成功</option>
                  <option value="距離外エラー">距離外エラー</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">早退理由 / 備考情報</label>
                <textarea
                  value={editingHistoryItem.reason || ''}
                  onChange={(e) => setEditingHistoryItem({ ...editingHistoryItem, reason: e.target.value })}
                  className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none h-20 resize-none font-bold"
                  placeholder="理由や修正に関するメモを入力"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingHistoryItem(null)}
                className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                キャンセル
              </button>
              <button
                onClick={submitEditHistory}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md transition"
              >
                変更を保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          📝 モーダル：社員情報の編集
          ========================================== */}
      {editingEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveEmployeeEdit} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">
                ✏️ 社員情報の変更 ({editingEmployee.id})
              </h3>
              <button type="button" onClick={() => setEditingEmployee(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">お名前</label>
                <input
                  type="text"
                  value={editingEmployee.name}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">4桁の暗証番号 (PIN)</label>
                <input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  inputMode="numeric"
                  value={editingEmployee.pin}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, pin: e.target.value.replace(/\D/g, '') })}
                  className="w-full h-10 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm tracking-widest text-center focus:border-blue-500 outline-none font-black"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">※ 代理打刻を防ぐための数字4桁です。</p>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-md transition"
              >
                変更を保存する
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================
          📝 モーダル：現場情報の編集
          ========================================== */}
      {editingSite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveSiteEdit} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800">
                ✏️ 現場情報の変更 ({editingSite.id})
              </h3>
              <button type="button" onClick={() => setEditingSite(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-500 font-bold mb-1">現場名</label>
                <input
                  type="text"
                  value={editingSite.name}
                  onChange={(e) => setEditingSite({ ...editingSite, name: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">住所</label>
                <input
                  type="text"
                  value={editingSite.address}
                  onChange={(e) => setEditingSite({ ...editingSite, address: e.target.value })}
                  className="w-full h-10 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">打刻を許容する範囲 (半径)</label>
                <select
                  value={editingSite.radius}
                  onChange={(e) => setEditingSite({ ...editingSite, radius: Number(e.target.value) })}
                  className="w-full h-10 px-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none font-bold cursor-pointer"
                >
                  <option value={100}>100メートル (非常に厳しい制限)</option>
                  <option value={200}>200メートル (一般的な制限)</option>
                  <option value={300}>300メートル (標準的でおすすめ)</option>
                  <option value={500}>500メートル (広めの敷地用)</option>
                  <option value={1000}>1000メートル (広域)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingSite(null)}
                className="flex-1 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md transition"
              >
                変更を保存する
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
