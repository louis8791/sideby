# Google 本機接線驗證紀錄

日期：2026-09-05；本機基底 `2b961f0`；狀態 **LOCAL_LIVE_PASS / PRODUCTION_LIVE_PASS**。

## 正式 Worker 驗證

- 網址：`https://louis8791-sideby-frontend.louis8791.workers.dev/maps-check`；頁面 200，browser／server key 均顯示已填入，secret 值未顯示。
- Google Cloud 專案 `sideby-507707` 已核對：browser key 僅限 Maps JavaScript API 與核准網站來源；server key 無應用程式限制，API 僅限 Places API (New)、Routes API、Geocoding API。未讀出或記錄 key 值。
- 初次 production 失敗不是金鑰限制：Cloudflare Worker 對 `redirect: "error"` 的外連拋出 `TypeError`。改用 `redirect: "manual"` 並在任何 3xx 回應時 fail closed，避免 server key 隨重新導向送出；離線測試鎖住此行為。
- 正式頁按下四項檢查後，Maps JavaScript 底圖與 Google 歸屬可見；Places 回傳臺北車站，Routes 回傳步行 36 分鐘／大眾運輸 14 分鐘，Geocoding 回傳 ROOFTOP 座標。這是單次 production live PASS，不代表配額、長時間穩定、雙手機或 Owner 驗收。

- Windows Node 24.16.0，前端 Bun 1.4.2 frozen-lockfile 乾淨安裝通過，沒有新增依賴。
- `npm run test:maps`：10 個離線子案例＋1 個總測試，11 passed、0 failed。所有 HTTP 由 mock 攔截，真實 Google 呼叫為 0；驗缺 key、同來源本機限制、三項 web service 官方 URL／header、無全域快取、精度／查無資料、錯誤去敏、照片歸屬與 browser/server key 分離。
- 前端 typecheck、client＋SSR＋cloudflare-module build 通過；既有套件的 deprecation／chunk size 警告不當成失敗，也不隱藏。
- 在 `http://127.0.0.1:5173/maps-check` 由 Owner 按下「檢查四項連線」：Maps JavaScript 顯示真實底圖、Google 歸屬與標記，console error／warning 為 0。
- Places API (New) 回傳臺北車站；Routes 回傳步行 36 分鐘與大眾運輸 14 分鐘；Geocoding 回傳 rooftop 精度座標。四項均由真實 Google 服務完成，不是 mock。
- 第一次 runtime 曾被全域 Supabase token 附加器阻擋；改為只在瀏覽器 Supabase 配置存在時附加。伺服器 `requireSupabaseAuth`、根 API 的權限與 DB 未更動。修正後重載 Chrome 確認待填狀態。
- `npm run maps:config` 僅確認兩把不同金鑰存在，不輸出內容；`frontend/.env.local` 受 Git 忽略，憑證未提交。
- 本次證明這台電腦與正式 Worker 在這組限制、這次查詢可用；帳務剩餘額度、配額告警、長時間穩定性均 **未驗收**。server key 不設 IP 限制是 Cloudflare Worker 無固定出口 IP 的部署選擇，不應誤寫成已完成固定 IP 防護。
- 檢查頁只驗 Google 接線，不能代替首頁完整操作、Supabase 登入、Gemini、雙人房間／推薦、兩支手機、正式部署或 Owner 驗收。Geocoding 只是獨立地址定位，未自動取代推薦資料。
- Google 回傳內容只用於即時畫面，不因此取得評論、照片或其他內容的永久保存、重新發布或 RAG／訓練權利。

換電腦、換網路、換金鑰或改正式網域後，仍須按 `GOOGLE_MAPS_LOCAL_SETUP.md` 重跑。只回報安全的錯誤代碼或狀態，不傳金鑰、原始供應商回應、私人位置或一般使用者資料。
