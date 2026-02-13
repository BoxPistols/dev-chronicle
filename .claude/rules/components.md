---
paths:
  - "src/components/**/*.tsx"
---

# コンポーネント規約

- `"use client"` ディレクティブを先頭に記述
- 型は `@/types` から import する
- ユーティリティ関数は `@/lib/utils` から import する
- SVGアイコンはインラインコンポーネントとして定義（外部アイコンライブラリ不使用）
- Tailwind CSS のユーティリティクラスで直接スタイリング
- ダークモード対応: `dark:` プレフィックスで暗色スタイルを併記
- アニメーションは `globals.css` に定義された `@keyframes` を使用
