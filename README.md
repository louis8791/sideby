# AI 情侶約會共決策 App

> 讓兩個人分別說出想要的感覺、限制與地雷，由 AI 在不暴露私密需求的前提下，排出三套可直接執行的完整約會行程。

## 專案狀態

目前是 **MVP 文件與技術基線**：產品範圍、ASCII UI、RAG／模型決策、資料契約、系統架構與驗收 Gate 已確定；尚未包含可執行 App。任何 Agent 不得把「文件已完成」描述成「產品已完成」。

## MVP 只做什麼

- 大臺北地區。
- Partner A、Partner B 兩支手機加入同一約會 Session。
- 共同設定日期、時間、集合地點、預算與交通方式。
- 個別輸入共享或私密需求。
- 理解「明亮、可愛但不要太幼稚、浪漫但不要太正式」等主觀形容詞。
- 從真實、預先整理的場地／活動資料中檢索候選。
- 先做硬限制過濾，再計算雙方適配度。
- 產生三套 2–4 站的完整行程。
- 雙方表態後只局部替換不合適的站點。
- 合作優惠明確標示，可外連訂位或購票。
- 約會後回饋可更新個人形容詞敏感度。

## 明確不做

CRM、商家後台、廣告投放後台、App 內付款、訂閱、情侶社群、即時聊天、遊戲化、住宿／SPA／酒吧／過夜行程、全臺擴張、模型微調平台，以及 MVP 以外的產品藍圖。

## 核心技術決策

這不是「把所有文字塞進向量庫，讓 LLM 猜答案」的純 RAG，而是 **Hybrid Retrieval-Augmented Recommendation**：

```text
自然語言
  ↓ Gemini 3.8 Flash（固定 JSON Schema）
結構化硬限制＋軟偏好＋形容詞區間
  ↓
SQL 硬篩選（時間／預算／過敏／交通／Hard No）
  ↓
Postgres FTS 關鍵字召回 ＋ pgvector 語意召回
  ↓ RRF 合併候選
A／B 個別適配分數
  ↓
CoupleScore（保護較不滿意的一方）
  ↓
程式化路線組合與二次驗證
  ↓
Gemini 只產生經 Privacy Guard 檢查的說明文字
```

- 解析／說明模型：`gemini-3.8-flash`
- Embedding：`gemini-embedding-2`，`768` 維
- 資料庫：Supabase PostgreSQL + `pgvector` + Full Text Search
- MVP 不做大型模型微調；形容詞敏感度以可解釋的區間、權重與回饋更新。
- 免費 Gemini 模式只允許合成／示範資料；真實私密需求必須使用具有適當資料處理條件的付費模式。

完整決策見 [`docs/MODEL_RAG.md`](docs/MODEL_RAG.md)。

## 文件權威順序

1. [`AGENTS.md`](AGENTS.md)
2. [`PRD.md`](PRD.md)
3. [`TDD.md`](TDD.md)
4. [`ROADMAP.md`](ROADMAP.md)
5. [`docs/MVP_SPEC.md`](docs/MVP_SPEC.md)
6. [`docs/MODEL_RAG.md`](docs/MODEL_RAG.md)

若文件衝突，以上方文件為準；但任何縮減使用者已確認的產品需求，都必須在 PRD 中留下明確決策。

## 目前可驗證內容

```bash
# 確認必要文件存在
for f in AGENTS.md PRD.md TDD.md ROADMAP.md docs/MVP_SPEC.md docs/MODEL_RAG.md; do
  test -s "$f" || exit 1
done

# 確認沒有把機密寫進 repo
git grep -nE '(GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY)=[^[:space:]<]+' -- ':!*.example' && exit 1 || true
```

實際 App 建立後，啟動與測試命令必須同步更新到本檔與 `TDD.md`，不得保留假指令。
