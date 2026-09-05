# Sideby — MVP ROADMAP

## 2026-09-05 本輪最新路徑

本輪新增 Google 本機接線子項（不新增 Phase）：官方 Maps JavaScript／Places (New)／Routes／Geocoding、私密設定範本與 `/maps-check` 已實作；憑證／帳務輸入、真實服務及正式部署為待辦，不標整體 PASS。操作見 `docs/GOOGLE_MAPS_LOCAL_SETUP.md`；其他工作同時進行的 Roadmap 重整不由本次覆蓋。

使用者指定主 Repo `louis8791/sideby`。本輪先完成同 Repo 的 `frontend/`、根後端、獨立 lockfile／建置與共同文件，再依序接建房／加入、私密輸入、確認、Gemini／Google Maps、生成／定案，最後驗雙裝置及正式網址。Manus 只增指定元件。

不排訓練、自管生成、Embedding 或 RAG；進階需求句改作核准後的回歸驗收。下方八階段與舊自管／零 API 工作包保留歷史對照，相關項目為 DEFERRED，不能當作 API 型 MVP 的必要訓練前置。既有後端規則／隱私測試仍需通過，前端匯入與代理不代表主流程串接完成。最新分工與驗收界線見 `docs/TEAM_INTEGRATION.md`。

現場協作入口：`docs/TEAM_INTEGRATION.md`。先固定後端與唯一展示主線，再接 Lovable；Manus 先交指定畫面／元件。本輪整合不增加新的頂層 Phase，現有八階段與模型／RAG 的延後決策維持適用。

## 交付原則

本 Roadmap 依產品依賴分為 8 個頂層 Phase。每階段都要分開回報文件、程式、測試、Runtime、雙裝置與 Owner 證據；某一層通過不能代替其他層。六小時黑客松安排只放在附錄，不是產品 Phase 或完成證據。

跨階段固定邊界：

- Sideby 是雙人私密需求共決策產品，不是地點清單或單人行程產生器。
- 本輪採 Gemini＋Google Maps；自管生成、Embedding、RAG 及訓練為 DEFERRED。外部解析要驗同意、隱私、schema 與失敗狀態，不以固定範例假裝成功。
- 不以 Google Places／Maps API 或批次 Google Text Search 建庫。唯一可長期保存的 Google 識別欄位是 optional `google_place_id`。
- Google 衍生的名稱、地址、評論、照片、搜尋結果與標籤不得進持久層、RAG、Embedding、訓練或評測；推薦、排序與公開理由只用自有、合作方授權或合規開放資料。
- 硬限制、雙人公平計分、行程組合、局部重排與最終合法性由確定性程式負責；模型只做受控解析與公開文字改寫。
- 模型、索引、資料或外部服務未就緒時，回傳真實未就緒／無可行方案；不得用文件、schema、fixture 或固定結果冒充成功。

## 狀態定義與盤點摘要

- `已完成`：該 Phase 的完成條件在相應證據層級全部成立。
- `部分完成`：已有可執行交付或相應測試，但仍缺必要功能或較高層驗收。
- `未開始`：只有需求、schema、fixture 或測試計畫，沒有對應可執行功能。

2026-09-05 盤點基線為 clean `main` commit `8cb9df6`，其後本機 HEAD 為 `cef9bc7` 且工作樹尚未提交。工作樹已加入確定性推薦、reaction／locked／局部重排／定案、本人 `too_dark` 偏好更新，以及正式手機優先首頁；Chrome＋Edge 已跑完一個合成主流程。仍沒有真實場地／RAG、兩支實體手機、正式部署或 Owner 驗收。

| Phase | 名稱 | 目前狀態 | 主要依賴 | 可平行資訊 |
|---|---|---|---|---|
| 1 | 契約、資料治理與驗收基線 | 已完成（文件／契約層） | 無 | Phase 2～4 可依契約並行 |
| 2 | 匿名雙人房間與共享狀態 | 部分完成 | Phase 1 | 前端串接可與 Phase 3、4 並行 |
| 3 | 條款、私密輸入與需求解析 | 部分完成 | Phase 1、2 | 本輪用有限規則基準；模型與進階資料可日後獨立進行 |
| 4 | 場地資料、RAG 與 Google Maps 跳轉基礎 | 部分完成 | Phase 1 | 資料整理、索引與 URL builder 可分工 |
| 5 | 雙人推薦與三套可執行行程 | 部分完成（合成資料後端） | Phase 2～4 | 公開理由只能在合法行程後並行 |
| 6 | 局部重排、私人清單與回饋治理 | 部分完成 | Phase 1、2；重排依 Phase 5 | 私人清單／內容治理可先行 |
| 7 | 手機整合、外部跳轉與誠實降級 | 部分完成（合成展示） | Phase 2～6 | 私人清單與外部失效仍可並行 |
| 8 | 端到端、效能、隱私與 Owner 驗收 | 部分完成（單一雙瀏覽器案例） | Phase 7 | 自動與實機驗收可分層準備 |

## Phase 1 — 契約、資料治理與驗收基線

### 目標

固定產品、資料、模型、隱私、錯誤與證據邊界，讓所有協作者依同一契約施工。

### 交付

- AGENTS、PRD、TDD、ROADMAP、MVP_SPEC、MODEL_RAG 與 API 契約。
- preference-query、itinerary、venue-record schemas 與合成 fixtures。
- shared、private_session、private_remembered；條款、個人化、模型改進與公開可見性分離。
- 場地來源／權利／更新／情境／人工審核／未知值，以及 Google 衍生內容拒絕規則。
- schema、單元、整合、Runtime、雙裝置、公開畫面、外部服務與 Owner 的分層證據規則。

### 完成條件

- 權威文件的範圍、欄位、API、錯誤與驗收語義一致。
- schemas／fixtures 可獨立解析，且不被升格成 Runtime 證據。
- 未完成能力有 fail-closed 或明確未就緒狀態；Google click-out 與資料保存例外已成為可測契約。

### 目前狀態

`已完成（文件／契約層）`。相關權威、schema、fixtures 與 no-fake-success 規則已存在；不代表 UI、模型、RAG、推薦或實機完成。

### 相依／可平行

無前置依賴。Phase 2、3、4 可並行；欄位變更須先回寫本 Phase 權威。

## Phase 2 — 匿名雙人房間與共享狀態

### 目標

讓兩位匿名使用者進入同一房間，只同步共同條件與完成狀態，並能安全處理並行修改與重連。

### 交付

- 匿名 Bearer 身分、到期與安全儲存。
- 建房、邀請、A／B 兩席上限、第三人拒絕與重送冪等。
- 每房 Session、共同條件、版本衝突、雙方確認與修改後重設。
- 公開狀態 allowlist、SSE、在線狀態、心跳與重連。
- 前端房間、等待、共同條件與同步狀態。

### 完成條件

- 並行加入仍只有兩人；非成員不能讀寫或訂閱。
- 過期版本不靜默覆寫；公開事件不含 token、邀請碼或私密欄位。
- 兩個獨立瀏覽器與兩支手機完成建立／加入、同步、失聯與重連。

### 目前狀態

`部分完成`。後端匿名身分、邀請、兩人上限、共享條件、版本、確認、GET／SSE 與重連已實作並有 PostgreSQL／HTTP 測試證據；正式首頁與 Chrome＋Edge 單一合成案例也已完成。尚無兩支實體手機、跨網路重連、正式 HTTPS、憑證撤銷／刪除或濫用防護。

### 相依／可平行

依賴 Phase 1。前端可依 BACKEND_API 串接；Phase 3 沿用同一身分／Session，Phase 4 可獨立整理資料。

## Phase 3 — 條款、私密輸入與需求解析

### 目標

在不向伴侶、共享事件、日誌或 RAG 洩漏原文的前提下，把每人的需求轉為可計算且可拒判的 preference-query。

### 交付

- 版本化條款與可撤回的 `personalization_enabled`、`model_improvement_opt_in`。
- private_session／private_remembered 本人 CRUD、同意閘門與撤回後降級。
- parsed／needs_clarification／unavailable envelope、schema 驗證、Privacy Guard 與公開 allowlist。
- 有限規則基準、數字／單位／否定規則及模糊語意追問。
- 需求 JSONL、人工答案、原文證據、group split、資料版本；字元 TF-IDF＋Logistic Regression 與固定基準／保留題評測。

### 完成條件

- A 無法從 API、Realtime、畫面、cache、log 或錯誤取得 B 的私密資料或可反推理由。
- remembered 只在有效個人化同意下使用；撤回後停止長期使用。
- 支援語句產出合法 schema；模糊、衝突、未支援或非法輸出一律追問／阻擋。
- 分類器以分組未見案例逐屬性報告 precision／recall／F1、support、macro-F1 與硬限制退步；無真實資料與評測不得稱已訓練。
- Phase 2 驗收交接所列 storage/parser/guard、RAG integration、two-browser privacy 三列全 PASS。

### 目前狀態

`部分完成`。commit `8cb9df6` 已實作私密輸入 migration／本人 API、同意與撤回降級、三態 envelope、有限規則解析與 Privacy Guard；目前本機完整測試已通過。Chrome＋Edge 的單一合成案例確認共同畫面未出現 A／B 私密原句，兩邊 console error／warning 為 0。Owner 已核准 15 筆／5 群組合成句作基本展示需求，並將自管模型與場地 RAG 延後；單一展示仍不能代替對抗性兩裝置隱私驗收。

### 相依／可平行

依賴 Phase 1、2。進階需求句、離線分類器與 parser adapter 均為後續可選工作，不阻擋本輪前端與雙瀏覽器驗收。

## Phase 4 — 場地資料、RAG 與 Google Maps 跳轉基礎

### 目標

建立可追溯、可合法使用、可供確定性驗證與自管 RAG 檢索的場地基礎，只以窄例外保存 Google Place ID。

### 交付

- venue schema／資料表：穩定 venue_id、類型、座標、價格、營業／活動時段、停留、來源、權利、查核／更新、人工審核與情境屬性。
- optional `google_place_id`；不保存其他 Google 衍生內容，也不作排名特徵或 RAG 文本。
- 政府資料 draft 匯入、第一方事實核對、團隊觀察／自有照片證據與人工審核。
- 小區域 12～20 筆核准真實場地、版本化交通矩陣、更新／失效／刪除流程。
- 自管 Embedding、版本化索引、Recall@K、惡意文件與來源違規測試；私人回饋不進共用 RAG。
- Maps URL builder：自有／授權名稱正確 URL encoding；有 Place ID 時 `query_place_id` 優先，無 ID 時名稱 fallback；無 API key。

### 完成條件

- 發布、排序與 RAG 共用政策守門；必要事實未知、未核准、過期或權利不足不得成為可執行候選。
- 政府匯入不推論主觀標籤；情境屬性不脫離時段／區域；每筆可追溯來源、權利、更新與審核。
- 至少 12 筆核准真實場地通過固定 Recall@K、索引版本及外部模型 API=0 證據。
- 測試證明 Place ID optional／優先、名稱正確編碼、無 key，且 Google 衍生內容被拒絕進持久層與 RAG。

### 目前狀態

`部分完成`。已有 venue-record schema、政府 draft 匯入、來源／權利／審核政策守門、版本化場地／交通矩陣資料表、optional `google_place_id`、Maps URL builder 與合成測試。尚無真實核准資料、正式交通內容、Embedding／索引或 Recall@K；資料缺少時推薦 API 會回 `RECOMMENDATION_DATA_UNAVAILABLE`。

### 相依／可平行

依賴 Phase 1。真實資料、索引與 URL builder 可分工；Phase 5 等待可執行場地與交通證據，Phase 7 可先用明確合成資料開發按鈕狀態。

## Phase 5 — 雙人推薦與三套可執行行程

### 目標

把兩人的共同條件與私密解析結果轉為三套通過硬限制、具實質差異且照顧較低適配方的完整行程。

### 交付

- Hard Constraint Filter：時間、預算、營業／活動、預約、交通、體力、飲食／過敏、無障礙、年齡／場域、Hard No、戶外／天氣。
- Adjective Sensitivity、UserFit、CoupleScore；合作／贊助不進適配分數。
- 候選檢索、2～4 站組合、交通、停留、成本與時段重驗。
- 三套差異方案、公開中性理由、合作標示、無可行方案與 generate／itineraries／finalize API。

### 完成條件

- 硬限制違反 0；缺必要事實不放行，不為湊三套放寬硬限制。
- 三套皆 2～4 站，任兩套不超過 50% 相同站點，且至少兩項關鍵維度不同。
- 較低一方適配達預先門檻；贊助不改 CoupleScore。
- venue_id、時間、價格、理由與連結都來自核准資料或確定性組合；模型輸出仍通過 schema、Privacy Guard 與最終驗證。

### 目前狀態

`部分完成（合成前後端）`。已實作確定性硬限制、UserFit／CoupleScore、三套差異組合、作用中場地／交通版本、`generate`／strict `itineraries`、版本失效、Privacy Guard 與正式行程卡；36 個本機測試通過，Chrome＋Edge 單一案例實際顯示三套。資料仍是明確 `synthetic_demo`。`5 engine/api` 為 PASS；fairness 最低門檻、真實核准場地／交通、RAG、三案例 Runtime 與 Owner 仍 BLOCKED，overall 是 `NOT_READY`。

### 相依／可平行

依賴 Phase 2 的共享狀態、Phase 3 的安全解析及 Phase 4 的場地／交通。公開理由模板只能在確定性引擎產生合法行程後並行。

## Phase 6 — 局部重排、私人清單與回饋治理

### 目標

保留已接受站點並修正衝突；以權限與同意管理私人場地清單、公開評論和後續學習候選。

### 交付

- 整套／單站 like、dislike、replace、locked stops 與 Local Replanner。
- 本次回饋更新 session 偏好；有效個人化下才更新本人 long-term 版本。
- 私人場地清單：補充、自訂標籤、1～5 分、想去／去過，本人 CRUD。
- 回饋預設 private；作者可 public／取消公開／刪除，公開只顯示 approved allowlist。
- 管理審核、檢舉、隱藏、頻率限制、內容清理與安全錯誤。
- 經有效模型改進同意、去識別、人工核准及資料版本記錄的離線訓練候選出口。

### 完成條件

- 重排 100% 保留 locked stops，替換後重驗整條路線；不合格提案整體拒絕。
- 「太暗」等案例使本人下一輪相關排序達可測變化，不影響他人或共用事實。
- 私人資料只有本人可讀；pending／rejected／hidden／deleted 不出現在公開列表。
- 公開、個人化與模型改進同意互不暗開；撤回、刪除、檢舉與隱藏停止後續公開／學習使用。
- 公開評論不直接改寫場地事實、共用標籤或 RAG；訓練候選不等於新模型完成。

### 目前狀態

`部分完成（合成前後端）`。除既有私人場地回饋外，已加入 reaction、雙方 locked、保留 stop 身分與順序的局部重排、全路線重驗、雙人 finalize，以及不可變 `too_dark` 事件。當次只改回報者；個人化有效才遞增本人長期版本，重送冪等且不進公共出口。正式首頁已串接，Chrome＋Edge 單一案例通過；三案例 Runtime、兩支實體手機、管理審核、檢舉／隱藏、頻率限制、私人清單 UI、Owner 與 training candidates 仍未完成，overall 維持 `NOT_READY`。

### 相依／可平行

私人清單／治理依 Phase 1、2 可先行；Replanner 與排序學習依 Phase 5。治理未完成前不得開放陌生使用者自由投稿或宣稱模型已學習。

## Phase 7 — 手機整合、外部跳轉與誠實降級

### 目標

把 Phase 2～6 串成手機直向完整流程，讓等待、錯誤、無資料與外部服務失效都有可理解且不誤導的畫面。

### 交付

- 房間、共同條件、私密需求、三套方案、完整行程、意見／重排、finalize、私人清單與回饋畫面。
- 生成／檢索／同步狀態、版本衝突、身分到期、索引未就緒、無候選與 503 降級 UI。
- 場地卡「在 Google Maps 查看」按鈕，只讀 Sideby 自有／授權資訊與 Phase 4 URL builder。
- 外部訂位／購票、合作標示；不保證座位、不代理付款。
- Google／網路不可用時，Sideby 結果仍可閱讀，外部詳情標示暫時無法開啟且不回存 Google 頁面。

### 完成條件

- 手機直向主流程無死路；錯誤可恢復或明確停止，不用假 loading／固定成功掩蓋失敗。
- Maps 按鈕有／無 Place ID 都正確，有 ID 時優先、無 key、只在點擊後外部開啟。
- 實機驗證 Google 不可用不影響核心推薦；公開畫面不含另一人的私密原文或可反推理由。

### 目前狀態

`部分完成（第一刀可驗收，Owner 真手機 BLOCKED）`。正式手機優先首頁已串房間、共同條件、版本狀態、私密需求、三套方案、Maps click-out、reaction、局部重排、finalize、本人私人清單與回饋；loading、empty、版本衝突、無資料、503、身分失效及外部不可用皆有誠實中文。正式模式不自動帶合成條件；`demo:local` 使用獨立 `.local` 合成資料庫並在 UI／payload 明示資料與交通版本。Chrome 雙分頁已跑通一個合成主流程至定案／回饋，IAB 390px／1280px 無水平 overflow、鍵盤 focus 可見、console error／warning 為 0；Maps click-out 與受控外部失效後原頁仍保留三套結果。外部訂位／購票欄位有連結才顯示且明示不保證座位、不代付款，贊助內容必須標示。兩支實體手機與 Owner 驗收仍缺，因此 Phase 7 不得標完成；證據入口為 `docs/PHASE7_ACCEPTANCE.md` 與 `npm run phase7:check`。

### 相依／可平行

完整整合依賴 Phase 2～6 的穩定 API。UI 可先用明確合成資料，但不能宣稱真實推薦、RAG 或同步完成。

## Phase 8 — 端到端、效能、隱私與 Owner 驗收

### 目標

在目標硬體與真實裝置上分層驗證 MVP，最後由 Owner 決定是否接受。

### 交付

- clean install／migration／build／test 與目標部署啟動證據。
- 兩瀏覽器、兩手機完整主流程：邀請、同步、私密輸入、生成、投票、重排、finalize、回饋。
- 對抗性隱私、跨使用者、日誌、cache、Realtime、惡意 RAG 文件與公開理由測試。
- 同步、第一輪行程、局部重排的 p50／p95，附硬體、模型、資料量、冷／暖啟動、併發與失敗條件。
- Google Maps 有／無 Place ID、URL encoding、手機開啟、Google／網路失效與不回存資料的實機證據。
- Demo 紀錄、已知限制與 Owner sign-off。

### 完成條件

- 自動測試、HTTP、兩裝置、公開畫面、外部跳轉與 Owner 各有可追溯證據。
- 公開同步 2 秒、第一輪三套 15 秒、局部重排 8 秒，以預先定義環境與多次樣本量測。
- 硬限制違反 0、locked stops 保留 100%、私密洩漏 0；失敗顯示真實狀態且無雲端 fallback。
- Owner 明確接受前，不稱產品完成或可交付。

### 目前狀態

`部分完成（單一雙瀏覽器合成案例）`。已有 schema／單元、本機 PostgreSQL＋HTTP 行為、單一 SSE 延遲樣本，以及 Chrome＋Edge 從邀請到回饋的完整主流程；兩邊 console error／warning 為 0。仍沒有三案例、兩支實體手機、真實模型／RAG／場地、p50／p95、Maps 手機開啟與失效、正式部署或 Owner sign-off。

### 相依／可平行

完整驗收依賴 Phase 7。自動、隱私與效能案例可先準備，但只在受驗版本與目標環境執行後算證據。

## MVP cut line

- Phase 1～7 是 MVP 功能施工範圍；Phase 8 不新增產品功能，而是不可省略的 release／Owner 驗收閘。
- `Feature Complete`：Phase 1～7 完成，仍不得稱 Owner 已接受。
- `Accepted MVP`：Phase 8 全部通過且 Owner sign-off。
- 黑客松可縮小場地區域、筆數與解析屬性，但不得刪除隱私、資料權利、硬限制、失敗誠實或證據分層。
- 2026-09-05 本輪 cut：Owner 核准的合成基本需求可作展示資料；自管模型評測與場地 RAG 在 Phase 1／2 相容閘門列 `DEFERRED`，雙瀏覽器與隱私 Runtime 仍不可省略。

## 下一刀

先補 Phase 4 的小區域核准真實場地、正式交通矩陣、自管 Embedding／RAG 與 Recall@K，再以至少三個完整案例重跑 Phase 5／6。Phase 7 補私人清單、Google／網路失效與兩支實體手機；Phase 6 補管理審核、檢舉／隱藏、頻率限制與 training candidates。缺資料維持 `RECOMMENDATION_DATA_UNAVAILABLE`，不得把本輪合成展示升格成真實推薦或 Owner 驗收。

## 橫向品質門檻

### 資料權利

- 每筆場地與主觀屬性都有來源、權利、更新／觀察時間、情境與審核；未知不補猜。
- Google 只有 optional `google_place_id` 保存例外；其他 Google 衍生內容不進資料庫、RAG、訓練或評測。

### 隱私與同意

- shared、private_session、private_remembered 在資料表、API、Realtime、cache、log 與 UI 分開。
- 公開、個人化與模型改進是獨立選擇；撤回與刪除停止未來使用，不用提示詞代替權限。

### 失敗誠實

- 模型、索引、資料、外部連結或同步失敗時回真實錯誤；不切雲端、不捏造場地、不放寬硬限制、不把 fixture 當真實結果。

### 證據分層

- 文件／schema、單元、整合、Runtime、雙裝置、公開畫面、外部服務與 Owner 各自驗收；狀態只升到實際證據層。

## 明確不排程項目

CRM、商家管理後台／自助上架、廣告管理、App 內付款、退款、發票、訂閱、完整社群（追蹤、好友、回覆串、按讚、私訊）、即時聊天、遊戲化、驚喜約會、住宿、SPA、酒吧／夜生活、過夜、長途旅遊、全臺／海外資料、大型生成模型微調平台，以及大量未授權評論／照片／私人對話 RAG。

受控短文字評論、私人清單、離線訓練候選與核准小型場地 RAG 已列入 Phase 4、6，不屬上述排除項目。

## 舊名稱對照與相容入口

| 舊名稱 | 新位置 |
|---|---|
| 1.0 文件契約 | Phase 1 |
| 1B 雙人 Session | Phase 2 |
| 舊 Phase 2 私密輸入 | Phase 3 |
| 1A 模型／RAG | Phase 3＋4 |
| 舊 Phase 3 推薦 | Phase 4＋5 |
| 舊 Phase 4／4A～4E | Phase 6 |
| 舊 Phase 5 收口 | Phase 7＋8 |

`docs/PHASE1_ACCEPTANCE.md`、`docs/PHASE2_ACCEPTANCE.md`、`docs/BACKEND_API.md`、`npm run phase1:check` 與 `npm run phase2:check` 暫保留既有名稱作交接／證據入口，不再定義 Roadmap 的 Phase 數量或依賴。兩個相容閘門依本輪黑客松 cut 將模型／RAG 列為 `DEFERRED`，但仍要求雙瀏覽器證據。

## 附錄 A — 黑客松六小時應變安排

這是材料到位時的壓縮施工／止損方案，不是產品 Phase、工期承諾或完成證據。

| 時間 | 工作 | 必須產生的證據 |
|---|---|---|
| H1／第 1–2 小時 | 清理約 100–200 句需求、人工核准；按原句群組分 60%／20%／20% | 標籤、來源／審核、固定切分、支持數 |
| H2／第 3 小時 | 固定規則基準；CPU TF-IDF＋Logistic Regression | 程式、參數、資料雜湊、產物、耗時 |
| H3／第 4 小時 | 只看驗證組修否定／單位；必要時才比較 SetFit | 逐標籤指標、失敗案例、拒判／追問、採用理由 |
| H4／第 5 小時 | 接核准場地與本地檢索，重驗硬限制 | venue_id、來源／權利／情境、索引版本、候選檢查 |
| H5／第 6 小時 | 凍結版本、最終保留題、展示並停止調參 | 基準比較、實際啟動、未支援範圍、Demo 紀錄 |

### 場地試點與停止規則

1. 選大臺北一個密集小區域，人工整理約 12～20 筆；政府資料只作候選入口。
2. 事實、主觀屬性與個人感受分開，記錄權利、時段／區域、日期、審核與未知。
3. 用明確日期／預算／交通試組三套 2～4 站；不足就擴充合規候選或誠實縮小展示情境。
4. 標註有爭議就縮標籤或追問；分類器無可說明收益就保留規則／明確選項。
5. 本地模型或索引拖延時不延伸大型調參；索引未完成不宣稱 RAG 通過，最終測試看過後不得仍稱未見測試。
