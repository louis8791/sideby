# Phase 1 黑客松驗收交接

## 本次驗收範圍

2026-09-05 Owner 決定採黑客松最小展示範圍。Owner 核准的合成需求句可作為格式、標註、分組切分與展示流程證據；它們不是訪談或真實使用者研究證據，也不證明分類模型品質。

自管分類器／生成模型評測與場地 RAG 在本輪標為 `DEFERRED`，不阻擋 Phase 1／2 展示驗收，也不得被寫成 PASS。前端完成後的兩瀏覽器 Runtime 仍是必要阻擋項。

## CC 執行入口

從乾淨 clone 的 repo 根目錄執行：

```powershell
npm ci
npm test
npm run requirements:validate -- data/training/requirements.hackathon.jsonl
npm run phase1:check
```

`data/training/requirements.hackathon.jsonl` 是從 Owner 提供的 150 筆合成草稿中，依現行六屬性 taxonomy 挑出的 15 筆基本展示案例：5 個改寫群組，按群組 60%／20%／20% 分到 train／validation／test。其餘草稿與後續進階句不阻擋此版，日後若納入必須重新人工確認與固定資料版本。

在 `.local/phase1/two-browser-runtime.json` 尚未完成前，最後一個指令應回 `NOT_READY` 與非零狀態。模型與 RAG 應顯示 `DEFERRED`，不是缺件或成功。

## 必要 Gate

| Gate | 完成條件 |
|---|---|
| `1.0_contracts` | 四份權威文件及三份 schema 存在 |
| `1A_requirements` | Owner 核准合成展示 JSONL 通過 schema、原文證據、審核與 group split 檢查 |
| `1B backend` | `npm test` 通過 |
| `1B_two_browser_runtime` | 兩個獨立瀏覽器加入同房、同步成功、私人資料洩漏 0，附可查閱證據 |

只有上列必要 Gate 全 PASS 才能回 `READY_FOR_CC_REVIEW`。`DEFERRED` 項目不阻擋，但須在回報中揭露未實作。

## 兩瀏覽器證據

`.local/phase1/two-browser-runtime.json` 必須符合：

- `commit` 等於受驗版本。
- `testedAt`、`recordedBy` 有值。
- 至少兩個獨立瀏覽器。
- `sameRoomJoined=true`。
- `sharedStateSynchronized=true`。
- `privateDataLeakCount=0`。
- 至少一個截圖或錄影參照。

CC 最後分列回報：`1.0`、`1A requirements`、`1B backend`、`1B two-browser`，並另列模型／RAG 為 `DEFERRED`。不得把合成需求說成真實使用者研究，也不得把規則基準說成已訓練模型。
