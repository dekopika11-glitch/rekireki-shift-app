import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // タイトルをアプリの内容に合わせて変更しました
  title: "シフト管理システム",
  description: "シフト提出・管理アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja" // 言語を日本語に設定
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: 'light' }} 
    >
      <body 
        // bg-white で白背景を、text-gray-900 で文字色を固定します
        className="min-h-full flex flex-col bg-white text-gray-900"
      >
        {children}
      </body>
    </html>
  );
}