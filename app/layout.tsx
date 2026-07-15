import type { Metadata } from "next";
import "./globals.css";
import { WatchlistProvider } from "@/hooks/useWatchlist";

export const metadata: Metadata = {
  title: "K-Ray",
  description: "股票走势复盘与事件候选工具 - 输入股票代码，查看真实日K线与关键走势节点",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <WatchlistProvider>{children}</WatchlistProvider>
      </body>
    </html>
  );
}
