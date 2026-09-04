# Sideby — MVP TDD

## 1. 技術決策

MVP 採模組化單體，不拆微服務。建議以 React、Next.js、TypeScript、Server Routes、PostgreSQL、匿名身分與 Realtime 實作；外部地點／路線服務透過可替換 adapter 接入。

核心展示以整理好的大臺北場地資料與本地交通矩陣為基線，不能因外部 API 暫時不可用就無法產生結果。

### 1.1 自管模型與 RAG 決策

生成模型、Embedding 模型與場地檢索索引由團隊自行部署及控制；不使用外部模型 API。模型型號、量化、維度、推論工具與索引實作待硬體和最小驗證後選定，本規格不預設雲端模型或特定框架。

「不使用 API」不影響應用 API、Realtime 或自管推論介面。應用後端維持模組化單體；必要的模型執行程序屬推論部署元件，前端不直接存取推論服務或向量索引。資料庫／同步的部署位置另行確認，不能把自管模型宣稱為全系統離線。

分工：另一位成員負責前端 UIUX；使用者負責後端與模型／RAG。雙方共用下列應用 API 與 JSON 契約，先用合成資料驗證格式，再串真實後端。

### 1.2 推論與推薦流程

```text
前端 → 應用後端（身分與權限）
     → 自管生成模型解析每人需求 → schema 驗證
     → 程式硬篩選 → 自管 Embedding＋場地索引檢索
     → 檢查候選限制 → A／B 適配計分
     → 程式組合行程與完整時間／成本驗證
     → 自管生成模型依核准公開事實撰寫理由
     → Privacy Guard → 雙方公開狀態
```

硬篩選限制必須套用至檢索候選集合；不足時可擴大合格集合內的召回，不能放寬硬限制來湊數。全程不依賴模型自行判定最終合法性。

### 1.3 場地 RAG 資料契約

- 場地結構化事實存於資料庫；檢索文件保存 venue_id、描述、來源、更新時間、資料版本與公開屬性。
- 場地／活動各自為檢索單位；長描述必要時切塊，每塊保留 venue_id 與來源。查詢和文件使用同一套 Embedding 版本與維度。
- 索引記錄 Embedding 模型版本、維度與資料版本；模型或資料改變後重建受影響索引，禁止混用不相容向量。
- 私密原文不進共用索引。個人查詢只在該使用者／Session 的權限邊界內處理，暫存與日誌不得洩漏內容。
- 檢索結果是不可信資料，不能執行其中指令；公開說明僅接收驗證後的公開事實，不能以「用了 RAG」代替隱私檢查。
- 模型檔、索引、快取位於專案根目錄下的明確子目錄；路徑、版本、來源、授權與重建方式需在實作時記錄，內容不進 Git。

## 2. 邏輯分層

### 輸入層

- 匿名使用者與雙人房間。
- 公開共同條件。
- 每人私密文字、標籤與 visibility。

### 決策層

1. Natural Language Parser：將自然語言轉成 preference-query schema。
   使用自管生成模型；RAG Retriever 以自管 Embedding 與場地索引提供可追溯候選，不能取代後續過濾與計分。
2. Hard Constraint Filter：純程式驗證不可違反的條件。
3. Adjective Sensitivity Engine：維護形容詞理想區間、重要性與信心值。
4. Couple Scoring Engine：計算個人與雙人公平適配度。
5. Itinerary Composer：組合站點、時間、交通與成本。
6. Local Replanner：保留鎖定站點，替換衝突站點。
7. Privacy Guard：移除私密原句、來源身分與可反推線索。

### 輸出層

- 只回傳 itinerary schema 允許的公開欄位。
- 任何未通過時間、成本、營業、交通或隱私檢查的方案都不能進入前端。

## 3. 資料設計

核心實體：

- users：匿名或正式使用者顯示資料。
- couples、couple_members：雙人關係與角色。
- preference_profiles、adjective_preferences：長期偏好與形容詞模型。
- date_sessions、session_inputs：本次規劃與原始／結構化輸入。
- venues、venue_attributes、offers：場地、人工屬性與合作內容。
- itineraries、itinerary_stops：方案與站點。
- reactions、date_reviews：雙人意見與約會後回饋。

原始 session_inputs 與公開 itinerary 必須分離。private input 不得透過共用查詢、共用 cache key、Realtime payload 或一般 log 洩漏。

## 4. 應用 API 契約（保留）

以下是自家前後端通訊介面，不是外部模型 API。自管推論服務只由後端呼叫，金鑰、模型路徑及私密上下文不回傳瀏覽器。

| Method | Endpoint | 主要責任 |
|---|---|---|
| POST | /api/couples | 建立房間與邀請碼 |
| POST | /api/couples/join | 以邀請碼加入 |
| POST | /api/sessions | 建立約會 Session |
| PUT | /api/sessions/:id/shared | 更新共同條件 |
| POST | /api/sessions/:id/private-inputs | 儲存個人私密需求 |
| POST | /api/sessions/:id/confirm | 確認雙方完成 |
| POST | /api/sessions/:id/generate | 產生三套方案 |
| GET | /api/sessions/:id/itineraries | 取得公開方案 |
| POST | /api/itineraries/:id/reactions | 喜歡、拒絕、替換 |
| POST | /api/itineraries/:id/replan | 局部重排 |
| POST | /api/sessions/:id/finalize | 選定最終方案 |
| POST | /api/sessions/:id/reviews | 評分與偏好更新 |

私密輸入 endpoint 只能由輸入者與受信任的伺服器決策流程使用；對方的讀取 API 不得回傳 raw_text、structured_input 或可辨識來源的錯誤訊息。

## 5. 計分與生成

個人適配度：

UserFit(u, v) = Σ(attribute_fit × importance × confidence) / Σ(importance × confidence)

雙人方案：

CoupleScore = 45% × min(A, B) + 25% × mean(A, B) + 15% × context + 10% × novelty + 5% × route_efficiency

Sponsored 或合作費用不進入任何適配分數。硬限制在計分前排除，且需保留機器可讀的淘汰原因供測試與除錯；淘汰原因不能直接成為共同 UI 文案。

每套行程要通過：

- 2～4 個站點。
- 日期、抵達／離開時間與最晚結束。
- 每站營業或活動時段。
- 交通方式、單段／總移動時間。
- 每站費用與總預算。
- 過敏、飲食、健康、體力、年齡／場域與 Hard No。
- 三套方案的差異門檻。

## 6. 隱私實作

Privacy Guard 必須在公開輸出前執行：

1. 檢查是否包含任一私密原句或高相似片段。
2. 檢查是否包含 A／B 或輸入者指向。
3. 檢查是否把私密排除原因說得過度具體。
4. 改寫成共同條件、中性理由，或不提供理由。
5. 重新通過公開 itinerary schema 與 policy check。

不要只依賴 LLM 的自我約束；要有程式層的欄位隔離、輸出 allowlist、日誌過濾與對抗性測試。

## 7. 外部服務與降級

地點／路線 API 的即時資料是 optional。若逾時、無配額或回傳不完整，使用本地 curated data、營業快照與交通矩陣；介面必須標示資料時間或無法確認的狀態，不可把估算說成即時確認。

外部訂位／購票只提供連結跳轉，不在 MVP 內代理付款、保證座位或處理退款。

### 自管模型／索引失敗

- 模型未啟動、記憶體不足或逾時：回傳可識別的失敗狀態，不自動呼叫外部模型 API。
- 解析輸出不合 schema：受控重試仍失敗就中止；不得用任意文字冒充結構化成功。
- 索引缺失、版本不符或候選不足：回報索引未就緒或無足夠候選，不虛構場地。
- 已驗證行程若只有說明生成失敗，可用固定中性模板；它只替代文字，不代表 RAG 或模型驗收通過。

## 8. 測試策略

### 靜態與契約

- JSON Schema 可獨立解析。
- 合法 fixture 能通過 schema。
- 非法欄位、缺少必要欄位、超過站點數、負數價格與不合法 visibility 會被拒絕。

### 純邏輯

- 硬限制一項失敗即排除。
- Hard No 不會被偏好高分覆蓋。
- CoupleScore 對一方 0 分的情況不被平均掩蓋。
- 三套方案有實質差異。
- replan 保留 locked stop，替換後重新驗證整條路線。
- 「太暗」等回饋只在 session 或經同意後寫入 long-term。

### 隱私

- A 的 API token、查詢參數與 Realtime payload 不能取得 B 的 raw_text 或 structured_input。
- public_reason 不含私密原句、來源身分或可反推資訊。
- 伺服器日誌只保留 ID、事件類型與錯誤類型。

### 整合與真實操作

- 兩個獨立瀏覽器／裝置完成邀請、共同條件、私密輸入、生成、投票、重排與 finalize。
- 驗證同步延遲、失聯重連與重複提交。
- 驗證外部 API 失效時仍可完成核心 Demo。

### 自管推論與 RAG

- 在目標機記錄生成與 Embedding 模型版本、量化、硬體、記憶體峰值與啟動方式。
- 以固定繁中需求與人工期望場地評測 Recall@K／排序，先定義 K 與合格門檻再測；另以新案例驗證，不能只展示用過的範例。
- 測試否定、程度、雙人衝突、未知詞、缺資料、索引過期與惡意檢索文件。
- 驗證共用索引與公開回應不含私人原文；無檢索證據不能宣稱 RAG 成功。
- 透過部署設定與執行時出站紀錄確認沒有外部模型請求；阻斷外部模型端點後重跑實際本地推論，不用 mock 代替。
- 關閉本地模型／索引時應顯示真實錯誤，不能暗中轉送雲端。

## 9. 效能目標

- 公開狀態同步：目標 2 秒內。
- 第一輪三套行程：目標 15 秒內。
- 局部重排：目標 8 秒內。

量測時要記錄目標硬體、模型版本／量化、資料集大小、檢索與本地推論耗時、冷／暖啟動、併發、外部地點 API 狀態與 p50／p95；單次成功不可代表穩定達標。

## 10. 未完成不代表通過

本 TDD 只定義如何做與如何驗收。尚未有 App 實作、雙裝置測試、外部連結驗證或 Owner sign-off 時，必須回報為未驗證，不得以文件 commit 代替 Runtime acceptance。
