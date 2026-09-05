# Sideby 黑客松三人整合入口

2026-09-05 現場檢查。唯一正式根目錄為 `E:\sideby`。本文件管理協作與接線；產品需求仍以 AGENTS、PRD、TDD、ROADMAP 為準，API 欄位以 [BACKEND_API.md](BACKEND_API.md) 為準。

## 已查到的衝突

- `E:\sideby` 是 Next.js＋PostgreSQL 後端及現有整合頁。遠端 `louis8791/sideby` 的 main 為 `8cb9df6`，本機 HEAD 為 `cef9bc7`，另有 Phase 5～7 未提交工作。現在直接下載遠端不能取得本機最新功能。
- 多個舊工作任務從 `C:\Users\user\OneDrive\문서\ChatGPT\黑克松` 進入，但實際共同修改 `E:\sideby`。不同任務名稱不等於檔案隔離。
- `.local/worktrees/phase3-itineraries-20260905` 仍以 `8cb9df6` 為基底，而且有自己的未提交推薦功能。它是舊候選工作，不能直接整包覆蓋主目錄的新 Phase 5～7。
- 朋友的 [leeshim-gif/sideby](https://github.com/leeshim-gif/sideby) 受檢版本為 `e094875f89139ad02b8b3d98483aebe131a12bbd`，使用 TanStack Start／Vite、React、Supabase 登入與另一套資料結構。首頁有固定邀請碼 `842716` 及 `INITIAL_PLANS`，尚不能用來證明雙人房間或三套後端生成已接通。
- 朋友版本的 `preference-ai.server.ts` 會呼叫 Gemini，`maps.functions.ts` 會呼叫 Lovable Google Places／Routes gateway。現行產品契約禁止外部模型呼叫與 Google API 建庫，自管模型與 RAG 也已延後；引入畫面不等於批准這些服務或資料流。
- Manus 前端尚未收到完整路徑／原始碼，因此不判定其框架、可用性或可合併範圍。

## 目錄與唯一主人

| 位置 | 用途與負責人 |
|---|---|
| `E:\sideby\app`、`src`、`db` | 目前整合版。由使用者與指定整合者單線寫入；資料庫、身分、權限、生成、定案都歸後端。 |
| `E:\sideby\.local\frontends\lovable` | 已隔離下載的朋友原版，保留自己的 Git 歷史與套件。畫面負責人持續在自己的 repo 分支修改。 |
| `E:\sideby\.local\frontends\manus` | Manus 收件位置，收到後才建立。先挑指定畫面／元件，不整包搬入根目錄。 |
| `E:\sideby\.local\worktrees` | 後端獨立分支工作區。每個工作區只有一個寫入者、自己的依賴與資料庫；建立前先確認基底包含所需功能。 |
| `E:\sideby\.local\phase1` | 需求候選資料與本機驗收證據，Git ignored。 |
| `E:\sideby\.local\snapshots\before-team-integration-20260905` | 修正前 43 份已修改／未追蹤檔案的逐檔雜湊核對備份。原工作樹仍保留。 |

整合時保留三個來源各自的 package／lockfile／Git。不可覆蓋根目錄的 `package.json`、lockfile、`app/api`、`src/server`、`db`、`.env` 或四份權威文件。Manus、Lovable 匯出都視為候選來源，不會自動成為正式入口。

`main` 是穩定整合分支。各人用自己的 feature 分支，交付確切 commit 和改動路徑；同一個實體 checkout 同時只讓一位 Agent／成員寫入。根目錄現有未提交工作先由整合者核對與提交，再讓其他後端工作區從該版本開始。前端 repo 的 main 可能持續與 Lovable 同步，不重寫已發布歷史。

## 現場工作順序

以下時間是執行節奏建議，依剩餘比賽時間縮短；不是完工承諾。

| 順序 | 你／後端與整合 | 朋友／Lovable | 第三位／Manus、資料與展示 |
|---|---|---|---|
| 第一輪，約 10 分鐘 | 固定 API／資料來源與本機可跑版本，保存未提交工作 | 指定要交付的前端 commit，暫停改身分和後端規則 | 交付原始碼路徑，列出想保留的畫面 |
| 第二輪，先接一條主線 | 提供建房、加入、Session、私密輸入、生成、定案 API | 先接建房／加入和兩個獨立瀏覽器；移除以固定碼代表真房間的流程 | 只做一個已指定畫面或準備展示資料／腳本，避免同時重做首頁 |
| 第三輪，功能閉環 | 修接口問題、版本衝突、本人資料隔離 | 共同條件→私密輸入→兩人確認→三套行程→選同方案 | 用第二支裝置操作並記錄失敗步驟，檢查字句和展示故事 |
| 上台前至少留 20～30 分鐘 | 凍結受驗 commit、固定啟動方式；只修阻擋 bug | 停止新增功能，跑一次完整展示 | 重演斷線／重新加入、不同方案衝突及 Maps 跳轉，準備錄影備援 |

若 Lovable 接線無法及時完成，使用目前已接真 API 的 Next.js 頁展示主流程。Manus 的視覺只在有時間完成相同流程驗證時加入。模型／RAG、正式帳號遷移、新資料庫及全新功能不插入這輪整合。

## 前後端接線

正式決策資料只進本專案 `/api/*`：匿名 Bearer token → couple／session → shared／private input → confirm → generate → reactions／replan → finalize。Supabase token、朋友的 profile 及本機畫面 state 不能直接當作本後端的成員身分或核准結果。

Lovable 若保留獨立 Vite 開發伺服器，前端負責人將 `/api` 同源代理到本機後端，保留 `Authorization` 和串流；代理 `Host`、`Origin` 必須一致。不要以 wildcard CORS 或 URL token 解決連線問題。正式部署亦須同源入口。各自機器的 `127.0.0.1` 指各自機器，不會連到隊友電腦；跨機器測試需要另行設定可達且受控的入口，目前本機 launcher 只綁 loopback。

主 API 與整合頁預設 3000；朋友的 Vite 頁可使用 5173，Manus 候選頁可使用 5174。每個工作區都用自己的 `.local`、`node_modules`、build 目錄；不同埠不表示可以共用同一個 Next checkout 或 PostgreSQL 資料目錄。

## 已提供的操作檢查

在 `E:\sideby` 執行：

```powershell
npm run workspace:check
npm run demo:local -- --port 3000
```

資料模式會明示 `synthetic_demo`。改埠使用 `--port` 或 `SIDEBY_PORT`；埠被占用時會停止並指出，不再悄悄換到別的網址。從其他目錄直接呼叫 launcher 會先拒絕，避免把資料庫或依賴建立在錯專案。

`npm test` 包含編譯、既有功能測試與工作目錄／埠衝突檢查。前端候選與 worktree 已排除於主專案 TypeScript 範圍，Next build root 固定於本 repo。這些檢查只證明工作區與啟動邊界；正式前端接線、實體雙手機和 Owner 展示仍須實測。

本次驗證：42 項自動測試、TypeScript 及 workspace check 通過；`demo:local -- --port 3100` 實際啟動，首頁／runtime 為 200，帶同源 Origin 的匿名建立為 201。Lovable 僅做靜態來源檢查，尚未接入或執行其雲端服務。需求 v2 的修正與候選驗證見 [ADVANCED_REQUIREMENTS.md](ADVANCED_REQUIREMENTS.md)。
