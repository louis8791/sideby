# AI Couple Date Planner MVP — ROADMAP

## 交付原則

先鎖定資料、隱私與驗收契約，再逐段接上流程。每個階段都要留下可重跑的證據；文件完成不等於 App 完成。

## Phase 0 — 文件與資料契約

### 交付

- PRD、TDD、AGENTS 與 MVP_SPEC。
- preference-query、itinerary JSON Schema。
- 不含秘密的 venue 與 evaluation fixtures。
- 明確區分 shared、private_session、private_remembered。

### 完成條件

- 文件中的範圍、API、欄位、驗收標準互相一致。
- schema 可解析，fixture 可通過基本結構檢查。
- Product/Data/Model/Runtime/No-Fake-Success/State-Boundary 契約已寫入。

## Phase 1 — 雙人 Session 基礎

### 交付

- 匿名裝置身分。
- 建立房間、邀請碼、加入房間與 Session 狀態。
- 公開共同條件與雙方完成狀態。
- Realtime 同步與重連處理。

### 完成條件

- 兩個獨立瀏覽器能加入同一房間。
- 公開欄位能同步，私密欄位尚未接入共用事件。

## Phase 2 — 私密輸入與結構化解析

### 交付

- 私密文字、標籤與 visibility。
- Natural Language Parser 固定輸出。
- 欄位隔離、日誌過濾與 Privacy Guard 初版。

### 完成條件

- A 無法讀取 B 的私密資料。
- 示例「明亮、可愛但不要太幼稚、不要走太多路」能轉成可計算查詢。
- 非法或不完整模型輸出會 fail closed。

## Phase 3 — 推薦與三套行程

### 交付

- curated venue dataset 與交通矩陣。
- 硬限制過濾。
- 個人形容詞敏感度與雙人公平計分。
- 三套多站式行程、時間、成本、公開理由與合作標示。

### 完成條件

- 不違反硬限制。
- 三套方案具實質差異。
- LLM 不可創造資料；生成後仍通過程式驗證。

## Phase 4 — 局部重排與回饋學習

### 交付

- 整套／單站 like、dislike、replace。
- locked stop 與 Local Replanner。
- 本次回饋即時更新。
- 約會後經同意更新長期偏好。

### 完成條件

- 拒絕一站後已接受站點不被任意重做。
- 「太暗」等回饋讓下一輪相關屬性達到固定可測門檻。
- 長期偏好未經同意不會更新。

## Phase 5 — 真實雙裝置展示與收口

### 交付

- 手機直向流程。
- 生成中狀態、錯誤與降級 UI。
- 商家詳情與外部訂位／購票跳轉。
- 對抗性隱私測試、效能量測與展示紀錄。

### 完成條件

- 兩支真實裝置完成主流程。
- 外部 API 失效時核心 Demo 仍可完成。
- 文件、程式、測試、Runtime 與 Owner 驗收狀態分開回報。

## 明確不排程項目

CRM、商家後台、App 內付款、訂閱、社群、遊戲化、驚喜約會、住宿／SPA／酒吧／過夜、全臺資料、模型微調與大規模 RAG。

