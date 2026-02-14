import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dev Chronicle - Embed",
  description: "GitHub & Zenn 活動レポートの埋め込み表示",
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-white dark:bg-surface-dark min-h-screen">{children}</div>;
}
