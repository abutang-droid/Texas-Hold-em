/**
 * 合并计划书 + 费用明细，移除合规章节，输出 PDF 源 Markdown
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const planPath = join(root, 'docs/11-商业化启动计划书.md');
const expensePath = join(root, 'docs/local/开发费与服务器软件费用明细清单.md');
const outPath = join(root, 'docs/11-商业化启动计划书-pdf-full.md');

function between(md, startRe, endRe) {
  const re = new RegExp(`${startRe}[\\s\\S]*?(?=${endRe})`, 'm');
  return md.replace(re, '');
}

function removeTableRows(md, patterns) {
  return md
    .split('\n')
    .filter((line) => !line.startsWith('|') || !patterns.some((p) => p.test(line)))
    .join('\n');
}

let plan = readFileSync(planPath, 'utf8');

// 整章 / 整节移除
plan = between(plan, '## 十二、合规与风险管理', '## 十三、');
plan = between(plan, '### 4\\.3 商店与合规文案（英文区）', '## 五、');
plan = between(plan, '#### 9\\.2\\.4 法务合规', '#### 9\\.2\\.5');

// 移除 mermaid 图（含合规上架字样）
plan = plan.replace(/```mermaid[\s\S]*?```/g, '');

// 表格行
plan = removeTableRows(plan, [
  /法务合规/,
  /英文法务/,
  /\| 法务 \|/,
  /\| 合规 \| 18\+/,
  /Privacy Policy/,
  /Responsible Gaming/,
  /Terms of Service/,
  /委托英文法务/,
  /官网上线（Privacy/,
  /英文法务文件/,
  /内测 → 公测迁移确认流程/,
  /合规咨询/,
  /法务合计/,
  /法务启动/,
  /法务合同/,
]);

// 文案替换（弱化合规措辞）
plan = plan.replace(/，也是合规重点。/g, '。');
plan = plan.replace(/合规与风控基础/g, '风控基础');
plan = plan.replace(/合规、双榜/g, '双榜');
plan = plan.replace(/、合规零事故/g, '');
plan = plan.replace(/且完成美国合规专项审查（预计 M10\+ 再议）。/g, '后再评估是否开放美国买量。');
plan = plan.replace(/合规与素材要求更严/g, 'CPI 较高');
plan = plan.replace(/IAP、双榜、合规、私人场全开/g, 'IAP、双榜、私人场全开');
plan = plan.replace(/注册 → 18\+ 确认.*\n/, '');

// 目录项
plan = plan.replace(/^\d+\. \[合规与风险管理\].*\n/m, '');

// 预算说明
plan = plan.replace(
  /全年现金硬顶：\*\*¥612,000\*\*/,
  '全年现金硬顶：**¥554,400**（已剔除法务合规 ¥57,600）',
);

const outline = `# Texas Hold'em 商业化启动计划书

**文档版本** v1.7 · **更新日期** 2026-08-20 · **报价币种** 人民币（CNY）· 不含合规章节

---

# 纲要

## 一、项目定位

- 跨端社交竞技德州扑克，单向封闭筹码经济（不可提现）
- 变现：IAP 充值（主）+ 官方场 5% / 私人场 3% rake
- 技术阶段：v1.1 公测前约 80%

## 二、已锁定战略决策

| 决策 | 方案 |
|------|------|
| 首发市场 | 全球英文区（English U.S. 主语言） |
| 团队规模 | 精益，技术现金 **¥36.4 万**（不含买量 / 法务） |
| 私人场 | 公测即开，强风控 + 后台熔断 |
| 筹码迁移 | **方案 A**：清零 + 赠 100 筹码 |
| 美国买量 | 不列入 T1，全年仅自然量 |
| 研发模式 | 创始人自研，节省转投买量 |

## 三、市场与买量

- **T1 付费**：加拿大、澳大利亚、新西兰
- **T2 自然量**：美国、英国、爱尔兰（广告排除美国）
- 全年买量：**¥18 万**（另计）

## 四、技术与开发预算摘要

| 类别 | 金额（人民币） |
|------|---------------|
| 开发费（自研现金 + 商店素材 + **APP UI 设计**） | ¥180,000 |
| 云基础设施 | ¥64,800 |
| 软件注册及 SaaS | ¥119,520 |
| **合计** | **¥364,320** |

> **说明**：设计外包 **¥10.8 万**（商店 ¥3.6 万 + UI ¥7.2 万），**三期付款**：W2 ¥3 万 / W5 ¥4.29 万 / W12 ¥3.51 万。

## 五、52 周时间表

| 阶段 | 周次 | 要点 |
|------|------|------|
| 上架冲刺 | W1–W8 | IAP、压测、全球英文区上线 |
| 软启动 | W9–W16 | 自然量，不买量 |
| 小预算验证 | W17–W28 | T1 买量 ¥4.3 万 |
| 稳态运营 | W29–W52 | 月买量上限 ¥2.3 万 |

## 六、首年 KPI（基准）

- 注册 5–10 万 · MAU 8,000–15,000 · 付费率 4–5%
- M12 月毛流水 ¥7.2 万 – ¥14.4 万

## 七、Q1 自研交付（P0）

1. 真机 IAP 联调 · 2. 压测 300 CCU · 3. 充值漏斗埋点
4. 公测清档脚本 · 5. 提审上线

## 八、正文目录

1. 执行摘要 · 2. 战略决策 · 3. 现状评估 · 4. 市场策略
5. 产品范围 · 6. 私人场 · 7. 经济模型 · 8. 组织分工
9. 预算表 · 10. 时间表 · 11. KPI 预测
12. 运营体系 · 13. 30 天行动 · 14. 待确认事项
15. **附录：开发费与服务器 / 软件费用明细**

---

`;

const bodyStart = plan.indexOf('## 一、执行摘要');
const planBody = bodyStart >= 0 ? plan.slice(bodyStart) : plan;

let expense = readFileSync(expensePath, 'utf8');
expense = between(expense, '### A5\\. 法务合规', '### A\\. 开发费合计');
expense = between(expense, '## 六、首月最小启动包', '## 七、');
expense = between(expense, '## 七、不包含在本清单内', '$');
expense = removeTableRows(expense, [
  /法务合规/,
  /A5-/,
  /Privacy Policy/,
  /Terms of Service/,
  /Responsible Gaming/,
  /合规咨询/,
  /英文法务/,
  /文档年度修订/,
  /法务一次性/,
]);
expense = expense.replace(
  /\| \*\*A\. 开发费（现金）\*\* \| \*\*¥237,600\*\*[\s\S]*?\| 含商店素材、APP UI 设计；人力自研不计入 \|/,
  '| **A. 开发费（现金）** | **¥180,000** | ¥138,500 – ¥251,000 | 含商店素材、APP UI 设计；人力自研不计入 |',
);
expense = expense.replace(
  /\| \*\*合计\*\* \| \*\*¥421,920\*\*[\s\S]*?\| 首年技术与基础设施（含法务 ¥57,600 时见 A5） \|/,
  '| **合计** | **¥364,320** | **¥253,430 – ¥436,520** | 首年技术与基础设施（不含法务） |',
);
expense = expense.replace(
  /\| A5 法务合规[\s\S]*?\n/,
  '',
);
expense = expense.replace(
  /\| \*\*开发费现金合计\*\* \| \*\*¥237,600\*\* \| \*\*¥164,500 – ¥305,000\*\* \|/,
  '| **开发费现金合计** | **¥180,000** | **¥138,500 – ¥251,000** |',
);
expense = expense.replace(/¹ Q1 开发费含[\s\S]*?\n\n/, '\n');
expense = expense.replace(/需注意合规\n/, '\n');

const expenseBody = expense.replace(/^#[\s\S]*?^---\n\n/m, '');

const merged = `${outline}${planBody}

---

# 附录：开发费与服务器 / 软件费用明细

${expenseBody}`;

// 清理多余空行
const cleaned = merged.replace(/\n{4,}/g, '\n\n\n');

writeFileSync(outPath, cleaned, 'utf8');
console.log(`Wrote ${outPath} (${cleaned.split('\n').length} lines)`);
