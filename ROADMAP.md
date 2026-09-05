# Sideby — MVP ROADMAP

## 2026-09-06 評論資訊模擬

- `feat/live-review-signals` 已完成單次 Google 評論的固定規則粗分類、最多五則評論／十個情境線索、提及次數與 UI 免責文字；完整 `npm run check:all` 82 項測試通過。
- 待完成：完整 `check:all`、GitHub PR／checks、Cloudflare 部署及正式 Place Details 目視。此功能只增加展示資訊，不提高 13 筆正式核准場地數，也不構成模型持續學習證據。

## 2026-09-06 成長功能目前完成度

- 已正式部署：完整 34 選項需求傳遞、全池資格篩選、版本場地發布／索引、個人場地负面回饋排序、離線候選去識別／審核／撤回。81 tests、兩端 build、PR #22／#23 checks、正式 API 34 選項與三套真實三站路線通過；每日早上 8 點（台灣）執行完整更新管線，已手動跑通。
- 待完成：補齊政府候選營業、價格、區域與主觀觀察證據；人工同意語料及保留題實測；兩支實體手機。1,121 候選不能一次冒充核准；目前 13 正式核准場地，學習候選 0，未訓練新模型。

Owner 已將完整標籤辨識、全量政府候選資格處理、三路持續改進納入本輪：需求傳遞與計分 → 場地發布與候選召回 → 私人偏好與離線候選／版本索引 → 整合與正式部署驗收。下方同項 DEFERRED 為歷史狀態；未完成實作與真實資料驗收不能標 PASS。

## 2026-09-06 Repository hygiene baseline

- 日常工作只保留 `E:\sideby` 的 `main` checkout；已合併的 sprint、integration、docs、fix 與 review worktrees／branches 均不再作現行入口。功能分支採短生命週期，合併後刪除。
- GitHub 只長期保留 `main` 與 `archive/phase3-itineraries-checkpoint-20260905`；原始文件交付另由 tag `archive/delivery-mvp-v1` 保存。archive 只供追溯，不參與部署。
- `output/` 為 repo 外發布產物的本機保存區並已忽略；正式 source、CI 與部署仍只認 `main`。Obsidian 以 Sideby 專用乾淨同步 worktree 維護，日常 Vault 其他專案的未解衝突不得混入本 Repo。

## 2026-09-06 Gemini 免費層展示驗收

- 已建立零付費 Free tier 專案並將專用 key 更新至 Cloudflare encrypted secret；未設定預付或付款。Gemini 維持選用、非主打能力。
- 已用兩個獨立瀏覽器完成「建立房間 → 32 碼加入 → 共同條件 → 雙方非敏感偏好 → 雙方最新版確認 → 三套 `approved_dataset` 路線」；Server Function 200 且沒有 provider error。這是合成／非敏感展示 Runtime，不是實體手機或真實私密資料驗收。
- 免費層告知文案與回歸測試已補強；真實私密 Gemini、評論候選標籤、安全理由改寫及完整供應商失敗矩陣仍為 `DEFERRED`。下一個主要 gate 仍是兩支真實手機與 Owner 驗收。

## 2026-09-06 雙人入口阻斷修復

- 已完成程式修正與局部測試：加入欄位接受後端完整 32 碼、保留大小寫並關閉手機自動校正；登入入口延後到瀏覽器 hydration 確認設定，登入網路例外不再讓按鈕永久卡住。
- 已完成 PR #18、GitHub checks、Railway／Cloudflare 部署與正式雙瀏覽器 smoke：「建立房間 → 完整 32 碼 → 加入同房 → 建立者同步看到加入 → 進入共同條件頁」通過；登入可開表單並對無效測試帳密回安全錯誤。兩支真實手機仍是最後 Owner gate。

## 2026-09-06 地點更新進度

- 已完成：交通部觀光署每日景點／餐飲 JSON 下載、臺北／新北篩選、VenueRecord 正規化、政策守門、PostgreSQL staging、來源／版本／hash／數量紀錄、transaction rollback 與冪等重跑。
- 已完成：PR #11 合併與 Railway production 套用；migration 009、1,121 筆 draft、17 筆拒絕、相同內容冪等回用及公開 API 200 已驗證。`venue-refresh-daily` 每日 00:00 UTC 自動更新。
- 已完成：PR #13 合併 `main` `e3e6336`，migration 010、ID-only Google Place ID 對應、跨政府快照沿用、即時地點詳情／路線顯示與 100 筆審查隊列已部署。Production DB 實際為 1,120 筆 matched、1 筆 not_found、0 筆 retry；Cron 已改為每日先更新政府資料、再補 Place ID。
- 最新單次來源盤點：全臺 9,818、臺北／新北 1,138、可進 draft staging 1,121、拒絕 17；不是 Sideby 自有大數據，也不是 1,121 個已核准可執行地點。
- 已完成程式與測試：Owner 從審查池核准 13 筆具官方票價／營業證據與 Place ID 的真實場地；已建立 `approved_dataset`、90 天室內 slots、座標估算交通矩陣及三套三站行為測試。標準啟動不再回切九筆 `synthetic_demo`。
- 已完成正式上線：PR #15／#16 合併後，Railway active 實查為 13 records、950 slots、468 matrix legs；Cloudflare 同源 API 的週日板橋、週五台北、週六土城三案均各產生 3 套三站 `approved_dataset` 行程，每站有 Place ID。
- 下一個 Owner gate：兩支真實手機完成主流程與 Google 詳情目視。冷氣、主觀屬性、飲食／過敏與無障礙仍需逐筆補證，未知不得放行。
- 偏好 UI 目前 34 項，原 30 項仍有 19 項缺正式推薦映射；偏好擴充另開一刀，不能為了增加數字而讓未定義標籤進排序。

## 2026-09-05 部署接續

- 已完成：PR #4 合併 `main`（`16cfd04`）；Railway GitHub source、自動部署、PostgreSQL reference、migration、健康檢查與 8080 對外埠上線；Cloudflare Worker、兩個 production origin 與 Google server secret 上線。Railway 直接 API 與 Cloudflare 同源 `/api/runtime` 均回 200，匿名身分經公開前端代理回 201。
- 已完成：`npm run check:all` 通過 47 根＋15 Maps／proxy 測試，GitHub checks 全綠；公開首頁與 `/maps-check` 回 200，兩把 Google key 均由頁面確認存在，秘密值未輸出或提交。
- 已完成 Maps JavaScript 正式 referrer、底圖目視及 Places／Routes／Geocoding 的 Cloudflare Worker 真實呼叫；Google 四項 production 檢查通過。前端三套既有地點已轉為後端版本化展示資料並保存 Google Place ID；Owner 決定本輪不主打 Gemini。下一個主要 gate 是兩支手機與 Owner 驗收。
- 公開基礎 Runtime 已完成，不得回退至舊 main，也不得把部署綠燈升格成 Accepted MVP。

## 2026-09-05 追加：把可發展性做成可驗證功能

| 工作 | 本輪狀態 | 下一個驗收條件 |
|---|---|---|
| 34 項共同選項清單 | 已盤點；新增環境 4 項已接 UI／API／引擎 | 真實場地逐區核實室內外、冷氣與使用時段 |
| 環境硬限制與鎖區重排 | 本機實作／自動測試 | 不用合成結果冒稱真店可用；正式入口另驗 |
| 舊選項與自由文字 | 11 項有近似映射、19 項待補 | 每一項有明確語意與回歸；不得靜默遺失否定、限制與未映射需求 |
| 私人清單與持續偏好 | 清單／同意／五種 allowlist 回饋已實作 | 穩定帳號與復原、後續 Session 回用清單、更多回饋類別逐項驗證 |
| 自有／授權場地擴充 | 資料政策、匯入 draft、審核與版本基礎已有 | 先補大臺北真實可用資料、區域／冷氣查核；再測候選量與效能 |
| 需求證據整理 | 6 組來源、12 指標已整理 | 不是自有大數據或需求驗證；用真實目標伴侶實測 |
| 產品採用驗證 | PLANNED | 探索性 30–50 對大臺北伴侶；定案時間、雙方完成率、限制漏接、實際出門、30 日再用；不是統計代表性承諾 |
| RAG／訓練／跨城市／商家平台 | DEFERRED | 先驗本地資料、權利、使用需求與成本；不得列成現成能力 |

Railway＋PostgreSQL 後端、Cloudflare 前端、正式 Google 四項及展示資料生成／保存已完成公開 Runtime 驗證；Gemini 免費層的雙瀏覽器非敏感展示也已通過。下一步是兩支實機與 Owner 驗收，Gemini 不屬本輪阻斷。

## 2026-09-05 本輪最新路徑

跨對話唯一接續入口為 `docs/NEXT_SESSION_HANDOFF.md`。目前施工點固定在公開部署與雙手機驗收；不得回頭把已延後的訓練／RAG 誤設為部署前置，也不得把本機 synthetic Runtime 當公開 PASS。

本輪新增 Google 接線子項（不新增 Phase）：官方 Maps JavaScript／Places (New)／Routes／Geocoding、私密設定範本與 `/maps-check` 已實作，2026-09-05 已在本機及 production 單次真實驗收四項 PASS。production 已加 `SIDEBY_PUBLIC_ORIGIN` 同來源 HTTPS 閘門。操作與證據見 `docs/GOOGLE_MAPS_LOCAL_SETUP.md`、`docs/GOOGLE_MAPS_VERIFICATION.md`。

使用者指定主 Repo `louis8791/sideby`。`frontend/` 已匯入隊友的 Lovable 前端，根目錄保留既有後端；兩者仍是獨立執行元件。最新分工為使用者主責後端、一人支援後端、一人持續前端細修。黑客松可保留固定邀請碼與範例行程，只要清楚標示 demo／synthetic 且不掩蓋真實失敗；Manus 只增指定元件。

本輪採 Google Maps＋確定性規則 MVP；Gemini 只增加已驗證的免費層非敏感展示，訓練、自管生成、Embedding、RAG 與其餘 Gemini 接點均為 `DEFERRED`。前端三套既有路線改由後端版本化展示資料生成與保存，Google 僅保存 Place ID 並即時載入詳情；兩支手機與公開完整流程仍待驗。

Gemini 三接點契約保留為未來選項；Owner 決定本輪不主打，只配置 `private_preference_parse` 的免費層非敏感展示且不列入提交阻斷。前端未勾選時使用本機規則，不能把其餘兩個接點或真實私密處理宣稱為已完成。

現場協作入口：`docs/TEAM_INTEGRATION.md`。所有人從同一主 Repo 的最新 `main` 開自己的 feature 分支；前端負責 `frontend/` 與應用 API 串接，後端負責根 API、資料、權限及決策規則。本輪不增加新的頂層 Phase，維持下列八階段。

## 交付原則

本 Roadmap 依產品依賴分為 8 個頂層 Phase。每階段都要分開回報文件、程式、測試、Runtime、雙裝置與 Owner 證據；某一層通過不能代替其他層。六小時黑客松安排只放在附錄，不是產品 Phase 或完成證據。

跨階段固定邊界：

- Sideby 是雙人私密需求共決策產品，不是地點清單或單人行程產生器。
- 本輪採 Google Maps＋確定性規則；Gemini、自管生成、Embedding、RAG 及訓練均為 DEFERRED，不以固定範例假裝外部服務成功。
- 政府開放資料維持候選母表；可用 Google ID-only Text Search 批次補 optional `google_place_id`。Google 其他欄位只即時顯示、不進持久層、排序、標籤、訓練或 RAG。
- Google 衍生的名稱、地址、評論、照片、搜尋結果與標籤不得進持久層、RAG、Embedding、訓練或評測；推薦、排序與公開理由只用自有、合作方授權或合規開放資料。
- 硬限制、雙人公平計分、行程組合、局部重排與最終合法性由確定性程式負責；模型只做受控解析與公開文字改寫。
- 模型、資料或外部服務未就緒時，回傳真實未就緒／無可行方案；不得用文件、schema、fixture 或固定結果冒充成功，也不得靜默切換成未揭露的供應商或假資料。

## 狀態定義與盤點摘要

- `已完成`：該 Phase 的完成條件在相應證據層級全部成立。
- `部分完成`：已有可執行交付或相應測試，但仍缺必要功能或較高層驗收。
- `未開始`：只有需求、schema、fixture 或測試計畫，沒有對應可執行功能。

2026-09-05 功能由 PR #4 合併到 `main` `16cfd04`。根後端已有匿名房間、私密輸入、合成三套推薦、reaction／locked／局部重排／定案與本人 `too_dark` 偏好更新；最新主畫面以同一匿名身分串接這些 API。`npm run check:all` 通過 47 根測試、15 Maps／代理測試、前端 typecheck 與 client／SSR／Cloudflare build；GitHub checks 與公開 Railway／Cloudflare 基礎 Runtime PASS。Google 四項本機與 production 真實檢查均通過；真實 Gemini、真實核准場地、兩支實體手機及 Owner 驗收仍未完成。

舊 `phase3-itineraries` 的 19 檔候選已以遠端 `archive/phase3-itineraries-checkpoint-20260905`／`63cfe6c` 保存，狀態為 `PRESERVED_NOT_ADOPTED`。它不能直接刪除，也不能因被保存就視為 main 已完成；後端支援者若要取用，須逐項比對後另開採用 commit。

| Phase | 名稱 | 目前狀態 | 主要依賴 | 可平行資訊 |
|---|---|---|---|---|
| 1 | 契約、資料治理與驗收基線 | 完成（文件／契約層） | 無 | Phase 2～4 可依契約並行 |
| 2 | 匿名雙人房間與共享狀態 | 部分完成（公開 API／代理已通；雙手機待驗） | Phase 1 | 前端串接可與 Phase 3、4 並行 |
| 3 | 條款、私密輸入與需求解析 | 本輪完成（結構化選項＋規則；Gemini DEFERRED） | Phase 1、2 | Gemini 可日後另驗 |
| 4 | 場地資料與 Google Maps 整合基礎 | 部分完成（展示資料已接；Google 四項 production PASS；真實核准資料待補） | Phase 1 | 資料政策與外部服務接線可分工 |
| 5 | 雙人推薦與三套可執行行程 | 部分完成（前端三套地點已接後端生成／保存；公開 Runtime 已驗） | Phase 2～4 | 公開理由使用確定性安全模板 |
| 6 | 局部重排、私人清單與回饋治理 | 部分完成（重排已接；進階評論治理延後） | Phase 1、2；重排依 Phase 5 | 私人清單／內容治理可先行 |
| 7 | 手機整合、外部跳轉與誠實降級 | 部分完成（公開 Worker／同源 API 已通；手機待驗） | Phase 2～6 | 前端負責串接，後端提供契約與修正 |
| 8 | 端到端、效能、隱私與 Owner 驗收 | 部分完成（自動＋本機 Runtime 證據） | Phase 7 | 底層證據不能取代完整驗收 |

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

`完成（文件／契約層）`。`docs/TEAM_INTEGRATION.md` 已固定單一 Repo、API 型 MVP、分工及證據邊界；AGENTS／PRD／TDD 的舊自管模型／零 Google API 敘述已改為歷史或延後選項，schema、fixtures 與 no-fake-success 規則也已存在。這不等於後續功能、Runtime 或 Owner 驗收完成。

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

`部分完成（公開 API／代理已通）`。根後端已有匿名身分、邀請、兩人上限、共享條件、版本、確認、GET／SSE 與重連，並有 PostgreSQL／HTTP 測試。Railway 正式 HTTPS 與 Cloudflare 同源 proxy 已回應 runtime／匿名身分；主畫面以根 Bearer 身分建立／加入真正房間並輪詢共享狀態。兩支實體手機、跨網路重連、憑證撤銷／刪除及濫用防護尚未驗收。

### 相依／可平行

依賴 Phase 1。前端可依 BACKEND_API 串接；Phase 3 沿用同一身分／Session，Phase 4 可獨立整理資料。

## Phase 3 — 條款、私密輸入與 Gemini 需求解析

### 目標

在不向伴侶、共享事件或一般日誌洩漏原文的前提下，把每人的需求交由受控 Gemini 解析，再轉為可計算且可拒判的 preference-query。

### 交付

- 版本化條款與可撤回的 `personalization_enabled`、`model_improvement_opt_in`。
- private_session／private_remembered 本人 CRUD、同意閘門與撤回後降級。
- parsed／needs_clarification／unavailable envelope、schema 驗證、Privacy Guard 與公開 allowlist。
- Gemini server-side adapter、最小必要輸入、逾時／額度／非法輸出失敗狀態及 schema 驗證。
- 有限規則基準、數字／單位／否定規則及人工核准需求句，作為回歸對照；不要求本輪訓練分類器。

### 完成條件

- A 無法從 API、Realtime、畫面、cache、log 或錯誤取得 B 的私密資料或可反推理由。
- remembered 只在有效個人化同意下使用；撤回後停止長期使用。
- 支援語句產出合法 schema；模糊、衝突、未支援或非法輸出一律追問／阻擋。
- 私密需求送 Gemini 前有清楚告知與有效同意，只送最小必要資料；原文、憑證及供應商錯誤全文不進公開 API、SSE 或一般日誌。
- Gemini 成功、逾時、額度不足與非法輸出都有可驗證結果；非法或不完整輸出不得進推薦。

### 目前狀態

`部分完成（主流程已接；免費層非敏感 Runtime 已驗）`。根後端已有私密輸入 migration／本人 API、同意與撤回降級、三態 envelope、有限規則解析及 Privacy Guard。前端需求 adapter 已接根身分／Session，Gemini 正規化文字只進後端 allowlist 解析器，不保存或公開；缺金鑰時畫面明示規則 fallback。已用有效免費層憑證完成雙瀏覽器非敏感成功路徑；逾時、額度、非法輸出與真實私密資料仍未驗收。15 筆／5 群組合成句只作回歸資料，不是模型訓練或真實需求研究證據。

### 相依／可平行

依賴 Phase 1、2。前端負責 Gemini 畫面與串接；後端負責同意、私密邊界、schema、硬限制及公開出口。離線分類器、自管模型與進階資料評測均為後續選項，不阻擋本輪 API 型 MVP。

## Phase 4 — 場地資料與 Google Maps 整合基礎

### 目標

建立可追溯、可合法使用、可供確定性驗證的場地基礎，並把 Google Maps 即時展示與 Sideby 自有／授權資料分開。

### 交付

- venue schema／資料表：穩定 venue_id、類型、座標、價格、營業／活動時段、停留、來源、權利、查核／更新、人工審核與情境屬性。
- optional `google_place_id`；不保存其他 Google 衍生內容，也不作排名特徵或 RAG 文本。
- 政府資料 draft 匯入、第一方事實核對、團隊觀察／自有照片證據與人工審核。
- API 型 MVP 所需的核准場地／交通資料、更新／失效／刪除流程；Google 即時展示內容不得自動回存成 Sideby 推薦事實。
- Google Maps server／browser gateway 的憑證、來源限制、額度、歸屬標示與失敗狀態。
- Maps URL builder：自有／授權名稱正確 URL encoding；有 Place ID 時 `query_place_id` 優先，無 ID 時名稱 fallback；無 API key 的 click-out 仍可保留。

### 完成條件

- 發布與排序共用政策守門；必要事實未知、未核准、過期或權利不足不得成為可執行候選。
- 政府匯入不推論主觀標籤；情境屬性不脫離時段／區域；每筆可追溯來源、權利、更新與審核。
- 真實 Google Maps 成功與失敗路徑、憑證限制、來源標示及 Sideby 資料不被覆寫均有證據。
- 測試證明 Place ID optional／優先、名稱正確編碼、click-out 無 key，且 Google 衍生內容不被批次存成持久推薦資料或訓練／RAG 語料。

### 目前狀態

`部分完成（本機四 API PASS；production 四項 FAIL）`。已有 venue-record schema、來源／權利／審核政策守門、版本化場地／交通矩陣、optional `google_place_id` 與 Maps URL builder。正式 Worker 已設定同來源 HTTPS 與兩把 key，但實測底圖來源授權錯誤、Places／Routes／Geocoding 未通過；實際 key 不在目前登入帳號可見專案。主畫面只有根場地資料帶明確 Place ID 才取 Google 即時詳情；合成名稱不做文字搜尋、不誤配真實商家，也不回存 Google 資料。待 key 擁有者修正限制、配額並重驗。

### 相依／可平行

依賴 Phase 1。資料政策、Google Maps 接線與 URL builder 可分工；Phase 5 只接受可驗證的場地／交通輸入，Phase 7 可先用明確標示的合成資料開發狀態，但不得冒充真實服務。

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

`部分完成（合成推薦已接主畫面）`。根後端已有確定性硬限制、UserFit／CoupleScore、三套差異組合、作用中場地／交通版本、`generate`／strict `itineraries`、版本失效及 Privacy Guard；前端已顯示根 API 的 A／B／C 三套行程、實際時長與交通，未生成前不顯示固定方案成功。資料仍明示 `synthetic_demo`；fairness 最低門檻、真實服務資料、三案例與 Owner 均未完成。

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

`部分完成（後端＋主畫面核心互動）`。根後端已有 reaction、雙方 locked、保留 stop 身分與順序的局部重排、全路線重驗、雙人 finalize，以及五種不可變 allowlist 偏好事件；兩個正式 UI 入口已接五種回饋，定案前可依回饋重生三套方案。三案例 Runtime、兩支實體手機、管理審核、檢舉／隱藏、頻率限制、Owner 與 training candidates 仍未完成。

### 相依／可平行

私人清單／治理依 Phase 1、2 可先行；Replanner 與排序學習依 Phase 5。治理未完成前不得開放陌生使用者自由投稿或宣稱模型已學習。

## Phase 7 — 手機整合、外部跳轉與誠實降級

### 目標

把 Phase 2～6 串成手機直向完整流程，讓等待、錯誤、無資料與外部服務失效都有可理解且不誤導的畫面。

### 交付

- 房間、共同條件、私密需求、三套方案、完整行程、意見／重排、finalize、私人清單與回饋畫面。
- 生成／外部服務／同步狀態、版本衝突、身分到期、無候選與 503 降級 UI。
- 場地卡「在 Google Maps 查看」按鈕，只讀 Sideby 自有／授權資訊與 Phase 4 URL builder。
- 外部訂位／購票、合作標示；不保證座位、不代理付款。
- Google／網路不可用時，Sideby 結果仍可閱讀，外部詳情標示暫時無法開啟且不回存 Google 頁面。

### 完成條件

- 手機直向主流程無死路；錯誤可恢復或明確停止，不用假 loading／固定成功掩蓋失敗。
- Maps 按鈕有／無 Place ID 都正確，有 ID 時優先、無 key、只在點擊後外部開啟。
- 實機驗證 Google 不可用不影響核心推薦；公開畫面不含另一人的私密原文或可反推理由。

### 目前狀態

`部分完成（公開 Worker／同源 API 已通）`。`frontend/` 已納入主 Repo，匿名建立／加入房間、共享條件、本人私密需求、雙方確認、三套後端行程、反應／重排、finalize 與本人偏好回饋已接根 API；production Worker 的同源 `/api` proxy 已用 runtime 與匿名身分驗證。合成場地不會用名稱誤配真實 Google 商家，畫面明示 synthetic 且不顯示真實商家評分／照片。真實 Gemini、真實場地、兩支實體手機、Google production 及 Owner 驗收仍未完成。

### 相依／可平行

完整整合依賴 Phase 2～6 的穩定 API。前端可用明確合成資料開發，但固定畫面資料、代理連通或 build PASS 都不能宣稱真實推薦、Gemini／Google Maps、同步或雙人定案完成。

## Phase 8 — 端到端、效能、隱私與 Owner 驗收

### 目標

在目標硬體與真實裝置上分層驗證 MVP，最後由 Owner 決定是否接受。

### 交付

- clean install／migration／build／test 與目標部署啟動證據。
- 兩瀏覽器、兩手機完整主流程：邀請、同步、私密輸入、生成、投票、重排、finalize、回饋。
- 對抗性隱私、跨使用者、日誌、cache、Realtime、外部模型非法輸出與公開理由測試。
- 同步、第一輪行程、局部重排的 p50／p95，附硬體、模型、資料量、冷／暖啟動、併發與失敗條件。
- Google Maps 有／無 Place ID、URL encoding、手機開啟、Google／網路失效與不回存資料的實機證據。
- Demo 紀錄、已知限制與 Owner sign-off。

### 完成條件

- 自動測試、HTTP、兩裝置、公開畫面、外部跳轉與 Owner 各有可追溯證據。
- 公開同步 2 秒、第一輪三套 15 秒、局部重排 8 秒，以預先定義環境與多次樣本量測。
- 硬限制違反 0、locked stops 保留 100%、私密洩漏 0；失敗顯示真實狀態，且不切換成未揭露供應商或假資料。
- Owner 明確接受前，不稱產品完成或可交付。

### 目前狀態

`部分完成（自動＋本機 Runtime 證據）`。`npm run check:all` 全綠，前端代理另驗 Authorization／SSE／跨來源拒絕；本機兩個瀏覽器頁面已走過合成建立／加入、共享、兩人私密確認、三套行程與結果頁。這仍不是兩支實體手機、真實 Gemini、真實場地、三案例效能、正式部署或 Owner sign-off，因此不得稱 Accepted MVP。

### 相依／可平行

完整驗收依賴 Phase 7。自動、隱私與效能案例可先準備，但只在受驗版本與目標環境執行後算證據。

## MVP cut line

- Phase 1～7 是 MVP 功能施工範圍；Phase 8 不新增產品功能，而是不可省略的 release／Owner 驗收閘。
- `Feature Complete`：Phase 1～7 完成，仍不得稱 Owner 已接受。
- `Accepted MVP`：Phase 8 全部通過且 Owner sign-off。
- 黑客松可縮小場地區域、筆數與解析屬性，但不得刪除隱私、資料權利、硬限制、失敗誠實或證據分層。
- 2026-09-05 本輪 cut：採 Gemini＋Google Maps API 型 MVP；Owner 核准的合成需求只作開發／回歸資料。自管模型、Embedding、RAG 與分類器訓練列為 `DEFERRED`，不得當成目前主線前置；正式前端雙瀏覽器、雙手機與隱私 Runtime 仍不可省略。

## 下一刀

整合版已在 `main`；根後端也已具備 migration＋`0.0.0.0` 的雲端啟動入口。下一步選定 PostgreSQL／Node 與 Cloudflare 帳號，填 `SIDEBY_API_ORIGIN`、`SIDEBY_PUBLIC_ORIGIN` 及平台 secrets；用公開網址完成兩支手機的房間、隱私、生成、定案與刷新驗收。Gemini 有有效金鑰後先驗私密需求單次呼叫及 fallback；評論候選標籤與安全理由改寫若時間不足維持 `PLANNED`。

## 橫向品質門檻

### 資料權利

- 每筆場地與主觀屬性都有來源、權利、更新／觀察時間、情境與審核；未知不補猜。
- Google 只有 optional `google_place_id` 保存例外；其他 Google 衍生內容不進資料庫、RAG、訓練或評測。

### 隱私與同意

- shared、private_session、private_remembered 在資料表、API、Realtime、cache、log 與 UI 分開。
- 公開、個人化與模型改進是獨立選擇；撤回與刪除停止未來使用，不用提示詞代替權限。

### 失敗誠實

- 模型、資料、外部連結或同步失敗時回真實錯誤；不切換未揭露供應商、不捏造場地、不放寬硬限制、不把 fixture 當真實結果。

### 證據分層

- 文件／schema、單元、整合、Runtime、雙裝置、公開畫面、外部服務與 Owner 各自驗收；狀態只升到實際證據層。

## 明確不排程項目

CRM、商家管理後台／自助上架、廣告管理、App 內付款、退款、發票、訂閱、完整社群（追蹤、好友、回覆串、按讚、私訊）、即時聊天、遊戲化、驚喜約會、住宿、SPA、酒吧／夜生活、過夜、長途旅遊、全臺／海外資料、大型生成模型微調平台，以及大量未授權評論／照片／私人對話 RAG。

受控短文字評論與私人清單仍在 Phase 6；離線訓練候選、自管模型、Embedding 與小型場地 RAG 為延後選項，不在本輪 API 型 MVP 主線。

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

## 附錄 A — 舊自管訓練／RAG 應變安排（DEFERRED）

以下只保存方案修改前的歷史規劃，不是目前施工順序、產品 Phase、工期承諾或完成證據；除非 Owner 日後明確恢復自管模型／RAG 路線，否則不得照此開工。

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
