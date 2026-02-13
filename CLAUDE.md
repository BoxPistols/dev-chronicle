# Dev Chronicle

Next.js 16 + TypeScript + Tailwind CSS 4 で構築した、GitHub/Zennの活動データから新聞風レポートを自動生成するWebアプリ。

## コードスタイル

- TypeScript strict。`any` 禁止
- コンポーネントは関数型 + named export（ページ除く）
- スタイルは Tailwind CSS ユーティリティクラスのみ。CSS-in-JS不使用
- 日本語UIが前提。ユーザー向けメッセージは日本語で記述
- コミットメッセージは簡潔に。冗長な定量値やファイル一覧は不要

## コマンド

- `npm run dev` -- 開発サーバー起動
- `npm run build` -- プロダクションビルド
- `npm run test` -- Vitest単体テスト実行
- `npm run test:watch` -- テスト監視モード

## アーキテクチャ

- `src/app/` -- App Routerのページ/レイアウト
- `src/app/api/` -- APIルート（GitHub / Zenn / AI所感）
- `src/components/` -- UIコンポーネント（InputForm, Newspaper）
- `src/lib/` -- ユーティリティ関数
- `src/types/` -- TypeScript型定義
- `src/__tests__/` -- ユニットテスト
- `docs/` -- アーキテクチャドキュメント

## 注意事項

- APIルートは外部APIのプロキシとして機能。APIキーはサーバーサイドでのみ使用
- `isContentRepo()` でコンテンツ系リポジトリ（zenn-content等）とプロダクト開発リポを区別している
- ダークモードは Tailwind CSS 4 の `@custom-variant dark` + `.dark` クラスで実装
- Tailwind CSS 4 では `@import "tailwindcss"` の前に Google Fonts の `@import url(...)` を配置する必要がある（CSS @import順序の制約）
- Next.js 16 の画像ドメイン許可は `next.config.ts` の `images.remotePatterns` で設定
- AI所感のシステムプロンプトにはコンテンツ系リポの区別指示とURL推測禁止が含まれる

## テスト方針

- ユーティリティ関数（`lib/utils.ts`）は Vitest でユニットテスト済み
- 新しいユーティリティ追加時はテストも併せて作成する
- コンポーネントテストは Testing Library を使用

## 環境変数

`.env.local` に設定（すべて任意）:
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` -- AI所感生成
- `GITHUB_TOKEN` -- レートリミット緩和

## PR/コミット規約

- コミットは conventional commits 形式: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- PRタイトルは70文字以内
- コミットメッセージに以下を含めない: ファイル数、変更行数、冗長な説明
