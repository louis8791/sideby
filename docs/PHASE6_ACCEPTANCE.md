# Phase 6 第一刀驗收交接

## 現況判定

舊 Phase 4 對應現行 Phase 6。已實作站點反應、雙方按讚後鎖定、保留鎖定站點的局部重排、雙人定案，以及 `too_dark` 的本人偏好更新。正式首頁已串真 API；Chrome＋Edge 已完成一個合成案例，包含 locked stop 保留、未鎖定站替換、雙人定案，以及 session-only／long-term 兩種學習結果。三案例 Runtime、兩支實體手機、管理審核、檢舉／隱藏、頻率限制、training candidates 與 Owner 驗收尚未完成，因此 Phase 6 overall 維持 `NOT_READY`。

## 重跑入口

從乾淨 clone 的 repo 根目錄執行：

```powershell
npm ci
npm run phase6:check
```

`npm test` 應通過。兩份 Runtime／Owner 證據未放入 `.local/phase6/` 前，`phase6:check` 應以非零狀態列出 BLOCKED。

## 必須驗證的行為

1. Bearer token 決定成員；body 不接受 userId／role，非成員與跨 Session 資源均以 404 拒絕。
2. 單方對站點按讚不鎖定；雙方對同一 stop 按讚後才由伺服器輸出 `locked=true`。整套行程按讚不會鎖死所有站點。
3. Reaction 以 itinerary／user／stop 做 upsert；公開回應、行程 GET 與 PublicState 不回傳 reaction row、user ID、私密原文或原因。
4. 已鎖定站點不可 dislike／replace；成功重排必須原樣保留其 `stop_id`、`venue_id`、`order_no` 與 locked 狀態。
5. 重排只使用既有 Phase 5 composer，排除被拒絕場地後重新驗證整條時間、交通、預算、營業、訂位、飲食／過敏、無障礙及 Hard No；無可行結果回 `NO_FEASIBLE_REPLAN`，不得放寬限制或部分覆寫原行程。
6. Session version 過期時 reaction／replan／finalize 都回 `VERSION_CONFLICT`；定案後 generate／reaction／replan 與改選另一方案都回 `SESSION_FINALIZED`。
7. 一人選擇時為 `pending_partner`；兩人不同方案為 `choice_conflict`；兩人同一方案才產生 finalization，同方案重送冪等。
8. `too_dark` 只能改回報者：當次 bright 門檻提高；個人化關閉時 long-term version 為 null，開啟時才遞增。重送不重複累積，另一人 parser projection byte-equivalent，公開畫面與行程 JSON 不含 signal。

## Runtime 證據

下列檔案留在 `.local/phase6/`，不提交 Git：

| 檔案 | 必要內容 |
|---|---|
| `two-browser-replan.json` | 與受驗 commit 相同；兩瀏覽器、至少三案；locked 變動、硬限制違規、隱私洩漏、非成員存取與接受舊版皆為 0 |
| `owner-acceptance.json` | 與受驗 commit 相同；Owner 明確接受、驗收人、含時區時間與備註 |

只有 `6 reaction/replan/finalize API`、`6 two-browser runtime`、`6 owner acceptance` 全 PASS，且其餘 Phase 6 工作包另行完成，才可把 Phase 6 overall 標為完成。
