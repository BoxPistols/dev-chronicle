# アーキテクチャ詳細

本ドキュメントでは、Dev Chronicleの設計判断と実装の詳細を記述する。概要については [README.md](../README.md) を参照。

---

## 設計方針

### シンプルさの優先

本アプリケーションは、少数のコンポーネントと明確なデータフローで構成することを優先している。状態管理ライブラリやフォームライブラリは導入せず、React標準の `useState` / `useRef` / `useCallback` で完結させている。これは、アプリの規模に対してこれらの抽象化が過剰であるという判断に基づく。

### サーバーサイドのプロキシパターン

外部APIへのリクエストはすべてNext.jsのAPIルートを経由する。これには2つの理由がある。

1. **APIキーの保護** -- GitHub TokenやAI APIキーをクライアントに露出させない
2. **CORSの回避** -- ブラウザから直接Zenn APIやGitHub APIを叩く場合のCORS制約を回避する

### コンテンツ系リポジトリの区別

GitHub上のアクティビティには、zenn-contentやblogなどのコンテンツ管理リポジトリへのコミットが含まれる。これらは記事の投稿やメタデータの更新であり、プロダクトのコード開発とは性質が異なる。本アプリでは `isContentRepo()` で正規表現ベースの判定を行い、表示やAIへのプロンプトで両者を区別している。

---

## データモデル

### GitHub

GitHub APIから取得するデータは3種類に分かれる。

**Profile (`GitHubProfile`)** -- ユーザーの基本情報。`login`, `name`, `avatar_url`, `bio`, `location`, `public_repos`, `followers`, `following` を含む。

**Events (`GitHubEvent[]`)** -- 直近100件のイベント。`PushEvent`（コミット）と`PullRequestEvent`（PR）が主要な分析対象。各イベントには `repo.name`（`owner/repo` 形式）と `created_at` が付与される。

**Repos (`GitHubRepo[]`)** -- 更新日順で30件のリポジトリ。`name`, `description`, `language`, `stargazers_count`, `forks_count`, `html_url` を使用する。

### Zenn

**Articles (`ZennArticle[]`)** -- 最新20件の記事。`title`, `slug`, `emoji`, `article_type`（tech/idea）, `liked_count`, `published_at`, `path`, `topics` を含む。

### コンポーネント間のデータ受け渡し

`InputForm` が取得したデータは `NewspaperProps` インターフェースを通じて `Newspaper` に渡される。

```typescript
interface NewspaperProps {
  gh: GitHubData | null; // GitHub全データ（profile + events + repos）
  zenn: ZennData | null; // Zenn記事データ
  usernames: {
    // 表示用ユーザー名
    ghUser: string;
    zennUser: string;
  };
  aiComment: string | null; // AI所感テキスト
}
```

---

## APIルートの実装詳細

### /api/github

- `GET` メソッド、クエリパラメータに `username` を取る
- `Promise.all` でプロフィール・イベント・リポジトリの3リクエストを並列実行
- `GITHUB_TOKEN` が環境変数に設定されていれば `Authorization: Bearer` ヘッダーを付与
- `next: { revalidate: 300 }` で5分間のISRキャッシュを有効化
- プロフィール取得に失敗した場合はそのHTTPステータスをそのまま返却

### /api/zenn

- `GET` メソッド、クエリパラメータに `username` を取る
- `https://zenn.dev/api/articles` にリクエストし、最新20件を取得
- 同じく300秒のキャッシュを適用

### /api/card

- `GET` メソッド、クエリパラメータに `gh`（必須）, `zenn`（任意）, `dark`（任意）を取る
- サーバーサイドでGitHub REST API + GraphQL API、Zenn APIからデータを直接取得
- `generateSvg()` でSVG文字列を組み立て、`image/svg+xml` として返却
- 高さはコンテンツに応じて動的計算（コントリビューショングラフ有無、Zenn有無で変動）
- エラーレスポンスもSVG形式で返却し、画像として壊れないようにする
- `Cache-Control: public, max-age=300` で5分キャッシュ

### /api/ai-comment

- `POST` メソッド、ボディに `summary`, `provider`, `model` を受け取る
- `provider` の値に応じて `callOpenAI`, `callAnthropic`, `callGemini` のいずれかを呼び出す
- 各関数は外部APIの固有フォーマットに合わせたリクエスト/レスポンス変換を担当
- システムプロンプトには以下の制約が含まれる:
  - 新聞コラム調の温かみある文体で4--6文
  - コンテンツ/ブログ系リポジトリをプロダクト開発と区別すること
  - プロフィールのURLリンク先の活動を推測で書かないこと
- エラー時は502ステータスとエラーメッセージを返却

---

## 新聞レイアウトの構成

Newspaper コンポーネントが生成する紙面は、以下のセクションで構成される。

### ヘッダー

新聞名「週刊デベロッパー・クロニクル」、発行日、対象ユーザー名を表示。三重線のボーダーで区切る。

### メインカラム（左）

- **GitHubリード** -- コミット数やアクティブリポジトリ数を織り交ぜたリード文
- **主要コミット** -- `groupPushEventsByRepo` でリポジトリ別にグループ化し、上位5リポジトリのコミットメッセージを最大3件ずつ表示
- **プルリクエスト動向** -- PR活動を最大5件表示。merged(緑)/opened(紫)/closed(赤) で色分け
- **Zennリード** -- 記事数といいね総数をリード文として表示
- **最新の記事** -- 最大8件の記事をリンク・いいね数・投稿日とともに表示

### サイドバー（右）

- アバター画像とプロフィール
- GitHub統計（コミット数、アクティブリポ、PR活動、Issue活動、公開リポ総数、フォロワー、合計スター）
- 使用言語ランキング（上位5言語、リポジトリ数ベース）
- Zenn統計（記事数、合計いいね、最新投稿からの経過日数）

### 注目リポジトリ

メインカラムの下にフルワイドで、最大6件のリポジトリをカード形式のグリッドで表示。各カードにはリポジトリ名、説明、言語、スター数、フォーク数を含む。

### AI編集者の所感

AIが生成したコラムテキストを、セリフ体で左ボーダー付きの引用ブロックとして表示。

### フッター

データソースの記載。

---

## エクスポート機能

### HTML生成

`buildHTML()` 関数が `newspaperRef` の `innerHTML` を取得し、完全なHTMLドキュメントとして組み立てる。Google Fontsのリンクとインラインスタイルを含むため、生成されたHTMLは外部依存なしで閲覧できる。

### ダウンロード

`Blob` + `createObjectURL` パターンでHTMLファイルをダウンロードする。ファイル名には生成日が付与される（例: `dev-chronicle_20260214.html`）。

### クリップボードコピー

`navigator.clipboard.writeText` でHTML文字列をコピーする。

### 印刷

`window.print()` を呼び出す。CSSの `@media print` ルールでツールバーを非表示にし、`@page` でA4サイズとマージンを指定している。

---

## テーマ実装

### CSS変数

`globals.css` の `@theme` ブロックで以下のカラートークンを定義している。

| トークン           | ライト    | 用途                         |
| ------------------ | --------- | ---------------------------- |
| `primary`          | `#1a1a2e` | 見出し、メインカラー         |
| `accent`           | `#2563eb` | リンク、アクセントカラー     |
| `surface`          | `#ffffff` | 背景                         |
| `surface-alt`      | `#f8f6f2` | サイドバー・カード背景       |
| `surface-dark`     | `#181825` | ダーク背景                   |
| `surface-dark-alt` | `#1e1e32` | ダークサイドバー・カード背景 |
| `border-light`     | `#e5e2dc` | ライトモードのボーダー       |
| `border-dark`      | `#333348` | ダークモードのボーダー       |
| `text`             | `#1e293b` | 本文テキスト                 |
| `text-muted`       | `#64748b` | 補助テキスト                 |
| `text-dark`        | `#cdd6e4` | ダークモード本文             |
| `text-dark-muted`  | `#8892a6` | ダークモード補助テキスト     |

### ダークモード切替

`InputForm` の `dark` ステートが `true` のとき、ルート要素に `.dark` クラスを付与する。Tailwind CSS 4の `@custom-variant dark` により、`.dark` および `.dark *` 配下で `dark:` プレフィックスのスタイルが有効になる。

`.dark-transition` クラスを適用することで、`background-color`, `color`, `border-color` が0.3秒のイージングでスムーズに遷移する。

---

## テスト方針

Vitest + React Testing Library を使用し、ユーティリティ関数のユニットテストを実装している。テスト対象は `lib/utils.ts` の全関数で、正常系・境界値・エッジケースをカバーしている。

テスト実行:

```bash
npm run test          # 単発実行
npm run test:watch    # 監視モード
```

---

## Embed機能

### 概要

`/embed` ルートは、レポートを外部WebページにiframeやEmbedで埋め込むためのエンドポイントである。入力フォームやツールバーを持たず、クエリパラメータで指定されたユーザーのレポートを直接レンダリングする。

### データフロー

```
外部サイト
  |
  |-- <iframe src="/embed?gh=user&zenn=user&dark=1">
  |
  v
/embed (クライアントコンポーネント)
  |
  |-- useSearchParams() でパラメータ取得
  |-- useEffect() でマウント時に自動フェッチ
  |     |-- GET /api/github?username=...
  |     |-- GET /api/zenn?username=...   (並列実行)
  |
  v
Newspaper コンポーネント (既存をそのまま利用)
```

### パラメータ設計

| パラメータ | 型     | デフォルト | 説明               |
| ---------- | ------ | ---------- | ------------------ |
| `gh`       | string | `""`       | GitHubユーザー名   |
| `zenn`     | string | `""`       | Zennユーザー名     |
| `dark`     | `"1"`  | なし       | ダークモード有効化 |

`gh` と `zenn` の少なくとも一方が必要。両方空の場合はエラーメッセージを表示する。

### iframe許可ヘッダー

`next.config.ts` で `/embed` パスに対して以下のヘッダーを設定している。

- `X-Frame-Options: ALLOWALL` -- iframe埋め込みを許可
- `Content-Security-Policy: frame-ancestors *` -- 任意のオリジンからの埋め込みを許可

これらのヘッダーは `/embed` パスのみに適用される。他のルート（`/` や `/api/*`）には影響しない。

### 通常画面との差異

| 項目         | 通常画面 (`/`)                   | Embed (`/embed`)         |
| ------------ | -------------------------------- | ------------------------ |
| 入力フォーム | あり                             | なし（パラメータで指定） |
| ツールバー   | あり（テーマ切替・エクスポート） | なし                     |
| AI所感       | あり（プロバイダ選択可）         | なし                     |
| ダークモード | ボタンで切替                     | `?dark=1` で指定         |
| レイアウト   | 余白あり                         | 最小限の余白             |

### コンポーネント構成

```
EmbedPage (Suspense boundary)
  |
  v
EmbedContent (useSearchParams + data fetching)
  |
  v
Newspaper (既存コンポーネント、props渡し)
```

`useSearchParams()` はSuspense boundaryを要求するため、`EmbedPage` でSuspenseラッパーを提供し、内部の `EmbedContent` で実際のパラメータ取得とデータフェッチを行う。

---

## SVGカード API (`/api/card`)

### 概要

GitHub プロフィール README に画像として埋め込めるSVGカードを生成するエンドポイント。GitHubがiframeやスクリプトを許可しないため、`![](url)` 形式の画像埋め込みで活動サマリーを表示する。

### データフロー

```
GitHub Profile README
  |
  |-- ![](https://your-domain.com/api/card?gh=user&zenn=user)
  |
  v
/api/card (Route Handler, サーバーサイド)
  |
  |-- fetchGitHub(username)
  |     |-- GET /users/{user}           (プロフィール)
  |     |-- GET /users/{user}/events    (イベント)
  |     |-- GET /users/{user}/repos     (リポジトリ)
  |     |-- POST /graphql              (コントリビューション, token必須)
  |
  |-- fetchZenn(username)              (zennパラメータ指定時)
  |     |-- GET zenn.dev/api/articles
  |
  v
generateSvg() -- SVG文字列を組み立て
  |
  v
Response (image/svg+xml, Cache-Control: 300s)
```

### SVG構成

SVGは以下のセクションで構成され、高さはコンテンツに応じて動的に計算される。

1. **ヘッダー** -- 表示名、`@ユーザー名`、Zennユーザー名（指定時）
2. **コントリビューショングラフ** -- 直近26週間のヒートマップ。5段階の色分け。Less/Moreの凡例付き
3. **GitHub Stats** -- Commits (recent), Pull Requests, Stars, Public Repos, Followers
4. **Top Languages** -- リポジトリ使用言語の上位5件
5. **Zenn** -- 記事数、いいね数（zennパラメータ指定時）

### テーマ

`dark=1` パラメータでダークテーマを適用。カラーパレットはEmbed/通常画面のものとは独立しており、SVG内で完結している。

| 要素         | ライト    | ダーク    |
| ------------ | --------- | --------- |
| 背景         | `#ffffff` | `#0d1117` |
| ボーダー     | `#d0d7de` | `#30363d` |
| テキスト     | `#1f2328` | `#c9d1d9` |
| サブテキスト | `#656d76` | `#8b949e` |
| アクセント   | `#0969da` | `#58a6ff` |

コントリビューションの色はGitHub公式に準拠:

- ライト: `#ebedf0` → `#9be9a8` → `#40c463` → `#30a14e` → `#216e39`
- ダーク: `#161b22` → `#0e4429` → `#006d32` → `#26a641` → `#39d353`

### エラーハンドリング

すべてのエラーレスポンスをSVG形式で返却し、画像として表示が壊れないようにしている。

- `gh` パラメータ未指定 → 400 + エラーSVG
- ユーザー未発見 → 404 + エラーSVG
- サーバーエラー → 500 + エラーSVG

### Embed (`/embed`) との設計上の違い

`/embed` はクライアントサイドでReactコンポーネント (Newspaper) をレンダリングするHTMLページだが、`/api/card` はサーバーサイドでSVG文字列を生成して返却する。これは、GitHub READMEが `<img>` タグの画像のみを許可するという制約に対応するためである。

---

## 今後の拡張方針

以下は検討中の拡張案であり、現時点では未実装である。

- **データソースの追加** -- Qiita, note, はてなブックマークなど他プラットフォームの統合
- **期間指定** -- 直近1週間以外の期間での活動集計
- **PDF出力** -- サーバーサイドでのPDFレンダリング
- **多言語対応** -- UIの英語/日本語切替
- **コンポーネントテスト** -- Newspaper, InputFormのレンダリングテスト追加
