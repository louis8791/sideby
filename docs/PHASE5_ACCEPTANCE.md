# Phase 5 驗收交接（給 Claude Code）

## 現況判定

Phase 5 後端第一刀已實作確定性硬限制、UserFit／CoupleScore、三套差異行程組合、核准資料與作用中交通矩陣讀取，以及 generate／itineraries API。測試只使用明確標示的合成場地；Phase 4 的真實核准場地、RAG 檢索與三案例 Runtime 證據尚未交付，因此 Phase 5 overall 應為 `NOT_READY`。

## CC 重跑入口

從乾淨 clone 的 repo 根目錄執行：

```powershell
npm ci
npm test
npm run phase5:check
```

`npm test` 應通過。三份真實證據未放入 `.local/phase5/` 前，`phase5:check` 應以非零狀態列出 BLOCKED。不得將 `tests/recommendation-fixtures.ts` 的合成資料複製成真實證據。

## 必須驗證的行為

1. 只有同房成員可 generate／GET；兩人未確認目前版本、私密解析未完成、資料集或交通矩陣未啟用時明確失敗。
2. 先以確定性程式排除時間、預算、營業、訂位、交通、單段／總移動、飲食／過敏、無障礙、年齡／場域、Hard No、戶外／天氣不合格候選；必要事實未知不得放行。
3. CoupleScore 固定為 `45% min + 25% mean + 15% context + 10% novelty + 5% route efficiency`；合作或贊助欄位不影響分數。
4. 每套 2～4 站。任兩套相同站點不超過 50%，且類型、區域、預算層級、移動密度至少兩項不同；不足三套就回 `NO_FEASIBLE_ITINERARIES`，不放寬硬限制。
5. 公開結果只使用核准 venue record、execution slot 與交通矩陣；不包含私密原文、標籤、輸入者、解析結果或可反推理由。
6. Session 條件或私密輸入改變後，舊版本行程不再由 GET 回傳，過期 generate 以 `VERSION_CONFLICT` 拒絕。

## Runtime 證據

下列檔案留在 `.local/phase5/`，不提交 Git：

| 檔案 | 必要內容 |
|---|---|
| `real-venue-route.json` | 與受驗 commit 相同；synthetic=false；至少 12 筆核准真實場地；資料集／交通矩陣版本；來源權利違規、必要事實未知及 Google 衍生欄位皆 0 |
| `rag-retrieval.json` | 至少 4 個查詢；實測 Recall@K 達事前門檻；私人索引命中、惡意文件失敗及外部模型 API 皆 0 |
| `three-itinerary-runtime.json` | 至少 3 個完整案例；每案三套；硬限制、差異、隱私及贊助改分失敗皆 0；記錄 p95 |

CC 最後分列回報：`5 engine/api`、`5 real venue/route data`、`5 RAG candidate retrieval`、`5 three-itinerary runtime`。四列全 PASS 才能把 Phase 5 overall 標為 PASS。
