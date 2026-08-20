# 商业化计划书 · 本地版

本目录为**离线可用**的本地副本，无需联网即可打开。

## 文件说明

| 文件 | 用途 |
|------|------|
| **`商业化启动计划书-v1.7-本地版.pdf`** | **推荐**：纲要 + 全文 + 费用明细；不含合规章节；人民币报价 |
| **`全项目计划书.md`** | **四期完整项目计划**（58 周 · WBS · 里程碑 · 风险 · 签字页） |
| **`全项目外包技术报价书.md`** | 审慎技术报价（¥101 万 · 四期付款） |
| `开发费与服务器软件费用明细清单.md` | 自研版费用拆分（设计三期 ¥10.8 万） |
| `商业化启动计划书-v1.3-本地版.pdf` | 旧版（含合规） |

## Mac 上获取（首次）

```bash
cd ~/Texas-Hold-em
git fetch origin
git checkout cursor/doc-review-refinement-2fc9
git pull origin cursor/doc-review-refinement-2fc9
open docs/local/全项目计划书.md
open docs/local/全项目外包技术报价书.md
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
| **全项目外包** | **¥101 万** | **58 周** | 含前期调研 ¥9.8 万；**不含买量** |

## 本地重新生成 PDF（可选）

```bash
cd ~/Texas-Hold-em
cd scripts && npm install && cd ..
node scripts/generate-commercialization-pdf.mjs
cp docs/11-商业化启动计划书.pdf docs/local/商业化启动计划书-v1.7-本地版.pdf
```

## 文档版本

- v1.7 · 2026-08-20
- 新增：**全项目计划书 v1.0**（四期 · 58 周 · WBS · 里程碑 · 风险登记）
- 外包报价书 v1.1：Phase 0 前期 6 周 + 项目计划书
- 已确认：方案 A 筹码迁移、美国不列入 T1 买量
