# Sideby 共同開發入口

唯一主專案為 [louis8791/sideby](https://github.com/louis8791/sideby)，Windows 正式根為 `E:\sideby`。`main` 是唯一部署來源；舊 sprint／integration 分支與隊友 Repo 只能作歷史或候選，不得回蓋目前 `main`。

## 模組與主人

| 路徑 | 責任 |
|---|---|
| `frontend/` | TanStack Start／React UI、Cloudflare server functions、前端 API 串接 |
| `app/api/`、`src/server/`、`db/` | Next.js API、PostgreSQL、房間身分、權限、私密資料與定案 |
| `src/model/`、`src/recommendations/`、`src/venues/` | 需求解析、硬限制、CoupleScore、路線、場地資料與更新管線 |
| `schemas/`、`tests/`、`docs/` | 共同契約、回歸測試、部署與交接證據 |

根後端是房間、成員、私密資料與決策狀態的唯一權威。Supabase 只提供可選帳號能力，不取代根後端身分；Gemini 只解析明確同意的非敏感展示文字，硬限制與公開輸出仍由程式驗證；Google 除 Place ID 外的內容只即時取得，不寫入推薦資料庫。

## 工作流程

1. 先更新 `origin/main`，再建立 `feature/<工作名稱>` 或 `fix/<問題>`。
2. 每個 checkout 只有一位 writer；需要並行時用 `.local/worktrees/<名稱>`，不得建立新的 `E:\sideby-*` 頂層根目錄。
3. 跨模組欄位先更新 [BACKEND_API](BACKEND_API.md)，再各自在自己的模組修改。
4. 提交前執行 `npm run check:all`；PR 的 backend／frontend checks 全綠後才合併。
5. 合併後刪除功能分支與臨時 worktree。需要永久保存的歷史改用明示 archive ref，且不參與部署。

## 外部前端來源

隊友 `leeshim-gif/sideby` 的 `c9b4925` 是 2026-09-05 的匯入來源紀錄；需要再取用時只審查差異，不帶入其 `.env`、根 package、資料庫或 Git 歷史。Lovable 是否同步必須以它當下連接的 Repo／預設分支畫面確認，不能把「GitHub 有程式碼」當成平台已部署。

## 驗收邊界

- 自動入口：`npm run check:all` 與 GitHub `Sideby checks`。
- 正式入口：Cloudflare 前端及 Railway `/api/runtime`。
- 兩個瀏覽器已通過邀請加入、雙方非敏感偏好、Gemini 解析與三套正式場地路線。
- 兩支實體手機與 Owner sign-off 尚未執行，因此仍不可標成 Accepted MVP。
