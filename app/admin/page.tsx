"use client";
import { useState, useEffect } from "react";
import { supabase } from "../supabase";

type TabType = 'holidays' | 'status' | 'staff' | 'settings';
type Staff = { id: string, name: string };

export default function AdminPage() {
  const [passwordInput, setPasswordInput] = useState("");
  const [storedPassword, setStoredPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('holidays');
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dbHolidays, setDbHolidays] = useState<string[]>([]); 
  const [holidays, setHolidays] = useState<string[]>([]);     
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [newStaffName, setNewStaffName] = useState("");
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, string>>({});
  const [monthlyRemarks, setMonthlyRemarks] = useState<Record<string, string>>({});

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const showToast = (message: string, type: "success" | "error" = "success") => { 
    setToast({ message, type }); 
    setTimeout(() => setToast(null), 3000); 
  };

  useEffect(() => {
    const getPassword = async () => {
      // セレクト時は .single() の前で cast する
      const { data } = await (supabase.from('config') as any).select('value').eq('key', 'admin_password').single();
      if (data) setStoredPassword((data as any).value); 
    };
    getPassword();
  }, []);

  const fetchInitialData = async () => {
    const { data: staffData } = await (supabase.from('staff') as any).select('id, name').order('created_at');
    if (staffData) setStaffList(staffData as Staff[]);

    const { data: holidayData } = await (supabase.from('holidays') as any).select('date');
    if (holidayData) setDbHolidays(holidayData.map((row: any) => row.date));

    const ym = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const startStr = `${ym}-01`;
    const endStr = `${ym}-${new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()}`;
    
    const { data: shiftData } = await (supabase.from('shifts') as any)
      .select('staff_id, updated_at')
      .gte('date', startStr)
      .lte('date', endStr);
      
    if (shiftData) {
      const subMap: Record<string, string> = {};
      (shiftData as any[]).forEach(d => { 
        if (!subMap[d.staff_id] || new Date(d.updated_at) > new Date(subMap[d.staff_id])) subMap[d.staff_id] = d.updated_at; 
      });
      setSubmissions(subMap);
    }

    const { data: remarkData } = await (supabase.from('monthly_remarks') as any)
      .select('staff_id, remark')
      .eq('year_month', ym);
    
    if (remarkData) {
      const rMap: Record<string, string> = {};
      remarkData.forEach((r: any) => { rMap[r.staff_id] = r.remark; });
      setMonthlyRemarks(rMap);
    } else {
      setMonthlyRemarks({});
    }
  };

  useEffect(() => { if (isAuthenticated) fetchInitialData(); }, [isAuthenticated, currentDate]);

  useEffect(() => {
    const prefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const monthDb = dbHolidays.filter(d => d.startsWith(prefix));
    if (monthDb.length === 0) {
      const defaults: string[] = [];
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
        if (d.getDay() === 1 || d.getDay() === 2) defaults.push(`${prefix}-${String(i).padStart(2, '0')}`);
      }
      setHolidays(prev => [...prev.filter(d => !d.startsWith(prefix)), ...defaults]);
    } else {
      setHolidays(prev => [...prev.filter(d => !d.startsWith(prefix)), ...monthDb]);
    }
  }, [currentDate, dbHolidays]);

  const toggleHoliday = (dateStr: string) => setHolidays(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);

  const handleSaveHolidays = async () => {
    setIsSubmitting(true);
    try {
      const prefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      const endStr = `${prefix}-${new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()}`;
      
      // from() の直後に as any を入れる
      await (supabase.from('holidays') as any).delete().gte('date', `${prefix}-01`).lte('date', endStr);
      
      const currentMonthHolidays = holidays.filter(d => d.startsWith(prefix));
      if (currentMonthHolidays.length > 0) {
        await (supabase.from('holidays') as any).insert(currentMonthHolidays.map(d => ({ date: d })));
      }
      
      const { data } = await (supabase.from('holidays') as any).select('date');
      if (data) setDbHolidays(data.map((row: any) => row.date));
      showToast("保存完了！");
    } catch (e) { showToast("保存失敗", "error"); } finally { setIsSubmitting(false); }
  };

  const handleAddStaff = async () => {
    if (!newStaffName.trim()) return;
    setIsSubmitting(true);
    try {
      await (supabase.from('staff') as any).insert([{ name: newStaffName.trim() }]);
      setNewStaffName("");
      const { data } = await (supabase.from('staff') as any).select('id, name').order('created_at');
      if (data) setStaffList(data as Staff[]);
      showToast("追加完了！");
    } catch (e) { showToast("追加失敗", "error"); } finally { setIsSubmitting(false); }
  };

  const confirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    setIsSubmitting(true);
    try {
      await (supabase.from('shifts') as any).delete().eq('staff_id', staffToDelete.id);
      await (supabase.from('staff') as any).delete().eq('id', staffToDelete.id);
      setStaffToDelete(null);
      const { data } = await (supabase.from('staff') as any).select('id, name').order('created_at');
      if (data) setStaffList(data as Staff[]);
      showToast("削除完了！");
    } catch (e) { showToast("削除失敗", "error"); } finally { setIsSubmitting(false); }
  };

  const handleChangePassword = async () => {
    if (currentPw !== storedPassword) {
      showToast("現在のパスワードが正しくありません", "error");
      return;
    }
    if (newPw !== confirmPw) {
      showToast("新しいパスワードが一致しません", "error");
      return;
    }
    if (newPw.length < 4) {
      showToast("新しいパスワードは4文字以上にしてください", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await (supabase.from('config') as any).update({ value: newPw }).eq('key', 'admin_password');
      if (error) throw error;
      setStoredPassword(newPw); 
      showToast("変更完了！");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) { 
      showToast("変更失敗", "error"); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const formatDateTime = (dateStr: string) => { 
    if (!dateStr) return "-"; 
    const date = new Date(dateStr); 
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; 
  };

  if (!isAuthenticated) return (
    <div className="max-w-sm mx-auto p-8 mt-20 bg-white rounded shadow text-center relative">
      {toast && <div className={`absolute -top-16 left-0 right-0 p-3 rounded text-white font-bold text-sm ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>{toast.message}</div>}
      <h1 className="text-xl font-bold mb-4">管理者ログイン</h1>
      <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="パスワード" className="w-full border-2 border-gray-300 p-2 rounded mb-4 text-center" />
      <button 
        onClick={() => { 
          if (passwordInput === storedPassword) setIsAuthenticated(true); 
          else showToast("パスワードが違います", "error"); 
        }} 
        className="w-full bg-gray-800 text-white font-bold py-2 rounded"
      >
        ログイン
      </button>
    </div>
  );

  const days = [];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const startingDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < startingDayOfWeek; i++) days.push(<div key={`empty-${i}`} className="p-1 border bg-gray-50"></div>);
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const isHoliday = holidays.includes(dateStr); 
    days.push(<div key={i} className={`p-1.5 border flex flex-col items-center h-20 ${isHoliday ? 'bg-red-50' : 'bg-white'}`}><span className={`font-bold text-sm mb-1 shrink-0 ${isHoliday ? 'text-red-500' : ''}`}>{i}</span><div className="flex-1 flex items-center justify-center w-full"><button onClick={() => toggleHoliday(dateStr)} className={`w-full py-1.5 rounded font-bold text-[10px] ${isHoliday ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'}`}>{isHoliday ? '休業' : '営業'}</button></div></div>);
  }

  return (
    <div className="max-w-md mx-auto p-4 font-sans text-gray-800 pb-20 relative">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg text-white font-bold text-sm z-50 transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>{toast.message}</div>}
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">管理メニュー</h1><a href="/" className="text-blue-500 hover:underline text-sm font-bold bg-blue-50 px-3 py-1 rounded">← 入力画面へ</a></div>
      <div className="flex overflow-x-auto gap-2 mb-6 pb-2 border-b">{(['holidays', 'status', 'staff', 'settings'] as TabType[]).map((tab) => { const labels = { holidays: '📅 定休日', status: '✅ 提出状況', staff: '👥 スタッフ', settings: '⚙️ 管理者設定' }; return (<button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{labels[tab]}</button>); })}</div>

      {activeTab === 'holidays' && (<div className="bg-white rounded-xl shadow-sm border p-3"><div className="flex justify-between items-center mb-4"><button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="px-3 py-1 bg-gray-100 rounded text-sm">先月</button><h2 className="text-lg font-bold">{year}年 {month + 1}月</h2><button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="px-3 py-1 bg-gray-100 rounded text-sm">翌月</button></div><div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] mb-1"><div className="text-red-500">日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div className="text-blue-500">土</div></div><div className="grid grid-cols-7 gap-1">{days}</div><button onClick={handleSaveHolidays} disabled={isSubmitting} className={`mt-6 w-full py-3 rounded-lg font-bold text-white ${isSubmitting ? 'bg-gray-400' : 'bg-red-500'}`}>{isSubmitting ? '保存中...' : '定休日を保存する'}</button></div>)}
      
      {activeTab === 'status' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border p-4 flex justify-between items-center"><button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="px-3 py-1 bg-gray-100 rounded text-sm">◀</button><h2 className="text-lg font-bold">{year}年 {month + 1}月 の状況</h2><button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="px-3 py-1 bg-gray-100 rounded text-sm">▶</button></div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <h3 className="font-bold p-3 bg-red-50 text-red-700 border-b text-xs text-center">⚠️ 未提出 ({staffList.length - Object.keys(submissions).length}名)</h3>
              <div className="p-2 flex flex-wrap gap-2">{staffList.filter(s => !submissions[s.id]).map(staff => (<div key={staff.id} className="text-sm px-3 py-1.5 bg-gray-50 rounded text-gray-500 font-bold">{staff.name}</div>))}</div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <h3 className="font-bold p-3 bg-green-50 text-green-700 border-b text-xs text-center">✅ 提出済み ({Object.keys(submissions).length}名)</h3>
              <div className="divide-y">{staffList.filter(s => submissions[s.id]).map(staff => (<div key={staff.id} className="p-3 flex justify-between items-center"><span className="text-sm font-bold">{staff.name}</span><span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded">最終更新: {formatDateTime(submissions[staff.id])}</span></div>))}</div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <h3 className="font-bold p-3 bg-blue-50 text-blue-700 border-b text-xs text-center">📝 今月の備考一覧</h3>
              <div className="divide-y">
                {staffList.map(staff => monthlyRemarks[staff.id] ? (
                  <div key={staff.id} className="p-3">
                    <div className="text-xs font-bold text-blue-600 mb-1">{staff.name}</div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{monthlyRemarks[staff.id]}</div>
                  </div>
                ) : null)}
                {Object.keys(monthlyRemarks).length === 0 && <p className="p-4 text-center text-gray-400 text-xs">備考はありません</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'staff' && (<div className="space-y-6"><div className="bg-white rounded-xl shadow-sm border p-4"><h3 className="font-bold mb-3 text-sm text-gray-500">新しいスタッフを追加</h3><div className="flex gap-2"><input type="text" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="名前を入力" className="flex-1 border p-2 rounded-lg bg-gray-50" /><button onClick={handleAddStaff} disabled={isSubmitting || !newStaffName.trim()} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm disabled:opacity-50">追加</button></div></div><div className="bg-white rounded-xl shadow-sm border overflow-hidden"><h3 className="font-bold p-4 bg-gray-50 border-b text-sm text-gray-500">登録済みスタッフ ({staffList.length}名)</h3><div className="divide-y max-h-96 overflow-y-auto">{staffList.map((staff) => (<div key={staff.id} className="p-3 flex justify-between items-center hover:bg-gray-50"><span className="font-bold">{staff.name}</span><button onClick={() => setStaffToDelete(staff)} className="text-red-500 text-xs font-bold px-3 py-1 bg-red-50 rounded hover:bg-red-100">削除</button></div>))}{staffList.length === 0 && <p className="p-4 text-center text-gray-400 text-sm">スタッフがいません</p>}</div></div></div>)}
      {activeTab === 'settings' && (<div className="bg-white rounded-xl shadow-sm border p-4"><h3 className="font-bold mb-4 text-gray-700 border-b pb-2">パスワードの変更</h3><div className="space-y-4"><div><label className="block text-xs font-bold text-gray-500 mb-1">現在のパスワード</label><input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="w-full border p-2 rounded-lg bg-gray-50" /></div><div><label className="block text-xs font-bold text-gray-500 mb-1">新しいパスワード</label><input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="w-full border p-2 rounded-lg bg-gray-50" /></div><div><label className="block text-xs font-bold text-gray-500 mb-1">新しいパスワード（確認）</label><input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="w-full border p-2 rounded-lg bg-gray-50" /></div><button onClick={handleChangePassword} disabled={isSubmitting} className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold mt-2">パスワードを更新する</button></div></div>)}

      {staffToDelete && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl p-6 w-full max-w-sm"><h3 className="font-bold text-lg mb-2 text-red-600">スタッフの削除</h3><p className="text-sm text-gray-600 mb-6">本当に <strong>{staffToDelete.name}</strong> さんを削除しますか？<br/>※過去に提出されたシフトデータもすべて削除されます。</p><div className="flex gap-3"><button onClick={() => setStaffToDelete(null)} className="flex-1 bg-gray-200 py-2 rounded-lg font-bold text-gray-700">キャンセル</button><button onClick={confirmDeleteStaff} disabled={isSubmitting} className="flex-1 bg-red-600 py-2 rounded-lg font-bold text-white">削除する</button></div></div></div>)}
    </div>
  );
}