"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AdminPage() {
  // 状態管理
  const [passwordInput, setPasswordInput] = useState("");
  const [storedPassword, setStoredPassword] = useState(""); // DBから取得したパスワード
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // パスワード変更用の状態
  const [showPwForm, setShowPwForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // カレンダー・定休日用の状態
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. 起動時にDBから現在のパスワードを取得
  useEffect(() => {
    const getPassword = async () => {
      const { data } = await supabase.from('config').select('value').eq('key', 'admin_password').single();
      if (data) setStoredPassword(data.value);
    };
    getPassword();
  }, []);

  // ログイン処理
  const handleLogin = () => {
    if (passwordInput === storedPassword) {
      setIsAuthenticated(true);
    } else {
      alert("パスワードが違います！");
    }
  };

  // パスワード変更実行
  const handleChangePassword = async () => {
    if (currentPw !== storedPassword) {
      alert("現在のパスワードが正しくありません。");
      return;
    }
    if (newPw !== confirmPw) {
      alert("新しいパスワードと確認用パスワードが一致しません。");
      return;
    }
    if (newPw.length < 4) {
      alert("パスワードは4文字以上で設定してください。");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('config')
        .update({ value: newPw })
        .eq('key', 'admin_password');

      if (error) throw error;

      setStoredPassword(newPw);
      alert("パスワードを変更しました。次回から新しいパスワードを使用してください。");
      setShowPwForm(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (error) {
      console.error(error);
      alert("パスワードの変更に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 定休日データの取得
  const fetchHolidays = async () => {
    const { data } = await supabase.from('holidays').select('date');
    if (data) setHolidays(data.map(row => row.date));
  };

  useEffect(() => {
    if (isAuthenticated) fetchHolidays();
  }, [isAuthenticated]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = new Date(year, month, 1).getDay();

  const toggleHoliday = (dateStr: string) => {
    setHolidays(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const monthStr = String(month + 1).padStart(2, '0');
      const startStr = `${year}-${monthStr}-01`;
      const endStr = `${year}-${monthStr}-${daysInMonth}`;
      await supabase.from('holidays').delete().gte('date', startStr).lte('date', endStr);
      const currentMonthHolidays = holidays.filter(d => d.startsWith(`${year}-${monthStr}`));
      if (currentMonthHolidays.length > 0) {
        await supabase.from('holidays').insert(currentMonthHolidays.map(d => ({ date: d })));
      }
      alert("保存しました！");
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- ログイン画面 ---
  if (!isAuthenticated) {
    return (
      <div className="max-w-sm mx-auto p-8 mt-20 bg-white rounded shadow text-center">
        <h1 className="text-xl font-bold mb-4">管理者ログイン</h1>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          placeholder="パスワードを入力"
          className="w-full border-2 border-gray-300 p-2 rounded mb-4 text-center"
        />
        <button onClick={handleLogin} className="w-full bg-gray-800 text-white font-bold py-2 rounded">
          ログイン
        </button>
      </div>
    );
  }

  // カレンダー構築
  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(<div key={`empty-${i}`} className="p-1 border bg-gray-50"></div>);
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const isHoliday = holidays.includes(dateStr);
    days.push(
      <div key={i} className={`p-1.5 border flex flex-col items-center h-24 ${isHoliday ? 'bg-red-50' : 'bg-white'}`}>
        <span className={`font-bold text-sm mb-1 shrink-0 ${isHoliday ? 'text-red-500' : ''}`}>{i}</span>
        <div className="flex-1 flex items-center justify-center w-full">
          <button onClick={() => toggleHoliday(dateStr)} className={`w-full py-1.5 rounded font-bold text-xs ${isHoliday ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
            {isHoliday ? '休業日' : '営業日'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 font-sans text-gray-800 pb-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">管理者メニュー</h1>
        <a href="/" className="text-blue-500 hover:underline text-sm font-bold bg-blue-50 px-3 py-1 rounded">← 戻る</a>
      </div>

      {/* 定休日設定カレンダー */}
      <div className="bg-white rounded shadow p-2 mb-8">
        <div className="flex justify-between items-center mb-4">
          <button onClick={prevMonth} className="px-3 py-1 bg-gray-200 rounded">先月</button>
          <h2 className="text-xl font-bold">{year}年 {month + 1}月</h2>
          <button onClick={nextMonth} className="px-3 py-1 bg-gray-200 rounded">翌月</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-sm mb-1">
          <div className="text-red-500">日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div className="text-blue-500">土</div>
        </div>
        <div className="grid grid-cols-7 gap-1">{days}</div>
        <button onClick={handleSave} disabled={isSubmitting} className={`mt-4 w-full py-3 rounded-lg font-bold text-white ${isSubmitting ? 'bg-gray-400' : 'bg-red-500'}`}>
          {isSubmitting ? '保存中...' : '定休日を保存する'}
        </button>
      </div>

      <hr className="my-8" />

      {/* パスワード変更セクション */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <button 
          onClick={() => setShowPwForm(!showPwForm)}
          className="text-gray-600 font-bold text-sm flex items-center gap-1"
        >
          {showPwForm ? '▼ パスワード変更を閉じる' : '▶ パスワードを変更する'}
        </button>

        {showPwForm && (
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">現在のパスワード</label>
              <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="w-full border p-2 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">新しいパスワード</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="w-full border p-2 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">新しいパスワード（確認）</label>
              <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="w-full border p-2 rounded text-sm" />
            </div>
            <button 
              onClick={handleChangePassword}
              disabled={isSubmitting}
              className="w-full bg-gray-700 text-white py-2 rounded font-bold text-sm active:bg-black"
            >
              パスワードを更新する
            </button>
          </div>
        )}
      </div>
    </div>
  );
}