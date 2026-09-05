# Phase 2 驗收交接（給 Claude Code）

## 現況判定

Phase 2 後端第一刀已實作：每位成員各自保存／讀取／刪除私密輸入，`private_remembered` 受個人化同意控制，規則基準輸出固定解析 envelope，非法 parser 輸出 fail closed，公開狀態經 Privacy Guard 欄位出口。自管模型與場地 RAG 尚未交付，前端也尚未完成兩瀏覽器操作，所以 Phase 2 overall 目前應為 `NOT_READY`。

## CC 重跑入口

從乾淨 clone 的 repo 根目錄執行：

```powershell
npm ci
npm test
npm run phase2:check
```

`npm test` 應通過。真正 RAG 整合及兩瀏覽器證據未放入 `.local/phase2/` 前，`phase2:check` 應以非零狀態列出 BLOCKED；不得建立空白或未實際操作的 JSON 讓它變綠。

## 必須驗證的行為

1. A、B 在同房各自 POST 私密內容；GET 只能讀本人，非成員與另一人的空白投影都回 404，不能用 id 或 body 冒名。
2. `private_session` 不要求長期個人化；`private_remembered` 必須先接受當期條款並開啟 `personalizationEnabled`。關閉設定後，既有 remembered 輸入降回 session scope。
3. 範例「明亮、可愛但不要太幼稚、不要走太多路」輸出 parsed；「有氣氛」及含未支援硬限制的混合句輸出 needs_clarification，不能忽略未解析限制。
4. parser 候選缺欄位或不合 schema 時輸出 unavailable／`PARSER_OUTPUT_INVALID`，不能將任意 JSON 存成 parsed。
5. 私密原文與標籤不得出現在對方 GET、PublicState、SSE、一般伺服器 log、共用 RAG 文件或公開理由。
6. 修改或刪除私密輸入會清除雙方既有確認，避免用舊確認生成新輸入的行程。

## Runtime 證據

以下檔案留在 `.local/phase2/`，不提交 Git：

| 檔案 | 必要內容 |
|---|---|
| `rag-integration.json` | 與受驗 commit 相同；至少 4 個查詢；資料／索引／parser 版本；共用索引私密輸入 0；公開理由私密原文 0；惡意文件失敗 0；外部模型 API 0；模型／索引停用狀態已驗證 |
| `two-browser-privacy.json` | 與受驗 commit 相同；兩個獨立瀏覽器；對方不能讀 raw input；PublicState、Realtime、server log 洩漏均 0；撤回 remembered 同意已驗證；附截圖／錄影參照 |

CC 最後分列回報：`2 private storage/parser/guard`、`2 RAG integration`、`2 two-browser privacy`。每列只填 PASS／FAIL／BLOCKED、證據路徑與第一個失敗原因；三列全 PASS 才能把 Phase 2 overall 標為 PASS。
