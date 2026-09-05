# Sideby 部署與交付

## 2026-09-06 已部署環境（最新）

- GitHub：`louis8791/sideby` `main`；全候選功能由 PR #27 合併，後續文件基線為 `635e3a9`。
- Railway：專案 `chic-bravery`；根 Next.js 服務連 Railway PostgreSQL，後端為 `https://sideby-production.up.railway.app`。Production active release `sideby-release-pool-20260906-a8f936dc01` 有 1,121 records、2,058 slots（1,108 provisional）、107,616 estimated legs；active recommendation index 1,121 筆。
- Cloudflare：Worker `louis8791-sideby-frontend`，正式前端為 `https://louis8791-sideby-frontend.louis8791.workers.dev`；全候選 UI 版本 `c0aace76-df4f-4914-b373-db9e956564a3` 已保留既有 origins、Supabase browser 公開設定與 encrypted secrets。
- 公開驗證：Cloudflare 首頁、同源 `/api/runtime` 與 Railway `/api/runtime` 均回 200。兩個匿名身分已完成同房、共享條件、雙私密輸入、雙確認並取得三套三站；全部使用上述 release，共 7／9 站標為待確認。
- Google production：Maps JavaScript、Places (New)、Routes、Geocoding 四項均已由正式 Worker 通過真實呼叫與底圖目視。Google 名稱、地址、營業、評分、照片、評論與路線只即時顯示；永久保存僅 Place ID。
- Gemini production：免費層只驗證合成／非敏感展示，未勾選則使用本機規則；不得處理真實私密資料或宣稱另外兩個 Gemini 接點完成。
- `www.sideby.dev`／`sideby.dev` 於 2026-09-06 尚無可用 DNS／HTTPS，正式入口仍是 Workers 網址。

以上證明公開 MVP Runtime 與目前資料 release，不取代兩支實體手機、成功帳號跨裝置恢復、跨網路完整流程或 Owner sign-off。

下方保留重建步驟；不能因已有部署而省略秘密、資料與驗收邊界。

## 乾淨下載與本機

從主 Repo 指定 commit clone，執行 npm ci、npm run frontend:install、npm run check:all。根 package-lock.json 與前端 bun.lock 各自固定依賴。

根後端用 npm run dev:local；合成展示用 npm run demo:local，皆只綁 127.0.0.1。前端用 npm run frontend:dev，開發 /api 代理到後端 3000。

## 環境與資料

| 元件 | 設定／資料 | 注意 |
|---|---|---|
| Next.js 後端 | DATABASE_URL、db/*.sql | 正式 DB 執行 npm run db:migrate；不會自動產生真實推薦場地。 |
| 原前端 Supabase | URL、publishable key，需要時 service role | 見 frontend/.env.example；不等於根後端匿名身分。 |
| Gemini | GEMINI_API_KEY，僅伺服器 | 原程式直接呼叫 Gemini；缺值不可用。需驗額度、同意、輸出及失敗狀態。 |
| Google Maps | VITE_GOOGLE_MAPS_API_KEY、不同的 GOOGLE_MAPS_SERVER_API_KEY、SIDEBY_PUBLIC_ORIGIN | 本機限 loopback 同 Origin；production 限設定的同來源 HTTPS。仍須限制 browser key 網站來源、server key API、配額與預算。 |
| 單一公開網址 | SIDEBY_API_ORIGIN | 前端 Worker 把同來源 `/api/*` 轉送到此 HTTPS 根後端；缺值或非安全網址回 503。 |
| 原前端資料 | frontend/drizzle/、supabase/、登入回呼、RLS | 不自動遷移到根 DB；資料、Storage 與雲端設定不隨 Git clone 出現。 |

從範本複製設定後在本機或平台填入，實際 .env 不進 Git。瀏覽器值可被使用者看見；service role、Gemini、Google 伺服器金鑰不得加 VITE_ 前綴。本輪 Google 本機使用 frontend/.env.local，詳見 [Google 設定](GOOGLE_MAPS_LOCAL_SETUP.md)。

## 正式入口

### 已驗證的 Worker 指令

根目錄執行 `npm run frontend:install`、`npm run check:all`，再進入 `frontend/`：

```powershell
npm run preview -- --port 5310 --env-file E:/sideby/frontend/.env.example --var SIDEBY_API_ORIGIN:http://127.0.0.1:5312
npm run deploy -- --dry-run --env-file E:/sideby/frontend/.env.example
```

第一行僅用於搭配 5312 的本機 demo 後端；第二行只檢查產物，不上傳。正式部署使用 `npm run deploy`，執行前完成 Owner OAuth、確認目標帳號與平台 vars／secrets；不得把範本的 localhost 後端拿去上線。`--env-file` 使用絕對路徑，因相對路徑會以 generated config 所在目錄解析。不要將真實 secret 放進命令或日誌。

Wrangler 固定 4.129.0；preview 直接跑 `.output/server/wrangler.json`，取代找不到 `dist/server/server.js` 的 Vite preview。deploy 使用同一份產物並加 `--keep-vars` 保留 Dashboard vars（[官方指令](https://developers.cloudflare.com/workers/wrangler/commands/workers/)）。Nitro 的 console 提示仍可能寫 `vite preview`，以本 Repo scripts 為準。

2026-09-05 本機 workerd 已驗：10 輪拒絕跨來源 POST 後仍能正常 POST、API／Bearer／SSE、首頁及 10 個建置資源。原本早退未讀 body 會使後續請求 500／程序中斷；已改為串流 drain 至 EOF，保留 403／503，不轉送拒絕內容。cancel-only 無效；no_bundle 路徑未套用 Wrangler 的 bundled drain middleware。相關第一手證據：[workerd #918](https://github.com/cloudflare/workerd/issues/918)、[官方 middleware](https://github.com/cloudflare/workers-sdk/blob/main/packages/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts)。本機驗收不能代替公開 Cloudflare 驗收。

### Railway 設定

從主 Repo 建立根目錄 Node 服務，另加 PostgreSQL，後端 `DATABASE_URL` 使用該資料庫的 reference。build 為 `npm run build`、start 為 `npm start`，健康路徑 `/api/runtime`。不得在 production 執行 demo launcher 或 seed synthetic 資料。

2026-09-05 官方 [Config as Code](https://docs.railway.com/config-as-code) 已公告舊 railway.json／railway.toml 不接受新服務加入；本輪使用 Dashboard 設定，不新增已淘汰設定檔或額外 IaC 架構。Owner 網頁已登入，但 GitHub 清單尚無 repo；須由 Owner 安裝／設定 Railway GitHub App，只選 `louis8791/sideby`。Cloudflare 網頁登入與本機 Wrangler OAuth 分開，不代表 CLI 可部署；兩者皆不得要求 Owner 貼憑證。

前端是 TanStack Start／Nitro；此次 build 實際產生 cloudflare-module 的 `.output/server` 與 `.output/public`，包含 Worker 入口。選定部署平台後按實際產物配置執行環境，不能只上傳靜態目錄，也不能把此 Worker 產物直接當作 Node server。根後端另以 Next.js 執行並連 PostgreSQL。

對外提供一個 HTTPS 入口：頁面及 TanStack server functions 交前端；`frontend/src/server.ts` 會在正式 Worker 將同來源 `/api/*` 轉送到 `SIDEBY_API_ORIGIN`，保留 Authorization／SSE，拒絕跨來源瀏覽器請求。Google server functions 另要求 `SIDEBY_PUBLIC_ORIGIN` 與公開網址完全一致。不可用 wildcard CORS 或網址 token 取代。

前端正式環境至少設定：`SIDEBY_API_ORIGIN=https://<後端網域>`、`SIDEBY_PUBLIC_ORIGIN=https://<公開前端網域>`、兩把 Google key；要啟用 Gemini 再加 `GEMINI_API_KEY`。根後端另設定 `DATABASE_URL`。平台執行 `npm start` 時會先冪等套用 migration，再以 `0.0.0.0` 與平台 `PORT` 啟動；不會自動 seed synthetic 資料。不要在 Origin 值尾端加路徑或 `/`，也不要提交任何真實 secret。

正式部署另設定登入允許的回呼、Google browser key 來源限制與流量額度，先在測試環境驗證，再記錄公開網址、兩個元件 commit、資料版本及維運負責人。

## 交付驗收

1. 固定 commit 乾淨下載能安裝、測試、建置。
2. 正式網址兩位獨立使用者同房、公開狀態一致、私密互不可見、推薦／定案及刷新保存成功。
3. 實際 Gemini／Google Maps 成功及失敗皆有證據，不能用固定行程代替。
4. 若需獨立接手，用接收者服務權限與新資料庫依文件重建；若仍依賴隊友原帳號，明記依賴與維運責任。

第 1 項通過不等於第 2～4 項通過；合成展示仍須標 synthetic_demo。

本機後端與前端 Vite 或 built Worker 啟動後，可執行 `npm run test:frontend-proxy`；改前端埠時傳完整本機網址，例如 `npm run test:frontend-proxy -- http://127.0.0.1:5310`。它只在 synthetic_demo 模式建立測試身分／房間，驗證同源 API、Bearer、SSE、連續跨來源拒絕、首頁與建置資源；不呼叫 Gemini／Google，不可對 production 跑這個測試。
