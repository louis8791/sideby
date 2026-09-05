# Sideby — MVP TDD

## 2026-09-06 全候選正式發布契約（已部署）

- `buildCandidatePoolRelease` 從單一最新政府 staging run 建立版本化 release：保留 13 筆既有 `verified_current` 記錄與時段，其餘有效候選發布為 `eligible_with_unknowns`，每筆只建立一個未來 90 天的 `provisional` slot，避免用每日假時段膨脹資料。
- `venue_records`／`venue_recommendation_index` 的未知價格維持 SQL `NULL`；索引 `price_basis` 可為 `unknown`。未知價格不可回填為 0，未知室內外或冷氣不可回填 false。
- 推薦輸出允許 nullable `total_cost`／`estimated_cost`，每站帶 `verification_status` 與 `unknown_fields`。含待確認候選的方案必須是 `confirmation_required=true`、`hard_constraints_passed=false`；前端須清楚警示。
- 一般無衝突需求可使用 provisional 候選；任何明確室內外、冷氣、飲食、過敏、無障礙等硬條件仍以精確值過濾，未知不得通過。`npm run check:all` 已通過 84 項測試及兩端 build。
- 發布與索引寫入改為 JSON 批次 SQL，避免 1,121 筆逐列 round trip。每日 `venues:refresh-all` 依序更新政府資料、Place ID、全候選 release 與學習索引；同日同來源版本冪等。
- Google 評論分類最多 12 個即時線索，新增室內、冷氣、冷氣可能不足與營業提醒；測試必須鎖住不持久化、不參與硬條件或排名的邊界。
- Production 驗收：Railway migration 012 後成功發布 `sideby-release-pool-20260906-a8f936dc01`；資料庫為 1,121 records、2,058 slots、1,108 provisional slots、107,616 legs，active index 1,121 entries／1,108 unknown price。公開後端以兩身分完整確認後回 3 套三站，全部採此 release，3 套均 `confirmation_required=true`，共 7 個待確認站點；Cloudflare version `c0aace76-df4f-4914-b373-db9e956564a3` 首頁／同源 runtime 200，正式 bundle 含兩項警示文案。

## 2026-09-06 Google 評論即時線索測試

- 分類器只接單次 Place Details 回應中的最多五則文字評論，固定輸出最多十個 allowlist 線索，區分正向與提醒類並計算被幾則評論提及；無文字或無命中即不顯示。
- 回歸測試須鎖住「安靜好聊／可能擁擠／可能排隊」等代表案例、數量上限與 Place Details 回傳接線。任何程式不得將評論或衍生線索傳到根 API、PostgreSQL、場地索引、偏好事件或學習候選。
- UI 必須同時顯示粗略分類與不影響價格、冷氣、室內外硬篩選的告知。程式／離線測試通過不等於 Google 正式回應或公開畫面已驗收。

## 2026-09-06 成長功能正式驗收

本機 `check:all` 共 81 tests 及兩端 build 通過，PR #22／#23 前後端 CI 通過。Migration 011、個人無屬性回饋排序、候選來源撤回、匯出 split、資料／矩陣／索引原子 rollback、重啟保留 release，以及匯入轉換版本更新均有回歸測試。正式 API 驗證完整 34 選項、原始硬限制不被 normalizedText 覆蓋、雙人加入與 3 套 approved_dataset 三站方案；瀏覽器登入表單可開。該次正式資料庫為 13 筆索引，已由本檔最上方的 1,121 筆 release／index 取代。實體手機及真實學習品質未驗。見 `docs/RECOMMENDATION_GROWTH.md`。

- 測試全部 30 軟選項與 4 環境選項、否定、未知語句；禁止前端正規化靜默覆蓋原始限制。
- 候選召回依硬限制及雙方適配，不能用 venue_id 前 32 筆作全部候選；只有核准屬性及可重算行程事實可計分。
- 全量政府資料依證據核准或列缺件，資料與索引原子發布；重啟不能覆蓋較新資料。未知冷氣、價格、營業及天候不得補成通過。
- 離線候選須有效同意、人工核准及撤回過濾；索引只含通過政策的核准資料。測試、正式部署及 Owner 驗收分開記錄。

## 2026-09-06 Gemini free-tier demo runtime

- Owner 採零付費方案；`GEMINI_API_KEY` 維持 Cloudflare server secret，免費層只接受合成／非敏感展示內容。UI 的 opt-in 必須同時包含「非敏感展示內容」自我確認與免費層資料使用告知；真實私密內容仍走本機規則。
- Production 行為證據：兩個獨立瀏覽器完成 32 碼邀請加入、共同條件、雙方非敏感偏好輸入與最新版確認；Gemini Server Function 回 200，未出現 provider error，最後產生三套 `approved_dataset` 三站路線。診斷用 Cloudflare invocation logs 已關閉；此證據不取代真實私密資料、失敗矩陣、兩支實體手機或 Owner 驗收。
- 回歸測試須鎖住免費層告知文字、明確 opt-in、無 provider body 日誌，以及 key 不進 client bundle／Git。不得用本機 fallback 的成功結果冒充 Gemini 成功。

## 2026-09-06 Invite and authentication regression

- UI 契約鎖定邀請欄位 `maxLength=32`、`autoCapitalize=none`、`autoCorrect=off`、`spellCheck=false`，並以正式後端產生的完整 code 完成建立者／加入者兩個獨立瀏覽器狀態驗收。
- `authAvailable` 初始固定為 false，只在 client effect 呼叫 `isSupabaseConfigured()` 後啟用，避免 Worker SSR 有平台變數而靜態瀏覽器 bundle 沒有 VITE 設定時產生 hydration 漂移與死按鈕。
- Auth request wrapper 以 `finally` 保證解除 busy，捕捉被拋出的網路例外並顯示安全錯誤；production build 必須帶同一 Supabase URL／publishable key，並以無效測試帳密驗證表單確實收到服務回應，不建立測試帳號。
- Runtime：PR #18 checks 與本機 `npm run check:all` 通過；Railway deployment `108b916d-6954-46a5-a418-1c60063b22fa`、Cloudflare version `49a0e177-7dae-4d49-8728-f0bdf90fedcf` 成功。公開 Worker 的兩個獨立瀏覽器完成完整 invite join、SSE 成員同步及進入共同條件頁；登入用無效測試帳密取得安全錯誤。未建立測試帳號，未取代實體手機驗收。

## 2026-09-06 Venue refresh staging

- Production 驗收：PR #15／#16 GitHub backend／frontend checks 全綠；Railway deployment `60042a23-4865-4411-9aa9-088a5136e307` 中 active dataset／matrix 均為 `approved_dataset`，實數為 13 records、950 slots、468 legs。13 staging approvals。Cloudflare Worker version `ddb20462-0bcb-4276-b8b5-0dd358e9523d` 的公開同源 API 已以三個日期／集合點完成雙方匿名身分、房間、共同條件、兩份私密輸入、雙確認與生成；三案均回 3 套三站且每站有 Place ID。
- `src/recommendations/approved-real-data.ts` 固定首批 13 筆 Owner 核准記錄、Google Place ID、政府來源證據、週期營業規則與票價。`assessVenue` 必須讓 13 筆全部 `itineraryEligible=true`；attributes 保持空陣列，不用政府敘述冒充主觀體驗。
- 標準 `prestart` 啟用 `approved_dataset` 與對應交通矩陣；只有 `SIDEBY_DATA_MODE=synthetic_demo` 才載入九筆展示資料。核准版按臺北日期產生未來 90 天 slots，查詢時只載入與 Session 時段相交的列，避免不同日期重複候選。
- 場地間及集合點到首站使用政府座標的確定性時間估算做硬限制前置值；前端只傳集合點座標、沒有內部 `matrixKey` 時，`approved_dataset` 必須統一使用 `meeting_user` 且仍能生成。Google Routes 仍只在前端即時顯示，不把回應寫入 PostgreSQL。這不是即時路況，Google 顯示值不得回寫覆蓋矩陣。
- 核准 slots 目前只證明室內參觀區；`airConditioned=null`、過敏／飲食／無障礙未知。相應硬限制必須回無可行方案，不可因正式資料模式而放寬。
- 行為測試須證明：標準 seed 的 active dataset／matrix 均為 `approved_dataset`、13 筆通過政策、90 天 slots 與 468 條矩陣存在；日間案例可由核准資料生成三套三站行程且每站有 Place ID。
- Migration 009 新增 `venue_sources`、`venue_import_runs`、`venue_staging_records`。來源 metadata、SHA-256、城市範圍、來源／範圍／staged／rejected 數量及 rejection summary 可追溯。
- `src/venues/tourism-open-data.ts` 下載交通部景點與餐飲 JSON，移除 BOM、只保留臺北／新北，正規化為既有 `VenueRecord`，再走 `assessVenue` 唯一政策出口。政府來源不建立 attributes，缺街道地址時明示「開放資料未提供街道地址」，非法座標或 schema／policy 失敗即拒絕。
- `npm run venues:refresh-government` 為 dry-run；加 `-- --apply` 才以既有 `DATABASE_URL` 寫入 staging。資料庫使用 advisory transaction lock；內容 hash 相同時回用既有 run，批次失敗 rollback，不修改 `venue_datasets.active`。
- 自動測試覆蓋城市篩選、缺值明示、錯誤拒絕、無 Google 欄位、draft／零主觀標籤、PostgreSQL transaction、冪等與 active dataset 保留。正式 activation 仍須人工核准、execution slots、交通資料與三案例 Runtime。
- PR #11 `0452445` 已部署 Railway；migration 009 成功，正式 DB 首次寫入 1,121 筆，第二次相同內容回 `reused=true` 且 run ID 相同。獨立 `venue-refresh-daily` Cron 服務用 PostgreSQL reference，每日 00:00 UTC 執行同一命令並在完成後退出。
- Migration 010 新增 `venue_google_place_matches` 與 `venue_candidate_review_queue`。ID-only Text Search 的 FieldMask 固定為 `places.id`，候選查詢合併政府名稱、地址與 500 公尺座標偏置；只寫 Place ID、對應狀態、時間與重試計數。新政府快照以穩定 `venue_id` 沿用已有 Place ID，不回填 Google 衍生內容。
- 2026-09-06 Railway production 批次對應後，資料庫實際計數為 `matched=1120`、`not_found=1`、`retry=0`，最新 staging 為 1,121 筆，其中 1,120 筆含 Place ID。100 筆審查隊列已實際讀取。Cron deployment `71aa7dff-06a5-4b63-a12b-78f753f88af6` 使用 `npm run venues:refresh-all`；這些是匹配與候選證據，不是人工核准證據。

## 2026-09-05 公開 Worker／Railway 執行契約

- `frontend/package.json` 固定 Wrangler 4.129.0；preview／deploy 均讀 Nitro `.output/server/wrangler.json`，保留 generated `no_bundle` 與 assets。deploy 加 `--keep-vars`，避免重部署清掉 Dashboard 的一般環境變數；server secrets 仍由平台保存。
- 帶 body 的 API 請求在 Origin／設定檢查早退時，`rejectRequest` 以 `pipeTo(new WritableStream())` 完整消耗串流，不轉送／記錄內容；cancel-only 在本機 workerd 仍會造成下一請求 500 與 ProxyWorker 結束，不可當修復。
- `google-maps.test.mjs` 驗 403／503 早退讀到 EOF 且零 outbound fetch；`check-frontend-proxy.mjs` 真正驗重複拒絕後仍可 API／Bearer／SSE，最後首頁與建置資源仍可讀。2026-09-05：47 根＋15 Maps／proxy 測試、前端 typecheck／build、本機 workerd 與 GitHub PR checks 通過。
- Railway 根服務連 PostgreSQL，啟動 migration 完成後由 Next 使用平台 `PORT=8080`；Railway public domain 的 target port 必須同為 8080，不能沿用本機 3000。健康路徑 `/api/runtime`、直接匿名建立與 Cloudflare 同源代理均已公開回應成功。
- Cloudflare Worker 為 `louis8791-sideby-frontend`，正式 `SIDEBY_API_ORIGIN` 指向 Railway、`SIDEBY_PUBLIC_ORIGIN` 指向 Worker 本身；Google server key 只以 secret 上傳。公開 `/maps-check` 已目視通過 Maps JavaScript 底圖，Places／Routes／Geocoding 也由 Worker 真實取得結果。Cloudflare 對 `redirect: "error"` 的外連會拋 `TypeError`；adapter 使用 `redirect: "manual"` 並拒絕所有 3xx，避免 server key 隨重新導向送出。測試需鎖住 manual mode、3xx fail-closed 與錯誤不含 secret。

## 2026-09-05 環境契約與可延續架構

- `POST /private-inputs` 可帶 `environment: {setting: indoor|outdoor|null, airConditioning: required|excluded|null}`。前端將明確選項直接傳後端；這兩欄不送 Gemini 解讀，不受其正規化遺失影響。API 嚴格檢查列舉與額外欄位。
- 唯一私密權威為 `parser_output.result.hard_constraints.environment`，沿用 session_inputs 的 JSONB，不增加 DB migration。舊 envelope 未帶此欄等同不限。API 回給本人，公開狀態／SSE 不可含 environment；修改仍使雙方確認失效。
- 規則解析只接受完整環境標籤，不將「不要冷氣」等否定句當成「冷氣」。文字與結構化欄位矛盾要求澄清；雙方各自合法但交集為空則無可行行程，不洩露哪一方的限制。
- `executionSlotSchema` 的 `outdoor` 描述實際使用區域；新增可選 `areaName`、`airConditioned: boolean|null`。未知／舊值缺漏不補成 false。同一 venue 可有多個區域 slot，每一候選必須由同一 slot 同時滿足環境、開放時段與天氣。戶外天氣必須 verified_suitable。
- 新生成的 public stop 帶 `execution_slot_id` 與 `area_name`；兩欄在 schema 保持 optional 以相容舊行程。這是公開場地資訊，不回傳個人的篩選理由。局部重排以 slot ID 保留已鎖定區域；舊行程無 slot ID 僅保留原有 venue／順序契約，不能宣稱區域已鎖。
- 持續發展沿用既有分層：私人清單／同意／回饋 API、本人偏好投影、合法場地 gate、版本化候選與交通矩陣、雙人版本確認。新增偏好先補 schema、語意、可信資料及行為測試，不以模型補值當事實。既有候選讀取上限與組合搜尋尚未完成規模測試。
- 公開需求研究只存摘要與統計指標於 `docs/demand-evidence.json`，不下載個人受訪紀錄、不混入場地資料或推薦訓練。來源與推論分欄，數值不得視為 Sideby 實績。
- 驗收涵蓋完整標籤解析、雙方衝突、四種室內外／冷氣組合、未知資料拒絕、同店不跨區借條件、鎖區重排、舊 envelope 相容與私密 HTTP／SSE。產品語意與完整 34 項清單以 PRD 為準。

## 2026-09-05 單一 Repo 整合更新

跨對話接續先讀 `docs/NEXT_SESSION_HANDOFF.md`，再用目前 Git、環境欄位存在性、測試與 Runtime 重驗；交接記錄不是部署或外部服務成功證據。

Google 接線：`frontend/src/lib/google-maps.server.ts` 使用官方 Places／Routes／Geocoding REST；`maps.functions.ts` 在 development 檢查 loopback＋同 Origin，在 production 只接受 `SIDEBY_PUBLIC_ORIGIN` 指定的同來源 HTTPS 請求。瀏覽器 loader 只用 `VITE_GOOGLE_MAPS_API_KEY`，其餘用不同 `GOOGLE_MAPS_SERVER_API_KEY`。無全域 Places／照片快取；照片保留作者歸屬；逾時／拒絕不洩漏 key／原始錯誤。2026-09-05 本機四項服務曾單次驗收成功；正式 Worker 已部署但四項實測未通過，需由實際 key 擁有者修正限制後重驗，手機另行驗收。

唯一主 Repo 為 `louis8791/sideby`。根 Next.js／PostgreSQL 管既有應用狀態；`frontend/` 為 TanStack Start／Vite＋Supabase／Gemini／Google Maps 來源程式，包含獨立伺服器功能，不能當成純靜態網頁。根 npm lockfile、前端 Bun lockfile 各自安裝；根 TypeScript 排除 frontend 及 .local。

開發 `/api/*` 經前端 Vite 代理轉至根後端；正式 TanStack Worker 入口也以 `SIDEBY_API_ORIGIN` 轉送同來源 `/api/*`，保留 Authorization／SSE、驗瀏覽器 Origin，並把 Origin 改為根 API 自身 Origin 供後端守門。未設定或非 HTTPS 目標即回 503。最新主畫面以根 API 的匿名 Bearer 身分完成房間、共享、私密、確認、生成、反應／重排、定案與回饋；Supabase 只是可選帳號功能，不是根 API 身分來源。

根後端正式啟動入口為 `npm start`：`prestart` 先以 advisory lock 冪等執行 PostgreSQL migrations，再依資料模式載入版本化資料。標準模式啟用 `sideby-approved-2026-09-06-v1`；`synthetic_demo` 只保留於明示本機 demo。Next 最後綁 `0.0.0.0` 並使用平台 `PORT`。

本輪主線選 Google Maps＋確定性規則；Owner 不主打 Gemini。Gemini、自行訓練／自管模型／RAG 均延後，既有 adapter 與資料守門保留但不列入提交 gate。

黑客松 UI 可保留固定邀請碼與範例行程。範例必須有獨立 demo／synthetic 狀態；真正 API 呼叫一旦失敗，只能顯示失敗或不可用，不得切換範例並沿用成功狀態。這項 cut 不降低後端權限、私密隔離與輸出驗證。

遠端 `archive/phase3-itineraries-checkpoint-20260905`／`63cfe6c` 只保存舊推薦候選。若要採用，先逐檔比較現行 main 的 schema、migration、API 與測試；不得因 archive 自身測試曾通過就整包 cherry-pick 或宣稱已整合。

## 1. 技術決策

工作區隔離：根 repo 保留 Next.js／PostgreSQL，TanStack 前端納入 `frontend/`，各有依賴與建置目錄，只有根 Git。TypeScript 僅掃描明確來源並排除 `.local`／`frontend`；Next root 固定。既有 local launcher 維持 cwd／埠檢查。以下未更新的模型技術章節是前一版規劃。

實作狀態依 ROADMAP 的 Phase 1～8 八個頂層階段回報；舊 1A／1B 與 4A～4E 僅保留為歷史工作包與證據入口，不能作為現行額外 Phase 或整階段通過證據。

MVP 採模組化單體，不拆微服務。以 React、Next.js、TypeScript、Server Routes、PostgreSQL、匿名身分與 Realtime 實作；Google API 提供即時地圖／地點／路線展示，核心推薦仍只接受核准資料與可驗證輸入。

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

### 1.4 雙人房間後端已實作選擇（原 Phase 1B，現 Roadmap Phase 2；2026-09-04）

- Next.js App Router＋TypeScript＋pg＋Zod；版本鎖定 package-lock.json。
- 匿名 Bearer 憑證只存雜湊、七天到期；邀請碼 24 小時到期，A／B 固定兩個席位。
- PostgreSQL 私有資料庫：anonymous_users、couples、couple_members、date_sessions、session_confirmations。其他下列資料表仍是後續規格。
- 共同條件採 optimistic version，交易鎖序列化修改／確認；編輯後清空兩方確認。
- Roadmap Phase 2 以 SSE＋500ms 查庫提供公開快照，10 秒心跳、30 秒在線期限、60 秒重連。尚未接 Supabase Realtime／RLS。
- 應用 API 是唯一資料入口；共同狀態固定欄位輸出，不對前端開放資料表。每房間暫定一個 Session，重送建立回原 Session。
- db/001_rooms.sql 為實際 migration；本機開發／測試使用可攜 PostgreSQL，資料、密碼與紀錄留在 .local/ 並排除 Git。
- 已實作路由、公開狀態、輸入範圍與錯誤以 [BACKEND_API](docs/BACKEND_API.md) 為雙人房間串接契約；下文完整 MVP API 不代表已全部可用。

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
- user_preference_versions、preference_feedback_events：只記本人可追蹤的偏好版本與不可變事件；當次 Session 事件與經有效個人化同意的長期投影分開。
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

### 4.2 私密輸入與 parser envelope（原 Phase 2，現 Roadmap Phase 3）

`POST /api/sessions/:id/private-inputs` body 為 `rawText`、`tags` 與 `visibility`；伺服器從 Bearer token 決定 user_id，資料庫以 `(session_id,user_id)` upsert。GET 只取得本人輸入，DELETE 刪除本人輸入；非成員及另一人的不存在投影都回 404。POST／DELETE／remembered 撤回會增加 Session 公開 revision 並清除既有 confirmations，使並行的舊版確認以 VERSION_CONFLICT 失敗；公開 revision 只表示決策輸入已改變，不暴露內容。

目前 parser 入口是 `rule_baseline_v1`，envelope 狀態固定為 `parsed／needs_clarification／unavailable`。只有符合 preference-query 契約的 parsed 結果可保存；不完整候選轉成 `PARSER_OUTPUT_INVALID` unavailable。規則只處理有限明示語句與阿拉伯數字限制，不能安全覆蓋完整句子時回澄清，不忽略未支援硬限制。這是可執行基準，不是自管分類器或 LLM 已交付。

`private_remembered` 只在當期條款有效且 `personalization_enabled=true` 時接受；關閉設定時，既有 session_inputs visibility 與 parsed result visibility 一併降為 `private_session`。原始私密輸入不會因 `model_improvement_opt_in` 自動進 training candidate 或共用索引。

### 4.3 Gemini 延後三接點契約

本節保留未來接線邊界；2026-09-05 Owner 決定本輪不主打 Gemini，真實 Gemini 與三接點驗收不阻擋本輪黑客松提交。

Gemini adapter 一律在伺服器執行，`GEMINI_API_KEY` 不得使用 `VITE_` 前綴或出現在 bundle、請求回應、一般日誌與 Git。模型名稱與 prompt／schema 版本須可追蹤；日誌只記 request id、用途、模型版本、schema 版本、狀態、延遲與 token／錯誤分類，不記輸入、輸出、API key 或供應商原始錯誤本文。免費／未付費 API 只接受合成或非敏感輸入；真實私密偏好須使用連結有效帳務的 API 專案並完成告知／同意。此規則依 Google [Gemini API Terms](https://ai.google.dev/gemini-api/terms)／[Billing](https://ai.google.dev/gemini-api/docs/billing)，查核日 2026-09-05，部署前重查。

三個允許用途如下：

1. `private_preference_parse`：只在使用者送出時接收本人私密文字與已選標籤，輸出 `parsed／needs_clarification／unavailable` envelope；`parsed` 必須通過 preference schema，硬限制仍由程式解析與驗證。
2. `review_tag_suggestion`：只接收本人新輸入、最多 300 字的 Sideby 評論，輸出有限數量、受字數與 taxonomy 限制的候選標籤及可選本人偏好 signal。回應必須維持 `suggested`，第二次由本人明確確認後才能寫 `user_tags` 或偏好事件；禁止傳入 Google 評論或其衍生內容。
3. `public_reason_rewrite`：只在推薦已通過確定性驗證後接收 public-reason allowlist DTO；輸出短中性文字。輸入與輸出都不得含 private text、user_id、角色來源、淘汰原因、未核准場地事實、價格／時間／優惠補猜或可反推哪一方偏好的敘述。

客戶端不得直接呼叫 Gemini；三個用途不得在 keypress、地圖事件、背景輪詢或頁面 render 觸發。每次請求須有 timeout、每人頻率限制與有界輸入／輸出；429／5xx、逾時、非法 JSON、schema 不符或安全檢查失敗都回真實失敗。需求解析可回人工明確選項；評論保留未標籤原文；公開理由可顯示標記為 deterministic 的既有程式安全理由，但任何降級不得標成 Gemini 成功。

最小測試需證明：三用途不交叉、評論標籤未確認不落盤、同一確認冪等、另一方不可讀取原文／候選、PublicState／SSE／日誌零私密內容、禁止 Google 衍生輸入、非法模型輸出 fail closed、程式理由不被模型新增事實、API key 不進 client bundle。真實驗收另以兩個瀏覽器／兩支手機檢查送出一次只呼叫一次、確認流程、供應商失敗、刷新保存與公開畫面。

2026-09-06 狀態：`private_preference_parse` 已接根後端匿名身分與主流程；模型正規化結果只能進既有 allowlist 解析器，不被保存或公開。缺 `GEMINI_API_KEY` 時明示使用本機規則 fallback；免費層已用合成／非敏感內容完成雙瀏覽器成功 Runtime，但真實私密資料與完整失敗矩陣仍未驗收。`review_tag_suggestion`、`public_reason_rewrite` 尚未實作。

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

2026-09-05 已實作 Phase 5 後端第一刀：`db/004_itineraries.sql` 以 `(dataset_version, venue_id)` 保存可並存的版本化場地與執行時段，並保存交通矩陣及 Session 行程；`src/recommendations/engine.ts` 先 fail-closed 過濾共同與私人日期／時間／戶外／訂位／交通／飲食／過敏／無障礙等硬限制，再按上述公式計分並選出三套差異方案；未知價格基準不得推薦。`src/server/itineraries.ts` 只接受同房成員與目前版本，兩人確認、兩筆已解析私密輸入、作用中資料集與矩陣缺一即明確失敗。`POST /api/sessions/:id/generate` 與 `GET /api/sessions/:id/itineraries` 已通過合成 PostgreSQL／HTTP 測試；GET 對 JSONB 重新套用嚴格 public itinerary schema，不直接外送任意欄位，Session 版本改變後舊行程不再回傳。合作欄位不進分數，公開輸出通過 allowlist、itinerary schema 與 Privacy Guard。fairness 最低門檻尚未定義；這不代表 Phase 4 真實場地／RAG、三案例 Runtime、前端或 Owner 已驗收；細節見 `docs/PHASE5_ACCEPTANCE.md`。

2026-09-05 已開始 Phase 6 後端第一刀。`db/005_replan_finalize.sql` 分開保存單一使用者擁有的 reaction、雙人 finalize choice 與 Session finalization；公開 itinerary ID 與資料表主鍵一致。Reaction 以目前 itinerary 的 stop_id 驗證目標並 upsert，雙方 stop-like 才推導 locked；reaction row 不進共同輸出。Replan 從伺服器 payload 取得 locked stops，使用同一 `composeItineraries` 排除衝突候選，保留 `stop_id／venue_id／order_no／locked`，整條路線重驗失敗就 rollback。Finalize 只有兩位成員選同一 itinerary 才成立，且定案後拒絕重新生成、反應、重排與改選。合成整合測試不能替代兩瀏覽器、真實資料或 Owner 驗收；細節見 `docs/PHASE6_ACCEPTANCE.md`。

## 6. 隱私實作

Privacy Guard 必須在公開輸出前執行：

1. 檢查是否包含任一私密原句或高相似片段。
2. 檢查是否包含 A／B 或輸入者指向。
3. 檢查是否把私密排除原因說得過度具體。
4. 改寫成共同條件、中性理由，或不提供理由。
5. 重新通過公開 itinerary schema 與 policy check。

不要只依賴 LLM 的自我約束；要有程式層的欄位隔離、輸出 allowlist、日誌過濾與對抗性測試。

目前 PublicState／SSE 與公開評論出口已接 `publicProjection` 欄位守門，遇到 rawText、structuredInput、parserOutput、clarification、userId、token 或 inviteCode 等私密欄位會拒絕輸出；`safePublicReason` 會拒絕私密原句及 A／B／「其中一方」來源線索。Roadmap Phase 5 生成公開理由時仍須把所有私密原文傳入同一守門並做兩瀏覽器對抗測試，現階段不能宣稱完整 Privacy Guard 已驗收。

## 7. 外部服務與降級

本輪已建 Google Places／Routes／Geocoding live adapter 與 Maps JavaScript 檢查頁，僅作即時查詢與展示。核心推薦使用核准的 curated data、營業快照與可驗證交通輸入；其他資料服務仍須個別確認來源與權利，不能自動接入。介面必須標示資料時間或無法確認的狀態，不可把估算說成即時確認；必要事實未知時不能通過可執行驗證。

外部訂位／購票只提供連結跳轉，不在 MVP 內代理付款、保證座位或處理退款。

Google 詳細資訊以 Place ID 在行程頁即時查詢並顯示，包含名稱、地址、營業時間、評分、照片與最多五則評論；照片及評論保留作者標示，任何回應都不得寫入資料庫。最多十個評論情境線索只在單次回應中產生與顯示，不得成為場地事實、排序或學習輸入。地圖與導航 URL 以自有／授權的 `venue.name` 作必填 `query`，有 `google_place_id` 時加入 `query_place_id`／`destination_place_id` 優先定位，且不得包含 API key。

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
- 太暗、太吵、太幼稚、太正式、走太多採伺服器 allowlist 映射；定案前回饋重生本次三套方案，只有有效 `personalization_enabled` 才寫入本人 long-term，且不影響其他使用者。
- 非 allowlist signal 回 400；同一人、行程、站點、signal 重送冪等，不得由前端自訂 attribute、方向或 delta。
- 已有 reaction 或 pending finalize choice 時 generate 回 `DECISION_IN_PROGRESS`，既有反應、鎖站與選擇筆數保持不變；定案後未開個人化的回饋回 `PERSONALIZATION_REQUIRED` 且不寫事件。

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

- Windows 測試中的 `next start` 由共用 start／stop 管理：每次啟動重新配置空閒連接埠，stop 關閉整個程序樹並等待退出，啟動失敗保留實際日誌；migration restart 行為測試必須確認重啟後資料仍在且不沿用舊連接埠。
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

Roadmap Phase 2、5、6 已有可執行 API、migration 與真實 PostgreSQL／HTTP 整合測試，Phase 7 已有正式手機優先頁面、本人私人清單與誠實 click-out 降級。Chrome 雙分頁已跑完一個合成主流程，IAB 已驗 390／1280 無水平 overflow 與可見鍵盤焦點；推薦場地仍是合成資料。這不代表兩支實體手機、三案例效能、真實場地／RAG、公開部署或 Owner sign-off。各層仍須分開驗收。

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

需求分類器已實作以下資料層入口（現列入 Roadmap Phase 3）：

- `src/model/requirements.ts`：Zod 契約、逐筆驗證、重複 sample_id、group split 與資料／taxonomy 版本檢查。
- `scripts/validate-requirements.ts`：JSONL 命令列驗證器，輸出 VALID／INVALID 與錯誤清單。
- `data/training/requirements.example.jsonl`：六筆明確標為 synthetic 的格式範例。
- `data/training/requirements.hackathon.jsonl`：Owner 從合成草稿核准的 15 筆基本展示資料，5 個改寫群組按 60%／20%／20% 切分；不是真實使用者研究或模型品質證據。
- `tests/model-requirements.test.ts`：驗證合法範例、group 跨切分及未審核／虛構原文證據的拒絕行為。

本輪 Phase 1／2 預設驗證 committed 的合成展示資料；未來若恢復真實資料評測，真實需求表仍放在 `.local/phase1/requirements.jsonl` 並排除 Git，且須另以 `PHASE1_REQUIREMENTS_PATH` 指定。只有人工核准案例可進切分，資料驗證通過仍不代表分類器已訓練或達到品質門檻。

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

可重跑入口為 `npm run requirements:validate -- <requirements.jsonl>` 與 `npm run phase1:check`；完整 CC 交接見 `docs/PHASE1_ACCEPTANCE.md`。2026-09-05 Owner 將模型評測與 RAG 延後，因此本輪顯示 `DEFERRED` 且不阻擋；兩瀏覽器 Runtime 仍缺時必須 fail closed。

- 逐屬性及各方向報告 precision／recall／F1、support，另報 macro-F1、混淆案例與 group 數。未提及類別分開報告，不用總 accuracy 掩蓋否定失敗。
- 分開報告程度規則、明確數字／單位解析、釐清案例成功率及可自動處理覆蓋率。全部拒判不能算「解析零錯誤」的成功產品。
- 驗證組上分類器須比固定規則帶來可說明的收益，且關鍵否定／硬限制案例不退步；最終測試報實際差異，不預先保證準確率或顯著改善。
- 已定義的硬限制違反案例要求 0 個放行；未知條件須拒絕／釐清。這只是該組測試門檻，不宣稱所有真實輸入永遠零錯誤。
- 如訓練路徑無收益或超出時間，保留規則／人工選項並標示實際模式；保存失敗證據，不假稱已部署分類器。
- 分類成功、RAG 命中、三套行程可執行、兩人接受度分開評測。需求表不包含某店實際採光資訊，不能拿它當場地資料。

## 12. 非 Google 場地證據與資料可行性

### 12.1 來源及更新

- Google API 只作即時查詢與展示；不將 Google Maps／Places／搜尋摘要／Takeout 衍生內容寫入場地資料、標籤、訓練或索引。
- Place ID 是上述保存限制的窄例外：可對政府候選用 `places.id` 唯一 FieldMask 批次對應並保存 optional `google_place_id`；不得連帶保存 Google 回傳的名稱、地址、營業、評論、照片、搜尋結果或依其推導的標籤，也不得用搜尋結果新增候選。
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
