# Sideby — MVP TDD

## 1. 技術決策

實作狀態依 ROADMAP 的 Phase 1～5 五個頂層階段回報；1A／1B 與 4A～4E 是工作包，不能作為額外 Phase 或整階段通過證據。

MVP 採模組化單體，不拆微服務。建議以 React、Next.js、TypeScript、Server Routes、PostgreSQL、匿名身分與 Realtime 實作；本次不接 Google API，地點／路線以核准資料與本地交通矩陣提供。

核心展示以整理好的大臺北場地資料與本地交通矩陣為基線，不能因外部 API 暫時不可用就無法產生結果。

### 1.1 自管模型與 RAG 決策

生成模型、Embedding 模型與場地檢索索引由團隊自行部署及控制；不使用外部模型 API。模型型號、量化、維度、推論工具與索引實作待硬體和最小驗證後選定，本規格不預設雲端模型或特定框架。

「不使用 API」不影響應用 API、Realtime 或自管推論介面。應用後端維持模組化單體；必要的模型執行程序屬推論部署元件，前端不直接存取推論服務或向量索引。資料庫／同步的部署位置另行確認，不能把自管模型宣稱為全系統離線。

分工：另一位成員負責前端 UIUX；使用者負責應用後端、權限、規則與整合；模型／RAG 拆為獨立工作包，承接人待確認。協作者共用下列應用 API 與 JSON 契約，先用合成資料驗證格式，再串真實後端。

### 1.2 推論與推薦流程

```text
前端 → 應用後端（身分與權限）
     → 小型需求分類器＋明確數值規則 → 必要時釐清 → schema 驗證
     → 程式硬篩選 → 自管 Embedding＋場地索引檢索
     → 檢查候選限制 → A／B 適配計分
     → 程式組合行程與完整時間／成本驗證
     → 自管生成模型依核准公開事實撰寫理由（尚待實作）
     → Privacy Guard → 雙方公開狀態
```

硬篩選限制必須套用至檢索候選集合；不足時可擴大合格集合內的召回，不能放寬硬限制來湊數。全程不依賴模型自行判定最終合法性。

此流程尚未接通：小型分類器是黑客松先行解析路徑，需求資料契約與驗證器已完成；自管生成模型可在有驗證證據後補充未涵蓋語意。分類器未接入前直接要求釐清，不假裝大型模型已完成解析。索引未就緒不能把規則排序標示為 RAG 成功；說明文字的中性模板只適用已驗證的行程。

### 1.3 場地 RAG 資料契約

- 場地結構化事實存於資料庫；檢索文件保存 venue_id、描述、來源、更新時間、資料版本與公開屬性。
- 場地／活動各自為檢索單位；長描述必要時切塊，每塊保留 venue_id 與來源。查詢和文件使用同一套 Embedding 版本與維度。
- 索引記錄 Embedding 模型版本、維度與資料版本；模型或資料改變後重建受影響索引，禁止混用不相容向量。
- 私密原文不進共用索引。個人查詢只在該使用者／Session 的權限邊界內處理，暫存與日誌不得洩漏內容。
- 檢索結果是不可信資料，不能執行其中指令；公開說明僅接收驗證後的公開事實，不能以「用了 RAG」代替隱私檢查。
- 模型檔、索引、快取位於專案根目錄下的明確子目錄；路徑、版本、來源、授權與重建方式需在實作時記錄，內容不進 Git。
- 場地可有 optional `google_place_id`，它是唯一可長期保存的 Google 識別欄位，不是場地事實、排名特徵或 RAG 文件內容。名稱、地址、評論、照片、搜尋結果與衍生標籤若來源是 Google，政策守門必須拒絕持久化與索引。

### 1.4 Phase 1B 已實作選擇（2026-09-04）

- Next.js App Router＋TypeScript＋pg＋Zod；版本鎖定 package-lock.json。
- 匿名 Bearer 憑證只存雜湊、七天到期；邀請碼 24 小時到期，A／B 固定兩個席位。
- PostgreSQL 私有資料庫：anonymous_users、couples、couple_members、date_sessions、session_confirmations。其他下列資料表仍是後續規格。
- 共同條件採 optimistic version，交易鎖序列化修改／確認；編輯後清空兩方確認。
- Phase 1B 以 SSE＋500ms 查庫提供公開快照，10 秒心跳、30 秒在線期限、60 秒重連。尚未接 Supabase Realtime／RLS。
- 應用 API 是唯一資料入口；共同狀態固定欄位輸出，不對前端開放資料表。每房間暫定一個 Session，重送建立回原 Session。
- db/001_rooms.sql 為實際 migration；本機開發／測試使用可攜 PostgreSQL，資料、密碼與紀錄留在 .local/ 並排除 Git。
- 已實作路由、公開狀態、輸入範圍與錯誤以 [BACKEND_API](docs/BACKEND_API.md) 為 Phase 1B 串接契約；下文完整 MVP API 不代表已全部可用。

## 2. 邏輯分層

### 輸入層

- 匿名使用者與雙人房間。
- 公開共同條件。
- 每人私密文字、標籤與 visibility。

### 決策層

1. Natural Language Parser：將自然語言轉成 preference-query schema。
   首批使用小型分類器＋規則，未涵蓋語意須釐清；自管生成模型是待評測的補充。RAG Retriever 以自管 Embedding 與場地索引提供可追溯候選，不能取代後續過濾與計分。
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
- date_sessions、session_inputs：本次規劃與原始／結構化輸入；`session_inputs` 以 `(session_id,user_id)` 唯一，保存 visibility、parse_status 與已驗證 parser envelope。
- venues、venue_attributes、offers：場地、人工屬性與合作內容。
- venues 的 `google_place_id` 為 optional 外部識別；其他可推薦欄位仍須有自有／授權／合規開放來源與權利紀錄。
- itineraries、itinerary_stops：方案與站點。
- reactions、date_reviews：雙人意見與約會後回饋。
- venue_feedback：每位使用者對場地的補充、分類、1～5 分、想去／去過與可見性；私人內容和公開投影分離。
- terms_acceptances、consent_preferences：條款版本／時間，以及可撤回的個人化與模型改進設定。
- review_reports、training_candidates：公開評論檢舉／審核，以及經同意、去識別和人工核准的下一版離線訓練候選。

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
| GET／PUT | /api/me/venues/:venueId/feedback | 讀寫本人的私人場地清單、補充、分類與 1～5 分 |
| PATCH／DELETE | /api/me/venue-feedback/:id | 改變本人回饋、公開／取消公開或刪除 |
| GET | /api/venues/:venueId/public-reviews | 取得已核准公開評論的分頁列表 |
| POST | /api/public-reviews/:id/reports | 檢舉公開評論 |
| GET／PUT | /api/me/consents | 讀寫條款接受、個人化與模型改進設定 |

2026-09-05 已實作並以正式建置產物做 HTTP 整合測試：`GET／PUT /api/me/consents`、`GET／PUT /api/me/venues/:venueId/feedback`、`PATCH／DELETE /api/me/venue-feedback/:id`、`GET /api/venues/:venueId/public-reviews`，以及 `GET／POST／DELETE /api/sessions/:id/private-inputs`。`POST /api/public-reviews/:id/reports`、管理者審核／隱藏介面、頻率限制、前端、正式自管模型／RAG 與模型學習出口尚未實作。現在只有場地 ID 格式驗證；正式場地資料表尚未接入，因此尚未驗證該 ID 確實存在。

私密輸入 endpoint 只能由輸入者與受信任的伺服器決策流程使用；對方的讀取 API 不得回傳 raw_text、structured_input 或可辨識來源的錯誤訊息。

### 4.2 Phase 2 私密輸入與 parser envelope

`POST /api/sessions/:id/private-inputs` body 為 `rawText`、`tags` 與 `visibility`；伺服器從 Bearer token 決定 user_id，資料庫以 `(session_id,user_id)` upsert。GET 只取得本人輸入，DELETE 刪除本人輸入；非成員及另一人的不存在投影都回 404。POST／DELETE／remembered 撤回會增加 Session 公開 revision 並清除既有 confirmations，使並行的舊版確認以 VERSION_CONFLICT 失敗；公開 revision 只表示決策輸入已改變，不暴露內容。

目前 parser 入口是 `rule_baseline_v1`，envelope 狀態固定為 `parsed／needs_clarification／unavailable`。只有符合 preference-query 契約的 parsed 結果可保存；不完整候選轉成 `PARSER_OUTPUT_INVALID` unavailable。規則只處理有限明示語句與阿拉伯數字限制，不能安全覆蓋完整句子時回澄清，不忽略未支援硬限制。這是可執行基準，不是自管分類器或 LLM 已交付。

`private_remembered` 只在當期條款有效且 `personalization_enabled=true` 時接受；關閉設定時，既有 session_inputs visibility 與 parsed result visibility 一併降為 `private_session`。原始私密輸入不會因 `model_improvement_opt_in` 自動進 training candidate 或共用索引。

### 4.1 場地回饋、可見性與同意

`venue_feedback` 至少保存 `feedback_id`、`user_id`、`venue_id`、`note_text`、`user_tags`、`rating_1_to_5`、`visit_state`、`visibility`、`moderation_status`、建立／更新／刪除時間及偏好版本。`visibility` 僅為 private／public；`moderation_status` 分開保存 pending／approved／rejected／hidden／deleted，避免把「作者想公開」冒充「已可公開顯示」。

新回饋固定為 private。作者切換 public 時建立待審核公開投影；取消公開立即從公開讀取與快取移除，但保留本人私人內容，除非作者另行刪除。公開 endpoint 只回傳 approved、未刪除、目前仍為 public 的純文字、1～5 分、公開標籤、匿名顯示名稱與日期；不得回傳 user_id、私密偏好、情侶關係、原始需求或內部審核資訊。

MVP 的公開評論為短純文字，建議限制 300 個 Unicode 字元並禁止 HTML、可點擊外部連結與圖片。輸出必須轉義，另以資料庫長度限制、頻率限制、內容審核、檢舉、隱藏及刪除處理濫用。評論是 untrusted user content，前端不得插入 HTML，自管模型／RAG 也不得執行其中指令。

`terms_acceptances` 保存 `terms_version`、接受時間與適用用途；服務必要儲存以有效條款接受為前置。`personalization_enabled` 控制後續私人回饋能否更新本人長期偏好，`model_improvement_opt_in` 控制去識別後能否進入訓練候選。設定有效時不逐則重問；撤回後停止新增長期更新或訓練候選。公開可見性與兩項設定相互獨立。

公開評論及私人回饋均不得直接寫入共用 RAG、官方事實或共用場地屬性。只有在擷取時有有效模型改進同意、通過去識別與人工核准、保留來源回饋 ID／同意版本／資料版本的內容，才能進 `training_candidates`；候選仍須依第 11 節切分、評測與版本閘門，不能在線自動重訓或立即替換正式模型。

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

目前 PublicState／SSE 與公開評論出口已接 `publicProjection` 欄位守門，遇到 rawText、structuredInput、parserOutput、clarification、userId、token 或 inviteCode 等私密欄位會拒絕輸出；`safePublicReason` 會拒絕私密原句及 A／B／「其中一方」來源線索。Phase 3 生成公開理由時仍須把所有私密原文傳入同一守門並做兩瀏覽器對抗測試，現階段不能宣稱完整 Privacy Guard 已驗收。

## 7. 外部服務與降級

本次不接 Google API，也不建 Google Places live adapter。展示使用核准的 curated data、營業快照與本地交通矩陣；其他資料服務仍須個別確認來源與權利，不能自動接入。介面必須標示資料時間或無法確認的狀態，不可把估算說成即時確認；必要事實未知時不能通過可執行驗證。

外部訂位／購票只提供連結跳轉，不在 MVP 內代理付款、保證座位或處理退款。

Google 詳細資訊同樣只做外部跳轉。按鈕文字固定為「在 Google Maps 查看」，URL 以自有／授權的 `venue.name` 作必填 `query`，使用 UTF-8 URL encoding；有 `google_place_id` 時加入 `query_place_id` 並以它優先鎖定目的地。格式：`https://www.google.com/maps/search/?api=1&query=<urlencoded name>&query_place_id=<place_id>`。URL 不得包含 API key；開啟 Maps URL 不計為本專案的 GMP API 呼叫。若沒有 Place ID，可只用已編碼的自有／授權名稱跳轉，但不得因此呼叫 Google 搜尋補資料或把回傳頁面存回資料庫。

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
- `google_place_id` 可省略；有值時 URL builder 產生正確編碼、含 `api=1` 與 `query_place_id`、不含 API key 的外部網址。
- 場地政策守門拒絕以 Google 為來源的名稱、地址、評論、照片、搜尋結果、衍生標籤及 RAG 文件；只允許 Place ID 作選用外部識別。

### 純邏輯

- 硬限制一項失敗即排除。
- Hard No 不會被偏好高分覆蓋。
- CoupleScore 對一方 0 分的情況不被平均掩蓋。
- 三套方案有實質差異。
- replan 保留 locked stop，替換後重新驗證整條路線。
- 「太暗」等回饋立即影響本次 session；只有有效 `personalization_enabled` 才寫入本人 long-term，且不影響其他使用者。

### 隱私

- A 的 API token、查詢參數與 Realtime payload 不能取得 B 的 raw_text 或 structured_input。
- public_reason 不含私密原句、來源身分或可反推資訊。
- 伺服器日誌只保留 ID、事件類型與錯誤類型。
- 私人 `venue_feedback` 無法被另一位使用者、伴侶、公開列表、搜尋、統計、RAG 或快取讀取。
- 新評論預設 private；只有作者可切換公開、取消公開或刪除，且 pending／rejected／hidden／deleted 均不出現在公開列表。
- 公開評論輸出不含 user_id、情侶關係、私密需求或內部偏好；HTML／腳本／外部連結不會成為可執行內容。
- 條款、個人化與模型改進同意的版本、時間與撤回行為有整合測試；公開設定不會暗中打開模型改進同意，反之亦然。
- 訓練候選匯出只包含同意有效、去識別及人工核准的列；私人原文、已撤回的後續資料及未核准評論必須被排除。

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

Phase 1B 已有可執行 API、migration 與真實 PostgreSQL／HTTP 整合測試；完整 MVP 下列各層仍依各自證據驗收。真實雙裝置、私密輸入隔離、模型／RAG、推薦、外部連結及 Owner sign-off 尚未完成，不得以文件或房間測試代替。

## 11. 黑客松小型需求分類器（需求資料契約已實作，訓練待執行）

### 11.1 目標與基準

第一版採字元 TF-IDF＋Logistic Regression，在本機 CPU 執行；此處先記錄方法，尚未安裝 Python 訓練依賴或測出耗時。

只訓練「原句 → 有限屬性的偏好方向」，不學商家知識、不訓練完整行程生成、不訓練大型語言模型。先建立固定關鍵字／否定規則基準，與分類器使用相同資料切分及評分程式。僅有訓練 loss 下降不能證明效果改善。

首批核心屬性為 bright、quiet、cute、childish；資料足夠時增加 interactive、walking，總數先限制 4–6 個。每個屬性可標 prefer／avoid／indifferent／not_mentioned；需要釐清、矛盾與程度另存欄位。方向不能從「出現了安靜兩字」直接決定。

### 11.2 需求表與人工標註

以 CSV 或 JSONL 整理約 100–200 句作起步，實際是否足夠按各標籤支持數和保留題表現判斷。

| 欄位 | 用途 |
|---|---|
| sample_id | 穩定案例識別碼 |
| text | 去識別的原句，保留繁中口語及標點 |
| group_id | 原句及其改寫的共同群組，防止跨組洩漏 |
| source_type／source_ref | 自行撰寫、經同意訪談或 AI 候選；來源參照不放個資 |
| annotations | 屬性、方向、程度（low／medium／high／unspecified）及對應原文片段 |
| expected_constraints | 明確數值、單位、硬上限與範圍，沒有就留空 |
| needs_clarification／reason | 模糊、矛盾、未支援語意及應釐清的點 |
| reviewer／review_status | 標註者代號、待審／同意／爭議；爭議未解不進黃金答案 |
| split | train／validation／test，分組後固定 |
| taxonomy_version／dataset_version | 尺度及資料版本，避免改定義後仍沿用舊分數 |

兩位標註者先各自標同一小批，對齊定義與爭議；主要資料至少逐筆人工核准，模糊／否定案例再交叉檢查。AI 可協助產生候選句，不自行核准標準答案。刻意保留「不強求」與「未提及」差別；不要以全部未提及大量灌水。

同一原句、提示模板衍生改寫須同 group_id；若同一受訪者／來源有高度重複敘事，也共同分組。正式私密輸入不是預設訓練來源；資料採集／訓練同意與長期偏好記憶同意分開。

Phase 1 已實作以下資料層入口：

- `src/model/requirements.ts`：Zod 契約、逐筆驗證、重複 sample_id、group split 與資料／taxonomy 版本檢查。
- `scripts/validate-requirements.ts`：JSONL 命令列驗證器，輸出 VALID／INVALID 與錯誤清單。
- `data/training/requirements.example.jsonl`：六筆明確標為 synthetic 的格式範例，不是真實需求表或模型品質證據。
- `tests/model-requirements.test.ts`：驗證合法範例、group 跨切分及未審核／虛構原文證據的拒絕行為。

真實需求表放在 `.local/phase1/requirements.jsonl` 並排除 Git；只有人工核准案例可進 train／validation／test。資料驗證通過仍不代表分類器已訓練或達到品質門檻。

### 11.3 切分、訓練與保存

1. 凍結第一版標籤定義，依 group_id 分組約 60% 訓練、20% 驗證、20% 最終測試。兼顧各屬性正反向涵蓋；分組優先於精確比例。只有一個群組的類別不能宣稱有獨立測試能力。
2. 規則基準固定後保存其版本與輸出。訓練流程以 scikit-learn Pipeline 串接字元 TfidfVectorizer 與每屬性 Logistic Regression 多類別分類器；首輪可用 char 2–5 grams、正則化與有限迭代，實際參數、套件版本及 random seed 須落盤記錄。
3. 詞表、IDF、分類器只 fit 訓練組。每個 head 必須至少有兩個實際類別才能 fit；沒有足夠正向／排斥案例的屬性標記 unsupported，不以常數輸出宣稱訓練完成。類別不平衡可在驗證組比較 class_weight 設定，不做大範圍搜尋。
4. 初版只訓練方向分類。程度、否定作用範圍、幣別／每人或合計／時間等採另行驗證的規則；含雙重否定、衝突或不支援語意時需要釐清。不能把分類機率當成 target_min、target_max 或已校準 confidence。
5. 同義改寫失敗且仍有時間時，才用相同切分比較 SetFit＋中文相容預訓練模型；選定模型、授權、目標硬體、版本與訓練範圍後執行。這是可選的小型文字模型調整，非必要的大型生成模型微調；尚未選型或安裝。
6. 模型選擇及機率／拒判門檻只使用驗證組。凍結版本後跑最終測試一次；看過測試錯誤後再調整，原測試集就不再是未見證據，下一輪需另留新測試。
7. 保存資料／切分雜湊、標籤表、程式 commit、設定、訓練耗時、硬體、套件版本、模型產物與逐題結果。模型產物在專案 models/，私有資料／紀錄在 .local/，均不入 Git。只提交無私密內容的腳本、定義及彙總報告。

### 11.4 與現有解析契約接合

訓練表不是前端直接傳送的 preference-query schema。後端需有轉換及驗證步驟：方向／程度 → 版本化尺度 → preferences／avoid；明確數值規則 → hard_constraints；最後驗證 schemas/preference-query.schema.json。

已實作：解析服務結果分 parsed／needs_clarification／unavailable。只有 parsed 攜帶合法 preference-query；追問只由本人 private-input API 取得，不進共同狀態。當前只接 `rule_baseline_v1`，自管分類器／生成模型 adapter 尚未接入；規則基準不得冒充模型驗收。

bright 等初始程度對應的區間由人工錨點及設定定義；未校準前不宣稱「明亮必然等於 0.7」。indifferent 不轉成排斥，not_mentioned 不生成限制。模糊詞、未知類別及 conflicting 不能自動當作「完全沒限制」。若使用者未說步行分鐘，不可補出硬上限。模糊句即使分類分數高，也不能略過釐清規則。

### 11.5 驗收與停止條件

可重跑入口為 `npm run requirements:validate -- <requirements.jsonl>` 與 `npm run phase1:check`；完整 CC 交接見 `docs/PHASE1_ACCEPTANCE.md`。後者缺少模型、評測、RAG 或兩瀏覽器 Runtime 證據時必須 fail closed。

- 逐屬性及各方向報告 precision／recall／F1、support，另報 macro-F1、混淆案例與 group 數。未提及類別分開報告，不用總 accuracy 掩蓋否定失敗。
- 分開報告程度規則、明確數字／單位解析、釐清案例成功率及可自動處理覆蓋率。全部拒判不能算「解析零錯誤」的成功產品。
- 驗證組上分類器須比固定規則帶來可說明的收益，且關鍵否定／硬限制案例不退步；最終測試報實際差異，不預先保證準確率或顯著改善。
- 已定義的硬限制違反案例要求 0 個放行；未知條件須拒絕／釐清。這只是該組測試門檻，不宣稱所有真實輸入永遠零錯誤。
- 如訓練路徑無收益或超出時間，保留規則／人工選項並標示實際模式；保存失敗證據，不假稱已部署分類器。
- 分類成功、RAG 命中、三套行程可執行、兩人接受度分開評測。需求表不包含某店實際採光資訊，不能拿它當場地資料。

## 12. 非 Google 場地證據與資料可行性

### 12.1 來源及更新

- 不接 Google API，不將 Google Maps／Places／搜尋摘要／Takeout 衍生內容寫入場地資料、標籤、訓練或索引。貼上的 Google live adapter 建議未被採用。
- Place ID 是上述保存限制的窄例外：只可保存為 optional `google_place_id`，不得連帶保存 Google 回傳的名稱、地址、評論、照片、搜尋結果或依其推導的標籤。MVP 不批次呼叫 Google Text Search 建庫。
- 採集名單從有授權的開放資料、團隊自有觀察與商家直接提供資料開始；資料集授權、文字、照片、衍生分析及發布權利分開記錄，來源不明先隔離不用。
- 商家官網可用來核對事實及保留出處，但不得因公開可見就批量轉存全文或照片。主觀宣傳描述只作有限證據，不能當現場體驗已驗證。
- 核心欄位為 venue_id、名稱／類別、地點、營業／活動日期、費用範圍、資料來源、查核時間、授權／使用範圍、更新負責人；價格及時段不足以驗證時該候選不能通過必要限制。
- 照片是選用展示資料。沒有可用照片時使用自製圖示與文字，不從其他網站補抓圖片。照片不可證明現場安靜、無排隊或全天採光。

### 12.2 屬性紀錄（資料契約已實作）

| 欄位 | 定義 |
|---|---|
| venue_id／attribute | 對應地點與版本化屬性名稱 |
| value／scale_version | 有錨點的分級或數值；未知為 null，不能以 0 表示 |
| evidence_kind／evidence_ref | 實訪、場館直接資料、開放資料或可用圖片及證據參照 |
| evidence_summary | 僅保存有權使用的必要事實摘要 |
| observed_at／checked_at | 實際觀察與來源查核時間分開 |
| context | 白天／晚上、平日／週末、室內／戶外或指定區域 |
| review_status／reviewer | proposed／approved／disputed／stale 及審核者代號 |
| source_quality／uncertainty | 證據品質及分歧原因，不用模型自報機率冒充可靠度 |

例：某場地「平日下午窗邊採光良好」只支持該情境的 bright；週末 quiet 未查就是未知。模型可先提出標籤及證據片段，人工核准後才成為候選依據。不同時段／觀察者分歧保留，不強行平均成虛假的精確值。

實作入口為 `src/venues/schema.ts`，交換契約由它產生至 `schemas/venue-record.schema.json`。`src/venues/policy.ts` 是發布、共用排序及建立 RAG 文件前的共同守門；它拒絕 Google 衍生來源、無重用權利的 RAG 內容、缺證據的核准屬性，並排除 personal 回饋。`src/venues/government-import.ts` 只把正規化政府資料轉成 draft，營業資訊最多為 `source_reported`，價格未知，主觀屬性為空。`tests/venue-data.test.ts` 以壞輸入與合成資料鎖定這些規則。

商家頁面的公開內容預設 `reference_only`，除非另有可重用權利；它可用來人工核對價格、公告時段等事實，但不會因宣傳文字出現「浪漫」就建立 romantic 屬性。情境屬性進 RAG 時必須連同平假日、時段與區域文字輸出，避免脫離情境。

### 12.3 試點與行程覆蓋

建議先在大臺北單一小區域整理 12–20 個場地試點，涵蓋飲食與活動等必要類型；數量及地點尚待選。先驗證三套行程與差異規則，再決定是否需擴充；30–50 筆也不是必然充分的門檻。只有合成資料時只能稱結構展示，不宣稱真實推薦完成。

用小範圍、明確日期與交通方式驗證完整鏈路。必要限制對應事實未知即不放行；軟屬性未知則不能宣稱符合，可顯示缺證或要求釐清。交通矩陣要記錄估算方法、時段與緩衝；直線距離不能當可步行路線或精準即時車程。

### 12.4 官方查核來源（2026-09-04）

- [Google Maps Platform Terms §3.2.3](https://cloud.google.com/maps-platform/terms)：禁止特定擷取／儲存、建立衍生內容及使用 Maps 內容改善 AI 模型。此處記錄本專案不採用的決定，不把各服務／區域例外整理成通用法律結論，也不據此新增 live adapter。
- [Places API 政策](https://developers.google.com/maps/documentation/places/web-service/policies)（2026-09-05 重核）：Place ID 不受快取限制，可永久保存；本專案只採此窄例外。
- [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)（2026-09-05 重核）：外部 Maps URL 不需 API key，`query` 必填且需正確編碼，`query_place_id` 可優先鎖定目的地。
- [新北市觀光旅遊景點中文](https://data.gov.tw/dataset/122908)：頁面列有地址、座標、介紹、時段、票價等欄位與 CSV、政府資料開放授權條款第 1 版。資源名稱含「106年更新」、詮釋資料更新時間為 2024-12-20；逐筆現況及完整性仍待查核。
- [臺北旅遊網景點資料中文](https://data.gov.tw/dataset/128696)：頁面有 CSV／相同開放授權，但目前列示欄位偏分類與行政區，不能宣稱已取得完整商家 POI。尚需檢查實際檔案。
- 2026-09-05 以官方下載網址做本機唯讀抽查：新北 CSV 有 540 筆、27 欄且座標欄存在，492 筆票價欄空白，記錄中的最新 `Changetime` 為 2022-12-25；營業欄雖非空，部分是「全年開放」或需另洽詢等文字，仍不能直接通過目前時段驗證。臺北 CSV 只有 13 筆行政區／主題景點彙整列，不是含地址座標的逐場地資料。原始 CSV 只留在 `.local/source-audit/`，未提交或當成可推薦資料。
- 上述抽查證明新北資料可作候選骨架，不能證明有完整餐廳母體、資料仍營業、票價有效或任何氣氛屬性；臺北這一份資料不適合作場地母表。授權條款要求顯名，正式匯入必須保留提供機關、資料集名稱、版本與授權網址。
- [scikit-learn 文字特徵](https://scikit-learn.org/stable/modules/feature_extraction.html)、[Logistic Regression](https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LogisticRegression.html)、[SetFit 多標籤分類](https://huggingface.co/docs/setfit/main/en/how_to/multilabel)：作為方法參照，未在本專案安裝或測出訓練效能。
