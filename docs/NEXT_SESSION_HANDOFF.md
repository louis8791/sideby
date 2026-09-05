# Sideby 跨對話交接（2026-09-05）

## 最新部署接續（優先於下方歷史基線）

- 2026-09-06 首次使用阻斷已修復：PR #18 merge `45cac2de24498f09fb38a9b5e0e6534dc4caa4c4`；Railway deployment `108b916d-6954-46a5-a418-1c60063b22fa` 與 Cloudflare Worker version `49a0e177-7dae-4d49-8728-f0bdf90fedcf` 成功。邀請欄位由錯誤的 12 碼改為完整 32 碼、保留大小寫並關閉手機自動校正。正式 Worker 已用兩個獨立瀏覽器實測建立、加入、建立者 SSE 同步與加入後進入共同條件頁；登入入口也已用既有團隊 Supabase 公開設定重建，表單可開、無效測試帳密會回安全錯誤且按鈕恢復。沒有建立測試帳號；兩支實體手機仍待最後驗收。
- 2026-09-06 首批正式推薦已上線：PR #15 merge `4e39cf307d4a3a15bf3e13b1fbecb2f11b7b09de`；公開實測發現前端集合點無內部 `matrixKey` 會無解，治本修正 PR #16 merge `84e5d3a12aa6db583c7ee11bd63f79a705baa1f7`。Railway backend deployment `60042a23-4865-4411-9aa9-088a5136e307`、cron deployment `7663da99-782f-4eab-9e4d-5f75b95fc19d`與 Cloudflare Worker version `ddb20462-0bcb-4276-b8b5-0dd358e9523d` 成功。Production DB 為 13 records、950 slots、468 legs。13 staging approvals；Cloudflare 同源公開 API 三個日間案例都回 3 套三站、`approved_dataset`與每站 Place ID。標準模式已不再使用九筆 `synthetic_demo`；冷氣與主觀屬性未知仍 fail closed。兩支真實手機與 Google 詳情目視是尚未完成的 Owner gate。
- 2026-09-06 PR #13 已合併 `main` `e3e6336cb9403614b829a331f6efa5bba5c8fdc1`：migration 010、政府候選 ID-only Google Text Search 批次對應、Place ID 跨快照沿用、100 筆審查隊列，以及行程頁即時名稱／地址／營業時間／評分／照片／最多三則評論／路線顯示均已上線。Railway 正式 DB 實際為 1,121 筆候選、1,120 筆 matched、1 筆 not_found、0 筆 retry；Cron deployment `71aa7dff-06a5-4b63-a12b-78f753f88af6` 已改用 `npm run venues:refresh-all`。根後端 deployment `ab075dba-e37d-4ebf-bad4-ad93ba9250f7` 成功，Cloudflare Worker version `772bd542-38f9-478a-96b1-5b7698454cc4` 已部署；後端與前端首頁均回 200。此證據不等於 1,120 筆已人工核准。

- PR #11 已合併 `main`（`0452445`）：交通部觀光署每日景點／餐飲更新管線讀到全臺 9,818、臺北／新北 1,138，Railway PostgreSQL 已寫入 1,121 筆 draft、拒絕 17，migration 009 與相同內容冪等回用已在 production 驗證。獨立 `venue-refresh-daily` 每日 00:00 UTC 執行；公開 runtime 維持 200。active 推薦仍是 9 個 `synthetic_demo`，下一刀是人工核准首批真實場地、補 execution slots／交通資料並跑三案例 Runtime；不得把候選庫冒充已核准場地。操作見 `docs/VENUE_REFRESH.md`。
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
- Google 評論沒有接入，也不得拿來建立 Sideby 場地標籤、RAG、Embedding 或訓練資料。
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
