import { NextResponse } from 'next/server';
import { supabase } from '../../supabase'; // 先ほど作ったsupabase.tsを読み込む

// Vercel Cron JobがこのURL(GET)にアクセスしてきた時に実行される処理
export async function GET() {
  try {
    // データベースがスリープするのを防ぐため、staffテーブルから1件だけデータを取得する
    const { data, error } = await (supabase.from('staff') as any).select('id').limit(1);
    
    if (error) {
      throw error;
    }

    // 成功したという記録を返す（画面には見えません）
    return NextResponse.json({ 
      status: 'ok', 
      message: 'Supabase is kept alive!',
      time: new Date().toISOString() 
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      status: 'error', 
      message: error.message 
    }, { status: 500 });
  }
}