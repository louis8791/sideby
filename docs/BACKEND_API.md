# Phase 1B 後端串接契約

2026-09-04：已實作房間與公開條件骨架。模型／RAG、私密輸入、推薦與 UI 尚未接入。

## 啟動與驗證

在 repo 根目錄執行（Node.js 22.13+；此次實測 Windows x64、Node 24.16.0）：

```sh
npm ci
npm run dev:local
```

服務預設 `http://127.0.0.1:3000`，此階段只有 `/api/*`，首頁 404 是預期行為。`dev:local` 自動啟動套件攜帶的真正 PostgreSQL 18.4、執行 migration，再啟動 Next.js；僅綁定本機，不新增 Windows 服務。資料、隨機密碼與資料庫日誌保存在 `.local/dev-postgres/`，不提交 Git。結束時關閉該程序與資料庫。

已有 PostgreSQL 時，由啟動環境設定伺服器專用 `DATABASE_URL`，執行 `npm run db:migrate`，再執行 `npm run dev`。migration 指令不自動讀取 `.env`；部署環境必須明確注入變數。此階段透過後端驗證成員，禁止將資料庫或資料表直接開放瀏覽器／PostgREST；尚未配置 Supabase RLS。

```sh
npm run typecheck
npm run build
npm test
```

`npm test` 必須先 build，會使用 `.local/tests/<timestamp>/` 的獨立 PostgreSQL 叢集與隨機 HTTP 埠，啟動正式建置產物。只使用合成資料；測後關閉程序、保留資料便於除錯。不要將這些本機密碼或日誌上傳。測試是本機 HTTP 整合證據，不能代替兩支手機、正式部署或負載驗收。

## 匿名身分

所有 POST／PUT 必須送 `Content-Type: application/json`，沒有欄位也送 `{}`。JSON 上限 8 KiB；額外欄位一律拒絕，不能帶 `userId`、`role` 或 `raw_text` 冒名／混入私密欄位。

`POST /api/auth/anonymous`，body `{}`，201 回應：

```json
{ "token": "<一次取得的匿名憑證>", "expiresAt": "<ISO 時間>" }
```

之後每個請求送 `Authorization: Bearer <token>`。憑證有效七天、資料庫僅存 SHA-256 雜湊；身分由後端從憑證決定。前端暫存在記憶體或 sessionStorage，登出／到期時清除；不得放入 URL、分享連結、分析事件或日誌。匿名憑證遺失後目前無帳號復原流程。

前端與 API 預期同源；獨立前端開發伺服器請設定同源代理，不開 wildcard CORS。正式對外提供服務前仍需完成 HTTPS、撤銷／刪除、流量限制與部署權限配置；目前入口以本機開發為限。

## 路由

| 方法與路徑 | Body | 成功回應 |
|---|---|---|
| POST `/api/couples` | `{}` | 201，`coupleId, role: "A", inviteCode, inviteExpiresAt` |
| POST `/api/couples/join` | `{ "inviteCode": "…" }` | 200，`coupleId, role` |
| POST `/api/sessions` | `{ "coupleId": "UUID" }` | 200，`sessionId` |
| GET `/api/sessions/:id` | 無 | 200，PublicState |
| PUT `/api/sessions/:id/shared` | `{ "version": 0, "shared": {…} }` | 200，最新 PublicState |
| POST `/api/sessions/:id/confirm` | `{ "version": 1 }` | 200，最新 PublicState |
| GET `/api/sessions/:id/events` | 無 | SSE：`state`、`heartbeat`、`error` |

邀請碼是 24 隨機 bytes 的 32 字元 base64url，可包成邀請連結（建議 URL fragment，由 UI 讀取後清除）；有效 24 小時，只有建房回應給建立者，伺服器僅存雜湊。加入交易鎖住房間，資料庫限制 A／B 各一名，第三人回 409。已加入成員重送加入請求回原角色，不新增席位。

Phase 1B 每房間一個 Session；任一成員建立或重送會取得同一 sessionId。新一輪約會／歷史 Session 留待後續產品流程。建房／建立匿名身分每次會產生新資源，前端防止連點；網路結果不明時不可無限自動重試建房。

## 共同條件

以下全部是兩人可見的公開欄位，必須在畫面明確標示：

```json
{
  "version": 0,
  "shared": {
    "mode": "future",
    "startsAt": "2026-10-10T12:00:00+08:00",
    "endsAt": "2026-10-10T18:00:00+08:00",
    "meetingPoint": {
      "label": "合成範例集合點",
      "latitude": 25.04,
      "longitude": 121.52
    },
    "budgetTwdTotal": 1800,
    "transport": ["walk", "transit"],
    "stops": 3,
    "outdoorAllowed": true,
    "bookingAllowed": false
  }
}
```

- `mode`：`now`／`future`，兩者均明確送開始與最晚結束時間；現在模式由 UI 使用當下時間填入。此階段存條件，不保證生成當下仍可出發；生成前須重驗時間。
- 時間為含時區 ISO 格式，結束晚於開始；Asia/Taipei 同一日、最多 16 小時，不提供過夜模式。
- 集合點名稱 1–120 字；座標初步接受緯度 24.6–25.4、經度 121.2–122.1。這是輸入粗篩，不能當成行政邊界或地點真實性驗證。
- `budgetTwdTotal` 是兩人合計新臺幣整數，輸入範圍 0–100000。後續行程仍須另驗算，不代表支出可行性已驗證。
- `transport`：不重複的 `walk`／`transit`／`car`／`bike`，至少一種。
- `stops`：2–4 站；`outdoorAllowed` 是是否容許戶外，`bookingAllowed` 是是否容許需要訂位／購票的安排，不代表已查到空位。

## 公開狀態、版本與確認

```json
{
  "sessionId": "<UUID>",
  "coupleId": "<UUID>",
  "version": 0,
  "shared": null,
  "status": "editing",
  "members": [
    { "role": "A", "online": true, "confirmed": false },
    { "role": "B", "online": true, "confirmed": false }
  ]
}
```

上方是兩人加入後的新 Session。版本大於零時 shared 會是完整共同條件物件；確認須在有共同條件與兩位成員後才允許。

- `waiting_partner`：只有一位；`editing`：已有兩位但未全部確認；`ready`：兩人均確認當期共同條件。
- `ready` 僅代表共同條件確認完成，**不表示私密輸入、模型、推薦或訂位已就緒**。
- 更新要帶上次讀取的 version，成功加一並清空兩人的確認；即使送相同內容也按一次更新處理。
- 版本過期回 409 `VERSION_CONFLICT`；前端重新 GET／使用最新 SSE，讓使用者檢視差異後再送，不能靜默覆蓋。
- 同一人重複確認同版本不增加人數。共同編輯與確認使用資料庫交易鎖，同時執行不會留下舊版本確認。
- mutation 回傳的是提交後讀到的最新快照；可能含另一人的後續更新，以 version 為準。
- PublicState 僅包含固定公開欄位，不含 userId、憑證、邀請碼或私人輸入。

## 同步與在線狀態

使用帶 Authorization header 的 `fetch` 讀取 SSE stream，**不可把 token 塞進 EventSource URL**。同源 UI 可以用 fetch 串流讀取器。伺服器每 500ms 查共享資料，變化時發送完整 `state`；每 10 秒有 `heartbeat`，連線最多 60 秒後結束，前端以短暫退避重連，每次連線先取得當前完整快照，不依賴舊事件重播。

`online` 表示最近 30 秒有有效狀態讀取或同步心跳，不保證手機螢幕仍開啟。切到背景／失聯後會到期；回來 GET 或重連即可恢復。頁面卸載時 AbortController 中止串流；401 停止重試並處理身分到期，503 顯示服務不可用後退避重試。

```text
event: state
data: { ...PublicState }

event: heartbeat
data: {}

event: error
data: {"code":"UNAUTHENTICATED"}
```

此版使用 SSE＋PostgreSQL 輪詢，尚未接 Supabase Realtime。每個訂閱會查庫，適用小規模展示；正式併發、反向代理緩衝、跨網路延遲與手機背景行為尚待驗證。

## 錯誤

非串流錯誤格式 `{ "error": { "code": "…" } }`；全部 API 回應 `Cache-Control: no-store`。

| HTTP | code | 前端處理 |
|---|---|---|
| 400 | INVALID_INPUT | 修正欄位／多餘欄位／UUID |
| 401 | UNAUTHENTICATED | 憑證遺失、無效或到期 |
| 403 | ORIGIN_DENIED | 檢查同源代理 |
| 404 | NOT_FOUND | 不存在或不是房間成員，兩者不區分 |
| 404 | INVITE_UNAVAILABLE | 邀請無效或過期 |
| 409 | ROOM_FULL | 已有兩人 |
| 409 | VERSION_CONFLICT | 取得最新條件後再編輯／確認 |
| 409 | SHARED_REQUIRED | 先設定共同條件 |
| 409 | PARTNER_REQUIRED | 等另一人加入 |
| 413 | BODY_TOO_LARGE | JSON 超過 8 KiB |
| 415 | JSON_REQUIRED | 設定 application/json |
| 503 | SERVICE_UNAVAILABLE | 服務／資料庫未就緒，顯示錯誤並退避 |

尚未實作的 private-inputs、generate、itineraries 等路由不會回傳假成功。目前只可串接上表，其他功能按 Roadmap 後續接入。
