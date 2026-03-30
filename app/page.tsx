"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

const generateTimeOptions = () => {
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
    return isDayTime || isNightTime;
  });
};
const timeOptions = generateTimeOptions();

const getEffectiveHolidays = (y: number, m: number, dbHols: string[]) => {
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
  const monthHols = dbHols.filter(d => d.startsWith(prefix));
  if (monthHols.length === 0) {
    const defaults = [];
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 1; i <= days; i++) {
      const d = new Date(y, m, i);
      if (d.getDay() === 1 || d.getDay() === 2) { 
        defaults.push(`${prefix}-${String(i).padStart(2, '0')}`);
      }
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
  const [monthlyRemark, setMonthlyRemark] = useState(""); // ★追加: 月間備考用のステート
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [staffList, setStaffList] = useState<{name: string}[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);

  const [timeModalDate, setTimeModalDate] = useState<string | null>(null);
  const [tempStartTime, setTempStartTime] = useState("10:00");
  const [tempEndTime, setTempEndTime] = useState("15:00");

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: staffData } = await supabase.from('staff').select('name').order('created_at');
      if (staffData) setStaffList(staffData as any[]); 
      
      const { data: holidayData } = await supabase.from('holidays').select('date');
      if (holidayData) setHolidays(holidayData.map((row: any) => row.date));
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
  
  const currentEffectiveHolidays = getEffectiveHolidays(year, month, holidays);

  useEffect(() => {
    const fetchExistingShifts = async () => {
      if (!staffName) { 
        setShifts({}); 
        setMonthlyRemark("");
        return; 
      }
      
      const { data: staffData } = await supabase.from('staff').select('id').eq('name', staffName).single();
      if (!staffData) return;
      
      const staffId = (staffData as any).id; 
      
      // ① シフトデータの取得
      const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      
      const { data: existingShifts } = await supabase
        .from('shifts').select('date, is_day, is_night, start_time, end_time')
        .eq('staff_id', staffId).gte('date', startOfMonth).lte('date', endOfMonth);
        
      if (existingShifts) {
        const newShifts: Record<string, ShiftState> = {};
        (existingShifts as any[]).forEach(s => { 
          newShifts[s.date] = { 
            day: s.is_day, 
            night: s.is_night,
            startTime: s.start_time,
            endTime: s.end_time
          }; 
        });
        setShifts(newShifts);
      }

      // ② 月間備考の取得
      const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
      const { data: remarkData } = await supabase
        .from('monthly_remarks')
        .select('remark')
        .eq('staff_id', staffId)
        .eq('year_month', ym)
        .maybeSingle(); // データがなくてもエラーにしない

      setMonthlyRemark(remarkData ? (remarkData as any).remark : "");
    };
    
    fetchExistingShifts();
  }, [staffName, currentDate, year, month, daysInMonth]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setStaffName(selected); 
    localStorage.setItem("shiftApp_staffName", selected);
  };

  const toggleShift = useCallback((dateStr: string, time: 'day' | 'night') => {
    setShifts((prev) => {
      const current = prev[dateStr] || { day: false, night: false };
      return { ...prev, [dateStr]: { ...current, [time]: !current[time] } };
    });
  }, []);

  const openTimeModal = (dateStr: string) => {
    const current = shifts[dateStr];
    setTempStartTime(current?.startTime || "10:00");
    setTempEndTime(current?.endTime || "15:00");
    setTimeModalDate(dateStr);
  };

  const saveTime = () => {
    if (timeModalDate) {
      setShifts(prev => ({
        ...prev,
        [timeModalDate]: {
          ...(prev[timeModalDate] || { day: false, night: false }),
          startTime: tempStartTime,
          endTime: tempEndTime
        }
      }));
      setTimeModalDate(null);
    }
  };

  const clearTime = () => {
    if (timeModalDate) {
      setShifts(prev => ({
        ...prev,
        [timeModalDate]: {
          ...(prev[timeModalDate] || { day: false, night: false }),
          startTime: null,
          endTime: null
        }
      }));
      setTimeModalDate(null);
    }
  };

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));

  const handleSubmit = async () => {
    if (!staffName.trim()) { alert("名前を選択してください！"); return; }
    setIsSubmitting(true);
    try {
      const { data: staffData } = await supabase.from('staff').select('id').eq('name', staffName).single();
      const currentStaffId = (staffData as any)?.id; 
      
      if (!currentStaffId) {
        throw new Error("スタッフが見つかりません。管理者に連絡してください。");
      }
      
      // ① シフト情報の保存
      const shiftRecordsToSubmit = Object.entries(shifts).filter(([dateStr]) => !currentEffectiveHolidays.includes(dateStr));
      const shiftRecords = shiftRecordsToSubmit.map(([date, times]) => ({
        staff_id: currentStaffId, 
        date, 
        is_day: times.day, 
        is_night: times.night,
        start_time: times.startTime || null,
        end_time: times.endTime || null
      }));
      
      if (shiftRecords.length > 0) {
        // @ts-ignore
        const { error } = await supabase.from('shifts').upsert(shiftRecords, { onConflict: 'staff_id, date' });
        if (error) throw error;
      }

      // ② 月間備考の保存
      const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
      // 一度既存の備考を削除してから追加する（重複エラー回避）
      await supabase.from('monthly_remarks').delete().eq('staff_id', currentStaffId).eq('year_month', ym);
      if (monthlyRemark.trim()) {
        // @ts-ignore
        await supabase.from('monthly_remarks').insert([{
          staff_id: currentStaffId,
          year_month: ym,
          remark: monthlyRemark.trim()
        }]);
      }

      alert("シフトと備考の提出・更新が完了しました！");
    } catch (error) { 
      console.error(error); 
      alert("エラーが発生しました。"); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="border-r border-b bg-gray-50/30 h-36"></div>);
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const shiftData = shifts[dateStr];
    const dayShift = shiftData?.day || false;
    const nightShift = shiftData?.night || false;
    const hasTime = shiftData?.startTime && shiftData?.endTime;
    const isHoliday = currentEffectiveHolidays.includes(dateStr); 
    
    days.push(
      <div key={i} className={`border-r border-b flex flex-col items-center h-36 overflow-hidden ${isHoliday ? 'bg-red-50' : 'bg-white'}`}>
        <span className={`font-bold text-sm my-1 ${isHoliday ? 'text-red-600' : ''}`}>{i}</span>
        {isHoliday ? (
          <div className="flex-1 flex items-center justify-center w-full px-1">
            <span className="text-red-400 font-bold text-[10px] sm:text-xs text-center truncate">定休日</span>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-1 px-1 pb-1">
            <button key={`${dateStr}-day`} type="button" onClick={() => toggleShift(dateStr, 'day')} className={`w-full text-[10px] h-7 rounded-md flex justify-center items-center select-none touch-manipulation active:opacity-70 transition-colors ${dayShift ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>昼:{dayShift ? '◯' : '×'}</button>
            <button key={`${dateStr}-night`} type="button" onClick={() => toggleShift(dateStr, 'night')} className={`w-full text-[10px] h-7 rounded-md flex justify-center items-center select-none touch-manipulation active:opacity-70 transition-colors ${nightShift ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>夜:{nightShift ? '◯' : '×'}</button>
            <button key={`${dateStr}-time`} type="button" onClick={() => openTimeModal(dateStr)} className={`w-full text-[9px] h-7 rounded-md flex justify-center items-center select-none touch-manipulation active:opacity-70 transition-colors ${hasTime ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {hasTime ? `${shiftData.startTime}-${shiftData.endTime}` : '時間指定'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 font-sans text-gray-800 pb-20 select-none">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">シフト入力</h1>
        <a href="/admin" className="text-gray-400 hover:text-gray-600 text-xs">⚙️設定</a>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-bold mb-2">名前</label>
        <select value={staffName} onChange={handleSelectChange} className="w-full border-2 border-gray-300 p-3 rounded-lg bg-white text-base">
          <option value="">名前を選択</option>
          {staffList.map((staff, idx) => <option key={idx} value={staff.name}>{staff.name}</option>)}
        </select>
      </div>

      <div className="bg-white shadow-sm border-t border-l border-gray-200">
        <div className="flex justify-between items-center p-4 border-b border-r border-gray-200 bg-gray-50/30">
          <button onClick={prevMonth} className="p-2 bg-white border rounded-full shadow-sm text-xs">◀</button>
          <h2 className="text-lg font-bold">{year}年 {month + 1}月</h2>
          <button onClick={nextMonth} className="p-2 bg-white border rounded-full shadow-sm text-xs">▶</button>
        </div>
        
        <div className="grid w-full" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {['日','月','火','水','木','金','土'].map((d, i) => (
            <div key={d} className={`text-center font-bold text-xs py-2 border-r border-b ${i===0?'text-red-500':i===6?'text-blue-500':''}`}>{d}</div>
          ))}
          {days}
        </div>
      </div>

      {/* ★追加: 送信ボタン上の備考入力欄 */}
      <div className="mt-8">
        <label className="block text-sm font-bold mb-2 text-gray-700">今月のシフトに関する備考 (任意)</label>
        <textarea
          value={monthlyRemark}
          onChange={(e) => setMonthlyRemark(e.target.value)}
          className="w-full border-2 border-gray-300 p-3 rounded-lg bg-white text-base"
          placeholder="例：テスト期間のため、20日〜25日はお休みをいただきたいです。"
          rows={3}
        />
      </div>

      <button onClick={handleSubmit} disabled={isSubmitting} className={`mt-6 w-full py-4 rounded-xl font-bold shadow-lg text-white text-lg active:opacity-80 ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600'}`}>{isSubmitting ? '送信中...' : 'シフトを提出・更新する'}</button>
      <div className="mt-8 text-center"><a href="/list" className="text-blue-600 font-bold border-b border-blue-600 pb-0.5">全員のシフトを見る →</a></div>

      {timeModalDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-lg mb-4 text-center">
              {timeModalDate.split('-')[1]}月{timeModalDate.split('-')[2]}日の時間指定
            </h3>
            
            <div className="flex items-center gap-2 mb-6 justify-center text-lg">
              <select 
                value={tempStartTime} 
                onChange={e => setTempStartTime(e.target.value)} 
                className="border-2 border-gray-300 p-2 rounded-lg bg-white"
              >
                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="font-bold text-gray-500">〜</span>
              <select 
                value={tempEndTime} 
                onChange={e => setTempEndTime(e.target.value)} 
                className="border-2 border-gray-300 p-2 rounded-lg bg-white"
              >
                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <button onClick={clearTime} className="bg-red-100 text-red-600 font-bold py-3 px-4 rounded-xl text-sm">
                クリア
              </button>
              <button onClick={() => setTimeModalDate(null)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl text-sm">
                キャンセル
              </button>
              <button onClick={saveTime} className="flex-1 bg-green-600 text-white font-bold py-3 px-4 rounded-xl text-sm">
                決定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}