# Sideby 地點更新管線

查核日：2026-09-06。正式來源為交通部觀光署每日更新、政府資料開放授權條款第 1 版的景點與餐飲 JSON。

## 目前數量

| 層級 | 數量 | 意義 |
|---|---:|---|
| Production 正式推薦池 | 1,121 | 已實查；13 筆完整驗證＋1,108 筆出發前待確認 |
| 合成展示場地 | 9 | 只保留於明示的本機 `synthetic_demo` 模式 |
| Production staging | 1,121 | 已寫入 Railway PostgreSQL；是全候選 release 的來源 |
| 已對應 Google Place ID | 1,120 | 只長期保存 Place ID；仍是待審 draft |
| Place ID 查無結果 | 1 | 30 日後可再查，不影響其政府候選記錄 |
| 首批審查隊列 | 100 | 依政府欄位完整度與 Place ID 狀態排序；非已核准 |
| 官方來源全臺資料 | 9,818 | 景點 6,190＋餐飲 3,628；不是 Sideby 可推薦場地數 |
| 臺北／新北來源記錄 | 1,138 | 符合 MVP 城市範圍的候選 |
| 通過 schema／政策並可進 staging | 1,121 | 可按 Owner 新 gate 發布；未知事實須保持待確認 |
| 拒絕 | 17 | 座標、schema 或政策檢查未通過 |

上述數字來自來源 `UpdateTime=2026-09-05` 的單次 dry-run；來源每日變動，後續以 `venue_import_runs` 記錄為準。

## 資料流

```text
交通部景點／餐飲 JSON
→ 僅保留臺北市、新北市
→ 正規化成 VenueRecord
→ schema、授權與共用政策守門
→ venue_import_runs + venue_staging_records
→ Owner 以全候選 release 核准發布資格，不等於核准未知事實
→ 13 筆建立 verified slots；其餘建立 provisional slot 並列待確認欄位
→ 驗證完成後才可切換 active
```

每日匯入先建立客觀 staging，再由 `venues:publish-candidates` 建立不可變的全候選 release 並切換 active。Owner 核准的是「可進推薦池並以缺件警示呈現」，不是把缺件改成已驗證。明亮、安靜、浪漫等主觀屬性不得由名稱或描述自動推論，冷氣未知也不得補成 true／false。

## 執行

只下載並計數，不寫資料庫：

```powershell
npm run venues:refresh-government
```

寫入 PostgreSQL staging：

```powershell
npm run venues:refresh-government -- --apply
```

`--apply` 需要部署環境既有的 `DATABASE_URL`。相同來源內容以 SHA-256 冪等辨識，重跑會沿用同一 import run，不重複插入。寫入採單一 transaction 與 advisory lock；任何錯誤整批 rollback，既有 active dataset 不變。

## 正式部署狀態

PR #13 已合併 `main`（`e3e6336`），Railway migration 010 已套用。Production 批次實際計數為 1,121 筆候選、1,120 筆 `matched`、1 筆 `not_found`、0 筆 `retry`，最新 staging 共 1,120 筆含 Place ID；`npm run venues:review-queue -- --limit=100` 已實際讀取 100 筆高完整度審查隊列。

獨立 `venue-refresh-daily` 服務已改為每日 00:00 UTC 執行 `npm run venues:refresh-all`，先更新政府候選，再補齊缺漏 Place ID；deployment `71aa7dff-06a5-4b63-a12b-78f753f88af6` 成功。正式 API `/api/runtime` 回 200／`standard`，Cloudflare Worker 首頁回 200。

2026-09-06 Owner 核准的 13 筆首批正式資料已上線。標準 seed 已啟用 `sideby-approved-2026-09-06-v1` 與 `sideby-approved-routes-2026-09-06-v1`，Production 實查為 13 records、950 個未來 90 天室內 slots、468 legs 與 13 staging approvals。場地間及使用者集合點交通先以政府座標作可重算估算，Google Routes 只在行程頁即時顯示。Cloudflare 同源公開 API 的週日板橋、週五台北、週六土城三案都回 3 套三站、`approved_dataset` 且每站含 Place ID。

## 正式來源

- 景點：`https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/AttractionList.json`
- 餐飲：`https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/RestaurantList.json`
- 授權：`https://data.gov.tw/license`

Google Places 不作場地母表來源。Sideby 可針對既有政府候選，以名稱、政府地址與座標偏置執行 ID-only Text Search；只把 `google_place_id` 長期寫入 `venue_google_place_matches`，並在後續政府快照沿用。名稱、地址、營業、照片、評論、評分與路線仍只在行程頁即時查詢，不寫入資料庫。

批次對應（只讀候選數）：

```powershell
npm run venues:match-google-place-ids
```

批次對應並保存 Place ID：

```powershell
npm run venues:match-google-place-ids -- --apply
```

每日來源更新與缺漏 Place ID 補齊可合併執行 `npm run venues:refresh-all`；失敗項目隔日重試、查無結果項目 30 日後重試。首批人工查核清單以 `npm run venues:review-queue -- --limit=100` 依政府欄位完整度及 Place ID 狀態排序。

只建立或預覽最新全候選 release：

```powershell
npm run venues:publish-candidates
```

在既有 PostgreSQL 連線套用並切換 active：

```powershell
npm run venues:publish-candidates -- --apply
```

`venues:refresh-all` 已包含此步驟。一般推薦可以使用待確認候選；若使用者指定室內／戶外、冷氣／無冷氣或其他安全硬限制，缺值候選仍會被拒絕。評論分類不會回填這些欄位。

## 首批啟用 Gate

1. 已完成：從 1,121 筆候選列名選定 13 筆，Owner 明確核准。
2. 已完成：保存政府當期快照可核對的票價、營業、停留時間與室內參觀區；冷氣及主觀屬性維持未知。
3. 已完成：建立同版本 execution slots、政府座標估算矩陣及 Google 即時顯示分界。
4. 自動行為測試已用 13 筆生成三套三站正式資料行程；待合併部署後補公開 API 三案例與雙手機驗收。

本節首批 13 筆 gate 保留為完整驗證子集的歷史。新 gate 已完成 production migration、release 與索引實查：正式推薦池為 1,121 筆，其中 1,108 筆清楚標為待確認。Active release 是 `sideby-release-pool-20260906-a8f936dc01`；2,058 slots 中 1,108 個為 provisional，交通矩陣 107,616 legs，active index 1,121 entries／1,108 unknown price。
