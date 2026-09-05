# Sideby 後端串接契約

2026-09-05：已實作房間／公開條件、私密 Session 輸入、有限規則解析、版本化同意、私人場地清單，以及 Phase 5 確定性推薦後端第一刀。推薦測試使用合成核准場地；Phase 4 真實場地／RAG、偏好更新器、內容管理與 UI 尚未接入。

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

`npm test` 會先重新 build，避免測到舊的 `.next` 產物，再使用 `.local/tests/<timestamp>/` 的獨立 PostgreSQL 叢集與隨機 HTTP 埠啟動正式建置。只使用合成資料；測後關閉程序、保留資料便於除錯。不要將這些本機密碼或日誌上傳。測試是本機 HTTP 整合證據，不能代替兩支手機、正式部署或負載驗收。

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
| GET `/api/sessions/:id/private-inputs` | 無 | 200，本人的私密輸入；無資料、非成員或對方沒有自己的投影為 404 |
| POST `/api/sessions/:id/private-inputs` | 見下方 | 200，新增或取代本人的私密輸入與 parser envelope |
| DELETE `/api/sessions/:id/private-inputs` | 無 | 204，刪除本人的私密輸入 |
| POST `/api/sessions/:id/generate` | `{ "version": 3 }` | 200，當期三套公開安全行程；不足三套則失敗 |
| GET `/api/sessions/:id/itineraries` | 無 | 200，只回當前 Session version 的行程 |
| GET `/api/me/consents` | 無 | 200，目前條款版本與兩項設定 |
| PUT `/api/me/consents` | 見下方 | 200，持久化後的條款與設定 |
| GET `/api/me/venues/:venueId/feedback` | 無 | 200，本人的私人回饋；無資料或非本人為 404 |
| PUT `/api/me/venues/:venueId/feedback` | 見下方 | 200，新增／取代本人的私人回饋 |
| PATCH `/api/me/venue-feedback/:id` | 見下方 | 200，修改本人內容或切換可見性 |
| DELETE `/api/me/venue-feedback/:id` | 無 | 204，軟刪除本人回饋 |
| GET `/api/venues/:venueId/public-reviews` | query：`limit=1..50&cursor=0..100000` | 200，只列 approved 公開回饋 |

邀請碼是 24 隨機 bytes 的 32 字元 base64url，可包成邀請連結（建議 URL fragment，由 UI 讀取後清除）；有效 24 小時，只有建房回應給建立者，伺服器僅存雜湊。加入交易鎖住房間，資料庫限制 A／B 各一名，第三人回 409。已加入成員重送加入請求回原角色，不新增席位。

Phase 1B 每房間一個 Session；任一成員建立或重送會取得同一 sessionId。新一輪約會／歷史 Session 留待後續產品流程。建房／建立匿名身分每次會產生新資源，前端防止連點；網路結果不明時不可無限自動重試建房。

## 私密輸入與解析

先接受目前條款，再送：

```json
{
  "rawText": "想找明亮、可愛但不要太幼稚，也不要走太多路。",
  "tags": ["約會"],
  "visibility": "private_session"
}
```

`rawText` 為 1～1000 字純文字並拒絕控制字元；`tags` 最多 12 個不重複項目、每項 1～30 字。visibility 只能是 `private_session` 或 `private_remembered`，省略時預設 session。後者還要求 `personalizationEnabled=true`，否則回 `PERSONALIZATION_REQUIRED`；設定關閉後，既有 remembered 輸入會降回 session scope。

成功回應只供本人使用：

```json
{
  "inputId": "<UUID>",
  "sessionId": "<UUID>",
  "rawText": "想找明亮、可愛但不要太幼稚，也不要走太多路。",
  "tags": ["約會"],
  "visibility": "private_session",
  "parse": {
    "status": "parsed",
    "engine": "rule_baseline_v1",
    "result": {
      "session_id": "<UUID>",
      "mode": "future",
      "visibility": "private_session",
      "preferences": [
        { "attribute": "bright", "target_min": 0.6, "importance": 0.8, "confidence": 1, "scope": "session", "source": "conversation" },
        { "attribute": "cute", "target_min": 0.4, "importance": 0.7, "confidence": 1, "scope": "session", "source": "conversation" }
      ],
      "avoid": [
        { "attribute": "childish", "target_max": 0.3, "importance": 0.9, "hard": false, "scope": "session" },
        { "attribute": "walking", "target_max": 0.4, "importance": 0.8, "hard": false, "scope": "session" }
      ],
      "hard_constraints": {
        "date": null,
        "start_time": null,
        "end_time": null,
        "meeting_point": null,
        "budget_scope": "couple_total",
        "ideal_budget": null,
        "absolute_budget": null,
        "transport_modes": [],
        "max_walk_minutes": null,
        "max_total_travel_minutes": null,
        "outdoor_allowed": null,
        "booking_required": null,
        "dietary_restrictions": [],
        "accessibility_needs": [],
        "hard_no": [],
        "weather_required": null
      },
      "context": { "energy": "unknown", "remember": false },
      "parser_confidence": 1
    },
    "clarification": null,
    "externalModelApiCalls": 0
  },
  "createdAt": "<ISO 時間>",
  "updatedAt": "<ISO 時間>"
}
```

完整結構以 `schemas/preference-query.schema.json` 為準。`parser_confidence: 1` 在此只表示這些列出的欄位由明確規則完整匹配，不代表模型機率或已知道使用者的精確偏好尺度。`rule_baseline_v1` 只承認有限明示詞句；「有氣氛」或含未支援限制的混合句回 `needs_clarification`。共同條件尚未建立時回 `unavailable／SHARED_REQUIRED`。非法 parser 候選固定轉成 `unavailable／PARSER_OUTPUT_INVALID`，不能當 parsed。

GET 永遠只依 Bearer token 讀本人，不能傳 userId／role；POST、DELETE 與 remembered 撤回會增加 Session 的公開 revision 並清除既有雙方確認，讓同時送出的舊版確認失敗。revision 只表示決策輸入已變，不透露誰輸入了什麼。rawText、tags、parse 及 clarification 不進 PublicState 或 SSE，也不自動進共用 RAG／訓練候選。當前解析器是可執行規則基準，不代表自管分類器、生成模型或 RAG 已完成。

## 條款、私人清單與公開評論

`GET /api/me/consents` 在尚未接受時回傳目前必要版本、`termsAccepted: false` 與兩項 false 設定。接受與設定使用：

```json
{
  "termsVersion": "2026-09-05-v1",
  "acceptTerms": true,
  "personalizationEnabled": true,
  "modelImprovementOptIn": false
}
```

兩項設定彼此獨立，可用相同 PUT 改成 false；接受條款本身不以設定關閉視為撤銷。服務必要的場地回饋儲存要求接受目前版本。這只是工程契約，正式法務文字及重大改版的重新同意條件尚未完成。

新增或完整取代本人對一個場地的回饋：

```json
{
  "noteText": "下午窗邊很明亮",
  "userTags": ["明亮", "約會"],
  "rating": 4,
  "visitState": "visited"
}
```

`noteText` 可為 null，否則 1～300 字；最多 8 個不重複標籤，每個 1～24 字；`rating` 為 null 或 1～5 整數；`visitState` 為 `saved`、`want_to_go`、`visited`。純文字拒絕控制字元、HTML 括號及 URL。`venueId` 必須符合 `venue_[a-z0-9_-]{1,120}`；目前尚未接正式場地資料表，只驗證格式，不代表該場地確實存在。

PUT 固定建立 private，不能夾帶 visibility。取得 `feedbackId` 後，才可 PATCH 部分欄位或 `{ "visibility": "public" }`。切成 public 只表示作者希望公開，狀態固定變成 pending；內容變更會重新 pending。取消公開立即變成 private／none，DELETE 立即從本人讀取與公開列表消失。

公開列表只回傳仍為 public、approved 且未刪除的固定欄位：`feedbackId, venueId, noteText, userTags, rating, authorAlias, createdAt`。目前沒有對外的核准、檢舉或隱藏 API，測試只在資料庫層設定 approved 以驗證出口；在管理流程完成前不得開放陌生使用者自由投稿。公開與否不會修改 `modelImprovementOptIn`，也不會把內容送入場地事實、共用標籤、RAG 或模型訓練。

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
      "longitude": 121.52,
      "matrixKey": "meeting_example"
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
- Phase 5 生成可另外送 `maxLegTravelMinutes`、`maxTotalTravelMinutes`、`dietaryRequirements`、`allergensToAvoid`、`accessibilityRequirements`、`participantMinAge`、`hardNoCategories`。這些都是公開共同硬限制；`matrixKey` 對應團隊核准的交通矩陣集合點，沒有對應資料時不估算直線距離冒充路線。

## 三套行程生成

生成前必須有兩位成員、共同條件、兩份 parsed 私密輸入，以及雙方對目前 version 的確認。後端只讀唯一 active 的 venue dataset 與 travel matrix；場地仍會通過 `assessVenue` 的來源、權利、審核、價格及營業守門。

硬限制先於計分。時間、營業、保守價格、訂位、交通、步行／總移動、飲食、過敏、無障礙、年齡、Hard No 與戶外／天氣任一不合即排除。必要事實未知、路線缺少、資料版本未啟用或不足三套實質差異時，不產生部分或固定假結果。

CoupleScore 固定使用 `45% × min(A,B) + 25% × mean(A,B) + 15% × context + 10% × novelty + 5% × route efficiency`。贊助只影響 `sponsored_content` 標示，不參與分數。每套 2～4 站，包含時間、保守估計費用、移動、score breakdown、中性公開理由、資料驗證狀態及以自有／授權名稱產生的 Google Maps click-out；optional `google_place_id` 只用於 `query_place_id`，URL 不含 API key。

Session 共同條件或私密輸入修改後 version 增加；GET 不再回傳舊 version 的行程，過期 generate 回 `VERSION_CONFLICT`。目前資料寫入沒有公開管理 API，測試直接載入合成 venue record／execution slot／travel matrix；正式匯入器與真實資料仍待完成。

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
| 409 | TERMS_REQUIRED | 先接受目前條款版本 |
| 409 | PERSONALIZATION_REQUIRED | private_remembered 前先開啟個人化設定 |
| 409 | SESSION_NOT_READY | 等兩人完成輸入並確認目前版本 |
| 422 | PRIVATE_INPUT_UNRESOLVED | 兩份私密需求尚未完成或仍需釐清 |
| 422 | NO_FEASIBLE_ITINERARIES | 硬限制及差異規則後不足三套，不自動放寬 |
| 413 | BODY_TOO_LARGE | JSON 超過 8 KiB |
| 415 | JSON_REQUIRED | 設定 application/json |
| 503 | SERVICE_UNAVAILABLE | 服務／資料庫未就緒，顯示錯誤並退避 |
| 503 | RECOMMENDATION_DATA_UNAVAILABLE | 核准場地資料集或交通矩陣未啟用 |

尚未實作的局部重排、finalize、公開評論檢舉／管理等路由不會回傳假成功。目前只可串接上表，其他功能按 Roadmap 後續接入。
