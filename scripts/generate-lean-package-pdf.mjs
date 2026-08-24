import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), 'package.json'));
const { marked } = require('marked');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const planPath = join(root, 'docs/local/全项目计划书.md');
const quotePath = join(root, 'docs/local/全项目外包技术报价书-v2.0-精益版.md');
const htmlPath = join(root, 'docs/local/全项目方案书-v2.0-精益版.html');
const pdfPath = join(root, 'docs/local/全项目方案书-v2.0-精益版-本地版.pdf');
const tmpDir = join(root, 'docs/local/.pdf-build');

const outlineHtml = `
<div class="outline-page">
  <h1 class="doc-title">Texas Hold'em</h1>
  <h2 class="doc-subtitle">全项目方案书（精益版）</h2>
  <p class="meta">文档版本 v2.0 · 更新日期 2026-08-24 · 计划书 + 报价书 · 10 周 · 含甘特图</p>
  <div class="outline-banner">本文档合并《全项目计划书》与《技术报价书》；¥24 万为纯技术服务费，云资源与域名网络费用由创始人另行承担。</div>
  <table class="cover-table">
    <tr><th>总周期</th><td>10 周（合同签署日起）</td></tr>
    <tr><th>技术服务费</th><td>¥240,000（三期付款 4:4:2）</td></tr>
    <tr><th>第一期</th><td>W1 – W3 · ¥96,000（40%）· 接场 + IAP/OAuth Alpha</td></tr>
    <tr><th>第二期</th><td>W4 – W7 · ¥96,000（40%）· 核心 UI + 压测 + 提审</td></tr>
    <tr><th>第三期</th><td>W8 – W10 · ¥48,000（20%）· 上线 + 迁移 + 终验</td></tr>
    <tr><th>不含在合同内</th><td>首期云资源、域名 / SSL / CDN（创始人账户支付，首期约 ¥1.3–2.2 万）</td></tr>
  </table>
  <p class="toc-hint">正文：第一部分 项目计划书 · 附录 技术报价书</p>
</div>
`;

const css = `
  @page { margin: 14mm 12mm 16mm 12mm; size: A4; }
  * { box-sizing: border-box; }
  body {
    font-family: "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 10pt; line-height: 1.5; color: #1a1a1a; margin: 0; padding: 0;
  }
  .outline-page { page-break-after: always; padding-top: 4mm; }
  .doc-title { font-size: 24pt; margin: 0 0 4px; }
  .doc-subtitle { font-size: 16pt; color: #1a5276; margin: 0 0 10px; }
  .meta { color: #666; font-size: 9pt; margin-bottom: 8px; }
  .outline-banner { background: #eaf2f8; border-left: 4px solid #1a5276; padding: 8px 12px; font-size: 9.5pt; color: #555; margin-bottom: 12px; }
  .toc-hint { font-size: 9pt; color: #666; margin-top: 20px; }
  .cover-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 16px; }
  .cover-table th, .cover-table td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; }
  .cover-table th { background: #eaf2f8; width: 28%; }
  .part-break { page-break-before: always; border-top: 3px solid #1a5276; margin: 24px 0 16px; padding-top: 8px; }
  .part-break h2 { font-size: 14pt; color: #1a5276; margin: 0; border: none; }
  .content h1 { font-size: 16pt; margin: 20px 0 8px; page-break-after: avoid; border-bottom: 2px solid #1a5276; padding-bottom: 4px; }
  .content h2 { font-size: 12.5pt; margin: 16px 0 6px; page-break-after: avoid; color: #222; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  .content h3 { font-size: 10.5pt; margin: 10px 0 5px; page-break-after: avoid; }
  .content h4 { font-size: 10pt; margin: 8px 0 4px; }
  .content p, .content li { font-size: 9.5pt; }
  .content table { width: 100%; border-collapse: collapse; font-size: 8pt; margin: 6px 0 10px; page-break-inside: avoid; }
  .content th, .content td { border: 1px solid #bbb; padding: 3px 4px; text-align: left; vertical-align: top; }
  .content th { background: #eaf2f8; }
  .content tr:nth-child(even) td { background: #fafafa; }
  .content blockquote { border-left: 3px solid #1a5276; margin: 6px 0; padding: 5px 10px; background: #f4f9fc; color: #444; font-size: 9pt; }
  .content pre { background: #f4f4f4; padding: 6px; font-size: 7.5pt; overflow-x: auto; page-break-inside: avoid; white-space: pre-wrap; word-break: break-all; }
  .content code { background: #eee; padding: 1px 3px; border-radius: 2px; font-size: 8pt; }
  .content hr { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
  .content ul, .content ol { margin: 4px 0 8px 16px; }
  .mermaid-diagram { margin: 10px 0 14px; page-break-inside: avoid; text-align: center; }
  .mermaid-diagram svg { max-width: 100%; height: auto; }
`;

function renderMermaidBlocks(md) {
  mkdirSync(tmpDir, { recursive: true });
  const placeholders = [];
  let index = 0;

  const mdWithoutMermaid = md.replace(/```mermaid\n([\s\S]*?)```/g, (_, code) => {
    const id = `MERMAID_PLACEHOLDER_${index}`;
    const mmdPath = join(tmpDir, `diagram-${index}.mmd`);
    const svgPath = join(tmpDir, `diagram-${index}.svg`);
    writeFileSync(mmdPath, code.trim(), 'utf8');

    const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/local/bin/google-chrome';
    const result = spawnSync(
      'npx',
      ['mmdc', '-i', mmdPath, '-o', svgPath, '-b', 'transparent', '--scale', '1.5'],
      {
        cwd: join(root, 'scripts'),
        encoding: 'utf8',
        env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: chromePath },
        timeout: 120000,
      },
    );

    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      throw new Error(`Mermaid render failed for diagram-${index}`);
    }

    const svg = readFileSync(svgPath, 'utf8');
    placeholders.push({ id, html: `<div class="mermaid-diagram">${svg}</div>` });
    index += 1;
    return `\n\n${id}\n\n`;
  });

  return { md: mdWithoutMermaid, placeholders };
}

function buildCombinedMarkdown() {
  const planMd = readFileSync(planPath, 'utf8');
  let quoteMd = readFileSync(quotePath, 'utf8');
  quoteMd = quoteMd.replace(/^# Texas Hold'em · 全项目外包技术报价书（精益版）\n\n/, '');

  return `${planMd.trim()}

---PART_BREAK---

# 附录：技术报价书

${quoteMd.trim()}
`;
}

marked.setOptions({ gfm: true, breaks: false });

const mdRaw = buildCombinedMarkdown();
const { md, placeholders } = renderMermaidBlocks(mdRaw);
let bodyHtml = marked.parse(md);

for (const { id, html } of placeholders) {
  bodyHtml = bodyHtml.replace(new RegExp(`<p>${id}</p>|${id}`, 'g'), html);
}

bodyHtml = bodyHtml.replace(
  /<hr>\s*<h1>附录：技术报价书<\/h1>/,
  '<div class="part-break"><h2>附录：技术报价书</h2></div>',
);
bodyHtml = bodyHtml.replace(/<h1>附录：技术报价书<\/h1>/, '<div class="part-break"><h2>附录：技术报价书</h2></div>');

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/>
<title>Texas Hold'em 全项目方案书（精益版）</title><style>${css}</style></head><body>
${outlineHtml}<div class="content">${bodyHtml}</div></body></html>`;

writeFileSync(htmlPath, html, 'utf8');

const chrome = '/usr/local/bin/google-chrome';
const userDataDir = `/tmp/chrome-pdf-package-${Date.now()}`;
const result = spawnSync(chrome, [
  `--user-data-dir=${userDataDir}`,
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--run-all-compositor-stages-before-draw', '--virtual-time-budget=25000',
  `--print-to-pdf=${pdfPath}`, '--no-pdf-header-footer', `file://${htmlPath}`,
], { encoding: 'utf8', timeout: 180000 });

try {
  rmSync(tmpDir, { recursive: true, force: true });
} catch {
  /* ignore */
}

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

console.log(`HTML: ${htmlPath}`);
console.log(`PDF:  ${pdfPath}`);
