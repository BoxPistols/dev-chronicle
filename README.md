# Dev Chronicle

GitHubとZennの活動データから、新聞風のウィークリーレポートを自動生成するWebアプリケーション。

[English version](README.en.md)

---

## コンセプト

開発者の日々の活動は、コミットやPR、記事執筆といった断片的な記録に散らばりがちである。Dev Chronicleは、それらを「週刊新聞」という一つのフォーマットに集約することで、活動の全体像を俯瞰できるようにすることを目的としている。

**設計上の狙い:**

- **散らばった活動の統合** -- GitHubのコード活動とZennの執筆活動を、一枚のレポートに統合して見渡せるようにする
- **新聞というメタファー** -- 見出し、リード文、サイドバーの統計欄といった新聞の構造を借りることで、データの羅列ではなく「読み物」として活動を振り返れるようにする
- **AIによる第三者視点** -- 活動データをもとにAIが編集者コラムを生成することで、自分では気づかない活動の傾向やバランスを客観的に映し出す

---

## 主な機能

### GitHub活動の可視化
プロフィール情報、直近のコミット履歴（リポジトリ別にグループ化）、PR活動（ステータス別に色分け）、注目リポジトリをセクションごとに表示する。コンテンツ系リポジトリ（zenn-contentなど）とプロダクト開発リポジトリは自動的に区別される。

### Zenn記事の統合
最新記事の一覧をいいね数・投稿日・トピックとともに掲載する。GitHubの活動と並べて表示することで、コードと文章の両面から活動を把握できる。

### AI編集者コラム
OpenAI / Anthropic Claude / Google Gemini の3プロバイダから選択し、活動データをもとにした所感を「新聞コラム調」で自動生成する。プロバイダごとに複数のモデルを選択可能。

### テーマとエクスポート
ライト/ダークテーマの切り替え、HTMLファイルのダウンロード、クリップボードへのHTMLコピー、ブラウザ印刷に対応。エクスポートされたHTMLはフォントやスタイルを含んでおり、単体で閲覧できる。

---

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript 5 (strict mode) |
| UI | React 19, Tailwind CSS 4 |
| フォント | Noto Sans JP, Noto Serif JP (Google Fonts) |
| テスト | Vitest 4, React Testing Library |
| 外部API | GitHub REST API v3, Zenn API |
| AI | OpenAI API, Anthropic Messages API, Google Gemini API |

---

## アーキテクチャ

### 全体構成

```
ブラウザ (React)
  |
  |-- /           InputForm.tsx  入力・状態管理・エクスポート処理
  |-- /embed      EmbedPage.tsx  パラメータ受取・自動表示（iframe用）
  |-- 共通        Newspaper.tsx  新聞レイアウトのレンダリング
  |
  v
Next.js API Routes (サーバーサイド)
  |-- /api/github       GitHub REST API のプロキシ
  |-- /api/zenn         Zenn API のプロキシ
  |-- /api/ai-comment   AI所感生成（マルチプロバイダ）
  |
  v
外部API
  |-- GitHub API (プロフィール / イベント / リポジトリ)
  |-- Zenn API (記事一覧)
  |-- OpenAI / Anthropic / Gemini (テキスト生成)
```

### データフロー

1. ユーザーがGitHub/Zennのユーザー名を入力し生成を実行
2. `InputForm` がAPIルートに対して並列リクエストを発行
3. APIルートは外部APIへのプロキシとして動作し、300秒のキャッシュ付きでデータを返却
4. AI所感が有効な場合、取得データからサマリーを構築し `/api/ai-comment` に送信
5. 全データが揃った時点で `Newspaper` コンポーネントがレンダリングを開始

### コンポーネント設計

アプリケーションは2つのコンポーネントを中心に構成されている。

**InputForm** は入力画面と結果画面の両方を担当する。データ取得の状態管理、AIプロバイダ/モデルの選択、テーマ切替、エクスポート処理（HTML生成・ダウンロード・コピー・印刷）を集約している。結果表示時はツールバーとNewspaperコンポーネントを含むビューに切り替わる。

**Newspaper** は純粋な表示コンポーネントで、受け取ったデータを新聞レイアウトに変換する。メインカラム（記事セクション）とサイドバー（統計パネル）の2カラム構成で、ヘッダー、リード文、コミット、PR、リポジトリ、Zenn記事、AI所感の各セクションを条件分岐で表示する。

### ユーティリティ層

`lib/utils.ts` に以下の関数群を配置している。

- `formatDate` / `shortDate` / `daysAgo` -- 日付の和暦表示やショートフォーマットへの変換
- `isContentRepo` / `sortByRelevance` -- コンテンツ系リポジトリの判定とソート
- `cleanBio` -- GitHubプロフィールのbioからURL・SNSラベル・区切り文字を除去
- `prColor` -- PRアクション（merged/opened/closed）に対応するカラーコードを返却
- `groupPushEventsByRepo` -- PushEventをリポジトリ単位でグループ化し、コミット数と最新日時を集約

### APIルート設計

3つのAPIルートはすべてNext.jsのRoute Handlers (App Router) で実装されている。

- `/api/github` -- GitHub APIに対してプロフィール・イベント・リポジトリの3リクエストを `Promise.all` で並列実行。`GITHUB_TOKEN` が設定されていればBearerトークンをヘッダーに付与してレートリミットを緩和する。
- `/api/zenn` -- Zenn APIから最新記事を取得。パラメータとしてユーザー名を受け取る。
- `/api/ai-comment` -- `provider` パラメータに応じてOpenAI / Anthropic / Gemini のいずれかを呼び分ける。システムプロンプトには「週刊技術新聞のAI編集者」としてのロール指定と、コンテンツ系リポジトリの区別やURL先の推測禁止といった注意事項が含まれている。

### テーマシステム

Tailwind CSS 4のカスタムテーマ機能を利用し、CSS変数でライト/ダークの色を定義している。ダークモードは `@custom-variant dark` で `.dark` クラスベースの切り替えを実現。テーマ遷移には `transition` を適用してスムーズな切り替えを行う。

---

## プロジェクト構成

```
src/
  app/
    api/
      github/route.ts       GitHub APIラッパー
      zenn/route.ts          Zenn APIラッパー
      ai-comment/route.ts    AI所感生成エンドポイント
    embed/
      layout.tsx             Embed用レイアウト
      page.tsx               Embed表示ページ（iframe埋め込み用）
    layout.tsx               ルートレイアウト・メタデータ
    page.tsx                 ホームページ
    globals.css              テーマ定義・グローバルスタイル
  components/
    InputForm.tsx            入力フォーム・状態管理・エクスポート処理
    Newspaper.tsx            新聞レイアウトのレンダリング
  lib/
    utils.ts                 日付変換・リポジトリ分類・データ整形ユーティリティ
  types/
    index.ts                 TypeScript型定義（GitHub / Zenn / Newspaper）
  __tests__/
    setup.ts                 テストセットアップ
    utils.test.ts            ユーティリティのユニットテスト
```

---

## セットアップ

### 前提条件

- Node.js 20以上
- npm / yarn / pnpm / bun のいずれか

### インストール

```bash
git clone <repository-url>
cd dev-chronicle
npm install
```

### 環境変数

`.env.local` を作成し、利用するサービスに応じたキーを設定する。

```
# AI所感の生成に使用（利用するプロバイダのキーのみ設定すればよい）
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AI...

# GitHubのレートリミット緩和（任意）
GITHUB_TOKEN=ghp_...
```

AI所感機能を使わない場合、APIキーの設定は不要。GITHUB_TOKENも任意だが、設定するとGitHub APIのレートリミットが大幅に緩和される（未認証: 60回/時、認証済み: 5,000回/時）。

### 起動

```bash
npm run dev
```

`http://localhost:3000` にアクセスする。

---

## コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run start` | プロダクションサーバー起動 |
| `npm run test` | テスト実行 |
| `npm run test:watch` | テスト監視モード |

---

## 使い方

1. GitHubユーザー名またはZennユーザー名（もしくは両方）を入力する
2. AI所感が必要な場合は、チェックボックスを有効にしプロバイダとモデルを選択する
3. 「新聞を生成する」を実行する
4. 生成されたレポートは、テーマ切替・HTML保存・HTMLコピー・印刷の各機能で活用できる

---

## 埋め込み（Embed）

Dev Chronicleのレポートを外部Webページに埋め込むことができる。`/embed` エンドポイントにクエリパラメータでユーザー名を渡すだけで、入力フォームなしのレポートが直接表示される。ポートフォリオサイト、ブログ、チームダッシュボードなどへの組み込みを想定している。

### URL仕様

```
/embed?gh={GitHubユーザー名}&zenn={Zennユーザー名}&dark={0|1}
```

### パラメータ一覧

| パラメータ | 必須 | 型 | 説明 |
|-----------|------|-----|------|
| `gh` | どちらか一方 | string | GitHubユーザー名 |
| `zenn` | どちらか一方 | string | Zennユーザー名 |
| `dark` | 任意 | `"1"` | ダークモードで表示する場合に指定 |

`gh` と `zenn` は両方指定することも、片方だけでも動作する。両方とも空の場合はエラーメッセージが表示される。

### iframeでの埋め込み

外部のHTMLページからiframeで読み込む形式。もっとも一般的な利用方法。

```html
<!-- GitHub + Zenn の両方を表示 -->
<iframe
  src="https://your-domain.com/embed?gh=BoxPistols&zenn=aito"
  width="100%" height="800" style="border: none;">
</iframe>

<!-- GitHubのみ、ダークモード -->
<iframe
  src="https://your-domain.com/embed?gh=BoxPistols&dark=1"
  width="100%" height="800" style="border: none;">
</iframe>

<!-- Zennのみ -->
<iframe
  src="https://your-domain.com/embed?zenn=aito"
  width="100%" height="800" style="border: none;">
</iframe>
```

### 直接リンクとしての利用

iframeを使わず、URLを直接ブラウザで開くこともできる。特定ユーザーのレポートへのショートカットとして活用可能。

```
https://your-domain.com/embed?gh=BoxPistols&zenn=aito
```

### レスポンシブ対応のiframe

埋め込み先のページでiframeの高さを自動調整したい場合は、以下のようにCSSで対応できる。

```html
<div style="position: relative; width: 100%; padding-top: 150%; overflow: hidden;">
  <iframe
    src="https://your-domain.com/embed?gh=BoxPistols"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;">
  </iframe>
</div>
```

固定高さで十分な場合は `height="800"` から `height="1200"` の範囲で調整する。GitHubとZennの両方を表示する場合は高さを大きめに取ることを推奨。

### 活用シーン

- **ポートフォリオサイト** -- 自分の開発活動を新聞形式で紹介
- **個人ブログ** -- サイドバーや専用ページに活動レポートを埋め込み
- **チームダッシュボード** -- メンバーごとの活動レポートを一覧表示
- **社内ツール** -- 定期的な活動共有の自動化

### 通常画面との違い

| 項目 | 通常画面 (`/`) | Embed (`/embed`) |
|------|---------------|------------------|
| 入力フォーム | あり | なし（パラメータで指定） |
| ツールバー | あり（テーマ切替・エクスポート） | なし |
| AI所感 | あり（プロバイダ選択可） | 非対応 |
| ダークモード | ボタンで切替 | `?dark=1` で指定 |
| レイアウト | 余白あり | 最小限の余白 |

### 注意事項

- AI編集者コラムはEmbed表示には含まれない。AI所感が必要な場合は通常画面を利用する
- データは表示時にAPIから取得するため、初回表示に数秒かかる場合がある
- GitHub APIのレートリミット（未認証: 60回/時）により、アクセスが集中すると一時的にデータ取得に失敗する可能性がある。`GITHUB_TOKEN` の設定を推奨
- iframe許可ヘッダー（`X-Frame-Options`, `Content-Security-Policy: frame-ancestors`）は `/embed` パスにのみ適用される

---

## ライセンス

MIT
