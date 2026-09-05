# Sideby

Sideby 是雙人私密需求共決策的約會行程 MVP。唯一 source of truth 是 [louis8791/sideby](https://github.com/louis8791/sideby) 的 `main`；新協作者先讀 [最新交接](docs/NEXT_SESSION_HANDOFF.md)，不要從舊分支或舊 Run Note 接續。

## 正式環境

| 元件 | 入口 | 現況 |
|---|---|---|
| 前端 | [Cloudflare Worker](https://louis8791-sideby-frontend.louis8791.workers.dev/) | 已公開；TanStack Start／Nitro |
| 後端 | [Railway runtime](https://sideby-production.up.railway.app/api/runtime) | 已公開；Next.js API／PostgreSQL |
| 正式推薦資料 | Railway PostgreSQL | 1,121 筆正式比較候選；13 筆完整驗證、1,108 筆待確認 |
| 場地與路線索引 | Railway PostgreSQL | 2,058 個時段、107,616 條估計路段、1,121 筆推薦索引；1,120 筆已有 Google Place ID |

目前公開主流程已完成房間建立／加入、雙方條件、私密偏好、三套版本化路線、Google 即時地點與導航、重排及定案。30 個軟偏好均有映射，另有 4 個環境硬條件；待確認場地可能沒有可靠價格、營業或實際區域，正式畫面會保留警示。Gemini 免費層只處理使用者明確同意的合成／非敏感展示內容；未勾選時改用本機規則。最後仍需兩支實體手機與 Owner 驗收，技術綠燈不等於 Accepted MVP。現行宣稱與舊產品介紹的差異見 [產品介紹宣稱稽核](docs/PRODUCT_INTRO_CLAIM_AUDIT.md)。

## 專案結構

| 路徑 | 用途 |
|---|---|
| `frontend/` | Cloudflare 前端、Google／Gemini server functions、可選 Supabase 帳號 |
| `app/api/`、`src/server/` | Railway API、房間身分、私密資料、同步與定案 |
| `src/model/`、`src/recommendations/`、`src/venues/` | 需求解析、硬限制、CoupleScore、路線與場地守門 |
| `db/`、`schemas/` | PostgreSQL migrations 與資料契約 |
| `tests/`、`frontend/tests/` | 後端、隱私、推薦、Google 與前端回歸測試 |
| `docs/` | 部署、API、地點更新與交接文件 |
| `.local/`、`output/` | Git ignored 的本機工作資料與交付產物 |

根目錄與 `frontend/` 是兩個既有執行元件，各自保留 lockfile；不要把兩套框架、資料庫或環境變數合併成單一 package。

## 開發與驗證

需要 Node.js 22.13+、npm；前端安裝由專案固定的 Bun 版本處理。

```powershell
npm ci
npm run frontend:install
npm run check:all
```

本機啟動：

```powershell
# 後端；標準模式不載入 synthetic seed
npm run dev:local

# 明示 synthetic_demo 的本機展示
npm run demo:local

# 前端，預設 http://127.0.0.1:5173
npm run frontend:dev
```

正式設定只放 Railway／Cloudflare secrets 或本機 ignored env；不得提交 API key、資料庫密碼或真實私密內容。

## Git 與協作

1. 從最新 `origin/main` 建立短生命週期 feature branch。
2. 每個 checkout 同時只有一位 writer；臨時 worktree 只放 `.local/worktrees/`。
3. PR 的 backend／frontend checks 全綠後才能合併；合併後刪除功能分支與 worktree。
4. 長期只保留 `main` 及明示 archive ref；archive 不參與部署。

分工與跨前後端契約見 [TEAM_INTEGRATION](docs/TEAM_INTEGRATION.md) 與 [BACKEND_API](docs/BACKEND_API.md)。權威文件為 [AGENTS](AGENTS.md)、[PRD](PRD.md)、[TDD](TDD.md)、[ROADMAP](ROADMAP.md)。
