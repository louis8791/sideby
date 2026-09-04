# 模型與 Hybrid RAG 決策

- 決策日期：2026-09-04
- 範圍：只服務本次 MVP
- 決策：採 **Hybrid Retrieval-Augmented Recommendation**，不採純 RAG，也不在 MVP 微調大型模型。

## 1. 推薦組合

| 層 | 選擇 | 理由 |
|---|---|---|
| 自然語言 Parser | `gemini-3.8-flash` | 穩定 Flash 模型、支援 Structured Output；適合把主觀中文轉固定 JSON |
| 安全說明文字 | `gemini-3.8-flash`＋模板 fallback | 只把已驗證事實寫成人話，不參與真實性判斷 |
| Embedding | `gemini-embedding-2`，768 維 | 支援中文與檢索；可指定 768 維，MVP 儲存／速度較平衡 |
| Vector DB | Supabase PostgreSQL + pgvector | 和既有 Auth／RLS／Realtime 放同一資料庫，減少三天整合成本 |
| 精確搜尋 | PostgreSQL FTS／人工 keywords | 捕捉料理、區域、活動類型與明確詞 |
| 排名 | TypeScript deterministic scorer | 可測、可解釋，保護兩人中較不滿意的一方 |
| Rerank | MVP 不另加 | 資料量小，先靠屬性計分與 CoupleScore，避免第三模型與延遲 |
| 學習 | 個人形容詞區間／權重更新 | 「太暗」等回饋立即可見，無需微調大模型 |

## 2. 為什麼不能只做純 RAG

向量相似度能找出語意接近的場所，但不能可靠保證：

- 還在營業。
- 總價未超過上限。
- 符合過敏、無障礙或 Hard No。
- 路線時間可行。
- A、B 都至少能接受。
- 合作商家沒有因付費冒充最適合。

因此必須是：

```text
LLM 解析，不裁決
SQL 先排除，不妥協
RAG 找候選，不保證答案
程式計分，不靠直覺
路線驗證，不相信生成文字
LLM 最後解釋，不創造事實
```

## 3. RAG Corpus

每一個可去的場地／活動是一筆可驗證紀錄：

```json
{
  "venue_id": "venue_023",
  "name": "示例咖啡廳",
  "category": "cafe",
  "district": "中山區",
  "facts": {
    "price_per_person": [250, 450],
    "typical_duration_min": 75,
    "reservation_status": "not_required"
  },
  "retrieval_text": "大片自然採光、木質空間、低至中噪音，適合聊天；可愛感來自小型擺設，不是卡通或親子主題。",
  "attributes": {
    "bright": 0.88,
    "cute": 0.58,
    "childish": 0.18,
    "quiet": 0.72,
    "romantic": 0.55,
    "formal": 0.25,
    "relaxing": 0.78
  },
  "attribute_source": "team_annotation",
  "attribute_confidence": 0.8
}
```

主觀屬性不是客觀真理，必須記錄來源與信心。

## 4. Query Contract

輸入「想找明亮一點的咖啡廳，可愛但不要太幼稚，今天不要走太多路」後，Parser 應輸出：

```json
{
  "hard_constraints": {
    "max_total_budget": 1500,
    "latest_end_at": "22:00",
    "transport_modes": ["walk", "mrt"],
    "hard_no": []
  },
  "preferences": [
    {"attribute": "bright", "target_min": 0.70, "importance": 0.85},
    {"attribute": "cute", "target_min": 0.45, "target_max": 0.75, "importance": 0.65},
    {"attribute": "childish", "target_max": 0.30, "importance": 0.90},
    {"attribute": "walking_intensity", "target_max": 0.35, "importance": 0.85}
  ],
  "retrieval_query": "自然採光、帶設計感但不幼稚、低步行量的咖啡廳與約會活動",
  "unknown_terms": []
}
```

## 5. 檢索順序

```text
1. SQL hard filter
2. FTS exact retrieval
3. Vector semantic retrieval
4. RRF fusion
5. A/B individual attribute fit
6. CoupleScore
7. Route composition
8. Deterministic validation
9. Privacy-safe explanation
```

RRF 可先採簡單形式：

```text
RRF(d) = 1 / (k + rank_fts(d)) + 1 / (k + rank_vector(d))
k = 60
```

RRF 只合併召回，不替代最終 CoupleScore。

## 6. 形容詞「訓練」的 MVP 定義

MVP 不需要微調 Gemini。真正需要學的是「這個人怎麼使用形容詞」。

每個人保存：

```text
attribute
理想下限／上限
重要性
信心
本次／長期
來源
```

回饋更新例：

- 太暗：`bright.min += 0.10`
- 有點暗：`bright.min += 0.05`
- 太可愛：`cute.max -= 0.10`
- 像親子餐廳：`childish.max -= 0.15`
- 剛好：把目前場地值附近設成偏好中心，信心增加

這種做法可在 Demo 中直接呈現前後差異，也能寫單元測試；等同於輕量線上偏好學習，而不是行銷式宣稱「模型越用越懂」卻無法驗證。

## 7. 隱私決策

本產品處理伴侶可能不願公開的文字。Google Gemini API 的 Unpaid Services 條款指出，未付費服務的輸入／輸出可能用於改善產品，且可能由人工審查，因此：

- Demo 免費額度只使用團隊撰寫的合成資料。
- `ALLOW_REAL_PRIVATE_INPUT=false` 為預設。
- 真實使用者測試需使用具有合適資料處理條件的付費服務設定，並取得告知與同意。
- 原始私密文字不放入共享向量庫；RAG 場地資料和個人私密資料分庫／分表、受 RLS 保護。
- Embedding 或生成 API 失效時，不以本機 log 保存原文來「方便除錯」。

## 8. Fallback

### Parser 失敗

- 固定 Schema 重試一次。
- 仍失敗：顯示無法理解，要求使用者改用勾選項目；不自行猜。

### Embedding 失敗

- 退回 SQL＋人工 keywords／FTS。
- UI 標示語意搜尋暫時不可用。

### Explainer 失敗

- 使用模板：
  - 「符合共同時間與預算。」
  - 「行程移動量較低。」
  - 「包含雙方可接受的餐飲與活動。」
- 不輸出任何私密原因。

### Routes 失敗

- 使用預先建立的交通矩陣。
- 無可靠時間資料時，該方案不得標示為可立即出發。

## 9. MVP Eval Set

最低 20 例，涵蓋：

- 同義：明亮／採光好／不陰暗。
- 程度：有點可愛／很可愛／不要太可愛。
- 否定：不要幼稚、不要網美感。
- 複合：安靜但不要死氣沉沉。
- 情境：今天很累，不想走路。
- 雙人衝突：A 要拍照，B 要吃飽。
- 私密：A 不想再配合吃拉麵，但不得讓 B 知道。
- 無解：所有候選都超過時間或預算。

最低 Gate：

- Hard constraint violation = 0。
- Privacy leakage = 0。
- 期望候選 Recall@10 達團隊事先設定門檻。
- 人工 pairwise preference accuracy 可重跑並保存 Fixture。

## 10. 官方參考

- Gemini 3.8 Flash：<https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash>
- Gemini Structured Outputs：<https://ai.google.dev/gemini-api/docs/structured-output>
- Gemini Embeddings：<https://ai.google.dev/gemini-api/docs/embeddings>
- Gemini API Additional Terms：<https://ai.google.dev/gemini-api/terms>
- Supabase Hybrid Search：<https://supabase.com/docs/guides/ai/hybrid-search>
- Supabase Semantic Search／pgvector：<https://supabase.com/docs/guides/ai/semantic-search>
- Supabase RAG with permissions：<https://supabase.com/docs/guides/ai/rag-with-permissions>
