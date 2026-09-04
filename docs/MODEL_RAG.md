# AI Couple Date Planner — Model / RAG Boundary

## 文件目的

本文件界定 MVP 中 AI、確定性程式、資料集與隱私層各自負責的事情。名稱保留 RAG，是為了明確說明本 MVP 不把 RAG 當成必要能力，也不把資料檢索能力誤報成模型學習。

## MVP 模型契約

### LLM 可以做

- 把 Partner A 或 B 的自然語言轉為固定的 preference-query JSON。
- 解析形容詞、程度、上下限、否定、情境、本次／長期範圍與 visibility。
- 將已決定的公開結果改寫為中性、不可反推來源的 public_reason。

### LLM 不可以做

- 決定是否忽略預算、時間、交通、健康、過敏、Hard No 或營業限制。
- 創造商家、價格、營業時間、優惠、票券狀態或外部連結。
- 直接排序並把未驗證的結果送到前端。
- 把私密原句、輸入者身分或可反推線索放進共同輸出。
- 宣稱模型權重已訓練、已具備預測能力或「學會了」使用者，除非有相應實驗證據。

## 確定性程式負責

1. Hard Constraint Filter：計分前排除不合格候選。
2. Adjective Sensitivity Engine：維護區間、重要性、信心與 scope。
3. Couple Scoring Engine：計算 UserFit、CoupleScore 與公平門檻。
4. Itinerary Composer：組合站點、順序、時間、交通與成本。
5. Local Replanner：保留 locked stops，替換必要衝突部分。
6. Validator：驗證 schema、資料來源、營業時段、預算、交通與方案差異。
7. Privacy Guard：檢查共同輸出並套用欄位 allowlist。

## 資料與檢索邊界

### MVP 基線

- 由團隊整理的大臺北真實場地／活動資料集。
- 每筆資料有穩定 venue_id、類型、座標、價格、營業／活動時段、建議停留、主觀屬性與外部連結。
- 預先建立交通時間矩陣或合理估算。
- 合作優惠可使用模擬資料，但必須標示為合作或示例。

### 外部 API

Places、Routes、即時營業資訊與地點詳情可透過 adapter 補充。API 失效、逾時、無配額或回傳不完整時，核心 Demo 回退到本地資料；介面標示資料時間與「無法確認」狀態。

### RAG 不在 MVP

MVP 不建立從大量評論、照片或私密對話自動產生的向量資料庫，不用 RAG 取代 curated dataset，也不把舊使用者對話當成可被另一對情侶查詢的知識。

若未來要加入 RAG，至少要另行定義資料授權、更新與刪除、租戶隔離、來源引用、個資去除、提示注入防護、召回評測與 Owner approval；這些不屬於目前 MVP。

## 輸入與輸出契約

### Preference query

輸入包含 raw_text、session context、既有偏好與 visibility；輸出包含：

- hard constraints
- desired／avoid preferences
- adjective attribute、min／max、importance
- scope、source 與 parser confidence

原始文字與結構化結果必須留在輸入者有權限的邊界內；可公開 API 不回傳它們。

### Itinerary

輸出只能引用資料庫中存在的 venue_id。每套方案包含 2～4 站、時間軸、移動、費用、couple_score、公開理由與合作標示；完整結構見 schemas/itinerary.schema.json。

## 隱私防護

公開說明產生後，依序檢查：

1. 是否含私密原句或高相似片段。
2. 是否出現 A／B、輸入者或單方指向。
3. 是否可由排除內容反推某人的隱藏需求。
4. 是否只保留共同條件與中性結果。
5. 是否通過輸出 schema、欄位 allowlist、日誌與 Realtime policy。

「只叫模型不要洩漏」不算完整防護；資料列權限、API response shaping、共用狀態隔離與測試都必須存在。

## 形容詞敏感度

MVP 使用可檢查的區間與權重，而非重新訓練 LLM：

- target_min、target_max：理想區間。
- importance：本次或長期的重要性。
- confidence：系統對判斷的信心。
- scope：session 或 long_term。
- source：問卷、對話、選擇或回饋。

「太暗」提高 bright 下限；「太幼稚」降低 childish 上限；「剛好」提高區間信心。long_term 只有在使用者明確同意時更新。

## 評測資料與指標

data/fixtures/eval-cases.example.json 提供不含秘密的範例案例。實作至少要能評估：

- Parse：形容詞、否定、上下限與 scope 是否正確。
- Constraint：硬限制違反數必須為 0。
- Itinerary：三套方案皆為 2～4 站且具有差異。
- Fairness：較低一方不低於最低門檻。
- Replan：locked stops 保留率為 100%。
- Privacy：公開輸出不得含原句、來源身分或可反推線索。
- Learning：固定回饋後，相關屬性達到預先定義的可測變化。

單一 fixture 通過不代表模型在真實裝置、真實資料、外部 API 或長期使用上已被驗證。

## 證據邊界

JSON schema 通過只證明格式；離線評測只證明案例；本地生成只證明開發環境；雙裝置測試才涵蓋部分 Runtime；公開畫面與 Owner sign-off 仍須另外驗收。回報時不得把其中一層升格為完整產品能力。

