# 進階需求 v2 候選資料

三份原始檔位於 `E:\sideby\.local\phase1\`，包括 180 句 CSV、297 筆原子標註 CSV，以及含 24 個雙人案例的 Excel。它們是同一份候選資料包，沿用各自原始欄位，不覆蓋已凍結的 `hackathon_basic_v1`。

使用 Python 3 標準函式庫，無額外套件：

```powershell
python scripts/validate-advanced-requirements.py
python scripts/validate-advanced-requirements.py --require-approved
python scripts/validate-advanced-requirements.py --self-test
```

第一個入口驗證兩份 CSV 的欄位、ID 關聯、原文證據、數值區間、時間、可見性、追問及審核欄位，成功回 `CANDIDATE_STRUCTURE_VALID`／exit 0。第二個加上審核紀錄條件，待審資料會 exit 1。這些都是候選資料檢查，不是人工核准、需求解析模型或 Runtime 驗收；新增 API 屬性仍需另行實作。

`evidence_summary` 可用 `｜` 連接多個原文片段。`evidence_span` 才是每筆標註的單一原文依據，未提及負例必須為空。未來轉換到 JSONL 時不可把拼接摘要當成單一證據，也不可把 v2 的複合方向或延伸屬性默默壓成舊六屬性。

Excel 的 15 筆 `reference_datetime` 以臺北當地時間數值保存，格式明示 `+08:00`，與 CSV 的時間點一致。CSV 保留 ISO 字串與時區作為機器交換依據。

目前 human reviewer 仍空白、review status 仍待審。人工確實覆核後才能填審核者與核准狀態；核准合成句也不會將來源變成真實訪談。
