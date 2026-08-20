# 商业化计划书 · 本地版

本目录为**离线可用**的本地副本，无需联网即可打开。

## 文件说明

| 文件 | 用途 |
|------|------|
| `商业化启动计划书-v1.3-本地版.pdf` | **推荐**：含纲要 + 全文，报价为人民币 |
| `商业化启动计划书-v1.3-本地版.md` | Markdown 源稿，可编辑 |
| `商业化启动计划书-v1.3-本地版.html` | 浏览器打开预览 |

## Mac 上获取（首次）

```bash
cd ~/Texas-Hold-em
git fetch origin
git checkout cursor/doc-review-refinement-2fc9
git pull origin cursor/doc-review-refinement-2fc9
open docs/local/商业化启动计划书-v1.3-本地版.pdf
```

## 已克隆仓库时更新

```bash
cd ~/Texas-Hold-em
git pull origin cursor/doc-review-refinement-2fc9
open docs/local/商业化启动计划书-v1.3-本地版.pdf
```

## 本地重新生成 PDF（可选）

```bash
cd ~/Texas-Hold-em
cd scripts && npm install && cd ..
node scripts/generate-commercialization-pdf.mjs
# 输出：docs/11-商业化启动计划书.pdf
```

## 文档版本

- v1.3 · 2026-08-20
- 已确认：方案 A 筹码迁移、美国不列入 T1 买量、创始人自研
