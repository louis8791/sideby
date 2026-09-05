# Sideby 部署與交付

此文件描述現有依賴與驗收步驟，不表示已有公開部署。

## 乾淨下載與本機

從主 Repo 指定 commit clone，執行 npm ci、npm run frontend:install、npm run check:all。根 package-lock.json 與前端 bun.lock 各自固定依賴。

根後端用 npm run dev:local；合成展示用 npm run demo:local，皆只綁 127.0.0.1。前端用 npm run frontend:dev，開發 /api 代理到後端 3000。

## 環境與資料

| 元件 | 設定／資料 | 注意 |
|---|---|---|
| Next.js 後端 | DATABASE_URL、db/*.sql | 正式 DB 執行 npm run db:migrate；不會自動產生真實推薦場地。 |
| 原前端 Supabase | URL、publishable key，需要時 service role | 見 frontend/.env.example；不等於根後端匿名身分。 |
| Gemini | GEMINI_API_KEY，僅伺服器 | 原程式直接呼叫 Gemini；缺值不可用。需驗額度、同意、輸出及失敗狀態。 |
| Google Maps | 限制用途的 browser key、原 gateway 的 LOVABLE_API_KEY／GOOGLE_MAPS_API_KEY | 原 gateway 憑證的外部部署可用性待驗，不能假定一般 Google key 可直接取代。 |
| 原前端資料 | frontend/drizzle/、supabase/、登入回呼、RLS | 不自動遷移到根 DB；資料、Storage 與雲端設定不隨 Git clone 出現。 |

從範本複製設定後在本機或平台填入，實際 .env 不進 Git。瀏覽器值可被使用者看見；service role、Gemini、gateway 憑證不得加 VITE_ 前綴。

## 正式入口

前端是 TanStack Start／Nitro；此次 build 實際產生 cloudflare-module 的 `.output/server` 與 `.output/public`，包含 Worker 入口。選定部署平台後按實際產物配置執行環境，不能只上傳靜態目錄，也不能把此 Worker 產物直接當作 Node server。根後端另以 Next.js 執行並連 PostgreSQL。

對外提供一個 HTTPS 入口：頁面及 TanStack server functions 交前端，/api/* 交根後端。反向代理保留合法 Host／Origin、Authorization、SSE；Vite 開發代理不會自動成為正式代理。不可用 wildcard CORS 或網址 token 取代。

正式部署另設定登入允許的回呼、Google browser key 來源限制與流量額度，先在測試環境驗證，再記錄公開網址、兩個元件 commit、資料版本及維運負責人。

## 交付驗收

1. 固定 commit 乾淨下載能安裝、測試、建置。
2. 正式網址兩位獨立使用者同房、公開狀態一致、私密互不可見、推薦／定案及刷新保存成功。
3. 實際 Gemini／Google Maps 成功及失敗皆有證據，不能用固定行程代替。
4. 若需獨立接手，用接收者服務權限與新資料庫依文件重建；若仍依賴隊友原帳號，明記依賴與維運責任。

第 1 項通過不等於第 2～4 項通過；合成展示仍須標 synthetic_demo。

本機兩個開發伺服器啟動後，可執行 `npm run test:frontend-proxy`；改前端埠時傳完整本機網址，例如 `npm run test:frontend-proxy -- http://127.0.0.1:5310`。它只在 synthetic_demo 模式建立測試身分／房間，驗證同源 API、Bearer、SSE 及跨來源拒絕；不呼叫 Gemini／Google。
