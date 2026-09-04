# TDD｜Technical Design & Test Design

- 專案：AI 情侶約會共決策 App MVP
- 狀態：Approved technical baseline
- 更新日期：2026-09-04

> 本檔同時是技術設計與測試設計。任何模組若沒有可驗證的輸入、輸出與失敗狀態，不得視為完成。

## 1. 架構原則

- 三天 MVP 採模組化單體，不拆微服務。
- RAG 只負責從既有資料找候選；硬限制與最終有效性由程式負責。
- A、B 各自計分，不能把兩人原始輸入合成一段文字後交給 LLM 隨意判斷。
- 場地事實、主觀屬性、私密需求、合作標記分層保存。
- 最終行程只能引用資料庫既有 `venue_id`。
- 外部 API 與模型失敗時清楚失敗；Fixture 模式可獨立完成 Demo。

## 2. 系統架構

```text
┌─────────────────┐                         ┌─────────────────┐
│ Partner A PWA   │                         │ Partner B PWA   │
└────────┬────────┘                         └────────┬────────┘
         │ HTTPS / Supabase Realtime                 │
         └──────────────────┬────────────────────────┘
                            ▼
┌──────────────────────────────────────────────────────────────┐
│ Next.js Application（UI + Server Routes，模組化單體）          │
│                                                              │
│ Session/Auth ─ Parser ─ Privacy Boundary                     │
│                    │                                         │
│                    ▼                                         │
│ SQL Hard Filter → Hybrid Retriever → A/B Fit → CoupleScore   │
│                                            │                 │
│                                            ▼                 │
│                              Itinerary Composer               │
│                                            │                 │
│                         Deterministic Validator               │
│                                            │                 │
│                              Privacy-safe Explainer           │
│                                            │                 │
│                                  Local Replanner              │
└───────────────────────┬────────────────────┬─────────────────┘
                        │                    │
                        ▼                    ▼
       ┌────────────────────────┐   ┌─────────────────────────┐
       │ Supabase PostgreSQL    │   │ Google Gemini API       │
       │ Auth / RLS / Realtime  │   │ 3.8 Flash / Embedding 2 │
       │ FTS / pgvector         │   └─────────────────────────┘
       └────────────┬───────────┘
                    │ optional runtime facts
                    ▼
          Places / Routes Adapter
```

## 3. Model Contract

| 任務 | 模型／方法 | 允許做的事 | 不允許做的事 |
|---|---|---|---|
| 自然語言解析 | `gemini-3.8-flash` | 固定 JSON Schema：限制、形容詞、範圍、可見性 | 決定是否忽略硬限制 |
| Embedding | `gemini-embedding-2`, 768 維 | 產生場地與查詢語意向量 | 作為唯一排名依據 |
| 形容詞敏感度 | 程式化區間＋線上權重更新 | 學習「太暗／太可愛／剛好」 | 在執行中微調大模型 |
| 候選融合 | Postgres FTS + pgvector + RRF | 合併精確詞與語意候選 | 把不合硬限制者救回 |
| 雙人排序 | TypeScript deterministic scorer | 分算 A、B；保護較低一方 | 加入贊助費用 |
| 行程編排 | Beam search／受限組合器 | 2–4 站、時間／價格／路線可驗 | 虛構站點或營業時間 |
| 說明文字 | `gemini-3.8-flash` 或模板 fallback | 只引用後端核准事實 | 揭露私密原文／輸入者 |

建議環境變數：

```dotenv
AI_PROVIDER=google
GENERATION_MODEL=gemini-3.8-flash
EMBEDDING_MODEL=gemini-embedding-2
EMBEDDING_DIM=768
DEMO_DATA_MODE=fixture
ALLOW_REAL_PRIVATE_INPUT=false
```

`ALLOW_REAL_PRIVATE_INPUT=false` 時，UI 必須顯示「僅使用示範資料」，並阻擋真實私密文字送往模型。

## 4. RAG／推薦資料流

### 4.1 Ingestion

每個場地是一個獨立檢索單位，不把多家店合成長文件。

```text
venue facts
+ team-authored retrieval_text
+ adjective attributes (0–1, source, confidence)
        ↓
gemini-embedding-2 (768)
        ↓
venues.embedding + FTS tsvector
```

建議 `retrieval_text`：

```text
名稱：暮光咖啡。類型：咖啡廳。區域：中山。
特徵：大片自然採光、木質空間、低至中噪音、適合聊天；
可愛感來自小型擺設，不是卡通或親子主題；餐點份量中等。
```

不得直接把 Google 評論／照片抓下來作訓練語料。

### 4.2 Query parsing

Parser 輸入分開傳入：

- 共同條件。
- A 個人輸入與可見性。
- B 個人輸入與可見性。
- 已確認的個人偏好區間。

Parser 輸出符合 `schemas/preference-query.schema.json`。

### 4.3 Hard filter

SQL 先排除：

- 超過絕對預算。
- 營業／活動時間不合。
- 地區、交通、最大移動時間不合。
- 過敏、飲食、健康、無障礙、年齡不合。
- 任一方 Hard No。

被排除資料不進向量檢索後續排名。

### 4.4 Hybrid retrieval

對硬篩選後資料執行：

1. Postgres FTS：精確分類、區域、料理、關鍵詞。
2. pgvector：形容詞與語意相似度。
3. Reciprocal Rank Fusion 合併兩份排名。
4. 每類站點保留 Top K（建議 20），交給個人適配計分。

MVP 不加獨立 cross-encoder reranker，以減少延遲與故障面。

### 4.5 Individual fit

```text
UserFit(u, v)
= Σ(attribute_fit × importance × confidence)
  / Σ(importance × confidence)
```

- 理想區間內：1。
- 超出區間：依距離線性／分段遞減。
- 強烈軟排斥：大幅扣分。
- Hard No：前一步已排除。

### 4.6 CoupleScore

```text
CoupleScore
= 0.45 × min(A_fit, B_fit)
+ 0.25 × mean(A_fit, B_fit)
+ 0.15 × session_context_fit
+ 0.10 × route_coherence
+ 0.05 × novelty
```

合作／贊助完全不進分數。

### 4.7 Itinerary composition

輸入為各類 Top K 場地，組合 2–4 站：

- 依時間窗產生合法順序。
- 計入停留與交通時間。
- 計入各站與總花費。
- 再次查驗營業／活動時段。
- 產生至少三套，任兩套相同站點不超過 50%。
- 若不足三套，回傳可行套數與可放寬軟條件，不造假。

### 4.8 Privacy-safe explanation

送往 Explainer 的 context 只能包含：

- 已核准的行程事實。
- 可公開的共同偏好。
- 經 Privacy Boundary 轉成中性維度的理由，例如 `increase_variety=true`。

不得傳入私密原句、輸入者或對方可推知的罕見細節。模型輸出再經規則掃描；失敗時使用固定模板。

## 5. 形容詞敏感度更新

### 5.1 狀態

```ts
type AdjectivePreference = {
  attribute: string;
  targetMin: number | null;
  targetMax: number | null;
  importance: number;
  confidence: number;
  scope: 'session' | 'remembered';
  source: 'onboarding' | 'utterance' | 'reaction' | 'review';
};
```

### 5.2 MVP 更新規則

以可重現的規則更新，而不是重新訓練 LLM：

```text
「太暗」       → bright.target_min += 0.10
「有點暗」     → bright.target_min += 0.05
「太可愛」     → cute.target_max -= 0.10
「像親子餐廳」 → childish.target_max -= 0.15
「剛好」       → 將候選值附近設為偏好中心，confidence += 0.10
```

所有值 clamp 到 0–1；Session 回饋預設只改本次，使用者明確同意後才合併到 remembered profile。

## 6. 核心資料表

| 表 | 主要用途 | 關鍵隱私規則 |
|---|---|---|
| `users` | 匿名／正式使用者 | 只本人可讀基本資料 |
| `couples` | 情侶關係 | 僅成員可讀 |
| `couple_members` | A／B membership | RLS |
| `date_sessions` | 一次約會規劃 | 共同欄位雙方可讀 |
| `session_inputs` | 個人輸入 | 私密列只有本人＋Server 可讀 |
| `preference_profiles` | 類別與長期偏好 | 只有本人可讀原始設定 |
| `adjective_preferences` | 形容詞區間 | 共同 API 不回傳所有者明細 |
| `venues` | 場地事實＋retrieval text＋embedding | 公開／團隊資料 |
| `venue_attributes` | 0–1 主觀屬性、來源、信心 | 不冒充客觀事實 |
| `offers` | 合作／模擬優惠 | `is_simulated` 必填 |
| `itineraries` | 候選／最終方案 | 僅 Session 成員可讀 |
| `itinerary_stops` | 站點、時間、交通、價格 | 必須引用 venue_id |
| `reactions` | 雙方對方案／站點反應 | 個人原文可設 private |
| `date_reviews` | 約會後回饋 | 本人同意才更新 remembered |

向量欄位：

```sql
embedding vector(768)
```

全文欄位：

```sql
fts tsvector generated always as (
  to_tsvector('simple', coalesce(retrieval_text, ''))
) stored
```

中文斷詞品質不足時，MVP 可另存人工關鍵詞陣列並與 FTS 結果融合；不得因此取消精確詞召回。

## 7. API 邊界

建議端點：

```text
POST   /api/sessions
POST   /api/sessions/:id/join
PATCH  /api/sessions/:id/shared-constraints
POST   /api/sessions/:id/private-inputs
POST   /api/sessions/:id/generate
POST   /api/sessions/:id/reactions
POST   /api/sessions/:id/replan
POST   /api/sessions/:id/finalize
POST   /api/sessions/:id/reviews
GET    /api/sessions/:id/public-state
```

### 私密 API 規則

- `public-state` 永不含私密原文、private attribute owner 或內部分數明細。
- Realtime 只廣播共同條件、在線狀態、公開反應與已清理行程。
- Server log 只記 request id、狀態碼、耗時、錯誤類型；不記 raw private input。
- 所有寫入驗證 Session membership。

## 8. JSON Schema

- `schemas/preference-query.schema.json`：Parser 結果。
- `schemas/itinerary.schema.json`：最終行程。
- Schema 失敗不得自動容錯成任意文字；最多重試一次，之後回報明確錯誤。

## 9. State Boundary

| 狀態 | 儲存位置 | 可否進 Git | 可否送免費模型 |
|---|---|---:|---:|
| Unit／E2E fixture | `data/fixtures` | 是 | 是 |
| 公開 Demo 場地 | DB seed／公開資料檔 | 是，確認授權與無個資 | 是 |
| Local scratch | `.local/` | 否 | 視內容，預設否 |
| 真實私密輸入 | 正式 DB 私密列 | 否 | 否 |
| API keys | Server secrets | 否 | 不適用 |

## 10. 錯誤契約

| Code | 狀況 | UI 行為 |
|---|---|---|
| `MODEL_UNAVAILABLE` | 模型 API 失敗 | 顯示無法解析，允許重試，不造假 |
| `MODEL_OUTPUT_INVALID` | JSON 不合 Schema | 一次受控重試，仍失敗則中止 |
| `NO_FEASIBLE_VENUES` | 硬篩選後無候選 | 請使用者選可放寬軟條件 |
| `INSUFFICIENT_ITINERARIES` | 少於三套合法行程 | 顯示實際套數，不複製假方案 |
| `ROUTE_DATA_UNAVAILABLE` | 路線 API 不可用 | Fixture／交通矩陣；無備援則標 skipped |
| `PRIVATE_INPUT_NOT_ALLOWED` | 免費模式輸入真實私密文字 | 阻擋送出並說明 Demo 限制 |
| `PRIVACY_GUARD_FAILED` | 說明可能洩漏 | 改用固定中性模板 |

## 11. 測試策略

### 11.1 Unit

- Parser schema：否定、程度詞、上下限、scope、visibility。
- Hard filter：12 類硬限制，各有通過／失敗案例。
- Attribute fit：區間內、邊界、過度、不足。
- CoupleScore：A=1/B=0 不得成為高分。
- Sponsor：切換贊助標記不改 CoupleScore。
- Sensitivity update：「太暗」後門檻增加且 clamp。
- Privacy sanitization：原句、人名、輸入者線索不得出現。
- Itinerary validator：時間、營業、交通與價格。

### 11.2 Retrieval eval

至少建立 20 個人工期望案例，包含：

- 明亮但不要太幼稚。
- 浪漫但不要太正式。
- 安靜但不要死氣沉沉。
- 可拍照但不要太網美。
- 有趣但不要累、不要走太多路。
- A 想可愛，B 想吃飽。

指標：

- Hard constraint violation：0。
- Recall@10：期望場地至少一個進 Top 10。
- Pairwise accuracy：人工認為較合適者排名較高。
- Privacy leakage：0。

### 11.3 Integration

1. Parser → Hard Filter → Retrieval → Score。
2. Score → Composer → Validator → Explainer。
3. Reaction → Sensitivity Update → Local Replan。
4. RLS／API：A 不得查到 B 私密列。
5. Realtime：共同欄位同步，私密欄位不廣播。

### 11.4 E2E Gate

```text
手機 A 建房
→ 手機 B 加入
→ 共同條件同步
→ A/B 各填私密需求
→ 產生 3 套合法行程
→ B 拒絕其中一站並說「太暗」
→ 保留其他站、提高明亮門檻、局部重排
→ 共同理由不洩漏私密資訊
→ 選定並開啟外部連結
```

## 12. Runtime Acceptance

- Vercel URL 以兩個不同瀏覽器 Session 操作。
- 重新整理後，共同 Session 與已產生方案仍存在。
- 斷線重連不廣播私密資料。
- Gemini／Places 任一關閉時，錯誤狀態與 Fixture fallback 符合契約。
- `.env.example` 完整，但公開 repo 無真實金鑰。
- E2E Gate 有可重跑命令與輸出；建立測試框架後補入本檔，不得編造。

## 13. 完成狀態語彙

- `pass`：已執行，有證據。
- `fail`：已執行，不通過。
- `skipped`：未執行並說明原因。
- `owner-only`：需帳號／金鑰／裝置。
- `blocked`：缺必要前置。

目前本 repo 僅文件基線；程式與 Runtime Gate 尚未實作，狀態不是 pass。
