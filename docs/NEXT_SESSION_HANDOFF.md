# Sideby 跨對話交接（2026-09-05）

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

只有工作樹乾淨、`HEAD` 等於 `origin/main`，且該 commit 包含本文件，才可繼續。

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

`E:\sideby\frontend\.env.local` 存在且被 Git ignore；已填兩把 Google key。下列仍未填：

- `GEMINI_API_KEY`
- Supabase 設定
- `SIDEBY_API_ORIGIN`
- `SIDEBY_PUBLIC_ORIGIN`

不要讀出、回傳、記錄或提交任何 key 值。交接前已確認 Git 追蹤檔沒有 API key。

## 4. 尚未完成，禁止宣稱 PASS

- 尚無公開網址；Railway 專案、PostgreSQL 與 Cloudflare Worker 都還沒建立／部署。
- Railway 與 Cloudflare 目前都停在登入頁；需要使用者自行登入，不得索取帳密。
- 真實 Gemini 尚未用有效金鑰驗收。
- Gemini「評論候選標籤＋本人確認」與「合法推薦後安全理由改寫」仍是 `PLANNED`。
- Google 評論沒有接入，也不得拿來建立 Sideby 場地標籤、RAG、Embedding 或訓練資料。
- 真實核准場地、兩支實體手機、正式網域、跨網路效能與 Owner sign-off 未完成。
- 持續學習只有本人 `too_dark` 偏好事件已實作；`training_candidates` 與版本化場地索引重建仍未完成／延後。

## 5. 下一個對話的施工順序

1. 先確認使用者已在 Railway 與 Cloudflare 登入；不得要求貼密碼或 secret。
2. Railway 從 `louis8791/sideby` 的 `main` 建立根目錄 Node 服務，再加入 PostgreSQL；確認 `DATABASE_URL` 存在，啟動命令為 `npm start`，健康檢查使用 `/api/runtime`。
3. 取得 Railway HTTPS 網域後，先驗 `/api/runtime` 與一個匿名建房請求；不得在 production seed synthetic 資料。
4. 從 `frontend/` 建置並部署 Cloudflare Worker。第一次可先取得公開網址；之後設定：
   - `SIDEBY_API_ORIGIN=https://<Railway 後端網域>`
   - `SIDEBY_PUBLIC_ORIGIN=https://<Cloudflare 公開前端網域>`
   - `VITE_GOOGLE_MAPS_API_KEY`（browser build setting）
   - `GOOGLE_MAPS_SERVER_API_KEY`（server secret）
   - 要驗 Gemini 時才設定 `GEMINI_API_KEY`（server secret）
5. Google browser key 加入正式前端 HTTP referrer；server key 只允許 Places API (New)、Routes API、Geocoding API，並設定配額／預算告警。
6. 用公開網址、兩支手機完成：建立／加入、共享同步、雙方私密互不可見、兩人確認、三套方案、重排、雙方定案、刷新保存、Google 成功／失敗與未授權 Gemini fallback。
7. 只有上述證據成立後才更新 Phase／Owner 狀態；否則維持 `NOT_READY`／部分完成。

## 6. 收尾規則

- 每輪實作後執行 `npm run check:all`；兩個本機服務存在時再跑 `npm run test:frontend-proxy`。
- 「CP 寫寫」＝同步 Obsidian 的 AGENTS／PRD／TDD／ROADMAP、Project State、Run Note、Change Log，再 commit＋push 並核對遠端。
- 不碰主 Vault 的其他專案 dirty state；Obsidian 遠端使用 `E:\sideby\.local\obsidian-sideby-sync-20260905` 隔離同步。
- 不刪除任何 worktree、archive branch、`.local` 資料或隊友成果，除非 Owner 另行明確指定。
