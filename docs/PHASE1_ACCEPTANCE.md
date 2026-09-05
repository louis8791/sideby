# Phase 1 驗收交接（給 Claude Code）

## 驗收結論規則

Phase 1 包含 1.0 文件／資料契約、1A 模型與 RAG、1B 雙人 Session。只有三者及兩瀏覽器 Runtime 都有獨立證據，Phase 1 才能判 PASS。現況預期為：1.0 與 1B 後端自動測試可通過；1A 真實需求表、模型／檢索證據及兩瀏覽器 Runtime 尚未備齊，因此整體應為 NOT READY。

不得手動建立幾個內容空泛的 JSON 只為讓指令變綠。證據中的 commit 必須等於受驗版本，模型與索引要在指定目標硬體實際執行；公開文件、schema、fixture 或後端測試不能替代模型、檢索與雙瀏覽器驗收。

## CC 執行入口

從乾淨 clone 的 repo 根目錄執行：

```powershell
npm ci
npm test
npm run requirements:validate -- data/training/requirements.example.jsonl
npm run phase1:check
```

前三項應成功。`phase1:check` 在真正證據未放入 `.local/phase1/` 前應以非零狀態結束並列出 BLOCKED gate；這是正確結果，不是把缺件隱藏成成功。

真實需求表放在 `.local/phase1/requirements.jsonl`，格式參考 `data/training/requirements.example.jsonl`。它必須通過 schema、人工核准、證據原文片段、group 不跨 train／validation／test，以及三組均有核准案例。範例只有六筆合成資料，只驗證格式，不能用來宣稱分類器品質。

`phase1:check` 另外要求下列本機證據，不提交 Git：

| 檔案 | 最小證據 |
|---|---|
| `.local/phase1/model-manifest.json` | 實際模型／版本／量化／授權／runtime／本機路徑／目標硬體、已在目標硬體執行、外部模型 API 次數為 0 |
| `.local/phase1/model-evaluation.json` | 固定資料與 taxonomy 版本、規則基準、macro-F1、至少四屬性 precision／recall／F1／support、沒有硬限制退步、測試集先凍結 |
| `.local/phase1/retrieval-evaluation.json` | 至少 12 個核准真實場地、Embedding／索引版本、Recall@K、預先門檻結果、來源違規與 Google 衍生資料為 0 |
| `.local/phase1/two-browser-runtime.json` | 兩個獨立瀏覽器加入同房、同步成功、私人資料洩漏 0，以及可查閱的截圖或錄影參照 |

可用 `PHASE1_EVIDENCE_DIR` 與 `PHASE1_REQUIREMENTS_PATH` 指向其他本機證據位置；它們仍不可指向公開 repo 內的私密資料。

## CC 必須另外人工檢查

1. 檢查模型、索引與場地資料的真實來源、授權、時間、情境與未知值；不得把 Google Maps／Places 衍生內容或個人回饋放進共用 RAG。
2. 在目標硬體實際執行至少一個未見改寫、否定需求、需釐清案例及無可行場地案例；確認沒有雲端模型 fallback。
3. 兩個獨立瀏覽器實際建立／加入同一房間、同步共同條件、處理版本衝突與重連，並嘗試跨使用者讀取私人資料。
4. 檢查測試產物與 Git commit 一致；不要以聊天摘要、既有 Run Note 或手填證據替代 Runtime。

CC 最後回報四列：`1.0`、`1A`、`1B backend`、`1B two-browser`，每列只可填 PASS／FAIL／BLOCKED、證據路徑與第一個失敗原因。四列全 PASS 才能將 `Phase 1 overall` 標為 PASS。
