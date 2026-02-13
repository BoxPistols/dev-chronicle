#!/bin/bash
# GitHub Labelsを labels.json から同期するスクリプト
# 使い方: bash .github/sync-labels.sh

set -euo pipefail

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
if [[ -z "$REPO" ]]; then
  echo "Error: Gitリポジトリ内で実行してください"
  exit 1
fi

LABELS_FILE=".github/labels.json"
if [[ ! -f "$LABELS_FILE" ]]; then
  echo "Error: $LABELS_FILE が見つかりません"
  exit 1
fi

echo "Repository: $REPO"
echo "Labels file: $LABELS_FILE"
echo ""

# labels.json からラベルを読み込んで同期
COUNT=$(jq '.labels | length' "$LABELS_FILE")
for i in $(seq 0 $(($COUNT - 1))); do
  NAME=$(jq -r ".labels[$i].name" "$LABELS_FILE")
  COLOR=$(jq -r ".labels[$i].color" "$LABELS_FILE")
  DESC=$(jq -r ".labels[$i].description" "$LABELS_FILE")

  # ラベルが存在するか確認
  if gh label list --repo "$REPO" --json name -q ".[].name" | grep -Fxq "$NAME"; then
    gh label edit "$NAME" --repo "$REPO" --color "$COLOR" --description "$DESC" 2>/dev/null
    echo "  Updated: $NAME"
  else
    gh label create "$NAME" --repo "$REPO" --color "$COLOR" --description "$DESC" 2>/dev/null
    echo "  Created: $NAME"
  fi
done

echo ""
echo "Done: $COUNT labels synced."
