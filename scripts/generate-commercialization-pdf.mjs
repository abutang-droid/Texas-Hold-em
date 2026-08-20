import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mdPath = join(root, 'docs/11-商业化启动计划书.md');
const htmlPath = join(root, 'docs/11-商业化启动计划书.html');
const pdfPath = join(root, 'docs/11-商业化启动计划书.pdf');

const outline = `
<div class="outline-page">
  <h1 class="doc-title">Texas Hold'em</h1>
  <h2 class="doc-subtitle">商业化启动计划书</h2>
  <p class="meta">文档版本 v1.3 · 更新日期 2026-08-20 · 报价币种：人民币（CNY）</p>

  <h2 class="outline-heading">纲要</h2>

  <section class="outline-block">
    <h3>一、项目定位</h3>
    <ul>
      <li>跨端社交竞技德州扑克，单向封闭筹码经济（不可提现）</li>
      <li>变现：IAP 充值（主）+ 官方场 5% / 私人场 3% rake</li>
      <li>技术阶段：v1.1 公测前约 80%，核心功能已具备</li>
    </ul>
  </section>

  <section class="outline-block">
    <h3>二、已锁定战略决策（6 项）</h3>
    <table class="outline-table">
      <tr><th>决策</th><th>方案</th></tr>
      <tr><td>首发市场</td><td>全球英文区（English U.S. 主语言）</td></tr>
      <tr><td>团队规模</td><td>精益，全年现金硬顶 ¥54 万</td></tr>
      <tr><td>私人场</td><td>公测即开，强风控 + 后台熔断</td></tr>
      <tr><td>筹码迁移</td><td>方案 A：清零 + 赠 100 筹码，提前 7 天公告</td></tr>
      <tr><td>美国买量</td><td>不列入 T1，全年仅自然量 + ASO</td></tr>
      <tr><td>研发模式</td><td>创始人自研，节省 ¥11.5 万转投买量</td></tr>
    </table>
  </section>

  <section class="outline-block">
    <h3>三、市场与买量</h3>
    <ul>
      <li><strong>T1 付费投放</strong>：加拿大、澳大利亚、新西兰</li>
      <li><strong>T2 自然量</strong>：美国、英国、爱尔兰（广告排除美国）</li>
      <li>全年买量预算：<strong>¥18 万</strong>（自研节省转投）</li>
    </ul>
  </section>

  <section class="outline-block">
    <h3>四、年度预算摘要（人民币）</h3>
    <table class="outline-table">
      <tr><th>类别</th><th>全年金额</th></tr>
      <tr><td>研发（工具/设备/SaaS，自研）</td><td>¥72,000</td></tr>
      <tr><td>云基础设施</td><td>¥64,800</td></tr>
      <tr><td>法务合规</td><td>¥57,600</td></tr>
      <tr><td>用户获取（买量）</td><td>¥180,000</td></tr>
      <tr><td>设计 / 客服 / 数据 / 其他</td><td>¥115,320</td></tr>
      <tr><td>应急储备</td><td>¥102,480</td></tr>
      <tr><td><strong>合计</strong></td><td><strong>¥540,000</strong></td></tr>
    </table>
  </section>

  <section class="outline-block">
    <h3>五、52 周时间表</h3>
    <table class="outline-table">
      <tr><th>阶段</th><th>周次</th><th>目标</th></tr>
      <tr><td>上架冲刺</td><td>W1–W8</td><td>真机 IAP、压测、提审、全球英文区上线</td></tr>
      <tr><td>软启动</td><td>W9–W16</td><td>自然量验证，不买量，D7≥12%</td></tr>
      <tr><td>小预算验证</td><td>W17–W28</td><td>T1 三国买量 ¥4.3 万，验证 LTV/CPI</td></tr>
      <tr><td>稳态运营</td><td>W29–W52</td><td>月买量上限 ¥2.3 万，筹备 v1.5</td></tr>
    </table>
  </section>

  <section class="outline-block">
    <h3>六、首年 KPI 目标（基准）</h3>
    <ul>
      <li>累计注册 5–10 万 · 月活 8,000–15,000 · 付费率 4–5%</li>
      <li>M12 月毛流水 ¥7.2 万 – ¥14.4 万</li>
      <li>M10–M14 有望经营性盈亏平衡（不含创始人人力）</li>
    </ul>
  </section>

  <section class="outline-block">
    <h3>七、Q1 创始人自研交付（P0）</h3>
    <ol>
      <li>真机 IAP 生产联调（iOS + Android）</li>
      <li>压测 300 CCU + 容量报告</li>
      <li>Firebase 充值漏斗埋点</li>
      <li>公测清档脚本（方案 A）</li>
      <li>监控告警 + 全球英文区提审上线</li>
    </ol>
  </section>

  <section class="outline-block">
    <h3>八、正文目录</h3>
    <ol class="toc-list">
      <li>执行摘要</li>
      <li>战略决策（已锁定）</li>
      <li>现状评估</li>
      <li>市场与上架策略</li>
      <li>产品与功能范围</li>
      <li>私人场公测方案</li>
      <li>变现与经济模型</li>
      <li>组织与分工</li>
      <li>预算表（人民币）</li>
      <li>时间表（52 周）</li>
      <li>KPI 与收入预测</li>
      <li>合规与风险管理</li>
      <li>数据与运营体系</li>
      <li>30 天行动清单</li>
      <li>待确认事项与执行摘要</li>
      <li>附录</li>
    </ol>
  </section>

  <p class="page-break-note">—— 以下为正文章节 ——</p>
</div>
`;

function mdToHtml(md) {
  let html = md
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr/>');

  // tables
  html = html.replace(/\n\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g, (_, header, body) => {
    const ths = header.split('|').filter(Boolean).map((c) => `<th>${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map((row) => {
      const tds = row.split('|').filter(Boolean).map((c) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // code blocks
  html = html.replace(/```[\s\S]*?```/g, (block) => {
    const inner = block.replace(/```\w*\n?/, '').replace(/```$/, '');
    return `<pre><code>${inner.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
  });

  // lists
  html = html.replace(/^(?:- .+\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map((l) => `<li>${l.replace(/^- /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  html = html.replace(/^(?:\d+\. .+\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map((l) => `<li>${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  html = html.split('\n\n').map((p) => {
    const t = p.trim();
    if (!t) return '';
    if (/^<(h[1-4]|table|ul|ol|pre|blockquote|hr)/.test(t)) return t;
    return `<p>${t.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n');

  return html;
}

const md = readFileSync(mdPath, 'utf8');
// skip duplicate title block in md body for cleaner PDF
const bodyMd = md.replace(/^# Texas Hold'em 商业化启动计划书[\s\S]*?^---\n\n## 目录[\s\S]*?^---\n\n/, '');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<title>Texas Hold'em 商业化启动计划书</title>
<style>
  @page { margin: 18mm 16mm 20mm 16mm; size: A4; }
  * { box-sizing: border-box; }
  body {
    font-family: "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1a1a1a;
    max-width: 100%;
    margin: 0;
    padding: 0;
  }
  .outline-page {
    page-break-after: always;
    padding: 8mm 0 0;
  }
  .doc-title {
    font-size: 26pt;
    color: #1a1a1a;
    margin: 0 0 4px;
    border: none;
  }
  .doc-subtitle {
    font-size: 18pt;
    color: #c9a227;
    margin: 0 0 12px;
    font-weight: 600;
  }
  .meta { color: #666; font-size: 9.5pt; margin-bottom: 24px; }
  .outline-heading {
    font-size: 16pt;
    border-bottom: 2px solid #c9a227;
    padding-bottom: 6px;
    margin: 0 0 16px;
    color: #1a1a1a;
  }
  .outline-block { margin-bottom: 16px; }
  .outline-block h3 {
    font-size: 11pt;
    color: #333;
    margin: 0 0 6px;
    border-left: 3px solid #c9a227;
    padding-left: 8px;
  }
  .outline-block ul, .outline-block ol { margin: 4px 0 0 18px; padding: 0; }
  .outline-block li { margin-bottom: 3px; }
  .outline-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
    margin-top: 4px;
  }
  .outline-table th, .outline-table td {
    border: 1px solid #ccc;
    padding: 5px 8px;
    text-align: left;
  }
  .outline-table th { background: #f5f3eb; font-weight: 600; }
  .toc-list { columns: 2; column-gap: 24px; }
  .page-break-note {
    text-align: center;
    color: #999;
    margin-top: 24px;
    font-size: 9pt;
  }
  .content { padding-top: 4mm; }
  h1 { font-size: 18pt; color: #1a1a1a; margin: 24px 0 12px; page-break-after: avoid; }
  h2 {
    font-size: 13pt;
    color: #1a1a1a;
    margin: 20px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e0e0e0;
    page-break-after: avoid;
  }
  h3 { font-size: 11pt; margin: 14px 0 6px; page-break-after: avoid; }
  h4 { font-size: 10.5pt; margin: 10px 0 4px; }
  p { margin: 6px 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin: 10px 0 14px;
    page-break-inside: avoid;
  }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f5f3eb; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  blockquote {
    border-left: 3px solid #c9a227;
    margin: 10px 0;
    padding: 6px 12px;
    background: #faf8f2;
    color: #444;
  }
  pre {
    background: #f4f4f4;
    padding: 8px 10px;
    font-size: 8.5pt;
    overflow-x: auto;
    border-radius: 4px;
    page-break-inside: avoid;
  }
  code { font-family: Consolas, monospace; font-size: 9pt; background: #f0f0f0; padding: 1px 4px; border-radius: 2px; }
  ul, ol { margin: 6px 0 10px 20px; }
  li { margin-bottom: 3px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
  strong { color: #111; }
</style>
</head>
<body>
${outline}
<div class="content">
${mdToHtml(bodyMd)}
</div>
</body>
</html>`;

writeFileSync(htmlPath, html, 'utf8');

const chrome = '/usr/local/bin/google-chrome';
const result = spawnSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--print-to-pdf=${pdfPath}`,
  '--no-pdf-header-footer',
  htmlPath,
], { encoding: 'utf8' });

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

console.log(`PDF generated: ${pdfPath}`);
