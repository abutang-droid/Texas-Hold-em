import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), 'package.json'));
const { marked } = require('marked');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const build = spawnSync('node', [join(root, 'scripts/build-commercialization-pdf-source.mjs')], {
  encoding: 'utf8',
  cwd: root,
});
if (build.status !== 0) {
  console.error(build.stderr || build.stdout);
  process.exit(1);
}

const mdPath = join(root, 'docs/11-商业化启动计划书-pdf-full.md');
const htmlPath = join(root, 'docs/11-商业化启动计划书.html');
const pdfPath = join(root, 'docs/11-商业化启动计划书.pdf');

const outlineHtml = `
<div class="outline-page">
  <h1 class="doc-title">Texas Hold'em</h1>
  <h2 class="doc-subtitle">商业化启动计划书</h2>
  <p class="meta">文档版本 v1.6 · 更新日期 2026-08-20 · 报价币种：人民币（CNY）· 不含合规章节</p>
  <div class="outline-banner">本页为纲要摘要，详细数据见正文章节</div>
</div>
`;

const css = `
  @page { margin: 16mm 14mm 18mm 14mm; size: A4; }
  * { box-sizing: border-box; }
  body {
    font-family: "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif;
    font-size: 10pt; line-height: 1.5; color: #1a1a1a; margin: 0; padding: 0;
  }
  .outline-page { page-break-after: always; padding-top: 6mm; }
  .doc-title { font-size: 24pt; margin: 0 0 4px; }
  .doc-subtitle { font-size: 16pt; color: #9a7b1a; margin: 0 0 10px; }
  .meta { color: #666; font-size: 9pt; margin-bottom: 8px; }
  .outline-banner { background: #f5f3eb; border-left: 4px solid #c9a227; padding: 8px 12px; font-size: 9.5pt; color: #555; }
  .content h1 { font-size: 17pt; margin: 22px 0 10px; page-break-after: avoid; border-bottom: 2px solid #c9a227; padding-bottom: 4px; }
  .content h2 { font-size: 13pt; margin: 18px 0 8px; page-break-after: avoid; color: #222; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  .content h3 { font-size: 11pt; margin: 12px 0 6px; page-break-after: avoid; }
  .content h4 { font-size: 10pt; margin: 10px 0 4px; }
  .content p, .content li { font-size: 9.5pt; }
  .content table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin: 8px 0 12px; page-break-inside: avoid; }
  .content th, .content td { border: 1px solid #bbb; padding: 4px 5px; text-align: left; vertical-align: top; }
  .content th { background: #f5f3eb; }
  .content tr:nth-child(even) td { background: #fafafa; }
  .content blockquote { border-left: 3px solid #c9a227; margin: 8px 0; padding: 6px 10px; background: #faf8f2; color: #444; }
  .content pre { background: #f4f4f4; padding: 8px; font-size: 8pt; overflow-x: auto; page-break-inside: avoid; }
  .content code { background: #eee; padding: 1px 3px; border-radius: 2px; font-size: 8.5pt; }
  .content hr { border: none; border-top: 1px solid #ddd; margin: 14px 0; }
  .content ul, .content ol { margin: 4px 0 8px 18px; }
`;

marked.setOptions({ gfm: true, breaks: false });

const mdRaw = readFileSync(mdPath, 'utf8');
const md = mdRaw.replace(/```mermaid[\s\S]*?```/g, '_[路线图见在线版文档]_');
const bodyHtml = marked.parse(md);

const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/>
<title>Texas Hold'em 商业化启动计划书</title><style>${css}</style></head><body>
${outlineHtml}<div class="content">${bodyHtml}</div></body></html>`;

writeFileSync(htmlPath, html, 'utf8');

const chrome = '/usr/local/bin/google-chrome';
const userDataDir = `/tmp/chrome-pdf-${Date.now()}`;
const result = spawnSync(chrome, [
  `--user-data-dir=${userDataDir}`,
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--run-all-compositor-stages-before-draw', '--virtual-time-budget=15000',
  `--print-to-pdf=${pdfPath}`, '--no-pdf-header-footer', `file://${htmlPath}`,
], { encoding: 'utf8', timeout: 90000 });

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

console.log(`PDF: ${pdfPath}`);
