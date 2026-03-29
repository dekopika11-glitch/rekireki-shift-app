"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

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

  // ★ 改善1：関数型アップデート (prev) => ... で計算の追い越しを完全に防ぐ
  const toggleShift = useCallback((dateStr: string, time: 'day' | 'night') => {
    setShifts((prev) => {
      const current = prev[dateStr] || { day: false, night: false };
      return {
        ...prev,
        [dateStr]: {
          ...current,
          [time]: !current[time]
        }
      };
    });
  }, []);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const handleSubmit = async () => {
    if (!staffName.trim()) {
      alert("名前を選択してください！");
      return;
    }
    setIsSubmitting(true);
    try {
      let { data: staffData } = await supabase.from('staff').select('id').eq('name', staffName).single();
      let currentStaffId = staffData?.id;
      if (!currentStaffId) {
        const { data: newStaff } = await supabase.from('staff').insert([{ name: staffName }]).select().single();
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
        const { error } = await supabase.from('shifts').upsert(shiftRecords, { onConflict: 'staff_id, date' });
        if (error) throw error;
      }
      alert("シフトの提出が完了しました！");
      if (isNewStaff) {
        const { data } = await supabase.from('staff').select('name').order('name');
        if (data) setStaffList(data);
        setIsNewStaff(false);
      }
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました。");
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
      <div key={i} className={`p-1 border flex flex-col items-center h-28 min-w-0 ${isHoliday ? 'bg-red-50' : 'bg-white'}`}>
        <span className={`font-bold text-sm mb-1 ${isHoliday ? 'text-red-500' : ''}`}>{i}</span>
        
        {isHoliday ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-red-400 font-bold text-[10px]">定休日</span>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-1.5 flex-1 justify-center">
            {/* ★ 改善2：onPointerDown で指が触れた瞬間に反応させる
                ★ 改善3：e.preventDefault() で「余韻」によるゴーストクリックを遮断
            */}
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                toggleShift(dateStr, 'day');
              }}
              className={`w-full text-[10px] h-8 rounded flex justify-center items-center select-none touch-none
                ${dayShift ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              昼:{dayShift ? '◯' : '×'}
            </button>
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                toggleShift(dateStr, 'night');
              }}
              className={`w-full text-[10px] h-8 rounded flex justify-center items-center select-none touch-none
                ${nightShift ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              夜:{nightShift ? '◯' : '×'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 font-sans text-gray-800 pb-20 select-none">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">シフト入力</h1>
        <a href="/admin" className="text-gray-400 hover:text-gray-600 text-xs">⚙️設定</a>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold mb-2">名前</label>
        {!isNewStaff && staffList.length > 0 ? (
          <select value={staffName} onChange={handleSelectChange} className="w-full border-2 border-gray-300 p-3 rounded-lg bg-white text-base">
            <option value="">名前を選択</option>
            {staffList.map((staff, idx) => <option key={idx} value={staff.name}>{staff.name}</option>)}
            <option value="NEW_STAFF">＋ 新しい名前を追加...</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input type="text" value={staffName} onChange={handleNameChange} className="flex-1 border-2 border-gray-300 p-2 rounded-lg" placeholder="名前を入力" />
            <button onClick={() => setIsNewStaff(false)} className="bg-gray-200 px-3 rounded-lg text-sm font-bold">戻る</button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        <div className="flex justify-between items-center mb-4 px-2">
          <button onClick={prevMonth} className="p-2 bg-gray-100 rounded-full">◀</button>
          <h2 className="text-lg font-bold">{year}年 {month + 1}月</h2>
          <button onClick={nextMonth} className="p-2 bg-gray-100 rounded-full">▶</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs mb-2">
          <div className="text-red-500">日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div className="text-blue-500">土</div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days}
        </div>
      </div>

      <button
        onPointerDown={(e) => { e.preventDefault(); handleSubmit(); }}
        disabled={isSubmitting}
        className={`mt-8 w-full py-4 rounded-xl font-bold shadow-lg text-white text-lg active:opacity-80
          ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600'}`}
      >
        {isSubmitting ? '送信中...' : 'シフトを提出する'}
      </button>

      <div className="mt-8 text-center">
        <a href="/list" className="text-blue-600 font-bold border-b border-blue-600 pb-0.5">全員のシフトを見る →</a>
      </div>
    </div>
  );
}