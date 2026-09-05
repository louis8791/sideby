# Phase 7 第一刀驗收交接

## 現況判定

Phase 7 已有手機優先正式頁面，串接匿名房間、共同條件、本人私密輸入、雙方確認、三套行程、反應／局部重排／定案、本人私人清單與回饋。Google Maps 與外部訂位／購票只做 click-out；Google 或網路失效時，既有 Sideby 行程仍留在頁面。合成展示資料只由 `npm run demo:local` 載入獨立 `.local/demo-postgres`，正式模式沒有自動填入的假場地或假共同條件。

程式與自動測試通過不等於 Phase 7 完成。390px／1280px 瀏覽器 Runtime 證據、兩支實體手機及 Owner 驗收必須分層保存；缺少任何一層時 `phase7:check` 維持 `NOT_READY`。

## 重跑入口

```powershell
npm test
npm run phase7:check
```

## 必須驗證的行為

1. 建立／加入、共同條件、本人私密輸入、雙方確認、三套行程、選擇／局部重排／定案、本人清單與回饋在手機直向均無死路。
2. loading、empty、錯誤、503、身分過期、版本衝突、尚未確認、無候選與資料未就緒均顯示清楚中文，不用假成功或假資料補畫面。
3. 場地卡固定顯示「在 Google Maps 查看」；URL 由 `src/venues/maps.ts` 產生，有／無 Place ID 均正確編碼，有 ID 時優先，不含 API key。
4. Maps 與訂位／購票皆為外部新分頁；Sideby 不保存 Google 頁面，不保證座位、不代付款，贊助內容必須標示。
5. 外部服務或網路不可用時，已產生的 Sideby 結果仍可閱讀，畫面明示外部詳情可能不可用。
6. 共用結果不得含另一人的私密原文、標籤或可反推理由；私人清單與回饋明示僅本人可見。
7. 390px 與 1280px 無水平溢出；鍵盤 focus、disabled、loading 與 console error 實測通過。
8. 合成展示明顯標示且只在 `.local`；正式流程沒有資料時回傳／顯示 unavailable。

## Runtime 證據

非敏感證據留在 `.local/phase7/`，不提交 Git：

| 檔案 | 必要內容 |
|---|---|
| `browser-runtime.json` | 對應 UI source fingerprint；390／1280、主流程至回饋、無 overflow／console error／私密洩漏、Maps 有／無 Place ID、無 key、外部失效仍保留結果 |
| `owner-mobile.json` | 同一 source fingerprint；兩支實體手機、Owner 明確接受、驗收人、含時區時間與備註 |

兩份證據與 source fingerprint 一致，且程式／測試皆通過後，才可把 Phase 7 第一刀標為 `READY_FOR_OWNER_REVIEW`。Owner 真手機證據缺少時，不得稱 completed。
