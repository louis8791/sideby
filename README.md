# Sideby

雙人私密需求共決策的約會行程 MVP。唯一共同開發 Repo：[louis8791/sideby](https://github.com/louis8791/sideby)。

## 三人從這裡開始

1. clone 本 Repo，從最新 main 開自己的 feature 分支。
2. 前端改 frontend/；後端改 app/api/、src/、db/；共同欄位先對齊 [API 契約](docs/BACKEND_API.md)。
3. PR 都回到本 Repo 的 main，整合後其餘人更新基底。每個 checkout 只有一位 writer。

完整分工與來源見 [TEAM_INTEGRATION](docs/TEAM_INTEGRATION.md)。原 Lovable 仍連著隊友 Repo，不會自動同步到此處的 frontend 子目錄。

## 專案結構

| 路徑 | 用途 |
|---|---|
| frontend/ | Lovable 的 React／TanStack Start 前端與伺服器函式 |
| app/api/、src/ | Next.js API、房間、私密資料、推薦、重排與定案 |
| db/ | 根後端 PostgreSQL migrations |
| app/page.tsx | 已接根 API 的合成整合展示入口 |
| docs/、tests/ | 共同規格、部署、驗收與後端測試 |
| .env.example、frontend/.env.example | 兩個執行元件各自的設定範本 |

一個 Repo 保留兩個現有執行元件與各自 lockfile，避免框架與依賴互相覆蓋。

## 安裝及執行

需要 Node.js 22.13+、npm。前端安裝使用固定 Bun 1.4.2 與既有 bun.lock，不需全域安裝 Bun。

```powershell
npm ci
npm run frontend:install
```

兩個終端都從 Repo 根目錄操作：

```powershell
# 終端 1：後端及明示的合成展示，http://127.0.0.1:3000
npm run demo:local

# 終端 2：Lovable 來源前端，http://127.0.0.1:5173
npm run frontend:dev
```

後端建立專案內獨立 PostgreSQL；無合成種子模式用 npm run dev:local。前端雲端功能須自行設定 frontend/.env；未配置時登入、Gemini、地圖可能不可用，見 [部署說明](docs/DEPLOYMENT.md)。

前端開發 /api/* 已代理到根後端；頁面按鈕仍須逐項接真實 API，不能把代理通過視為功能全通。

## 驗證

```powershell
npm run check:all
```

執行後端 build／HTTP 與資料測試，以及前端型別檢查與 build；GitHub PR 有兩個獨立檢查工作。舊 Phase 閘門保留，缺真實資料／實機證據時仍應回 NOT_READY。

## 能力與未完成項

- 既有後端包含匿名雙人房間、公開同步、本人私密輸入、同意設定、有限規則解析、合成三套行程、反應／鎖定／重排／定案與本人偏好更新。
- 新前端原始碼含 Supabase、Gemini 與 Google Maps 接法。本輪採 API 型 MVP，不排模型訓練／自管模型／RAG；需求句作核准後的回歸驗收。
- 前端固定房間碼／行程、Supabase 身分與根後端狀態尚待接合；兩支手機、真實雲端服務、公開部署及 Owner 驗收仍未完成。
- 私密原文不得進對方 API、SSE、公開理由、共用歷史或一般日誌。雲端解析須告知與同意；Google 展示資料不自動進自有訓練／RAG。

權威文件：[AGENTS](AGENTS.md)、[PRD](PRD.md)、[TDD](TDD.md)、[ROADMAP](ROADMAP.md)。舊模型／RAG 章節保留為歷史與未來參考，最新決策以各文件開頭及 TEAM_INTEGRATION 為準。
