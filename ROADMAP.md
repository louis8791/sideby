# ROADMAP｜三天 MVP 施工順序

- 專案：AI 情侶約會共決策 App
- 範圍：只到可展示、可驗證的黑客松 MVP
- 原則：每個里程碑都有可見輸出與 Gate；不列 CRM、商業後台或比賽後藍圖。

## M0｜規格鎖定（已完成）

- [x] 產品說明與 ASCII UI。
- [x] PRD、TDD、ROADMAP、AGENTS。
- [x] 模型與 Hybrid RAG 決策。
- [x] MVP 非範圍與隱私邊界。

**完成條件：**權威文件無重大矛盾，Agent 能在不讀聊天紀錄的情況下接手。

## Day 1｜資料、契約與雙人骨架

### 1A. 專案與 UI 骨架

- [ ] 建立 Next.js + TypeScript + PWA 響應式頁面。
- [ ] 建房、邀請碼、加入房間、在線狀態。
- [ ] 共同條件頁與個人輸入頁。
- [ ] 使用合成 Fixture 完成完整畫面流。

### 1B. 資料與 Schema

- [ ] 建立 Supabase schema、RLS、Realtime channel。
- [ ] 匯入大臺北 MVP 場地／活動資料。
- [ ] 每筆資料補 `retrieval_text`、主觀屬性、來源與信心。
- [ ] 建立 Parser 與 Itinerary JSON Schema。
- [ ] 建立 20 個 retrieval／privacy eval cases。

### 1C. 模型 Parser

- [ ] 串 `gemini-3.8-flash` structured output。
- [ ] 支援程度詞、否定、上下限、scope、visibility。
- [ ] 無效 JSON 一次受控重試，之後明確失敗。
- [ ] Demo 預設阻擋真實私密輸入。

**Day 1 Gate：**兩支手機可加入並同步共同條件；私密輸入不會被另一端取得；Parser fixtures 通過 Schema。

## Day 2｜Hybrid retrieval、雙人排序與行程

### 2A. Retrieval

- [ ] 啟用 pgvector（768 維）與 FTS。
- [ ] 產生場地 embeddings。
- [ ] 完成 SQL 硬篩選。
- [ ] 完成 FTS＋vector＋RRF，保留各類 Top K。

### 2B. 雙人模型

- [ ] 實作 attribute interval fit。
- [ ] 分別計算 A_fit、B_fit。
- [ ] 實作 CoupleScore 與最低一方門檻。
- [ ] 贊助標記不影響分數的測試。

### 2C. 行程組合

- [ ] 以 2–4 站組合完整行程。
- [ ] 計算停留、移動、預算、營業／活動時段。
- [ ] 產生三套差異化方案。
- [ ] 完成 deterministic validator。

**Day 2 Gate：**指定 Fixture 可穩定得到三套合法、多樣行程；12 類硬限制零違反；Retrieval eval 達到事先設定門檻。

## Day 3｜協調學習、隱私與完整 Demo

### 3A. 雙方表態與局部重排

- [ ] Like／Dislike 整套或單一站點。
- [ ] 支援太暗、太貴、太遠、太累等回饋。
- [ ] 鎖定已接受站點，只替換拒絕站點。
- [ ] 重算後續時間、交通與成本。

### 3B. 形容詞敏感度

- [ ] 實作 Session 內門檻／權重更新。
- [ ] 「太暗」後第二輪候選明亮度明顯提高。
- [ ] 只有使用者同意才更新 remembered profile。

### 3C. Privacy Guard 與說明

- [ ] Explainer 只接收核准事實與中性偏好維度。
- [ ] 洩漏檢查失敗時使用模板 fallback。
- [ ] A 無法經 UI、API、Realtime 或 log 取得 B 私密內容。

### 3D. 整體驗收

- [ ] 在兩個真實手機瀏覽器跑完整 E2E。
- [ ] 測試 Gemini 關閉與 Places／Routes 關閉。
- [ ] 確認 Fixture fallback 與錯誤訊息。
- [ ] 確認公開 repo 無 secrets／真實個資。
- [ ] 錄製最短完整展示流程或保留逐步驗收證據。

**Day 3 Gate：**完成 TDD 的 E2E Gate；任何未驗項標為 `skipped`／`owner-only`，不可冒充 pass。

## 黑客松最終交付清單

- [ ] 可公開存取的手機 Web／PWA。
- [ ] 可由兩支手機加入的 Demo Session。
- [ ] 至少一組衝突明顯的 A／B Fixture。
- [ ] 三套完整行程與局部重排。
- [ ] 「明亮／可愛但不要太幼稚」敏感度更新演示。
- [ ] 合作優惠透明標記與外部連結。
- [ ] 自動測試／E2E 證據。
- [ ] README 啟動、環境與驗證說明。

## 下一刀

建立 Next.js 專案與 Supabase migration，先讓兩個瀏覽器加入同一 Session，驗證公開欄位同步、私密欄位不廣播；在此 Gate 通過前，不開始做行程生成。
