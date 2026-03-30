"use client";
import { useState, useEffect } from "react";
import { supabase } from "../supabase";

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

export default function ShiftList() {
  const [currentDate, setCurrentDate] = useState(new Date());
  type DayShift = { 
    day: string[]; 
    night: string[]; 
    fullDay: string[]; 
    timed: { name: string; range: string }[] 
  };
  const [monthlyShifts, setMonthlyShifts] = useState<Record<string, DayShift>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<{id: string, name: string}[]>([]);
  const [submittedStaffIds, setSubmittedStaffIds] = useState<Set<string>>(new Set());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const { data: allStaff } = await supabase.from('staff').select('id, name').order('created_at');
      if (allStaff) setStaffList(allStaff as any[]);
      
      const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
      
      const { data: shiftData } = await supabase
        .from('shifts')
        .select(`date, is_day, is_night, start_time, end_time, staff_id, staff ( name )`)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth);

      const formattedData: Record<string, DayShift> = {};
      const submittedIds = new Set<string>();

      if (shiftData) {
        shiftData.forEach((row: any) => {
          const dateStr = row.date;
          const staffName = row.staff?.name || "不明";
          submittedIds.add(row.staff_id);

          if (!formattedData[dateStr]) {
            formattedData[dateStr] = { day: [], night: [], fullDay: [], timed: [] };
          }

          if (row.start_time && row.end_time) {
            formattedData[dateStr].timed.push({
              name: staffName,
              range: `${row.start_time}-${row.end_time}`
            });
          } else {
            if (row.is_day && row.is_night) formattedData[dateStr].fullDay.push(staffName);
            else if (row.is_day) formattedData[dateStr].day.push(staffName);
            else if (row.is_night) formattedData[dateStr].night.push(staffName);
          }
        });
      }
      setMonthlyShifts(formattedData);
      setSubmittedStaffIds(submittedIds);

      const { data: holidayData } = await supabase.from('holidays').select('date').gte('date', startOfMonth).lte('date', endOfMonth);
      if (holidayData) setHolidays((holidayData as any[]).map(row => row.date)); 
      setIsLoading(false);
    };
    fetchData();
  }, [currentDate, year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = new Date(year, month, 1).getDay();
  const currentEffectiveHolidays = getEffectiveHolidays(year, month, holidays);

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) days.push(<div key={`empty-${i}`} className="border-r border-b bg-gray-50/50"></div>);
  
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const shift = monthlyShifts[dateStr] || { day: [], night: [], fullDay: [], timed: [] };
    const isHoliday = currentEffectiveHolidays.includes(dateStr); 

    days.push(
      <div key={i} className={`flex flex-col h-56 sm:h-72 min-w-0 border-r border-b overflow-hidden ${isHoliday ? 'bg-red-50/50' : 'bg-white'}`}>
        <span className={`font-bold text-[10px] sm:text-sm border-b py-0.5 text-center shrink-0 ${isHoliday ? 'bg-red-100 text-red-600' : 'bg-gray-100/80'}`}>{i}</span>
        {isHoliday ? (
          <div className="flex-1 flex items-center justify-center"><span className="text-red-400 font-bold text-[9px] sm:text-xs">休</span></div>
        ) : (
          <div className="flex flex-col flex-1 text-[9px] sm:text-[11px]">
            {/* 昼セクション */}
            <div className="p-1 border-b border-gray-100 flex-1 min-h-[30px]">
              <span className="text-[8px] font-bold text-blue-600 block leading-none mb-0.5">昼:</span>
              <div className="text-gray-700 leading-tight font-medium">
                {shift.day.map((name, idx) => <div key={idx} className="truncate">{name}</div>)}
              </div>
            </div>
            {/* 夜セクション */}
            <div className="p-1 border-b border-gray-100 flex-1 min-h-[30px]">
              <span className="text-[8px] font-bold text-indigo-600 block leading-none mb-0.5">夜:</span>
              <div className="text-gray-700 leading-tight font-medium">
                {shift.night.map((name, idx) => <div key={idx} className="truncate">{name}</div>)}
              </div>
            </div>
            {/* 1日セクション */}
            <div className="p-1 border-b border-gray-100 flex-1 min-h-[30px]">
              <span className="text-[8px] font-bold text-green-600 block leading-none mb-0.5">1日:</span>
              <div className="text-gray-700 leading-tight font-medium">
                {shift.fullDay.map((name, idx) => <div key={idx} className="truncate">{name}</div>)}
              </div>
            </div>
            {/* ★修正: 時間指定セクション (背景を白に変更) */}
            <div className="p-1 flex-[1.5] min-h-[40px]">
              <span className="text-[8px] font-bold text-orange-600 block leading-none mb-1">時間指定:</span>
              <div className="flex flex-col gap-1 text-gray-700 font-medium">
                {shift.timed.map((s, idx) => (
                  <div key={idx} className="border-b border-gray-50 last:border-0 pb-0.5">
                    <div className="font-bold text-gray-900 break-all">{s.name}:</div>
                    <div className="text-[8px] sm:text-[9px] text-orange-700 font-bold leading-none">{s.range}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full sm:max-w-5xl mx-auto p-0 sm:p-4 font-sans text-gray-800 pb-12">
      <div className="flex justify-between items-center p-3 sm:px-0">
        <h1 className="text-lg sm:text-2xl font-bold">シフト一覧</h1>
        <a href="/" className="text-blue-500 hover:underline text-[10px] sm:text-xs font-bold bg-blue-50 px-3 py-1 rounded-full">← 入力へ</a>
      </div>
      
      <div className="w-full bg-white border-t border-l border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="flex justify-between items-center p-2 sm:p-4 bg-gray-50/50 border-b border-r border-gray-200">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="px-3 py-1 bg-white border rounded text-[10px] sm:text-sm active:bg-gray-100 shadow-sm">先月</button>
          <h2 className="text-sm sm:text-lg font-bold">{year}年 {month + 1}月</h2>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="px-3 py-1 bg-white border rounded text-[10px] sm:text-sm active:bg-gray-100 shadow-sm">翌月</button>
        </div>
        <div className="grid grid-cols-7 text-center font-bold text-[10px] sm:text-sm bg-gray-50 py-2 border-b border-r border-gray-200">
          <div className="text-red-500">日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div className="text-blue-500">土</div>
        </div>
        {isLoading ? (
          <div className="text-center py-20 text-gray-400 text-xs border-r border-gray-200">読み込み中...</div>
        ) : (
          <div className="grid grid-cols-7 w-full">{days}</div>
        )}
      </div>

      {!isLoading && (
        <div className="bg-white border rounded-xl shadow-sm p-4 mx-2 sm:mx-0">
          <h3 className="font-bold text-gray-700 mb-4 text-sm sm:text-base border-b pb-2">📋 {month + 1}月の提出状況</h3>
          <div className="grid grid-cols-2 gap-4 sm:gap-8">
            <div>
              <div className="text-xs sm:text-sm font-bold text-green-600 mb-2">✅ 提出済み ({Array.from(submittedStaffIds).length}名)</div>
              <div className="flex flex-wrap gap-1.5">
                {staffList.filter(s => submittedStaffIds.has(s.id)).map(staff => (
                  <span key={staff.id} className="text-[10px] sm:text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-1 rounded">{staff.name}</span>
                ))}
                {Array.from(submittedStaffIds).length === 0 && <span className="text-xs text-gray-400">まだいません</span>}
              </div>
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-red-500 mb-2">⚠️ 未提出 ({staffList.length - Array.from(submittedStaffIds).length}名)</div>
              <div className="flex flex-wrap gap-1.5">
                {staffList.filter(s => !submittedStaffIds.has(s.id)).map(staff => (
                  <span key={staff.id} className="text-[10px] sm:text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded">{staff.name}</span>
                ))}
                {staffList.length - Array.from(submittedStaffIds).length === 0 && <span className="text-xs text-gray-400">全員完了！</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}