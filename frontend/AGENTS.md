# Sideby 前端協作規則

2026-09-06：Google 設定依根 `docs/GOOGLE_MAPS_LOCAL_SETUP.md`；已改用官方 API，不再使用 Lovable gateway。兩把金鑰分離，只有 Maps JavaScript 的來源受限金鑰可加 VITE_。Cloudflare production 已完成 Maps JavaScript、Places、Routes、Geocoding 四項真實呼叫與底圖目視；這仍不取代兩支實體手機與 Owner 驗收。

此目錄已匯入 `louis8791/sideby/frontend`，唯一共同開發來源是本 repo。原始來源為 `leeshim-gif/sideby` 的 `e094875f89139ad02b8b3d98483aebe131a12bbd`。本目錄沒有獨立 Git repository。

- 先讀根目錄 `AGENTS.md`、`docs/TEAM_INTEGRATION.md` 與 `docs/BACKEND_API.md`。
- 只從本 repo 的最新 main 開 feature 分支。前端成員改此目錄；根 package、API、DB 及產品規則由整合者協調。
- 本目錄用 Bun lockfile，根後端用 npm lockfile；不可互相覆蓋或將兩套依賴合併。
- `npm run frontend:dev` 從根目錄啟動；開發 `/api` 代理到根後端。正式部署必須另配置同源代理，Vite 的開發代理不會自動上線。
- 本地畫面狀態、Supabase 登入、固定房間碼與範例行程不能作為後端成員／定案權威；接入既有 Bearer／Session API 後才算功能整合。
- Google Maps production 已驗；Gemini 只完成免費層合成／非敏感展示 Runtime。真實私密 Gemini、成功帳號跨裝置恢復、兩支實體手機與 Owner 仍待驗，不把程式碼或單一綠燈升格成完整產品驗收。
- 原 Lovable 專案仍連著隊友 repo。本目錄不會自動與它同步；後續共同修改在此 repo 進行。不要直接套用下方原版的同步承諾。

## 原來源平台提示（僅適用原 Repo，保留來源資訊）

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
