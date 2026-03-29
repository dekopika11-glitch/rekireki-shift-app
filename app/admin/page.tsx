"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabaseの接続準備
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AdminPage() {
  // ログイン用の状態
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // カレンダー・定休日用の状態
  const [currentDate, setCurrentDate] = useState(new Date());
  const [holidays, setHolidays] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // パスワード確認処理（今回はシンプルに 1234 で固定）
  const handleLogin = () => {
    if (password === "1234") {
      setIsAuthenticated(true);
    } else {
      alert("パスワードが違います！");
    }
  };

  // データベースから定休日を読み込む処理
  const fetchHolidays = async () => {
    const { data, error } = await supabase.from('holidays').select('date');
    if (data) {
      setHolidays(data.map(row => row.date));
    } else if (error) {
      console.error(error);
    }
  };

  // ログイン成功時にデータを読み込む
  useEffect(() => {
    if (isAuthenticated) fetchHolidays();
  }, [isAuthenticated]);

  // カレンダーの月移動
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  // カレンダーの計算
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // 定休日の「休」を切り替える処理
  const toggleHoliday = (dateStr: string) => {
    setHolidays(prev => 
      prev.includes(dateStr) 
        ? prev.filter(d => d !== dateStr) // すでに休みなら解除
        : [...prev, dateStr]              // 休みじゃなければ追加
    );
  };

  // データベースに定休日を保存する処理
  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // 1. いったん、表示している月の定休日データをすべてリセットする
      const monthStr = String(month + 1).padStart(2, '0');
      const startStr = `${year}-${monthStr}-01`;
      const endStr = `${year}-${monthStr}-${daysInMonth}`;
      
      await supabase.from('holidays').delete().gte('date', startStr).lte('date', endStr);

      // 2. 現在「休」になっている日付だけを保存し直す
      const currentMonthHolidays = holidays.filter(d => d.startsWith(`${year}-${monthStr}`));
      
      if (currentMonthHolidays.length > 0) {
        const recordsToInsert = currentMonthHolidays.map(d => ({ date: d }));
        const { error } = await supabase.from('holidays').insert(recordsToInsert);
        if (error) throw error;
      }

      alert("定休日の設定を保存しました！");
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- ログイン前の画面 ---
  if (!isAuthenticated) {
    return (
      <div className="max-w-sm mx-auto p-8 mt-20 bg-white rounded shadow text-center">
        <h1 className="text-xl font-bold mb-4">店長ログイン</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワードを入力 (1234)"
          className="w-full border-2 border-gray-300 p-2 rounded mb-4 text-center"
        />
        <button onClick={handleLogin} className="w-full bg-gray-800 text-white font-bold py-2 rounded">
          ログイン
        </button>
      </div>
    );
  }

  // --- ログイン後の画面（カレンダー） ---
  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="p-1 border bg-gray-50"></div>);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const isHoliday = holidays.includes(dateStr);

    // ★修正：マスのパディングを p-1.5 に増やし、justify-centerを外しました
    days.push(
      <div key={i} className={`p-1.5 border flex flex-col items-center h-24 ${isHoliday ? 'bg-red-50' : 'bg-white'}`}>
        {/* 日付下の余白を mb-1 に縮小 */}
        <span className={`font-bold text-sm mb-1 shrink-0 ${isHoliday ? 'text-red-500' : ''}`}>{i}</span>
        
        {/* ボタンが上下の中央に来るようにラッパーを追加 */}
        <div className="flex-1 flex items-center justify-center w-full">
          <button
            onClick={() => toggleHoliday(dateStr)}
            // ★修正：文字サイズを小さく（text-xs）、上下余白を詰めた（py-1.5）
            className={`w-full py-1.5 rounded font-bold text-xs transition-colors ${isHoliday ? 'bg-red-500 text-white shadow-inner' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
          >
            {isHoliday ? '休業日' : '営業日'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 font-sans text-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">店長メニュー（定休日設定）</h1>
        <a href="/" className="text-blue-500 hover:underline text-sm font-bold bg-blue-50 px-3 py-1 rounded">
          ← 入力画面へ
        </a>
      </div>

      <div className="bg-white rounded shadow p-2">
        <div className="flex justify-between items-center mb-4">
          <button onClick={prevMonth} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">先月</button>
          <h2 className="text-xl font-bold">{year}年 {month + 1}月</h2>
          <button onClick={nextMonth} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">翌月</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center font-bold text-sm mb-1">
          <div className="text-red-500">日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div className="text-blue-500">土</div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSubmitting}
        className={`mt-8 w-full py-3 rounded-lg font-bold shadow-lg text-white transition-colors
          ${isSubmitting ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'}`}
      >
        {isSubmitting ? '保存中...' : '定休日を保存する'}
      </button>
    </div>
  );
}