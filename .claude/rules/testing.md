---
paths:
  - "src/__tests__/**/*.ts"
  - "src/__tests__/**/*.tsx"
---

# テスト規約

- テストフレームワークは Vitest を使用
- `describe` / `it` でテストを構造化
- 正常系、境界値、エッジケースをカバーする
- ユーティリティ関数の追加・変更時はテストを必ず更新
- テスト実行: `npm run test`（単発）/ `npm run test:watch`（監視）
