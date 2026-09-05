# 單一 Repo 整合驗證

2026-09-05；目標 Repo：louis8791/sideby。此記錄只驗收本輪來源整合與開發連線。

## 來源

- 根後端 HEAD cef9bc7492bed82e2c7c7a67d869fb798f930a5a，加上當時 82 份來源檔的本機快照 7f3d2454925f1abbce952587d2316301cfc497f7。快照前後內容雜湊及原工作樹狀態一致，未遺漏原本未提交工作。
- 前端來源 leeshim-gif/sideby，e094875f89139ad02b8b3d98483aebe131a12bbd；98 份原始檔納入 frontend/，實際 .env 與 .lovable/project.json 排除，不引入來源 Git 歷史。
- 後續調整限套件指令、編譯／依賴邊界、開發 API 代理、設定範本、檢查與協作文件；原畫面及雲端業務邏輯未冒充已串接根後端。

## 本機已驗證

| 檢查 | 結果 |
|---|---|
| 根 npm ci | PASS；獨立工作樹安裝，未借用原 checkout 的 node_modules |
| 前端 Bun 1.4.2 frozen lockfile 安裝 | PASS；既有 bun.lock 未更動 |
| 根 npm test | PASS；42 passed、0 failed，包含真 PostgreSQL／正式 Next.js HTTP 測試 |
| frontend:typecheck | PASS |
| frontend:build | PASS；產生 client＋SSR＋cloudflare-module Worker |
| workspace:check | PASS；根編譯排除 frontend 與 .local |
| 前端 5310／後端 3310 本機 | 前端文件及代理 runtime 200；明示 synthetic_demo |
| test:frontend-proxy | PASS；同源匿名建立、Bearer 房間／Session、SSE 初始事件成功；非同源寫入 403 |

前端有既有的 inputValidator 棄用、tsconfig-paths 外掛及 bundle 大小警告，build 未失敗；這些沒有當作整合阻斷。未設定真實服務憑證，沒有為本輪代理驗證呼叫 Gemini、Google 或正式 Supabase。

## 不在上述 PASS 內

- Lovable 的既有專案沒有改接至本 Repo；共同開發以本 Repo 分支為準。
- 前端固定邀請碼／INITIAL_PLANS 與獨立 Supabase 身分尚待改接根應用 API。
- 真實 Gemini／Google Maps、Supabase 權限／登入、前端完整畫面與雙裝置流程未驗收。
- 正式 HTTPS 部署、新資料庫獨立重建、負載與 Owner 驗收未完成。
- 缺少真實資料／實機證據的既有 Phase 閘門不能因此改為 PASS。

重跑方式及所需設定見 TEAM_INTEGRATION.md、DEPLOYMENT.md。GitHub 自動檢查結果以對應 commit 的 Actions 為準；本機 PASS 不冒充遠端 PASS。
