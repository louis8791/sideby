# AI 情侶約會共決策 App — MVP 系統規格

> 本文件是可實作與可驗收的 MVP 基線，不代表已完成產品、已接上外部 API 或已通過 Owner 驗收。

## 1. 產品定義

一句話：情侶分別說出想要的感覺、限制與地雷，系統在不暴露私密需求的前提下，替兩人排出三套可直接出發的完整約會行程。

本產品處理的是雙人共同決策，不是餐廳清單、景點搜尋器或單純的 AI 行程產生器。

## 2. MVP 邊界

### 支援

- 臺北市、新北市，以捷運及大眾運輸可合理到達區域為主。
- 現在就出發與規劃未來。
- 餐廳、咖啡廳、甜點、電影、展覽、手作、運動、娛樂、散步與景點。
- 兩支手機、匿名裝置身分、邀請碼與同一個規劃 Session。
- 團隊整理的場地與活動資料、預先建立的交通矩陣。

### 排除

住宿、SPA、酒吧與夜生活、過夜、長途旅遊、App 內付款、CRM、商家後台、訂閱、社群、即時聊天、遊戲化、驚喜約會、全臺擴張、模型微調與大量評論／照片 RAG。

核心 Demo 不得依賴外部 API 才能完成；外部地點／路線服務只能作為可替換的補充。

## 3. 角色與可見性

正式角色只有 Partner A 與 Partner B。商家不是系統使用者；商家資料由資料庫提供。

| 資料 | shared | private_session | private_remembered |
|---|---:|---:|---:|
| 日期、時間、集合地點 | 可見 | 不適用 | 不適用 |
| 預算、交通、行程長度 | 可見 | 不適用 | 不適用 |
| 心情、體力、氣氛 | 可選 | 僅本次 AI 可用 | AI 可用並可長期保存 |
| 不想去的類型與私密需求 | 可選 | 僅本次 AI 可用 | AI 可用並可長期保存 |
| 原始文字與結構化結果 | 依輸入者權限 | 輸入者與受信任決策層 | 輸入者與受信任決策層 |
| 推薦方案與共同理由 | 雙方可見 | 不適用 | 不適用 |

預設值是 private_session。私密原文不得出現在另一半的 API response、畫面、Realtime payload、共用快取或可查詢歷史。

## 4. 使用流程

1. 建立雙人房間，產生邀請碼或分享連結。
2. A、B 進入同一 Session，看到對方已加入／在線狀態。
3. 共同填寫模式、日期、時間、集合地點、預算、交通、行程長度與必要限制。
4. A、B 各自填寫心情、氣氛、形容詞、不要的類型與不方便直說的需求。
5. 雙方按下完成；系統解析自然語言並建立本次偏好。
6. 先用程式過濾硬限制，再做個人適配、雙人公平計分與行程組合。
7. 產生三套完整方案，經時間、成本、營業、路線與隱私檢查後回傳。
8. 雙方對整套或個別站點 like、dislike、replace。
9. 鎖定已接受的站點，只對衝突區域局部重排。
10. 雙方選定最終方案，查看商家詳情與外部訂位／購票連結。
11. 約會後分別評分；只有勾選同意時才更新長期偏好。

## 5. 行動版畫面規格

### 5.1 加入房間

顯示建立房間、輸入邀請碼、目前成員與等待狀態。匿名裝置可直接使用，不以完整註冊作為 MVP 阻礙。

### 5.2 共同條件

提供現在／未來切換、日期、開始與最晚結束時間、集合地點、兩人總額／每人預算、理想預算、交通方式、行程長度、戶外與立即訂位需求。任一方修改後，另一方看到更新；生成前雙方都要確認。

### 5.3 私密需求

明確標示「只有 AI 會看到」。支援形容詞標籤、自由文字、不要項目與三種 visibility。完成後對方只看到「已完成」，不看到內容。

### 5.4 三套方案

每套顯示主題、站點順序、時間、總花費、移動時間、交通方式、合作標示與可公開的中性理由。三套不可只是替換同類型的一家店。

### 5.5 完整行程

每站顯示抵達／離開時間、停留、預估費用、交通、營業／活動確認狀態、商家詳情與外部連結。不能把無法確認的資料寫成已確認。

### 5.6 意見與局部重排

雙方可對整套或單站 like、dislike、replace，並輸入修改語句。已被雙方接受的站點顯示 locked；重排只替換必要部分，若新路線違反硬限制，整個提案作廢。

### 5.7 最終行程與回饋

顯示雙方已選方案、完整時間軸、提醒、商家外部連結與優惠標示。約會後各自評分、選擇喜歡站點、輸入回饋並選擇是否記住。

## 6. 功能規格

| 編號 | 功能 | 規格 |
|---|---|---|
| FR-01 | 雙人房間 | 建立邀請碼／連結，兩支裝置加入同一 Session。 |
| FR-02 | 即時同步 | 同步公開條件、完成狀態、投票與最終方案。 |
| FR-03 | 規劃模式 | 支援 now 與 future。 |
| FR-04 | 共同條件 | 日期、時間、地點、預算、交通與行程長度。 |
| FR-05 | 私密輸入 | 文字與標籤支援三種 visibility。 |
| FR-06 | 語言解析 | 解析形容詞、強度、上下限、否定、情境與範圍。 |
| FR-07 | 硬限制 | 任何時間、預算、交通、健康或 Hard No 違反都排除。 |
| FR-08 | 三套行程 | 每套 2～4 站，含時間、移動、費用與理由。 |
| FR-09 | 雙人意見 | 支援整套／單站 like、dislike、replace。 |
| FR-10 | 局部重排 | 保留 locked stops，只替換衝突部分。 |
| FR-11 | 本次學習 | 回饋立即影響本次下一輪。 |
| FR-12 | 長期偏好 | 取得同意後才保存長期模型。 |
| FR-13 | 隱私轉譯 | 不回傳原句、輸入者或可反推理由。 |
| FR-14 | 合作內容 | 顯示優惠、商家詳情與外部訂位／購票。 |
| FR-15 | 贊助治理 | sponsored 不進入 CoupleScore，且清楚標示。 |
| FR-16 | 約會後回饋 | 雙方各自評分與回饋。 |

## 7. 硬限制

計分前必須驗證：

1. 日期與時間範圍。
2. 最晚結束時間。
3. 絕對預算上限。
4. 商家營業與活動入場時間。
5. 預約／票券狀態；無法確認時要標示。
6. 可接受交通方式。
7. 單段與總移動時間上限。
8. 食物過敏、飲食禁忌與健康限制。
9. 無障礙及體力限制。
10. 年齡、身分或場域限制。
11. 使用者明確設定的 Hard No。
12. 戶外活動所需的天氣條件。

LLM 不得以「整體看起來適合」覆蓋硬限制。

## 8. 偏好與推薦模型

### 8.1 形容詞

MVP 可使用 bright、cute、childish、quiet、romantic、formal、interactive、relaxing、freshness 等數值屬性。每個使用者的偏好保存 target_min、target_max、importance、confidence、scope 與 source。

例如「明亮一點，可愛但不要太幼稚」可以解析為 bright 下限、cute 區間與 childish 上限，而不是只保存文字。

### 8.2 個人適配

UserFit(u, v) = Σ(形容詞符合度 × 重要性 × 信心值) ÷ Σ(重要性 × 信心值)

落在理想區間為 1；稍微超出依距離遞減；違反強烈排斥為 0；Hard No 直接排除。

### 8.3 雙人公平分數

CoupleScore = 45% × min(A, B) + 25% × mean(A, B) + 15% × 情境符合度 + 10% × 新鮮感 + 5% × 路線效率

min(A, B) 的高權重避免一方 100、另一方 0 時，平均分仍看似合格。贊助與合作費用不得加入公式。

### 8.4 回饋更新

- 「太暗」提高本次 bright.target_min。
- 「太可愛，像親子餐廳」收窄 cute 上限並降低 childish 上限。
- 「剛好」提高該區間 confidence。
- 「今天不想太安靜」只更新本次 session scope。

這是數值偏好更新，不是執行期間重新訓練大型語言模型。

## 9. 行程生成

每套方案必須包含集合時間與地點、2～4 個站點、每站到離時間、站間交通與時間、每站花費、總預算、總長度、營業／活動驗證、公開理由、合作標示與外部連結。

任兩套方案不得超過 50% 相同站點，且至少在主活動類型、氣氛、預算層級、區域、移動密度中有兩項明顯差異。

找不到完美交集時，不先放寬硬限制；可先做雙方都能接受的組合，再做一站偏向某方、另一站平衡另一方的方案。仍無法成立時，要求使用者選擇可放寬的軟條件，並且不揭露誰正在配合誰。

## 10. 私密需求轉譯

Private input 可以影響篩選、排序與重排，但：

- 不可原句回傳。
- 不可顯示輸入者。
- 不可用足以推測輸入者的方式解釋。
- 不可寫入另一半可查詢的歷史紀錄。

Privacy Guard 的流程是：檢查原句／相似片段、檢查身分線索、檢查可反推內容、改寫為共同條件或中性理由，再通過公開欄位 allowlist。

例如禁止輸出「A 不想再陪 B 吃拉麵」或「其中一方不想吃拉麵」，可只輸出「本次提高料理多樣性與新鮮感的權重」或不提供原因。

## 11. 資料模型

| 實體 | 核心欄位 |
|---|---|
| users | id、display_name、created_at |
| couples | id、invite_code、relationship_stage、created_at |
| couple_members | couple_id、user_id、role、joined_at |
| preference_profiles | user_id、category_preferences、hard_no、updated_at |
| adjective_preferences | user_id、adjective、target_min、target_max、importance、confidence、scope、source |
| date_sessions | id、couple_id、mode、status、shared_constraints、finalized_itinerary_id、created_at |
| session_inputs | id、session_id、user_id、raw_text、structured_input、visibility、created_at |
| venues | id、name、category、座標、district、價格、營業時間、duration、booking_url、source |
| venue_attributes | venue_id、attribute、value、confidence、source |
| offers | venue_id、title、description、sponsored、external_url |
| itineraries | id、session_id、title、couple_score、total_cost、total_duration、public_reason、version |
| itinerary_stops | itinerary_id、order_no、venue_id、到離時間、交通、移動時間、費用、locked |
| reactions | user_id、itinerary_id、stop_id、reaction、comment、visibility |
| date_reviews | session_id、user_id、rating、favorite_stop、feedback_text、remember |

## 12. API

| Method | Endpoint | 用途 |
|---|---|---|
| POST | /api/couples | 建立雙人房間 |
| POST | /api/couples/join | 以邀請碼加入 |
| POST | /api/sessions | 建立 Session |
| PUT | /api/sessions/:id/shared | 更新共同條件 |
| POST | /api/sessions/:id/private-inputs | 儲存私密需求 |
| POST | /api/sessions/:id/confirm | 確認雙方輸入 |
| POST | /api/sessions/:id/generate | 產生三套方案 |
| GET | /api/sessions/:id/itineraries | 取得公開方案 |
| POST | /api/itineraries/:id/reactions | 喜歡／拒絕／替換 |
| POST | /api/itineraries/:id/replan | 局部重排 |
| POST | /api/sessions/:id/finalize | 選定最終方案 |
| POST | /api/sessions/:id/reviews | 評分與偏好更新 |

Partner A 不得透過任何 API 取得 Partner B 的 raw_text、structured_input 或可識別拒絕原因。共用行程只包含 public_reason。

## 13. 系統架構

前端是 React、Next.js、TypeScript 的 Responsive Web／PWA；後端是 Next.js Server Routes 的模組化單體；資料庫使用 PostgreSQL；匿名身分、Realtime 與 Row Level Security 可由 Supabase 提供；LLM 使用可輸出固定 JSON 的 API；地點／路線為 optional adapter。

資料流：雙方裝置 → Session／Auth／Validation → 解析器 → 硬限制過濾 → 偏好與雙人計分 → 行程組合 → 程式驗證 → Privacy Guard → 公開回應。

API key 只放伺服器環境變數。外部 API 逾時時改用 curated dataset 與預先建立的交通矩陣。

## 14. 非功能規格

- 公開狀態同步目標 2 秒內。
- 第一輪三套行程目標 15 秒內。
- 局部重排目標 8 秒內。
- 主要流程適用手機直向畫面。
- 生成中要顯示階段狀態與可理解的錯誤。
- 位置資料預設只保留本次 Session。
- 長期偏好寫入前必須取得同意。
- 日誌僅保留 ID、事件類型與錯誤類型，不記錄私密原文。
- 場地只能引用資料庫 venue_id；驗證失敗不得傳前端。

## 15. MVP 驗收

AC-01 至 AC-13 的正式清單位於 PRD.md。至少涵蓋雙裝置加入、公開同步、私密隔離、形容詞解析、三套完整行程、硬限制零違反、雙人適配、局部重排、本次學習、無私密洩漏、合作透明、外部連結與約會後學習。

驗收必須區分 schema／單元／整合／雙裝置／公開畫面／外部服務／Owner 各層證據；其中一層通過不可冒充其他層已完成。

## 16. 待定實作決策

- LLM 供應商、模型、成本與降級。
- 場地資料筆數、來源授權、更新頻率與負責人。
- 匿名身分與邀請碼的期限、撤銷、房間刪除。
- 路線估算與即時資料的時間戳規則。
- 「明顯提高」與隱私反推的固定測試門檻。

