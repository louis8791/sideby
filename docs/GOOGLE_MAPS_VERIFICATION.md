# Google 本機接線驗證紀錄

日期：2026-09-05；基底 `bf16045`；狀態 **INPUT_REQUIRED / NOT_LIVE_VERIFIED**。

- Windows Node 24.16.0，前端 Bun 1.4.2 frozen-lockfile 乾淨安裝通過，沒有新增依賴。
- `npm run test:maps`：10 個離線子案例＋1 個總測試，11 passed、0 failed。所有 HTTP 由 mock 攔截，真實 Google 呼叫為 0；驗缺 key、同來源本機限制、三項 web service 官方 URL／header、無全域快取、精度／查無資料、錯誤去敏、照片歸屬與 browser/server key 分離。
- 前端 typecheck、client＋SSR＋cloudflare-module build 通過；既有套件的 deprecation／chunk size 警告不當成失敗，也不隱藏。
- Chrome 在 `http://127.0.0.1:5173/maps-check` 實際載入：瀏覽器及伺服器金鑰均顯示待填，檢查按鈕停用，沒有 Supabase／Gemini 配置也能取得伺服器設定狀態。
- 第一次 runtime 曾被全域 Supabase token 附加器阻擋；改為只在瀏覽器 Supabase 配置存在時附加。伺服器 `requireSupabaseAuth`、根 API 的權限與 DB 未更動。修正後重載 Chrome 確認待填狀態。
- `npm run maps:config` 回 `INPUT_REQUIRED`、exit 1、兩 key false、externalCalls 0；這是正確的待輸入狀態，不是 API 驗收失敗或成功。
- 主工作目錄 `frontend/.env.local` 為空欄位並受 Git 忽略；不複製隊友的憑證。額度／帳務／Cloud API enable、有效金鑰、真實底圖／查詢／路由／Geocoding 均 **未驗收**。
- 檢查頁只驗 Google 接線，不能代替首頁完整操作、Supabase 登入、Gemini、雙人房間／推薦、兩支手機、正式部署或 Owner 驗收。Geocoding 只是獨立地址定位，未自動取代推薦資料。
- 另有工作修改主工作樹 ROADMAP；本輪以獨立工作樹提交，只增加 Google 接線註記，不回蓋那份未提交的 Roadmap 重整。

後續按 `GOOGLE_MAPS_LOCAL_SETUP.md` 私下填入金鑰，重啟前端、人工啟動查詢，逐項記錄成功／失敗。只回報安全的錯誤代碼或狀態，不傳金鑰、原始供應商回應、私人位置或一般使用者資料。
