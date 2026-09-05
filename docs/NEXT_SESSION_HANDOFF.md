# Sideby 跨對話交接（2026-09-05）

## 最新部署接續（優先於下方歷史基線）

- PR #6 已合併 `main`，merge commit `21b28f333f7cc0f70921ce3a60320183995b2817`：九個既有前端站點、十一個環境 slot、二十四條展示 travel matrix 已由 Railway `prestart` 冪等寫入 PostgreSQL；正式 API 實測生成三套、每套三站，partner 可讀回三套保存結果，共含九個 Google Place ID。展示價格、時長、屬性仍明示 `synthetic_demo`，不保存 Google 地址、照片、評分、評論或路線回應。
- Google Maps JavaScript 正式底圖已因 Worker referrer 補齊而通過；Places API (New)／Routes API／Geocoding 的 production server 呼叫仍失敗，且相同 server key 在本機可解析九個 Place ID。下一個外部動作是由 key 擁有者核對 server key 的應用程式限制、API 限制、帳務與配額。
- Owner 決定本次不主打 Gemini；它已從提交阻斷移為後續加值，不得用未驗收的 Gemini 能力包裝主流程。
- PR #4 已合併 `main`，merge commit `16cfd041899356432caa1c4cc914fa94b7541902`；feature commit `db618d0` 已保存在遠端。產品介紹 `output/` 仍未追蹤，其他 worktree／archive 未動。
- Railway 專案 `chic-bravery` 已建立 PostgreSQL 與根 Next.js 服務。GitHub source 是 `louis8791/sideby`／`main`，自動部署已開啟，`DATABASE_URL` 使用 Postgres reference，migration 成功，健康路徑 `/api/runtime`，公開 target port 已由錯誤的 3000 修正為平台實際 `PORT=8080`。
- 後端 `https://sideby-production.up.railway.app`：`/api/runtime` 200／`standard`；直接匿名身分建立 201。
- Cloudflare Worker `https://louis8791-sideby-frontend.louis8791.workers.dev` 已部署；`SIDEBY_API_ORIGIN`／`SIDEBY_PUBLIC_ORIGIN` 已設，Google server key 以 secret 上傳，browser key 由 Vite build 使用。首頁、`/maps-check` 與同源 `/api/runtime` 均 200，經代理匿名建立 201。
- 最新 `npm run check:all` 通過 47 根＋15 Maps／proxy 測試，GitHub PR checks 全綠；未輸出、記錄或提交任何 secret。
- Google production 部分通過：Maps JavaScript 正式底圖成功，Places／Routes／Geocoding 仍失敗。下一步由 key 擁有者核對三項 server API 限制、帳務與配額後重跑 `/maps-check`。
- Railway deployment `9b251684-dcb4-422c-bd6f-739c477263d5` 已成功，PostgreSQL showcase 生成／保存 Runtime 通過；Cloudflare Worker version `22f78714-bb8c-4790-8832-5685d9f83b0a` 已部署。兩支手機、跨網路效能與 Owner sign-off 仍未驗；不要重建既有服務。

## 本輪功能內容（已由 PR #4 推送合併）

- Scope：project-specific；Evidence：verified code／automated tests／public research。工作分支 `feat/environment-preferences-and-evidence` 的 `db618d0` 已由 PR #4 合併到 `main` `16cfd04`；下方舊基線僅保留追溯用途。
- 新增室內／戶外（含戶外區）、冷氣／無冷氣的 UI、結構化 API、區域硬限制及鎖 slot 重排。30 舊選項中 11 有近似映射、19 待補；加環境共 34。詳見 PRD、`docs/KEYWORDS_AND_GROWTH.md`。
- 重新執行 check:all 通過（47 根測試、15 Maps／代理測試、前端 typecheck／client／SSR／Cloudflare build）；有真正 PostgreSQL＋HTTP＋SSE 行為測試，且已另完成公開基礎 Runtime 驗證。
- 需求研究完成 6 組第一手來源、12 指標的 Markdown＋JSON；並非 Sideby 大數據、採用／留存驗證或訓練資料。四份權威已更新。
- 本輪瀏覽器用另開的 5311 dev 入口驗到新四選項與單選互斥，390／1280 寬度可讀；測後關閉該測試程序。原 `vite preview` 路徑問題後續已改用 Nitro／Wrangler 正式產物修復並公開部署。正式 Google referrer 仍未由實際 key 擁有者補齊。
- Railway＋PostgreSQL／Cloudflare 已部署；未更動其他 worktree／archive。下一步只處理 Google key 擁有者設定、外部服務與 Owner gates。

這是下一個對話的唯一接續入口。若本文件與舊 Run Note 不同，以 `AGENTS.md`、`PRD.md`、`TDD.md`、`ROADMAP.md` 與目前 Git／Runtime 為準。

## 1. 立即接手位置

- 唯一主 Repo：`https://github.com/louis8791/sideby`
- 本機正式根：`E:\sideby`
- 主分支：`main`
- 已驗證程式基線 commit：`6abd18fc959ba2f16738f953dc15b4d3b5d9735f`；本交接文件所在的最新 `main` commit 以 GitHub／`origin/main` 為準。
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

- Lovable 主畫面已接根後端：匿名建立／加入房間、共享條件、本人私密需求、雙方確認、三套 synthetic 行程、reaction、局部重排、finalize、本人 `too_dark` 回饋。
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
- `/maps-check`：Maps JavaScript、Places (New)、Routes、Geocoding 曾在這台電腦完成單次真實 PASS；這不是正式網域或手機證據。
- GitHub Actions：commit `6abd18f` 的 Sideby checks 成功。

## 3. 本機設定狀態

`E:\sideby\frontend\.env.local` 存在且被 Git ignore；已填兩把 Google key。Cloudflare 已設定兩個 production origin 與 Google server secret；本機檔下列仍未填：

- `GEMINI_API_KEY`
- Supabase 設定

不要讀出、回傳、記錄或提交任何 key 值。交接前已確認 Git 追蹤檔沒有 API key。

## 4. 尚未完成，禁止宣稱 PASS

- Google browser key 的正式 referrer 已完成，Maps JavaScript production 底圖通過；server key 的應用程式／API restriction 尚未由實際 key 擁有者完成，production Places／Routes／Geocoding 仍失敗。
- Gemini「評論候選標籤＋本人確認」與「合法推薦後安全理由改寫」仍是後續規劃，不是本次提交主線或阻斷。
- Google 評論沒有接入，也不得拿來建立 Sideby 場地標籤、RAG、Embedding 或訓練資料。
- 真實核准場地、兩支實體手機、跨網路效能與 Owner sign-off 未完成；正式網域本身已建立並通過基本 API。
- 持續學習只有本人 `too_dark` 偏好事件已實作；`training_candidates` 與版本化場地索引重建仍未完成／延後。

## 5. 下一個對話的施工順序

1. 不重建 Railway、PostgreSQL、Cloudflare Worker 或既有 production origins；先將 showcase 分支合併並核對 Railway seed、公開 API 與前端版本。
2. 由實際 Google key 擁有者在正確專案核對 server key 的應用程式限制；server key 只允許 Places API (New)、Routes API、Geocoding API，並設定配額／預算告警。
3. 從正式 `/maps-check` 重跑四項；Maps JavaScript 已通過，三項 server API 成功後才改 production Google 為全數通過。
4. 用公開網址、兩支手機完成：建立／加入、共享同步、雙方私密互不可見、兩人確認、三套方案、重排、雙方定案、刷新保存，以及 Google 成功／失敗 fallback。
5. 只有上述證據成立後才更新 Phase／Owner 狀態；否則維持 `NOT_READY`／部分完成。

## 6. 收尾規則

- 每輪實作後執行 `npm run check:all`；兩個本機服務存在時再跑 `npm run test:frontend-proxy`。
- 「CP 寫寫」＝同步 Obsidian 的 AGENTS／PRD／TDD／ROADMAP、Project State、Run Note、Change Log，再 commit＋push 並核對遠端。
- 不碰主 Vault 的其他專案 dirty state；Obsidian 遠端使用 `E:\sideby\.local\obsidian-sideby-sync-20260905` 隔離同步。
- 不刪除任何 worktree、archive branch、`.local` 資料或隊友成果，除非 Owner 另行明確指定。
