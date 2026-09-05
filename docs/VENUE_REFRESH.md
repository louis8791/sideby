# Sideby 地點更新管線

查核日：2026-09-06。正式來源為交通部觀光署每日更新、政府資料開放授權條款第 1 版的景點與餐飲 JSON。

## 目前數量

| 層級 | 數量 | 意義 |
|---|---:|---|
| 正式展示場地 | 9 | 目前 production 推薦仍使用的 `synthetic_demo` |
| Production draft staging | 1,121 | 已寫入 Railway PostgreSQL，尚未核准、不參與推薦 |
| 官方來源全臺資料 | 9,818 | 景點 6,190＋餐飲 3,628；不是 Sideby 可推薦場地數 |
| 臺北／新北來源記錄 | 1,138 | 符合 MVP 城市範圍的候選 |
| 通過 schema／政策並可進 staging | 1,121 | 全部仍為 `draft`，不會自動進推薦 |
| 拒絕 | 17 | 座標、schema 或政策檢查未通過 |

上述數字來自來源 `UpdateTime=2026-09-05` 的單次 dry-run；來源每日變動，後續以 `venue_import_runs` 記錄為準。

## 資料流

```text
交通部景點／餐飲 JSON
→ 僅保留臺北市、新北市
→ 正規化成 VenueRecord
→ schema、授權與共用政策守門
→ venue_import_runs + venue_staging_records
→ 人工補價格／營業／環境區域／審核
→ 另行建立 approved_dataset、execution slots 與合法交通資料
→ 驗證完成後才可切換 active
```

管線刻意不自動切換 `venue_datasets.active`。政府來源只能建立客觀資料 draft；明亮、安靜、浪漫等主觀屬性不得由名稱或描述自動推論，價格、營業時間與實際室內外／冷氣區域也必須另行驗證。

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

PR #11 已合併 `main`（`0452445`），Railway deployment 成功，migration 009 已套用。production 首次匯入寫入 1,121 筆 draft；再次執行回用同一 run，沒有重複資料。獨立 `venue-refresh-daily` 服務已設定每日 00:00 UTC 執行更新命令，並使用 Railway PostgreSQL reference；正式 API `/api/runtime` 仍回 200／`standard`。

## 正式來源

- 景點：`https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/AttractionList.json`
- 餐飲：`https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/RestaurantList.json`
- 授權：`https://data.gov.tw/license`

Google Places 不作大量建庫來源。Google Text Search 單次查詢總結果有限，且 Places 內容不得預抓或長期保存；Sideby 只長存可重用的 `google_place_id`，其餘名稱、地址、照片、評論、評分與搜尋結果維持即時顯示。

## 尚未完成的啟用 Gate

1. 從 1,121 筆 draft 中選定首批大臺北約會場地。
2. 人工核對價格、營業、停留時間、室內外區域及冷氣狀態。
3. 建立同版本 execution slots 與非 Google 持久交通資料，或採合規即時路線顯示。
4. 以至少 12 筆核准真實場地跑三案例 Runtime，再由 Owner 決定是否切換 production active dataset。

未通過以上 Gate 前，1,121 只能稱為「可追溯候選庫」，不能稱為 1,121 個已核准可約會地點。
