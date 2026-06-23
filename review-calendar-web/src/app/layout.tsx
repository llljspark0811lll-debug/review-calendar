import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const rounded = localFont({
  src: "./fonts/HakgyoansimChilpanjiugae-B.ttf",
  variable: "--font-rounded",
  weight: "700",
  display: "swap",
});

const display = localFont({
  src: "./fonts/HakgyoansimChilpanjiugae-B.ttf",
  variable: "--font-display",
  weight: "700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "리뷰캘린더",
  description: "선정된 체험단과 리뷰 마감일을 귀엽게 관리하는 일정 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${rounded.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
