# Phase 2 黑客松驗收交接

## 本次驗收範圍

2026-09-05 Owner 決定本輪以已實作的私密輸入、有限規則解析與 Privacy Guard 完成黑客松展示；場地 RAG 標為 `DEFERRED`，不阻擋 Phase 1／2 驗收，也不得宣稱已接入。

前端完成後的兩瀏覽器隱私操作仍是必要 Gate。後端自動測試不能替代這項 Runtime 證據。

## CC 重跑入口

```powershell
npm ci
npm test
npm run phase2:check
```

在 `.local/phase2/two-browser-privacy.json` 尚未完成前，`phase2:check` 應回 `NOT_READY` 與非零狀態；RAG 應顯示 `DEFERRED`。

## 必須驗證的行為

1. A、B 在同房各自 POST 私密內容；GET 只能讀本人，非成員與另一人的空白投影都回 404。
2. `private_session` 不要求長期個人化；`private_remembered` 必須先接受當期條款並開啟個人化，關閉後既有資料降回 session scope。
3. 已支援句型輸出 parsed；「有氣氛」與含未支援限制的混合句輸出 needs_clarification。
4. 非法 parser 候選輸出 unavailable／`PARSER_OUTPUT_INVALID`。
5. 私密原文、標籤與解析結果不得出現在對方 GET、PublicState、SSE、一般伺服器 log 或公開理由。
6. 修改或刪除私密輸入會清除雙方既有確認。

## 必要 Gate

| Gate | 完成條件 |
|---|---|
| `2_private_storage_parser_guard` | 後端 migration、本人 API、規則解析與 Privacy Guard 存在，且 `npm test` 通過 |
| `2_two_browser_privacy` | 兩個獨立瀏覽器完成本人隔離、公開狀態／Realtime／log 零洩漏及 remembered 撤回驗證 |

`.local/phase2/two-browser-privacy.json` 必須綁定受驗 commit、兩個瀏覽器、零洩漏、撤回驗證及至少一個截圖或錄影參照。

兩個必要 Gate 全 PASS 才能回 `READY_FOR_CC_REVIEW`。CC 最後分列回報 `2 private storage/parser/guard`、`2 two-browser privacy`，並另列 `2 RAG integration: DEFERRED`。
