# 商业化计划书 · 本地版

本目录为**离线可用**的本地副本，无需联网即可打开。

## 文件说明

| 文件 | 用途 |
|------|------|
| **`商业化启动计划书-v1.7-本地版.pdf`** | **推荐**：纲要 + 全文 + 费用明细；不含合规章节；人民币报价 |
| **`全项目计划书-v2.0-本地版.pdf`** | **推荐 PDF**：含甘特图 · 三期 10 周精益计划（¥24 万） |
| **`全项目计划书.md`** | 源稿 v2.0（含 Mermaid 甘特图 §6.3） |
| **`全项目外包技术报价书-v2.0-精益版.md`** | **当前推荐**：精益上架报价（¥24 万 · 10 周 · 三期付款） |
| **`全项目外包技术报价书.md`** | 审慎全量报价 v1.1（¥101 万 · 58 周 · 四期付款） |
| `全项目计划书-v1.1-本地版.pdf` | 旧版全量计划 PDF（58 周） |
| `开发费与服务器软件费用明细清单.md` | 自研版费用拆分（设计三期 ¥10.8 万） |
| `商业化启动计划书-v1.3-本地版.pdf` | 旧版（含合规） |

## Mac 上获取（首次）

```bash
cd ~/Texas-Hold-em
git fetch origin
git checkout cursor/doc-review-refinement-2fc9
git pull origin cursor/doc-review-refinement-2fc9
open docs/local/全项目计划书.md
open docs/local/全项目外包技术报价书-v2.0-精益版.md
```

## 已克隆仓库时更新

```bash
cd ~/Texas-Hold-em
git pull origin cursor/doc-review-refinement-2fc9
```

## 方案对照（首年）

| 方案 | 技术总包 | 周期 | 说明 |
|------|----------|------|------|
| 创始人自研 | ¥61.2 万 | 52 周 | 含买量 ¥18 万 + 储备 |
| **全项目外包（精益）** | **¥24 万** | **10 周** | 接场上架 P0；**不含买量 / 运营** |
| 全项目外包（审慎全量） | ¥101 万 | 58 周 | 含前期调研 ¥9.8 万；**不含买量** |

## 本地重新生成 PDF

```bash
cd ~/Texas-Hold-em
cd scripts && npm install && cd ..
node scripts/generate-project-plan-pdf.mjs
open docs/local/全项目计划书-v2.0-本地版.pdf
```

商业化计划书 PDF（另需）：

```bash
node scripts/generate-commercialization-pdf.mjs
```

## 文档版本

- v2.0 · 2026-08-24
- **全项目计划书 v2.0**：三期 · 10 周 · ¥24 万 · WBS · 里程碑 · 风险登记
- **精益报价书 v2.0**：与计划书配套；三期付款 ¥7.2 万 / ¥9.6 万 / ¥7.2 万
- 全量审慎报价 v1.1：Phase 0 前期 6 周 + 58 周四期方案（Git 历史保留）
- 已确认：方案 A 筹码迁移、美国不列入 T1 买量
