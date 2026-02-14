import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "週刊デベロッパー・クロニクル",
  description: "GitHub & Zenn のアクティビティから自動生成する開発者向け週刊新聞",
  openGraph: {
    title: "週刊デベロッパー・クロニクル",
    description: "GitHub & Zenn のアクティビティから自動生成する開発者向け週刊新聞",
    locale: "ja_JP",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f1a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-neutral-100 dark:bg-surface-dark min-h-screen dark-transition">
        {children}
      </body>
    </html>
  );
}
