"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// 選択されたシフトに応じて時間オプションを生成
const getAvailableTimeOptions = (isDay: boolean, isNight: boolean) => {
  const options = [];
  for (let i = 0; i < 24; i++) {
    const hour = String(i).padStart(2, '0');
    options.push(`${hour}:00`);
    options.push(`${hour}:30`);
  }
  return options.filter(time => {
    const [h, m] = time.split(':').map(Number);
    const minutes = h * 60 + m;
    const isDayTime = minutes >= 10 * 60 && minutes <= 15 * 60;  
    const isNightTime = minutes >= 17 * 60 && minutes <= 22 * 60; 
    
    if (isDay && isNight) return isDayTime || isNightTime;
    if (isDay) return isDayTime;
    if (isNight) return isNightTime;
    return false;
  });
};

const getEffectiveHolidays = (y: number, m: number, dbHols: string[]) => {
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
  const monthHols = dbHols.filter(d => d.startsWith(prefix));
  if (monthHols.length === 0) {
    const defaults = [];
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 1; i <= days; i++) {
      const d = new Date(y, m, i);
      if (d.getDay() === 1 || d.getDay() === 2) defaults.push(`${prefix}-${String(i).padStart(2, '0')}`);
    }
    return defaults;
  }
  return monthHols;
};

type ShiftState = {
  day: boolean;
  night: boolean;
  startTime?: string | null;
  endTime?: string | null;
};

export default function Home() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [staffName, setStaffName] = useState("");
  const [shifts, setShifts] = useState<Record<string, ShiftState>>({});
  const [monthlyRemark, setMonthlyRemark] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffList, setStaffList] = useState<{name: string}[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  
  const [timeModalDate, setTimeModalDate] = useState<string | null>(null);
  const [tempStartTime, setTempStartTime] = useState("");
  const [tempEndTime, setTempEndTime] = useState("");

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: staffData } = await (supabase.from('staff') as any).select('name').order('created_at');
      if (staffData) setStaffList(staffData as any[]); 
      const { data: holidayData } = await (supabase.from('holidays') as any).select('date');
      if (holidayData) setHolidays(holidayData.map((row: any) => row.date));
    };
    fetchInitialData();
    const savedName = localStorage.getItem("shiftApp_staffName");
    if (savedName) setStaffName(savedName);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = new Date(year, month, 1).getDay();
  const currentEffectiveHolidays = getEffectiveHolidays(year, month, holidays);

  useEffect(() => {
    const fetchExistingShifts = async () => {
      if (!staffName) { setShifts({}); setMonthlyRemark(""); return; }
      const { data: staffData } = await (supabase.from('staff') as any).select('id').eq('name', staffName).single();
      if (!staffData) return;
      const staffId = (staffData as any).id; 
      const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const { data: existingShifts } = await (supabase.from('shifts') as any).select('*').eq('staff_id', staffId).gte('date', startOfMonth).lte('date', endOfMonth);
      if (existingShifts) {
        const newShifts: Record<string, ShiftState> = {};
        (existingShifts as any[]).forEach(s => { 
          newShifts[s.date] = { day: s.is_day, night: s.is_night, startTime: s.start_time, endTime: s.end_time }; 
        });
        setShifts(newShifts);
      }
      const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
      const { data: remarkData } = await (supabase.from('monthly_remarks') as any).select('remark').eq('staff_id', staffId).eq('year_month', ym).maybeSingle();
      setMonthlyRemark(remarkData ? (remarkData as any).remark : "");
    };
    fetchExistingShifts();
  }, [staffName, currentDate, year, month, daysInMonth]);

  const toggleShift = useCallback((dateStr: string, time: 'day' | 'night') => {
    setShifts((prev) => {
      const current = prev[dateStr] || { day: false, night: false };
      const nextState = { ...current, [time]: !current[time] };
      if (!nextState.day && !nextState.night) {
        nextState.startTime = null;
        nextState.endTime = null;
      }
      return { ...prev, [dateStr]: nextState };
    });
  }, []);

  const openTimeModal = (dateStr: string) => {
    const current = shifts[dateStr];
    if (!current?.day && !current?.night) return; 
    setTempStartTime(current?.startTime || "");
    setTempEndTime(current?.endTime || "");
    setTimeModalDate(dateStr);
  };

  const saveTime = () => {
    if (timeModalDate) {
      setShifts(prev => ({ ...prev, [timeModalDate]: { ...(prev[timeModalDate] || { day: false, night: false }), startTime: tempStartTime || null, endTime: tempEndTime || null } }));
      setTimeModalDate(null);
    }
  };

  const clearTime = () => {
    if (timeModalDate) {
      setShifts(prev => ({ ...prev, [timeModalDate]: { ...(prev[timeModalDate] || { day: false, night: false }), startTime: null, endTime: null } }));
      setTimeModalDate(null);
    }
  };

  const handleSubmit = async () => {
    if (!staffName.trim()) { alert("名前を選択してください！"); return; }
    setIsSubmitting(true);
    try {
      const { data: staffData } = await (supabase.from('staff') as any).select('id').eq('name', staffName).single();
      const currentStaffId = (staffData as any)?.id; 
      const shiftRecordsToSubmit = Object.entries(shifts).filter(([dateStr]) => !currentEffectiveHolidays.includes(dateStr));
      const shiftRecords = shiftRecordsToSubmit.map(([date, times]) => ({
        staff_id: currentStaffId, date, is_day: times.day, is_night: times.night, start_time: times.startTime || null, end_time: times.endTime || null
      }));
      if (shiftRecords.length > 0) {
        await (supabase.from('shifts') as any).upsert(shiftRecords, { onConflict: 'staff_id, date' });
      }
      const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
      await (supabase.from('monthly_remarks') as any).delete().eq('staff_id', currentStaffId).eq('year_month', ym);
      if (monthlyRemark.trim()) {
        await (supabase.from('monthly_remarks') as any).insert([{ staff_id: currentStaffId, year_month: ym, remark: monthlyRemark.trim() }]);
      }
      alert("提出完了！");
    } catch (e) { alert("エラーが発生しました。"); } finally { setIsSubmitting(false); }
  };

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="border-r border-b bg-gray-50/30 h-36"></div>);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const shiftData = shifts[dateStr];
    const hasTime = !!(shiftData?.startTime || shiftData?.endTime); 
    const isDayOrNightSelected = !!(shiftData?.day || shiftData?.night);
    const isHoliday = currentEffectiveHolidays.includes(dateStr); 
    
    days.push(
      <div key={i} className={`border-r border-b flex flex-col items-center h-36 overflow-hidden ${isHoliday ? 'bg-red-50' : 'bg-white'}`}>
        <span className={`font-bold text-sm my-1 ${isHoliday ? 'text-red-600' : ''}`}>{i}</span>
        {/* ★ここを修正: 定休日の場合は「定休日」と表示し、そうでない場合は入力ボタンを表示 */}
        {isHoliday ? (
          <div className="flex-1 flex items-center justify-center w-full px-1">
            <span className="text-red-400 font-bold text-[10px] sm:text-xs text-center truncate">定休日</span>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-1 px-1 pb-1">
            <button onClick={() => toggleShift(dateStr, 'day')} className={`w-full text-[10px] h-7 rounded-md ${shiftData?.day ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>昼:{shiftData?.day ? '◯' : '×'}</button>
            <button onClick={() => toggleShift(dateStr, 'night')} className={`w-full text-[10px] h-7 rounded-md ${shiftData?.night ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>夜:{shiftData?.night ? '◯' : '×'}</button>
            <button 
              onClick={() => openTimeModal(dateStr)} 
              disabled={!isDayOrNightSelected}
              className={`w-full text-[9px] h-7 rounded-md transition-all ${!isDayOrNightSelected ? 'bg-gray-50 text-gray-300 cursor-not-allowed opacity-50' : (hasTime ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500')}`}
            >
              {hasTime ? (shiftData.startTime && shiftData.endTime ? `${shiftData.startTime}-${shiftData.endTime}` : shiftData.startTime ? `${shiftData.startTime}-` : `-${shiftData.endTime}`) : '時間指定'}
            </button>
          </div>
        )}
      </div>
    );
  }

  const activeTimeOptions = timeModalDate ? getAvailableTimeOptions(shifts[timeModalDate]?.day || false, shifts[timeModalDate]?.night || false) : [];

  return (
    <div className="w-full max-w-md mx-auto p-4 font-sans text-gray-800 pb-20 select-none">
      <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">シフト入力</h1><a href="/admin" className="text-gray-400 text-xs">⚙️設定</a></div>
      <select value={staffName} onChange={(e) => {setStaffName(e.target.value); localStorage.setItem("shiftApp_staffName", e.target.value);}} className="w-full border-2 p-3 rounded-lg mb-6 bg-white"><option value="">名前を選択</option>{staffList.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}</select>
      <div className="bg-white shadow-sm border-t border-l">
        <div className="flex justify-between items-center p-4 border-b border-r bg-gray-50/30">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>◀</button><h2 className="font-bold">{year}年 {month + 1}月</h2><button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>▶</button>
        </div>
        <div className="grid grid-cols-7 text-center font-bold text-xs py-2 bg-gray-50 border-r border-b"><div>日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div>土</div></div>
        <div className="grid grid-cols-7">{days}</div>
      </div>
      <textarea value={monthlyRemark} onChange={(e) => setMonthlyRemark(e.target.value)} className="w-full border-2 p-3 rounded-lg mt-6" placeholder="備考" rows={3} />
      <button onClick={handleSubmit} disabled={isSubmitting} className={`mt-6 w-full py-4 rounded-xl font-bold text-white shadow-lg ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600'}`}>送信する</button>
      <div className="mt-8 text-center"><a href="/list" className="text-blue-600 font-bold border-b border-blue-600">全員のシフトを見る →</a></div>
      
      {timeModalDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm">
            <h3 className="font-bold mb-4 text-center">{timeModalDate.split('-')[1]}月{timeModalDate.split('-')[2]}日の時間指定</h3>
            <div className="flex gap-2 mb-6 justify-center text-lg">
              <select value={tempStartTime} onChange={e => setTempStartTime(e.target.value)} className="border-2 border-gray-300 p-2 rounded-lg bg-white">
                <option value="">指定なし</option>
                {activeTimeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="font-bold text-gray-500 mt-2">〜</span>
              <select value={tempEndTime} onChange={e => setTempEndTime(e.target.value)} className="border-2 border-gray-300 p-2 rounded-lg bg-white">
                <option value="">指定なし</option>
                {activeTimeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={clearTime} className="bg-red-100 text-red-600 font-bold p-3 rounded-xl flex-1 text-sm">クリア</button>
              <button onClick={() => setTimeModalDate(null)} className="bg-gray-200 text-gray-700 font-bold p-3 rounded-xl flex-1 text-sm">閉じる</button>
              <button onClick={saveTime} className="bg-green-600 text-white font-bold p-3 rounded-xl flex-1 text-sm">決定</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}