# Sideby 跨對話交接（2026-09-05）

## 2026-09-06 產品介紹稽核與最後收尾（最新）

`output/pdf/Sideby_窗口產品介紹.pdf` 已完整讀取及逐頁渲染；它是 2026-09-05 的本機快照，不是最新正式提交版。`docs/PRODUCT_INTRO_CLAIM_AUDIT.md` 已列出所有差異：30 個軟偏好現已全數映射至 21 屬性、五種個人回饋、1,121 筆正式比較池（13 verified／1,108 needs confirmation）、正式 Cloudflare／Railway 上線，以及 Gemini 免費層非敏感展示 Runtime。舊 PDF 的「非已上線」、「11／19 映射」、「只有太暗」、「真實場地完全待補」與「Gemini 尚未驗證」均不可再作現行宣稱。

最後必要工作只有證據與提交收斂：重製最新 PDF；兩支實體手機走完整主流程及 Google 降級；公開登入若保留則驗成功登入／恢復或標示 Beta；Owner 正式網址走查與 sign-off；固定 main、部署、release、測試及比賽要求的簡報／影片／連結。1,108 筆逐筆補證、新模型訓練、自訂 `sideby.dev` 網域與商業驗證可延後。2026-09-06 查核 `www.sideby.dev`／`sideby.dev` 尚無可用 DNS／HTTPS，正式入口仍是 Workers 網址。

## 2026-09-06 全候選發布完成狀態（最新，優先於下文）

Owner 已改變發布 gate：最新 1,121 筆通過 schema／來源政策的政府候選都要進正式推薦池，不要求每筆先補齊價格、時段、實際區域、室內外及冷氣。這不是批量補證；13 筆維持 fully verified，其餘以 `eligible_with_unknowns`／`needs_confirmation` 發布，未知欄位維持 null。一般路線可使用，明確環境／安全硬條件仍 fail closed；含未知站點的方案必須顯示待確認、nullable 總價、`confirmation_required=true` 與 `hard_constraints_passed=false`。

PR #27 已合併 `main` `4dbabfa`；Railway deployment `a10e8db4-29f9-402b-83b0-a283e8879d1c` 成功並套用 Migration 012。Production active release `sideby-release-pool-20260906-a8f936dc01` 實查為 1,121 records、2,058 slots（1,108 provisional）、107,616 legs；active index 1,121 entries，其中 1,108 筆 unknown price。公開後端以兩個匿名身分完成共享條件、兩份非敏感輸入、雙確認與生成，回 3 套三站且全部使用新 release；7／9 站標為 `needs_confirmation`，3 套均 `confirmation_required=true`。

Cloudflare Worker version `c0aace76-df4f-4914-b373-db9e956564a3` 已部署；正式首頁與同源 `/api/runtime` 回 200，bundle 含「部分價格待確認」及「價格／營業／區域請於出發前確認」。建置沿用正式 bundle 既有的 Supabase browser 公開設定，未輸出或提交其值；`--keep-vars` 保留平台 origins 與 secrets。下一個 Owner gate 是兩支實體手機主流程與畫面目視，不是再發布場地。

Google 評論新增室內、冷氣、冷氣可能不足與營業提醒，但只在單次 Place Details 回應內粗略分類，不寫入資料庫、核准欄位、排序、索引或訓練。1,120 筆 Place ID 與 1 筆 not_found 的既有 production 證據未變。

## 本輪優先入口（2026-09-06）

Google 即時評論情境線索已上線：PR #25 merge `030de8b9e48151eb959c2e5d97ebe8dd358b46a3`，Cloudflare Worker version `4a13b1cc-6930-4c85-ad64-9059ebc8f914`。每個行程地點最多顯示五則評論，單次請求內固定規則輸出最多十個正向／提醒線索與提及次數，並明示不作硬篩選或核准事實。完整 `npm run check:all` 82 項測試、GitHub backend／frontend checks、公開首頁與 `/api/runtime` 200、正式 bundle 文案、雙瀏覽器邀請加入，以及 Maps JavaScript／Places／Routes／Geocoding 與底圖目視均通過。評論及衍生線索不落盤、不進排序、索引、RAG、訓練或評測；尚未逐一證明 13 個正式場地在當下評論都會命中線索。

PR #22／#23 已合併，功能 commit `85e5ccd` 已部署；日常回到 `main`。Railway `724d3cbf-a31a-4a17-985c-9285541fc0f5`、Cloudflare `38e9fe98-8a69-4aff-85e3-cc2ff8a7bfdd`；81 tests／CI／正式同源 API 34 選項、雙人加入、3 套真實三站路線通過，登入表單可開。先讀 `docs/RECOMMENDATION_GROWTH.md`；末段「成長功能接續」是部署前歷史，SSH 阻塞已解決，不能再當現行 blocker。

成長管線當次的 Migration 011、13 筆推薦索引與完整 refresh-all 已執行；該 13 筆現已成為最上方全候選 release 的完整驗證子集。候選快照 `tourism-tpe-ntpc-2026-09-06-38445b4239`：1,121 候選／1,120 Place IDs／128 營業文字／19 明確入場費／425 缺街道地址。學習候選仍為 0；新模型訓練、更多候選證據、主觀標籤觀察及實體手機未完成。Google 單次 IDs-only 查詢成功，未啟用付費。

正式 frontend build 需帶既有 Supabase URL 與 publishable key（只能用 browser 公開設定）；本輪已由隊友 Git 參考回填至建置程序，沒有將值提交或寫入日誌。一般 `check:all` 的 build 不會帶這些公開設定，不可直接取代正式部署包。Railway 已用既有已註冊 SSH 身分連線，不必再註冊 key 或公開 PostgreSQL。

## 最新部署接續（優先於下方歷史基線）

- 2026-09-06 repository hygiene 已收斂：`E:\sideby` 日常只保留 `main` checkout；已合併或廢棄的 9 個舊 worktree 已移除，GitHub 已合併功能分支也已刪除。長期 ref 只保留 `main`、`archive/phase3-itineraries-checkpoint-20260905` 與 tag `archive/delivery-mvp-v1`。`output/` 保留產品 PDF但由 Git 忽略。Sideby Obsidian 權威使用 `.local/obsidian-sideby-sync-20260905` 的乾淨 worktree；不得用日常 Vault 其他專案的 merge 衝突判定 Sideby 未同步。
- 2026-09-06 Gemini 免費層展示 Runtime 已接通：Owner 明確選擇零付費方案；專用 Free tier key 已更新至 Cloudflare `GEMINI_API_KEY` encrypted secret，未設定預付或付款。兩個獨立瀏覽器完成 32 碼邀請加入、共同條件、雙方合成／非敏感偏好、最新版確認與三套 `approved_dataset` 路線；Server Function 200 且無 provider error。免費層告知文案已部署至 Cloudflare Worker version `10aea24f-755f-47a7-8b96-32ab3b3a8954`，並以 `frontend/nitro.config.ts` 固定已被 Cloudflare 接受的 compatibility date `2026-09-05`；部署後加密 secrets、兩個 origin variables 均保留，診斷用 invocation logs 已關閉。這不等於真實私密 Gemini、完整失敗矩陣、兩支實體手機或 Owner 驗收；免費層只能用合成／非敏感展示內容。
- 2026-09-06 首次使用阻斷已修復：PR #18 merge `45cac2de24498f09fb38a9b5e0e6534dc4caa4c4`；Railway deployment `108b916d-6954-46a5-a418-1c60063b22fa` 與 Cloudflare Worker version `49a0e177-7dae-4d49-8728-f0bdf90fedcf` 成功。邀請欄位由錯誤的 12 碼改為完整 32 碼、保留大小寫並關閉手機自動校正。正式 Worker 已用兩個獨立瀏覽器實測建立、加入、建立者 SSE 同步與加入後進入共同條件頁；登入入口也已用既有團隊 Supabase 公開設定重建，表單可開、無效測試帳密會回安全錯誤且按鈕恢復。沒有建立測試帳號；兩支實體手機仍待最後驗收。
- 2026-09-06 首批正式推薦已上線：PR #15 merge `4e39cf307d4a3a15bf3e13b1fbecb2f11b7b09de`；公開實測發現前端集合點無內部 `matrixKey` 會無解，治本修正 PR #16 merge `84e5d3a12aa6db583c7ee11bd63f79a705baa1f7`。Railway backend deployment `60042a23-4865-4411-9aa9-088a5136e307`、cron deployment `7663da99-782f-4eab-9e4d-5f75b95fc19d`與 Cloudflare Worker version `ddb20462-0bcb-4276-b8b5-0dd358e9523d` 成功。Production DB 為 13 records、950 slots、468 legs。13 staging approvals；Cloudflare 同源公開 API 三個日間案例都回 3 套三站、`approved_dataset`與每站 Place ID。標準模式已不再使用九筆 `synthetic_demo`；冷氣與主觀屬性未知仍 fail closed。兩支真實手機與 Google 詳情目視是尚未完成的 Owner gate。
- 2026-09-06 PR #13 已合併 `main` `e3e6336cb9403614b829a331f6efa5bba5c8fdc1`：migration 010、政府候選 ID-only Google Text Search 批次對應、Place ID 跨快照沿用、100 筆審查隊列，以及行程頁即時名稱／地址／營業時間／評分／照片／最多三則評論／路線顯示均已上線；後續 `feat/live-review-signals` 將評論上限與即時模擬分類列於本檔開頭，尚未部署。Railway 正式 DB 實際為 1,121 筆候選、1,120 筆 matched、1 筆 not_found、0 筆 retry；Cron deployment `71aa7dff-06a5-4b63-a12b-78f753f88af6` 已改用 `npm run venues:refresh-all`。根後端 deployment `ab075dba-e37d-4ebf-bad4-ad93ba9250f7` 成功，Cloudflare Worker version `772bd542-38f9-478a-96b1-5b7698454cc4` 已部署；後端與前端首頁均回 200。此證據不等於 1,120 筆已人工核准。

- PR #11 已合併 `main`（`0452445`）：交通部觀光署每日景點／餐飲更新管線讀到全臺 9,818、臺北／新北 1,138，Railway PostgreSQL 已寫入 1,121 筆 draft、拒絕 17，migration 009 與相同內容冪等回用已在 production 驗證。獨立 `venue-refresh-daily` 每日 00:00 UTC 執行；公開 runtime 維持 200。這是當時 active 仍為 9 個 `synthetic_demo` 的歷史里程碑，現況已由本檔開頭的 1,121 筆全候選 release 取代。操作見 `docs/VENUE_REFRESH.md`。
- PR #9 已合併 `main`，merge commit `94ab10583738b8ac4b48bf4f882d63bb1e0c1e13`：本人偏好回饋由單一「太暗」擴充為太暗、太吵、太幼稚、太正式、走太多五種伺服器固定映射。Railway deployment `93b584c5-d3df-40b4-9cf4-6a409a019bab` 成功，migration 008 已隨 `prestart` 執行；公開 API 實測雙人確認、三套生成、「太吵」寫入與三套重生均通過。Cloudflare Worker version `999b5641-7d0c-4dbb-b957-d0383f949418` 已部署，首頁 200 且公開 bundle 含五種回饋。GitHub backend／frontend checks 與本機 `npm run check:all` 全綠（49 根＋15 Maps／proxy）。
- PR #6 已合併 `main`，merge commit `21b28f333f7cc0f70921ce3a60320183995b2817`：九個既有前端站點、十一個環境 slot、二十四條展示 travel matrix 已由 Railway `prestart` 冪等寫入 PostgreSQL；正式 API 實測生成三套、每套三站，partner 可讀回三套保存結果，共含九個 Google Place ID。展示價格、時長、屬性仍明示 `synthetic_demo`，不保存 Google 地址、照片、評分、評論或路線回應。
- Google Maps JavaScript 正式底圖已通過；Places API (New)／Routes API／Geocoding 也已由 Cloudflare Worker 真實取得結果。Google Cloud 的 browser／server key 限制已核對正確；根因是 Worker 對 `redirect: "error"` 拋出 `TypeError`，已改為 `redirect: "manual"` 並拒絕所有 3xx，production 四項現均通過。
- Owner 決定本次不主打 Gemini；它已從提交阻斷移為後續加值，不得用未驗收的 Gemini 能力包裝主流程。
- PR #4 已合併 `main`，merge commit `16cfd041899356432caa1c4cc914fa94b7541902`；feature commit `db618d0` 已保存在遠端。產品介紹 `output/` 仍未追蹤，其他 worktree／archive 未動。
- Railway 專案 `chic-bravery` 已建立 PostgreSQL 與根 Next.js 服務。GitHub source 是 `louis8791/sideby`／`main`，自動部署已開啟，`DATABASE_URL` 使用 Postgres reference，migration 成功，健康路徑 `/api/runtime`，公開 target port 已由錯誤的 3000 修正為平台實際 `PORT=8080`。
- 後端 `https://sideby-production.up.railway.app`：`/api/runtime` 200／`standard`；直接匿名身分建立 201。
- Cloudflare Worker `https://louis8791-sideby-frontend.louis8791.workers.dev` 已部署；`SIDEBY_API_ORIGIN`／`SIDEBY_PUBLIC_ORIGIN` 已設，Google server key 以 secret 上傳，browser key 由 Vite build 使用。首頁、`/maps-check` 與同源 `/api/runtime` 均 200，經代理匿名建立 201。
- 最新 `npm run check:all` 通過 49 根＋15 Maps／proxy 測試，GitHub PR checks 全綠；未輸出、記錄或提交任何 secret。
- Google production 四項通過：正式底圖可見，Places 回傳臺北車站，Routes 回傳步行／大眾運輸時間，Geocoding 回傳 ROOFTOP 座標；未讀出、記錄或提交任何 key。
- Railway deployment `9b251684-dcb4-422c-bd6f-739c477263d5` 已成功，PostgreSQL showcase 生成／保存 Runtime 通過；Google 四項通過的 Cloudflare Worker version 為 `25ada2bf-4101-4bcb-8b93-67e83c2d6d74`。兩支手機、跨網路效能與 Owner sign-off 仍未驗；不要重建既有服務。

## 本輪功能內容（已由 PR #4 推送合併）

- Scope：project-specific；Evidence：verified code／automated tests／public research。工作分支 `feat/environment-preferences-and-evidence` 的 `db618d0` 已由 PR #4 合併到 `main` `16cfd04`；下方舊基線僅保留追溯用途。
- 新增室內／戶外（含戶外區）、冷氣／無冷氣的 UI、結構化 API、區域硬限制及鎖 slot 重排。30 舊選項中 11 有近似映射、19 待補；加環境共 34。詳見 PRD、`docs/KEYWORDS_AND_GROWTH.md`。
- 重新執行 check:all 通過（47 根測試、15 Maps／代理測試、前端 typecheck／client／SSR／Cloudflare build）；有真正 PostgreSQL＋HTTP＋SSE 行為測試，且已另完成公開基礎 Runtime 驗證。
- 需求研究完成 6 組第一手來源、12 指標的 Markdown＋JSON；並非 Sideby 大數據、採用／留存驗證或訓練資料。四份權威已更新。
- 本輪瀏覽器用另開的 5311 dev 入口驗到新四選項與單選互斥，390／1280 寬度可讀；測後關閉該測試程序。原 `vite preview` 路徑問題後續已改用 Nitro／Wrangler 正式產物修復並公開部署。正式 Google referrer 仍未由實際 key 擁有者補齊。
- Railway＋PostgreSQL／Cloudflare 已部署；未更動其他 worktree／archive。Google production 四項已通過；下一步是 Lovable `Git → Re-check`／Preview／Publish（前提是該 Lovable 專案確實連到本 repo `main`），再做單瀏覽器完整流程、兩支手機、跨網路效能與 Owner gates。

這是下一個對話的唯一接續入口。若本文件與舊 Run Note 不同，以 `AGENTS.md`、`PRD.md`、`TDD.md`、`ROADMAP.md` 與目前 Git／Runtime 為準。

## 1. 立即接手位置

- 唯一主 Repo：`https://github.com/louis8791/sideby`
- 本機正式根：`E:\sideby`
- 主分支：`main`
- 已驗證功能基線 commit：`45cac2de24498f09fb38a9b5e0e6534dc4caa4c4`；本交接文件所在的最新 `main` commit 以 GitHub／`origin/main` 為準。
- 最新 Lovable 來源：`leeshim-gif/sideby` commit `c9b4925`，已審查匯入 `frontend/`。
- 舊推薦候選封存：`archive/phase3-itineraries-checkpoint-20260905`／`63cfe6c`，保留未採用，不得刪除或整包合併。

接手時先執行：

```powershell
git -C E:\sideby fetch origin
git -C E:\sideby status --short --branch
git -C E:\sideby rev-parse HEAD
git -C E:\sideby rev-parse origin/main
```

乾淨部署基線應核對 `HEAD` 與 `origin/main`；若目前在上方記錄的 feature 分支且有已知未提交工作，先保留並審查差異，不能為了對齊 main 而丟棄內容。正式上傳前記錄實際部署的已提交版本。

## 2. 已完成且已驗證

- Lovable 主畫面已接根後端：匿名建立／加入房間、共享條件、本人私密需求、雙方確認、三套 synthetic 行程、reaction、局部重排、finalize，以及太暗／太吵／太幼稚／太正式／走太多五種本人回饋。
- 根後端仍是身分、權限、Session version、私密保存與定案唯一來源；Supabase 未設定時明示「免登入展示」。
- 私密文字只有使用者勾選「允許本次內容送至 Gemini」才會呼叫 Gemini；未勾選或供應商不可用時，明示使用本機規則。
- 合成場地沒有明確 `google_place_id` 就不查 Google；不以名稱搜尋第一筆結果誤配真實商家，也不顯示其照片、評分或地址。
- production 前端 Worker 以 `SIDEBY_API_ORIGIN` 提供同一公開網址的 `/api/*` proxy，保留 Authorization／SSE 並拒絕跨來源。
- Google server functions 在 production 只接受 `SIDEBY_PUBLIC_ORIGIN` 指定的同來源 HTTPS 網域。
- 根後端 `npm start` 會先冪等 migration，再綁 `0.0.0.0` 與平台 `PORT`；本機曾以 3101 啟動並回 `/api/runtime` 200／`standard`。

已驗證結果：

- `npm run check:all`：44 項根測試＋14 項 Maps／代理測試全數通過，前端 typecheck、client／SSR／Cloudflare build 通過。
- `npm run test:frontend-proxy`：API、Bearer、SSE 與跨來源拒絕 Runtime PASS。
- 本機瀏覽器：未授權 Gemini時的規則 fallback、雙人流程與三套 synthetic 結果已走過。
- `/maps-check`：Maps JavaScript、Places (New)、Routes、Geocoding 已在本機及正式 Cloudflare 網域完成單次真實 PASS；仍不是兩支手機或 Owner 驗收證據。
- GitHub Actions：commit `6abd18f` 的 Sideby checks 成功。

## 3. 本機設定狀態

`E:\sideby\frontend\.env.local` 存在且被 Git ignore；已填兩把 Google key。Cloudflare 已設定兩個 production origin 與 Google server secret；本機檔下列仍未填：

- `GEMINI_API_KEY`
- Supabase 設定

不要讀出、回傳、記錄或提交任何 key 值。交接前已確認 Git 追蹤檔沒有 API key。

## 4. 尚未完成，禁止宣稱 PASS

- Google browser／server key 限制已核對，production Maps JavaScript／Places／Routes／Geocoding 四項通過；尚未完成的是兩支實體手機上的完整流程與失敗降級驗收。
- Gemini「評論候選標籤＋本人確認」與「合法推薦後安全理由改寫」仍是後續規劃，不是本次提交主線或阻斷。
- Google 評論已作行程頁即時顯示；`feat/live-review-signals` 另在單次回應內產生不落盤的模擬線索。兩者都不得建立 Sideby 核准場地標籤、推薦事實、RAG、Embedding、訓練或評測資料。
- 真實核准場地、兩支實體手機、跨網路效能與 Owner sign-off 未完成；正式網域本身已建立並通過基本 API。
- 持續學習的本人偏好路徑已擴充為五種 allowlist 事件：尚無 reaction／finalize choice 時可立即重生三套；已有決策進度則拒絕重生並保留資料。定案後只有個人化有效才接受回饋並跨 Session 保留。`training_candidates` 與版本化場地索引重建仍未完成／延後，不得把偏好門檻更新稱為模型訓練。

## 5. 下一個對話的施工順序

1. 不重建 Railway、PostgreSQL、Cloudflare Worker 或既有 production origins；先將 showcase 分支合併並核對 Railway seed、公開 API 與前端版本。
2. 用公開網址先完成單瀏覽器全流程 smoke，確認既有 Railway／PostgreSQL／Cloudflare／Google 串接沒有回歸。
3. 用兩支手機完成：建立／加入、共享同步、雙方私密互不可見、兩人確認、三套方案、重排、雙方定案、刷新保存，以及 Google 成功／失敗 fallback。
4. 只有上述證據成立後才更新 Phase／Owner 狀態；否則維持 `NOT_READY`／部分完成。

## 6. 收尾規則

- 每輪實作後執行 `npm run check:all`；兩個本機服務存在時再跑 `npm run test:frontend-proxy`。
- 「CP 寫寫」＝同步 Obsidian 的 AGENTS／PRD／TDD／ROADMAP、Project State、Run Note、Change Log，再 commit＋push 並核對遠端。
- 不碰主 Vault 的其他專案 dirty state；Obsidian 遠端使用 `E:\sideby\.local\obsidian-sideby-sync-20260905` 隔離同步。
- 不刪除任何 worktree、archive branch、`.local` 資料或隊友成果，除非 Owner 另行明確指定。
## 2026-09-06 成長功能接續（優先於下方歷史）

`feat/recommendation-growth` 已實作全 30 軟偏好／21 計分屬性＋4 環境條件、無屬性場地個人回饋排序、全池候選篩選、政府候選資格報告、原子發布與版本索引、Migration 011 及可撤回離線候選。`npm run check:all` 80 tests 與兩端 build 通過；後續 UI 說明亦再次完成前端 typecheck/build 和 UI tests。操作見 `docs/RECOMMENDATION_GROWTH.md`。

未做：正式部署與新場地批量核准。既有正式 13 核准場地保持；新讀來源 1,121 筆中 128 有營業文字、19 有明確入場費文字、425 缺街道地址。不能宣稱全部 1,121 可推薦或已訓練新模型。

部署前：Railway CLI 可讀服務，但舊 SSH identity 要求帳號連結；不要開 PostgreSQL 公網來繞過。Cloudflare 可讀版本，惟本機 build 缺 Supabase browser 公開設定，需要核對現行登入入口後發布，不能讓登入功能倒退。不得索取秘密值或啟用付費。
