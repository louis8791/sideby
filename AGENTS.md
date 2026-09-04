# AGENTS.md

## 1. 專案唯一目標

在三天黑客松範圍內，做出一個可由兩支手機操作的 AI 情侶約會共決策 MVP：系統在不洩漏雙方私密需求的情況下，從已知真實場地資料中產生三套符合硬限制、可局部重排的完整大臺北約會行程。

## 2. 必讀順序

開始任何實作前，只讀與任務有關的最小文件，依序為：

1. 本檔 `AGENTS.md`
2. `PRD.md`
3. `TDD.md`
4. `ROADMAP.md`
5. 需要 UI／完整欄位時才讀 `docs/MVP_SPEC.md`
6. 需要模型／RAG 細節時才讀 `docs/MODEL_RAG.md`

不要掃描使用者整個 Obsidian Vault，也不要把聊天紀錄當成權威規格。

## 3. 權威與衝突處理

權威排序：

```text
AGENTS.md > PRD.md > TDD.md > ROADMAP.md > docs/MVP_SPEC.md > docs/MODEL_RAG.md
```

- PRD 定義「做什麼／不做什麼」。
- TDD 定義「怎麼做／怎麼驗」。
- ROADMAP 只安排本次 MVP 施工順序。
- 規格不明時先採最小、可測、可回退做法，不自行擴張產品。

## 4. 固定技術決策

除非使用者明確批准，以下不得擅自替換：

- Web／PWA：Next.js + React + TypeScript。
- 後端：Next.js Server Routes 的模組化單體。
- DB／同步：Supabase PostgreSQL、Realtime、RLS。
- 向量：`pgvector`，768 維。
- 文字解析與安全說明：`gemini-3.8-flash`，固定 JSON Schema。
- Embedding：`gemini-embedding-2`，`output_dimensionality=768`。
- 搜尋：SQL 硬篩選 → Postgres FTS + pgvector → RRF → 程式化 CoupleScore。
- LLM 不負責硬限制、最終排序、時間／成本計算或真實性判定。
- MVP 不做獨立 reranker、不做大型模型微調、不拆微服務。

## 5. Product Contract

使用者完成雙方輸入並按下「產生行程」後，系統只可承諾下列結果：

1. 從資料庫既有 `venue_id` 中選擇。
2. 產生三套 2–4 站完整行程。
3. 每套均包含時間、移動、預估價格與安全推薦理由。
4. 所有硬限制通過程式驗證。
5. 私密原文、輸入者與可反推線索不出現在共同畫面。
6. 任一關鍵資料或模型失敗時，明確顯示失敗，不得用假資料冒充成功。

## 6. Data Contract

- 真實場地、模擬優惠、測試 Fixture 必須有清楚欄位標記，不可混在一起。
- 場地事實與主觀標籤分開保存；主觀標籤必須有 `source`、`confidence`。
- 私密原文不得進入共享 Realtime channel、共同 API response 或一般應用 log。
- `private_session` 在 Session 結束後依規格刪除；`private_remembered` 只有取得本人同意才可寫入偏好模型。
- 外部 Places／Routes 資料只用於允許的即時查詢，不抓取評論或圖片建立訓練集。

## 7. Model Contract

- 模型輸出必須經 schema validation；無法解析時回報 `MODEL_OUTPUT_INVALID`。
- Parser 只能輸出定義過的 attribute、operator、range、importance、scope、visibility。
- 未知形容詞可進 `unknown_terms`，不能偷偷映射成無關屬性。
- LLM 只能引用後端提供的候選事實，不得創造商家、價格、時間、優惠或路線。
- 真實私密需求不得送入 Gemini Unpaid Services；預設 `ALLOW_REAL_PRIVATE_INPUT=false`。
- 模型不可用私密需求生成會讓伴侶反推出原意的說明。

## 8. 禁止事項

任何 Agent 都不得：

- 新增 CRM、商家管理、廣告後台、付款、訂閱、社群、聊天、遊戲化、過夜行程或其他 MVP 外功能。
- 將「規劃未來約會」誤讀為產品未來 Roadmap；它只是預約日期模式。
- 使用純向量相似度取代硬限制或雙人評分。
- 把 A、B 分數直接平均，導致一方 100、一方 0 仍被推薦。
- 因合作／贊助提高 CoupleScore。
- 在瀏覽器暴露 Service Role Key、模型金鑰或私密原文。
- 抓取 Google Maps 評論／照片用於訓練或評估形容詞模型。
- 將 `.env`、真實使用者資料、完整 log、資料庫 dump commit 到公開 repo。
- 測試失敗、跳過或無法執行時宣稱 PASS。
- 未經使用者明確要求自行 push、刪 branch、force push 或覆蓋既有 Obsidian 文件。

## 9. 實作順序

每一刀遵守：

```text
讀最小規格
→ 先寫／更新測試或驗收 Fixture
→ 實作最小變更
→ 執行最相關測試
→ 執行受影響的整合 Gate
→ 更新文件與狀態
→ commit
```

若發現規格矛盾，先記錄在 commit／PR 說明中並採安全、最小行為，不得默默改產品承諾。

## 10. 最低驗證 Gate

至少要有：

- Schema validation：Parser／Itinerary 固定 JSON。
- Hard constraint unit tests：預算、時間、過敏、Hard No、交通。
- Privacy test：A 無法從 API／Realtime／理由取得 B 私密資料。
- Retrieval eval：形容詞語意召回與硬標籤排序。
- CoupleScore test：保護較低滿意度一方。
- Itinerary validation：站點時間、營業、移動、總預算。
- Local replan test：保留已鎖定站點，只替換被拒絕站點。
- E2E：兩支手機加入 → 輸入 → 三套行程 → 局部重排 → 選定。

## 11. No Fake Success

下列狀態必須區分：

- `pass`：測試實際執行且有輸出證據。
- `fail`：已執行但不通過。
- `skipped`：環境或依賴不具備，未執行。
- `owner-only`：需要帳號、金鑰、付費或使用者裝置。
- `blocked`：缺少關鍵決策／資料。

文件存在不等於 App 可運作；Mock 成功不等於真實 API 成功。

## 12. 完成定義

一項任務只有同時滿足以下條件才算完成：

- 符合 PRD 範圍。
- 沒有新增私密資料洩漏路徑。
- 相關測試實際通過。
- 錯誤狀態可見，不假成功。
- 文件與環境變數範例同步更新。
- `git status` 乾淨，commit 訊息能說明改動。
