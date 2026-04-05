import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "코딩테스트 대시보드",
  description: "프로그래머스 Lv.0 풀이 현황",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
