# 偏好、地點發布與持續改進

## 2026-09-06 實作與驗收界線

- 30 軟偏好均有明確對應，合計 21 個計分屬性；另有室內／戶外（含戶外區）、冷氣／無冷氣 4 個硬條件。前端傳原文及選項，不再用正規化文字覆蓋原始限制。未支援的硬限制須澄清。
- 辨識不等於地點能滿足：未知軟屬性維持中性分數，未知硬條件拒絕；不能把未觀察的氣氛、服務或冷氣補成事實。情境觀察不會無條件當成一般屬性。
- 2026-09-06 重新讀取政府來源共 1,121 筆候選；128 筆有來源營業文字、19 筆有可精確辨識的單一入場費文字、425 筆缺街道地址。這是原始候選完整度，不是正式資料已歸零。既有正式核准資料仍為 13 筆，本次沒有批量冒名核准。
- 全候選池先過政策及硬條件，再取最多 20 個兼顧雙方與類別的候選進行路線組合；不再以 ID 前 32 筆作全部候選。這是有界搜尋，不保證全域最優。

## 地點更新及發布

1. `npm run venues:refresh-government -- --apply`：抓取授權政府基本資料、保留票價原文，新增候選快照，不替換正式資料。
2. `npm run venues:qualify -- --database --details`：列出缺件與候選，不自動假設免費、全天開放或冷氣。
3. `npm run venues:match-google-place-ids -- --apply --limit=100`：僅取 `places.id`；已有成功對應者跳過，預設每批 100、並行 2，401／403／429 停止新增請求。Google 詳情不寫入永久候選庫。
4. 整理核准 release JSON，包含 `version`（`sideby-release-*`）、完整 `records`、新且唯一 `slotId` 的 `slots`。每個場地必須是最新政府候選、有核准價格／時段與可執行區域資料。版本不可重用。
5. `npm run venues:publish -- --file=.local/reviewed-release.json` 只做格式檢查；加 `--apply` 才在單一交易內發布場地、時段、估計交通矩陣與版本索引。失敗保留原 active。啟動 seed 不覆蓋更新的 release。

Google 官方 [計價表](https://developers.google.com/maps/billing-and-pricing/pricing)（2026-09-06 核對）列 Text Search Essentials (IDs Only) 為 Unlimited free usage；這不代表詳情、照片及路線同樣無限免費。未核對剩餘額度前不做付費批次。大型場地集合的估計矩陣只保留每站最近 32 個鄰站，缺路段不可假成功，亦不得冒充 Google 即時路線。

## 三條持續改進路徑

### 個人偏好

既有五種負面回饋更新該使用者的偏好，並降低該地點對本人的排序；即使場地尚無氣氛屬性，也能作用。跨次使用需有效個人化同意及本版條款。另一半的偏好不被改寫，公開結果不攜帶私人事件或使用者識別。

### 離線候選

`npm run learning -- collect-ranking` 收集有效 model-improvement 同意的結構化排序事件，仍待人工審核。這不是文字分類語料。

`submit-requirement --input=.local/reviewed-candidate.json` 只接受人工去識別文字、原回饋所有權、逐字標註證據與當期同意。`review` 指定審查者／決定／split。原有六核心需求標註 taxonomy 沿用，不把 21 個場地屬性冒稱已有訓練資料。

`export-requirements --version=... --taxonomy=... --output=.local/...jsonl` 必須具備 train／validation／test 且同一人不跨 split；`export-ranking` 獨立輸出結構事件。輸出僅准 `.local/`，不可提交 Git。

撤回同意、修改或刪除來源回饋、改變審核，會撤銷相關候選或凍結資料集；撤銷版本不可重用。匯出與撤回以交易鎖序列化。已匯出到其他電腦的副本無法被資料庫遠端抹除，使用前須核對 export status；本輪沒有訓練或部署新模型。

### 地點索引

`npm run learning:refresh` 收集排序候選並重建／核對 active 核准資料索引；納入既有每日 `venues:refresh-all`。索引包含來源版本、record hash、可用客觀欄位與核准一般屬性；推薦前比對版本與 hash。不含 Google 詳情、不產生 Embedding，也不等於模型參數學習。

## 驗收

本機 `npm run check:all`：80 tests、後端 build、前端 typecheck／build 通過。包含真 PostgreSQL／HTTP 房間流程、全部 30 選項、4 環境條件、個人排序、來源撤回、split 防洩漏、發布 rollback、重啟保留新 release。正式部署與兩支手機驗收須另記，不以此測試結果代替。
