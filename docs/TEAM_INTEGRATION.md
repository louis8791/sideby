# Sideby 三人共同開發入口

2026-09-05 使用者指定唯一主專案為 [louis8791/sideby](https://github.com/louis8791/sideby)。Windows 正式根為 E:\sideby；各人有自己的 clone／feature 分支，所有功能回到同一個 GitHub main。

## 目錄與負責範圍

| 路徑 | 內容與負責人 |
|---|---|
| frontend/ | Lovable 匯出的 TanStack Start／React 網站及伺服器函式；前端負責人維護。 |
| app/api/、src/server/ | 既有 Next.js 應用 API、匿名房間、權限、私密資料、確認與定案；後端負責人維護。 |
| src/model/、src/recommendations/、src/venues/ | 解析基準、硬限制、雙人計分、行程與資料守門。 |
| db/ | 根後端的 PostgreSQL migrations；資料表修改與 API 一起審查。 |
| app/page.tsx、public/acceptance.html | 已接根 API 的整合／診斷入口；新前端通過相同流程前保留。 |
| frontend/drizzle/、frontend/supabase/ | 原前端帳號／歷史資料定義，不自動套到根後端 DB。 |
| docs/、schemas/、tests/ | 共同契約與驗收；跨前後端變更由整合者協調。 |
| .local/ | 本機資料、備份、工作樹與證據，Git ignored。 |

一個 Repo、兩個既有執行元件。保留原後端路徑以避免搬動 Next.js API 與測試；不引入微服務框架。前端使用 frontend/bun.lock，後端使用根 package-lock.json，各有依賴與建置產物。

## 最新產品決策

- 本輪採 Gemini 與 Google Maps 服務，不訓練模型、不排自管模型／Embedding／RAG。需求句用作人工核准後的回歸驗收，候選句不自動升格黃金答案。
- 此決策取代舊版「全專案禁止外部模型／Google API」及本輪必須訓練的規劃。舊後端零呼叫的測試結果只適用該基準，不能代表新增前端也零呼叫。
- 單一房間、權限與定案來源仍由根後端管理。Supabase 登入不能直接充當根後端的匿名 Bearer 成員身分。
- Gemini 處理自然語言；硬限制、權限及公開輸出仍由程式驗證。外部服務失敗應回不可用，不以範例或固定結果冒充成功。
- Google 即時展示資料與自有資料分開，不批次將評論、照片或衍生標籤存入共用訓練／RAG；啟用服務時另驗來源、保存與歸屬標示。
- 私密需求送外部模型前須告知並取得有效同意；原文、憑證及供應商錯誤全文不得進公開 API、SSE 或一般日誌。

## 每人工作方式

1. 接受主 Repo 的 Collaborator 邀請並 clone，從最新 origin/main 建立 feature/<工作名稱> 分支。
2. 前端成員改 frontend/；後端成員改 API／規則／DB；第三位改已約定的元件、docs/ 或測試案例。每個 checkout 只允許一個 writer。
3. Manus 收到後只納入指定畫面，不再覆蓋根 package、登入或資料庫。
4. PR 一律指向本 Repo 的 main；共同欄位先更新 [BACKEND_API](BACKEND_API.md)，整合者確認檢查後合併。
5. 舊 frontend-dev／backend-dev 若落後，先保存未提交工作並合併最新 main，不強制覆蓋舊分支。

## Lovable 同步邊界

匯入來源：leeshim-gif/sideby，commit e094875f89139ad02b8b3d98483aebe131a12bbd。原 Repo 保留；本 Repo 未匯入實際 .env、.lovable/project.json 或來源的 Git 歷史。

原 Lovable 仍連著隊友 Repo。本次不會把它自動改接 louis8791/sideby/frontend/，也沒有雙 Repo 自動同步。共同開發以主 Repo 的分支為準；若繼續使用原 Lovable，其變更只是外部候選，需審查差異後帶入，不得覆蓋主 Repo 的新修改。

若要求 Lovable 即時編輯同一份主 Repo，須另核對現有 Repo／子目錄支援。官方文件說明建立連線會建立新 Repo，跨帳號轉移既有 Repo 會中斷同步；不直接轉移或重連來假裝完成。[官方說明](https://docs.lovable.dev/integrations/github)，查核 2026-09-05。

## 本機與驗收

Google 地圖已取消 Lovable gateway 依賴；各人填自己的 `frontend/.env.local`，依 [Google 本機設定](GOOGLE_MAPS_LOCAL_SETUP.md) 開 `/maps-check`，不需要先配置 Supabase／Gemini。2026-09-05 本機 Maps、Places、Routes、Geocoding 已單次真實驗收通過；正式部署、首頁雙人流程與手機仍另驗。

根目錄先執行 npm ci、npm run frontend:install。後端終端用 npm run demo:local（3000，明示 synthetic_demo），正常無種子模式為 npm run dev:local；前端終端用 npm run frontend:dev（5173）。

設定欄位見 frontend/.env.example；空值代表未設定。開發 /api/* 代理到 127.0.0.1:3000，保留 Authorization、Host、Origin 與 SSE；後端仍檢查來源。改後端埠時以 SIDEBY_API_ORIGIN 對齊。不同電腦的 127.0.0.1 不相通。

npm run check:all 驗證後端及前端建置。正式部署另見 [DEPLOYMENT](DEPLOYMENT.md)，Vite 開發代理不會自動上線。

## 下一刀與證據界線

匯入前端仍含固定邀請碼、INITIAL_PLANS、畫面 state 與獨立 Supabase 流程。目錄合併及 /api 代理不會把按鈕自動接上根後端。下一刀依序接建房／加入、私密輸入、確認、生成／重排、定案。

## 截止前 16 小時分工

| 工作區／角色 | 唯一可寫範圍 | 截止前必交 |
|---|---|---|
| `feature/sprint-frontend`／前端 | `frontend/` | 移除固定邀請碼與 INITIAL_PLANS，接建房／加入、條件、私密輸入、確認、三套方案、reaction／重排／finalize；呈現 API／Google／Gemini 真實失敗。 |
| `feature/sprint-backend`／後端 | `app/api/`、`src/server/`、`src/model/`、`src/recommendations/`、`src/venues/`、`db/`、`schemas/` | 只補前端串接所需的契約、權限、Gemini 安全轉接與資料守門；不得重做 UI。 |
| `feature/sprint-integration`／整合驗收 | `docs/`、`tests/`、CI／部署設定 | 鎖定 API 契約、審 PR、合併、跑兩瀏覽器／手機與 fresh clone；不得與功能負責人同時改同一檔。 |

時間盒：前 1 小時固定基線；第 1～7 小時前後端並行；第 7～11 小時整合完整主流程；第 11～14 小時做雙瀏覽器／手機、隱私與失敗路徑；最後 2 小時只修阻斷、部署、演示與備援，不再加功能。

兩個獨立瀏覽器／手機需另驗同房、私密隔離、實際 Gemini／Google Maps、雙人定案與刷新保存。程式匯入不代表完整串接、正式部署或雲端帳號已移交。
