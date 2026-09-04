# Sideby

> 一款把兩個人的喜好、限制與不方便直說的需求，整理成三套可直接出發的完整約會行程的雙人共決策產品。

本 repository 是 Sideby AI 情侶約會共決策 App 的 MVP 文件與資料契約基線。它定義要做什麼、如何驗證，以及哪些事情刻意不做；目前不宣稱已完成可上線的 App。

## 版本與提交紀錄

- `main` 是目前唯一工作分支，後續修改以此分支的文件為基準。
- [原始交付版 `archive/delivery-mvp-v1`](https://github.com/louis8791/sideby/tree/archive/delivery-mvp-v1) 以 Git tag 保留完整內容與原始 commit，僅供歷史比對。
- 原始交付版與 `main` 是兩條獨立建立的歷史，內容並不相同。例如原始版指定模型與 Hybrid RAG，現行版改為模型責任與資料來源邊界；本次整理未合併或改寫這些產品／技術決策。
- 最新修改可查看 [main 提交紀錄](https://github.com/louis8791/sideby/commits/main/)。

| 既有 commit | 內容 | 所在版本 |
|---|---|---|
| [`4b297ed`](https://github.com/louis8791/sideby/commit/4b297ed3fb21953df6b1a9d986d91ef3e37e1595) | 建立 MVP 文件基線 | main 歷史 |
| [`eea56cc`](https://github.com/louis8791/sideby/commit/eea56cc9f0832fa06c99da3970add20b0c1a4132) | 專案更名為 Sideby | main 歷史 |
| [`96b7017`](https://github.com/louis8791/sideby/commit/96b70171355e431b5532f95e52946b2a8d234581) | 原始交付包的 MVP 文件 | 封存標籤 |

## 產品要解決的問題

情侶通常不是找不到地點，而是難以在以下條件同時成立時快速做決定：

- 兩人的偏好不同，且其中一方可能不方便直接說出完整需求。
- 「明亮、可愛、浪漫、放鬆」等形容詞對不同人的標準不同。
- 找到地點後仍要處理時間、營業狀態、交通、預算與行程順序。
- 一方拒絕一站時，不應讓整份行程全部重做。

MVP 的核心承諾是：雙方分別輸入需求，AI 只把可安全公開的共同結果呈現給兩人，再產生三套多站式、經硬限制驗證的行程。

## MVP 範圍

- 臺北市與新北市，以捷運及大眾運輸可合理到達區域為主。
- 現在就出發、規劃未來兩種模式。
- 匿名裝置身分、邀請碼、雙人 Session 與即時公開狀態。
- 公開共同條件與每人可選的 shared、private_session、private_remembered 輸入。
- 自然語言偏好解析、硬限制過濾、雙人公平計分、三套完整行程與局部重排。
- 約會後在取得同意後更新個人偏好。

## 明確不包含

CRM、商家後台、App 內付款、訂閱、社群、即時聊天、遊戲化、驚喜約會、住宿、SPA、酒吧、過夜、長途旅遊、全臺擴張、大模型微調平台，以及依賴即時大量評論或照片訓練的 RAG 系統。

## 文件入口

| 文件 | 用途 |
|---|---|
| [PRD.md](PRD.md) | 使用者、問題、範圍、功能需求與產品驗收 |
| [TDD.md](TDD.md) | 架構、資料、API、模型邊界與測試策略 |
| [ROADMAP.md](ROADMAP.md) | 從文件基線到可展示 MVP 的分階段交付 |
| [AGENTS.md](AGENTS.md) | 本專案的執行規則與不可越過的契約 |
| [docs/MVP_SPEC.md](docs/MVP_SPEC.md) | 完整 MVP 產品與系統規格 |
| [docs/MODEL_RAG.md](docs/MODEL_RAG.md) | 模型、資料來源、隱私與 RAG 邊界 |
| [schemas/](schemas/) | LLM 結構化輸出與行程輸出的 JSON Schema |
| [data/fixtures/](data/fixtures/) | 不含秘密的範例場地與評測案例 |

## 重要證據邊界

本 repo 的 schema 通過、文件完整或離線 fixture 測試，只能證明文件與靜態契約層級。它們不等於兩支真實手機、API 權限隔離、公開畫面隱私、外部訂位、即時資料正確或 Owner 驗收已完成。

核心 Demo 必須能使用預先整理的範例資料與交通矩陣完成；地點／路線外部 API 只能是可替換的補充來源。合作優惠若為模擬資料，必須在 UI 清楚標示。

## 隱私底線

私密原文不得進入另一半可取得的 API、Realtime 訊息、共用快取、共用歷史或一般伺服器日誌。共同推薦理由只能描述安全的共同條件或中性結果，不得揭露輸入者或可反推出私密內容的原因。
