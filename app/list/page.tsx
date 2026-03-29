"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabaseの接続準備
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ShiftList() {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  type DayShift = { day: string[]; night: string[]; fullDay: string[] };
  const [monthlyShifts, setMonthlyShifts] = useState<Record<string, DayShift>>({});
  const [isLoading, setIsLoading] = useState(true);

  // ★追加：定休日を保存する箱
  const [holidays, setHolidays] = useState<string[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    
    // 1. シフトデータの取得
    const { data: shiftData, error: shiftError } = await supabase
      .from('shifts')
      .select(`date, is_day, is_night, staff ( name )`);

    if (shiftError) {
      console.error("シフト取得エラー:", shiftError);
      alert("データの取得に失敗しました。");
      setIsLoading(false);
      return;
    }

    const formattedData: Record<string, DayShift> = {};
    if (shiftData) {
      shiftData.forEach((row: any) => {
        const dateStr = row.date;
        const staffName = row.staff?.name || "不明";
        
        if (!formattedData[dateStr]) {
          formattedData[dateStr] = { day: [], night: [], fullDay: [] };
        }

        if (row.is_day && row.is_night) {
          formattedData[dateStr].fullDay.push(staffName);
        } else if (row.is_day) {
          formattedData[dateStr].day.push(staffName);
        } else if (row.is_night) {
          formattedData[dateStr].night.push(staffName);
        }
      });
    }
    setMonthlyShifts(formattedData);

    // ★2. 定休日データの取得
    const { data: holidayData } = await supabase.from('holidays').select('date');
    if (holidayData) {
      setHolidays(holidayData.map(row => row.date));
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="p-1 border bg-gray-50"></div>);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayStaffs = monthlyShifts[dateStr]?.day || [];
    const nightStaffs = monthlyShifts[dateStr]?.night || [];
    const fullDayStaffs = monthlyShifts[dateStr]?.fullDay || [];

    // ★追加：この日が定休日かどうかを判定
    const isHoliday = holidays.includes(dateStr);

    days.push(
      <div key={i} className={`p-1 border flex flex-col h-48 min-w-0 overflow-hidden ${isHoliday ? 'bg-red-50' : 'bg-white'}`}>
        <span className={`font-bold text-sm border-b pb-1 mb-1 text-center shrink-0 ${isHoliday ? 'bg-red-100 text-red-600' : 'bg-gray-100'}`}>
          {i}
        </span>

        {isHoliday ? (
          // ★定休日の場合は、シフトエリアを隠して「定休日」と大きく表示
          <div className="flex-1 flex items-center justify-center">
            <span className="text-red-400 font-bold text-lg tracking-widest">定休日</span>
          </div>
        ) : (
          // 営業日の場合は今まで通りシフトを表示
          <>
            {/* 昼エリア */}
            <div className="flex-1 overflow-y-auto min-h-0 mb-1">
              <span className="text-xs font-bold text-blue-600 sticky top-0 bg-white block">昼:</span>
              <div className="text-xs text-gray-700 leading-tight break-all">
                {dayStaffs.map((name, idx) => <div key={idx}>{name}</div>)}
              </div>
            </div>

            {/* 夜エリア */}
            <div className="flex-1 overflow-y-auto min-h-0 border-t border-gray-100 pt-1 mb-1">
              <span className="text-xs font-bold text-indigo-600 sticky top-0 bg-white block">夜:</span>
              <div className="text-xs text-gray-700 leading-tight break-all">
                {nightStaffs.map((name, idx) => <div key={idx}>{name}</div>)}
              </div>
            </div>

            {/* 1日エリア */}
            <div className="flex-1 overflow-y-auto min-h-0 border-t border-gray-100 pt-1">
              <span className="text-xs font-bold text-green-600 sticky top-0 bg-white block">1日:</span>
              <div className="text-xs text-gray-700 leading-tight break-all">
                {fullDayStaffs.map((name, idx) => <div key={idx}>{name}</div>)}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 font-sans text-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">シフト一覧画面</h1>
        <a href="/" className="text-blue-500 hover:underline text-sm font-bold bg-blue-50 px-3 py-1 rounded">
          ← 入力画面に戻る
        </a>
      </div>

      <div className="bg-white rounded shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <button onClick={prevMonth} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">先月</button>
          <h2 className="text-xl font-bold">{year}年 {month + 1}月</h2>
          <button onClick={nextMonth} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">翌月</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center font-bold text-sm mb-1">
          <div className="text-red-500">日</div><div>月</div><div>火</div><div>水</div><div>木</div><div>金</div><div className="text-blue-500">土</div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-500 font-bold">データを読み込み中...</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {days}
          </div>
        )}
      </div>
    </div>
  );
}