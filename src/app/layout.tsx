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
  title: "OSS Radar — 开源项目健康度对比",
  description: "基于 GitHub 真实数据，CHAOSS 框架评分，帮你做更好的技术选型决策",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-gray-100 py-4">
          <p className="text-center text-xs text-gray-400 space-x-2">
            <span>© OSS Radar</span>
            <span className="text-gray-200">·</span>
            <span>数据来自 GitHub API</span>
            <span className="text-gray-200">·</span>
            <span>评分基于 <a href="https://chaoss.community" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 underline underline-offset-2">CHAOSS</a> 框架</span>
            <span className="text-gray-200">·</span>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-600">GitHub ↗</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
