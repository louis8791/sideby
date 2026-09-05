# Google Maps 本機接線：填入資訊即可開始實測

2026-09-05。此文件是設定與驗收入口；同日本機已完成四項單次真實連線驗收，但新電腦、新金鑰、公開部署與主流程仍須各自重驗。已取消地圖對 Lovable gateway 的依賴，不需要 LOVABLE_API_KEY。

## 你現在需要填什麼

本機已準備 `E:\sideby\frontend\.env.local`（Git 忽略）。在等號後貼入兩把**不同**的金鑰，儲存後重啟前端。不要把金鑰貼入對話、截圖或 GitHub。

```dotenv
VITE_GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_SERVER_API_KEY=
```

新 clone 的隊友從 `frontend/.env.example` 建立自己的 `frontend/.env.local`。不需要共享你的金鑰；每人使用自己的設定，程式仍在同一個 Repo。

## Google Cloud 要準備的設定

1. 開啟 [Google Cloud 專案](https://console.cloud.google.com/projectselector2/home/dashboard)，選擇或建立你自己可管理的專案。記住專案名稱即可，不必把 Project ID 填進 Sideby。
2. 在該專案確認 Google Maps Platform 帳務已啟用。帳務資料／付款／條款由帳號持有人完成；本次沒有代你開通付費服務。
3. 在 [API 程式庫](https://console.cloud.google.com/apis/library) 逐一啟用下表四項 API。
4. 在 [憑證](https://console.cloud.google.com/apis/credentials) 建立兩把不同金鑰，設定應用限制與 API 限制後才填進本機檔案。
5. 在 [Google Maps 用量與配額](https://console.cloud.google.com/google/maps-apis/quotas) 調低展示用配額，另設定帳務預算通知。預算通知不是強制停機／支出上限；查詢、照片與重試都可能計費，勿無限重跑。

| API | 本輪用途 | 填入哪把金鑰 |
|---|---|---|
| Maps JavaScript API | 瀏覽器地圖底圖、標記 | VITE_GOOGLE_MAPS_API_KEY |
| Places API (New) | 搜尋建議、地點詳情、行程地點、選用照片 | GOOGLE_MAPS_SERVER_API_KEY |
| Routes API | 站點間 WALK／TRANSIT 時間和距離 | GOOGLE_MAPS_SERVER_API_KEY |
| Geocoding API | 檢查頁的地址轉座標 | GOOGLE_MAPS_SERVER_API_KEY |

Geocoding 不是顯示底圖的必需 API。目前另提供 `geocodeAddress` 伺服器函式及檢查入口，沒有自動加到每次地點搜尋；Places 本身已回傳所選地點座標。地址定位保留精度與 partial match，不當成已驗證商家。

### 瀏覽器金鑰

- Application restrictions 選 Websites。
- 加入 `http://127.0.0.1:5173/*` 及 `http://localhost:5173/*`，不開放任意網站。
- API restrictions 只允許 Maps JavaScript API。
- 這把金鑰本來就會出現在瀏覽器載入的程式裡；保護方式是來源與用途限制，不能當成伺服器秘密。

### 伺服器金鑰

- API restrictions 只允許 Places API (New)、Routes API、Geocoding API。
- Application restrictions 選 IP addresses，填 Google 看到的**目前對外 IP**，不是 `127.0.0.1` 或區網 `192.168.*`。若不確定，由現場網路管理者協助確認；本次未查詢或公開你的 IP。
- 黑客松 Wi-Fi、手機分享、VPN 或 IPv4／IPv6 出口改變時需重核限制。不要為了繞過失敗，把兩把金鑰混用或永久取消限制。
- 不得加 `VITE_` 前綴，不放前端 JavaScript、Google Maps 圖片網址、對話或 repository。

依 [Google 金鑰安全指引](https://developers.google.com/maps/api-security-best-practices) 分開瀏覽器與 web service 使用。API 啟用與帳務要求見 [Maps JavaScript 設定](https://developers.google.com/maps/documentation/javascript/get-api-key)。查核日：2026-09-05。

## 填妥後如何驗

在 `E:\sideby`：

```powershell
npm run maps:config
npm run frontend:dev
```

第一個指令只回報欄位是否存在，不輸出內容、不呼叫 Google。缺值回 `INPUT_REQUIRED`／exit 1；齊全且不同回 `CONFIG_PRESENT_NOT_LIVE_VERIFIED`／exit 0，**不是 API 驗收 PASS**。

開 [本機地圖檢查頁](http://127.0.0.1:5173/maps-check)，不用啟動根後端，也不用 Supabase 或 Gemini。缺任一金鑰時按鈕停用；預設不呼叫 Google Maps。填完、重啟、重新整理後，按「檢查四項連線」。

- 使用公開的臺北車站／北門參考點和車站地址，不讀取裝置定位或私人需求。
- 一次完整檢查會載入 Maps JavaScript、一次 Text Search（有照片時另一次 Photo）、兩次 Routes（步行／大眾運輸）、一次 Geocoding；可能計費。Places 建議與詳情另由首頁 PlaceField 流程呼叫，需要該首頁自己的服務配置。
- Maps JavaScript 顯示「程式已載入」只代表 loader 成功，仍須目視確認底圖不是灰底、授權錯誤或開發警告。
- Places 要回真實正確地點；Routes 未提供的交通方式保持未知；Geocoding 的部分符合／大略座標需人工核對。HTTP 成功但查無結果不算展示通過。
- 錯誤只顯示安全提示，不輸出原始供應商回應、私密地址或金鑰。

`npm run test:maps` 是離線模擬傳輸測試，不能代替上述真實連線。

## 實作與公開部署界線

- 直接使用 Google 官方 Places／Routes／Geocoding 端點；地圖由 Maps JavaScript 載入。前端 Node 開發指令讀取自己的 `.env`／`.env.local`，既有程序環境優先；不要在根 `.env` 填前端金鑰。
- Web service 僅允許 development、loopback hostname 與同 Origin 請求。目前 production 預設拒絕；不能直接把此開發伺服器開到網際網路。正式部署要先接應用授權、用量／濫用防護、部署端 secrets，再另行驗收；不透過把 NODE_ENV 改 development 來繞過。
- Google 資料只即時展示，不保存在全域 venue cache、資料庫、檔案或共用 RAG／訓練。照片作者歸屬隨照片傳遞並顯示；搜尋／卡片保留 Google Maps 歸屬。地圖虛線只表示站點順序，不冒充實際道路導航。
- 首頁原有登入、Gemini、固定邀請碼與三套範例行程並未因接地圖自動完成整合；本次沒有修改 DB、私密授權或根 API。Supabase 未設定時略過的只是可選 token 附加，私密伺服器函式仍檢查 requireSupabaseAuth。
- 正式公開前仍要驗公開條款／隱私告知、Google 內容保存及歸屬、配額、失敗 UX、雙人與手機流程。

實作依據：[Places Text Search](https://developers.google.com/maps/documentation/places/web-service/text-search)、[Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions)、[Geocoding](https://developers.google.com/maps/documentation/geocoding/guides-v3/requests-geocoding)、[照片](https://developers.google.com/maps/documentation/places/web-service/place-photos)、[歸屬政策](https://developers.google.com/maps/documentation/places/web-service/policies)。
