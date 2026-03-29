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

  // データ取得
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: staffData } = await supabase.from('staff').select('name').order('name');
      if (staffData) setStaffList(staffData);
      const { data: holidayData } = await supabase.from('holidays').select('date');
      if (holidayData) setHolidays(holidayData.map(row => row.date));
    };
    fetchInitialData();
    const savedName = localStorage.getItem("shiftApp_staffName");
    if (savedName) setStaffName(savedName);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // シフト情報の取得
  useEffect(() => {
    const fetchExistingShifts = async () => {
      if (!staffName || isNewStaff) { setShifts({}); return; }
      const { data: staffData } = await supabase.from('staff').select('id').eq('name', staffName).single();
      if (!staffData) return;
      const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const { data: existingShifts } = await supabase
        .from('shifts').select('date, is_day, is_night')
        .eq('staff_id', staffData.id).gte('date', startOfMonth).lte('date', endOfMonth);
      if (existingShifts) {
        const newShifts: Record<string, { day: boolean; night: boolean }> = {};
        existingShifts.forEach(s => { newShifts[s.date] = { day: s.is_day, night: s.is_night }; });
        setShifts(newShifts);
      }
    };
    fetchExistingShifts();
  }, [staffName, currentDate, isNewStaff, year, month, daysInMonth]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === "NEW_STAFF") { setIsNewStaff(true); setStaffName(""); }
    else { setIsNewStaff(false); setStaffName(selected); localStorage.setItem("shiftApp_staffName", selected); }
  };

  const toggleShift = useCallback((dateStr: string, time: 'day' | 'night') => {
    setShifts((prev) => {
      const current = prev[dateStr] || { day: false, night: false };
      return { ...prev, [dateStr]: { ...current, [time]: !current[time] } };
    });
  }, []);

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  const handleSubmit = async () => {
    if (!staffName.trim()) { alert("名前を選択してください！"); return; }
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
        staff_id: currentStaffId, date, is_day: times.day, is_night: times.night
      }));
      if (shiftRecords.length > 0) {
        const { error } = await supabase.from('shifts').upsert(shiftRecords, { onConflict: 'staff_id, date' });
        if (error) throw error;
      }
      alert("シフトの提出・更新が完了しました！");
      if (isNewStaff) {
        const { data } = await supabase.from('staff').select('name').order('name');
        if (data) setStaffList(data);
        setIsNewStaff(false);
      }
    } catch (error) { console.error(error); alert("エラーが発生しました。"); } finally { setIsSubmitting(false); }
  };

  const days = [];
  // 空白マス
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="border-r border-b bg-gray-50/30 h-32"></div>);
  }
  // 日付マス
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayShift = shifts[dateStr]?.day || false;
    const nightShift = shifts[dateStr]?.night || false;
    const isHoliday = holidays.includes(dateStr);
    days.push(
      <div key={i} className={`border-r border-b flex flex-col items-center h-32 overflow-hidden ${isHoliday ? 'bg-red-50' : 'bg-white'}`}>
        <span className={`font-bold text-sm my-1 ${isHoliday ? 'text-red-600' : ''}`}>{i}</span>
        {isHoliday ? (
          <div className="flex-1 flex items-center justify-center w-full px-1">
            <span className="text-red-400 font-bold text-[10px] sm:text-xs text-center truncate">定休日</span>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-1 px-1 pb-2">
            <button onPointerDown={(e) => { e.preventDefault(); toggleShift(dateStr, 'day'); }} className={`w-full text-[11px] h-9 rounded-md flex justify-center items-center select-none touch-none ${dayShift ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>昼:{dayShift ? '◯' : '×'}</button>
            <button onPointerDown={(e) => { e.preventDefault(); toggleShift(dateStr, 'night'); }} className={`w-full text-[11px] h-9 rounded-md flex justify-center items-center select-none touch-none ${nightShift ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>夜:{nightShift ? '◯' : '×'}</button>
          </div>
        )}
      </div>
    );
  }

  return (
    /* ★ 修正1：w-full を追加して、中身に関わらず親要素が最大幅まで広がるように固定 */
    <div className="w-full max-w-md mx-auto p-4 font-sans text-gray-800 pb-20 select-none">
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
            <input type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)} className="flex-1 border-2 border-gray-300 p-2 rounded-lg" placeholder="名前を入力" />
            <button onClick={() => setIsNewStaff(false)} className="bg-gray-200 px-3 rounded-lg text-sm font-bold">戻る</button>
          </div>
        )}
      </div>

      <div className="bg-white shadow-sm border-t border-l border-gray-200">
        <div className="flex justify-between items-center p-4 border-b border-r border-gray-200 bg-gray-50/30">
          <button onClick={prevMonth} className="p-2 bg-white border rounded-full shadow-sm text-xs">◀</button>
          <h2 className="text-lg font-bold">{year}年 {month + 1}月</h2>
          <button onClick={nextMonth} className="p-2 bg-white border rounded-full shadow-sm text-xs">▶</button>
        </div>
        
        {/* ★ 修正2：grid-cols-7 ではなく style で minmax(0, 1fr) を指定して幅を強制固定 */}
        <div className="grid w-full" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {['日','月','火','水','木','金','土'].map((d, i) => (
            <div key={d} className={`text-center font-bold text-xs py-2 border-r border-b ${i===0?'text-red-500':i===6?'text-blue-500':''}`}>{d}</div>
          ))}
          {days}
        </div>
      </div>

      <button onClick={handleSubmit} disabled={isSubmitting} className={`mt-8 w-full py-4 rounded-xl font-bold shadow-lg text-white text-lg active:opacity-80 ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600'}`}>{isSubmitting ? '送信中...' : 'シフトを提出・更新する'}</button>
      <div className="mt-8 text-center"><a href="/list" className="text-blue-600 font-bold border-b border-blue-600 pb-0.5">全員のシフトを見る →</a></div>
    </div>
  );
}