"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ShiftList() {
  const [currentDate, setCurrentDate] = useState(new Date());
  type DayShift = { day: string[]; night: string[]; fullDay: string[] };
  const [monthlyShifts, setMonthlyShifts] = useState<Record<string, DayShift>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [holidays, setHolidays] = useState<string[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchData = async () => {
    setIsLoading(true);
    const { data: shiftData } = await supabase.from('shifts').select(`date, is_day, is_night, staff ( name )`);
    const formattedData: Record<string, DayShift> = {};
    if (shiftData) {
      shiftData.forEach((row: any) => {
        const dateStr = row.date;
        const staffName = row.staff?.name || "不明";
        if (!formattedData[dateStr]) formattedData[dateStr] = { day: [], night: [], fullDay: [] };
        if (row.is_day && row.is_night) formattedData[dateStr].fullDay.push(staffName);
        else if (row.is_day) formattedData[dateStr].day.push(staffName);
        else if (row.is_night) formattedData[dateStr].night.push(staffName);
      });
    }
    setMonthlyShifts(formattedData);
    const { data: holidayData } = await supabase.from('holidays').select('date');
    if (holidayData) setHolidays(holidayData.map(row => row.date));
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [currentDate]);

  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = new Date(year, month, 1).getDay();

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="border-r border-b bg-gray-50/50"></div>);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayStaffs = monthlyShifts[dateStr]?.day || [];
    const nightStaffs = monthlyShifts[dateStr]?.night || [];
    const fullDayStaffs = monthlyShifts[dateStr]?.fullDay || [];
    const isHoliday = holidays.includes(dateStr);

    days.push(
      <div key={i} className={`flex flex-col h-40 sm:h-56 min-w-0 border-r border-b overflow-hidden ${isHoliday ? 'bg-red-50/50' : 'bg-white'}`}>
        <span className={`font-bold text-[10px] sm:text-sm border-b py-0.5 text-center shrink-0 ${isHoliday ? 'bg-red-100 text-red-600' : 'bg-gray-100/80'}`}>{i}</span>
        {isHoliday ? (
          <div className="flex-1 flex items-center justify-center"><span className="text-red-400 font-bold text-[9px] sm:text-xs">休</span></div>
        ) : (
          <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 p-0.5">
            <div className="mb-0.5">
              <span className="text-[8px] font-bold text-blue-600 block leading-none">昼:</span>
              <div className="text-[9px] sm:text-[11px] text-gray-700 leading-tight break-all font-medium">
                {dayStaffs.map((name, idx) => <div key={idx} className="border-b-[0.5px] border-gray-50 last:border-0">{name}</div>)}
              </div>
            </div>
            <div className="border-t-[0.5px] border-gray-100 pt-0.5 mb-0.5">
              <span className="text-[8px] font-bold text-indigo-600 block leading-none">夜:</span>
              <div className="text-[9px] sm:text-[11px] text-gray-700 leading-tight break-all font-medium">
                {nightStaffs.map((name, idx) => <div key={idx} className="border-b-[0.5px] border-gray-50 last:border-0">{name}</div>)}
              </div>
            </div>
            <div className="border-t-[0.5px] border-gray-100 pt-0.5">
              <span className="text-[8px] font-bold text-green-600 block leading-none">全:</span>
              <div className="text-[9px] sm:text-[11px] text-gray-700 leading-tight break-all font-medium">
                {fullDayStaffs.map((name, idx) => <div key={idx} className="border-b-[0.5px] border-gray-50 last:border-0">{name}</div>)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full sm:max-w-5xl mx-auto p-0 sm:p-4 font-sans text-gray-800">
      <div className="flex justify-between items-center p-3 sm:px-0">
        <h1 className="text-lg sm:text-2xl font-bold">シフト一覧</h1>
        <a href="/" className="text-blue-500 hover:underline text-[10px] sm:text-xs font-bold bg-blue-50 px-3 py-1 rounded-full">← 入力へ</a>
      </div>
      <div className="w-full bg-white border-t border-l border-gray-200 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center p-2 sm:p-4 bg-gray-50/50 border-b border-r border-gray-200">
          <button onClick={prevMonth} className="px-3 py-1 bg-white border rounded text-[10px] sm:text-sm active:bg-gray-100 shadow-sm">先月</button>
          <h2 className="text-sm sm:text-lg font-bold">{year}年 {month + 1}月</h2>
          <button onClick={nextMonth} className="px-3 py-1 bg-white border rounded text-[10px] sm:text-sm active:bg-gray-100 shadow-sm">翌月</button>
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
    </div>
  );
}