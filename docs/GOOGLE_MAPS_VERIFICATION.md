# Google 本機接線驗證紀錄

日期：2026-09-05；基底 `2b961f0`；狀態 **LOCAL_LIVE_PASS / PRODUCTION_NOT_VERIFIED**。

- Windows Node 24.16.0，前端 Bun 1.4.2 frozen-lockfile 乾淨安裝通過，沒有新增依賴。
- `npm run test:maps`：10 個離線子案例＋1 個總測試，11 passed、0 failed。所有 HTTP 由 mock 攔截，真實 Google 呼叫為 0；驗缺 key、同來源本機限制、三項 web service 官方 URL／header、無全域快取、精度／查無資料、錯誤去敏、照片歸屬與 browser/server key 分離。
- 前端 typecheck、client＋SSR＋cloudflare-module build 通過；既有套件的 deprecation／chunk size 警告不當成失敗，也不隱藏。
- 在 `http://127.0.0.1:5173/maps-check` 由 Owner 按下「檢查四項連線」：Maps JavaScript 顯示真實底圖、Google 歸屬與標記，console error／warning 為 0。
- Places API (New) 回傳臺北車站；Routes 回傳步行 36 分鐘與大眾運輸 14 分鐘；Geocoding 回傳 rooftop 精度座標。四項均由真實 Google 服務完成，不是 mock。
- 第一次 runtime 曾被全域 Supabase token 附加器阻擋；改為只在瀏覽器 Supabase 配置存在時附加。伺服器 `requireSupabaseAuth`、根 API 的權限與 DB 未更動。修正後重載 Chrome 確認待填狀態。
- `npm run maps:config` 僅確認兩把不同金鑰存在，不輸出內容；`frontend/.env.local` 受 Git 忽略，憑證未提交。
- 本次只證明這台電腦、這組限制與這次查詢可用；帳務剩餘額度、配額告警、正式網域來源限制、正式伺服器 IP 限制與長時間穩定性均 **未驗收**。
- 檢查頁只驗 Google 接線，不能代替首頁完整操作、Supabase 登入、Gemini、雙人房間／推薦、兩支手機、正式部署或 Owner 驗收。Geocoding 只是獨立地址定位，未自動取代推薦資料。
- Google 回傳內容只用於即時畫面，不因此取得評論、照片或其他內容的永久保存、重新發布或 RAG／訓練權利。

換電腦、換網路、換金鑰或改正式網域後，仍須按 `GOOGLE_MAPS_LOCAL_SETUP.md` 重跑。只回報安全的錯誤代碼或狀態，不傳金鑰、原始供應商回應、私人位置或一般使用者資料。
