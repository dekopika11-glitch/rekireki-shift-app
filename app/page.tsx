"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabaseの接続準備
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [staffName, setStaffName] = useState("");
  const [shifts, setShifts] = useState<Record<string, { day: boolean; night: boolean }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [staffList, setStaffList] = useState<{name: string}[]>([]);
  const [isNewStaff, setIsNewStaff] = useState(false);
  
  const [holidays, setHolidays] = useState<string[]>([]);

  useEffect(() => {
    const fetchStaffList = async () => {
      const { data } = await supabase.from('staff').select('name').order('name');
      if (data) {
        setStaffList(data);
        if (data.length === 0) setIsNewStaff(true);
      }
    };
    const fetchHolidays = async () => {
      const { data } = await supabase.from('holidays').select('date');
      if (data) {
        setHolidays(data.map(row => row.date));
      }
    };

    fetchStaffList();
    fetchHolidays();

    const savedName = localStorage.getItem("shiftApp_staffName");
    if (savedName) setStaffName(savedName);
  }, []);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === "NEW_STAFF") {
      setIsNewStaff(true);
      setStaffName("");
    } else {
      setStaffName(selected);
      localStorage.setItem("shiftApp_staffName", selected);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setStaffName(newName);
    localStorage.setItem("shiftApp_staffName", newName);
  };

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const toggleShift = (dateStr: string, time: 'day' | 'night') => {
    setShifts((prev) => {
      const currentShift = prev[dateStr] || { day: false, night: false };
      return { ...prev, [dateStr]: { ...currentShift, [time]: !currentShift[time] } };
    });
  };

  const handleSubmit = async () => {
    if (!staffName.trim()) {
      alert("名前を選択（または入力）してください！");
      return;
    }

    setIsSubmitting(true);

    try {
      let { data: staffData } = await supabase
        .from('staff')
        .select('id')
        .eq('name', staffName)
        .single();

      let currentStaffId = staffData?.id;

      if (!currentStaffId) {
        const { data: newStaff, error: insertError } = await supabase
          .from('staff')
          .insert([{ name: staffName }])
          .select()
          .single();

        if (insertError) throw new Error("スタッフ登録エラー");
        currentStaffId = newStaff.id;
      }

      const shiftRecordsToSubmit = Object.entries(shifts).filter(([date]) => !holidays.includes(date));
      
      const shiftRecords = shiftRecordsToSubmit.map(([date, times]) => ({
        staff_id: currentStaffId,
        date: date,
        is_day: times.day,
        is_night: times.night
      }));

      if (shiftRecords.length > 0) {
        const { error: shiftError } = await supabase
          .from('shifts')
          .upsert(shiftRecords, { onConflict: 'staff_id, date' });

        if (shiftError) throw shiftError;
      }

      alert("シフトの提出が完了しました！");
      
      if (isNewStaff) {
        setStaffList(prev => [...prev, { name: staffName }].sort((a, b) => a.name.localeCompare(b.name)));
        setIsNewStaff(false);
      }

    } catch (error) {
      console.error(error);
      alert("エラーが発生しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="p-1 border bg-gray-50"></div>);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayShift = shifts[dateStr]?.day || false;
    const nightShift = shifts[dateStr]?.night || false;
    
    const isHoliday = holidays.includes(dateStr);

    days.push(
      <div key={i} className={`p-1 border flex flex-col items-center h-24 min-w-0 ${isHoliday ? 'bg-red-50' : ''}`}>
        <span className={`font-bold text-sm ${isHoliday ? 'text-red-500' : ''}`}>{i}</span>
        
        {isHoliday ? (
          <div className="flex-1 flex items-center justify-center w-full">
            <span className="text-red-400 font-bold text-sm">定休日</span>
          </div>
        ) : (
          <>
            {/* ★修正：エラーの原因だった不要な行（onClick={() => toggleHoliday...}）を削除しました！ */}
            <button
              onClick={() => toggleShift(dateStr, 'day')}
              className={`mt-1 w-full text-xs py-1 rounded flex justify-center items-center ${dayShift ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-500'}`}
            >
              <span className="w-6 text-right">昼:</span>
              <span className="w-4 text-center">{dayShift ? '◯' : '×'}</span>
            </button>
            <button
              onClick={() => toggleShift(dateStr, 'night')}
              className={`mt-1 w-full text-xs py-1 rounded flex justify-center items-center ${nightShift ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-200 text-gray-500'}`}
            >
              <span className="w-6 text-right">夜:</span>
              <span className="w-4 text-center">{nightShift ? '◯' : '×'}</span>
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 font-sans text-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">シフト入力</h1>
        <a href="/admin" className="text-gray-400 hover:text-gray-600 text-xs">⚙️設定</a>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold mb-2">名前</label>
        
        {!isNewStaff && staffList.length > 0 ? (
          <select
            value={staffName}
            onChange={handleSelectChange}
            className="w-full border-2 border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 bg-white"
          >
            <option value="">名前を選んでください</option>
            {staffList.map((staff, idx) => (
              <option key={idx} value={staff.name}>{staff.name}</option>
            ))}
            <option value="NEW_STAFF">＋ 新しい名前を追加する...</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={staffName}
              onChange={handleNameChange}
              className="flex-1 border-2 border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500"
              placeholder="例: 山田 太郎"
            />
            {staffList.length > 0 && (
              <button 
                onClick={() => {
                  setIsNewStaff(false);
                  setStaffName(staffList[0]?.name || "");
                }}
                className="bg-gray-200 px-3 rounded hover:bg-gray-300 text-sm font-bold whitespace-nowrap"
              >
                選択に戻る
              </button>
            )}
          </div>
        )}
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
        onClick={handleSubmit}
        disabled={isSubmitting}
        className={`mt-8 w-full py-3 rounded-lg font-bold shadow-lg text-white transition-colors
          ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
      >
        {isSubmitting ? '送信中...' : 'シフトを提出する'}
      </button>

      <div className="mt-6 text-center flex flex-col gap-2">
        <a href="/list" className="text-blue-500 hover:underline text-sm font-bold">シフト一覧画面を見る →</a>
      </div>
    </div>
  );
}