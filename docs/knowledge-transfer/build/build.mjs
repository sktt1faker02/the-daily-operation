import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const buildDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(buildDir, "..");
const repoRoot = path.resolve(buildDir, "..", "..", "..");
const outputHtml = path.join(outputDir, "The-Daily-Operation-Knowledge-Transfer.html");
const outputPdf = path.join(outputDir, "The-Daily-Operation-Knowledge-Transfer.pdf");
const tempDir = path.join(buildDir, ".tmp");
const edgePath = process.env.EDGE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const branch = "docs/knowledge-transfer";
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
  cwd: repoRoot,
  encoding: "utf8",
}).trim();
const captureDate = "2026-10-20";

if (!existsSync(edgePath)) {
  throw new Error(`Microsoft Edge was not found at ${edgePath}. Set EDGE_PATH or print the HTML manually.`);
}

const overview = readFileSync(path.join(outputDir, "01-overview-and-architecture.md"), "utf8");
const setup = readFileSync(path.join(outputDir, "02-setup-and-deployment.md"), "utf8");

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function slug(value) {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
}

function inline(value) {
  let result = escapeHtml(value);
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2">$1</a>');
  return result;
}

function markdownToHtml(markdown) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const html = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (line.startsWith("```")) {
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    if (line.startsWith("|")) {
      const rows = [];
      while (index < lines.length && lines[index].startsWith("|")) {
        const cells = lines[index].split("|").slice(1, -1).map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) rows.push(cells);
        index += 1;
      }
      if (rows.length) {
        const [head, ...body] = rows;
        html.push(`<table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      }
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].replace(/\s+#+\s*$/, "");
      html.push(`<h${level} id="${slug(title)}">${inline(title)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      html.push("<hr>");
      index += 1;
      continue;
    }

    if (line.startsWith("> ")) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith("> ")) {
        quote.push(lines[index].slice(2));
        index += 1;
      }
      html.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^\d+\.\s/, ""))}</li>`);
        index += 1;
      }
      html.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s/.test(lines[index])) {
        items.push(`<li>${inline(lines[index].replace(/^[-*]\s/, ""))}</li>`);
        index += 1;
      }
      html.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() &&
      !/^(#{1,4})\s|^```|^\||^> |^[-*]\s|^\d+\.\s|^---+$/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  return html.join("\n");
}

const partTitles = [
  { id: "part-1", title: "Part 1 — Inventory and setup", status: "Done", goal: "Find the app’s structure, routes, tools, data access seam, and setup/deployment path.", sections: "01 Overview and architecture · 02 Setup and deployment", questions: "Where does the app start? What can each role reach? How do I run, build, and publish it?" },
  { id: "part-2", title: "Part 2 — Data model and action-to-table matrix", status: "Not started", goal: "Map every Dataverse table and connect each user action to its data operations.", sections: "03 Data model · 04 User actions to tables", questions: "What records and columns exist? Which actions read or change them?" },
  { id: "part-3", title: "Part 3 — Business rules and security", status: "Not started", goal: "Explain payroll rules, status transitions, access checks, and security boundaries.", sections: "05 Business rules · 06 Security and access", questions: "How are payroll amounts and statuses determined? How is data access protected?" },
  { id: "part-4", title: "Part 4 — Gaps, risks, and verification", status: "Not started", goal: "Identify code risks and give the owner a practical environment verification checklist.", sections: "07 Risks, gaps, and verification", questions: "What still needs attention or confirmation in Power Platform?" },
];

function tocRow(label, target, page) {
  return `<tr><td><a href="#${target}">${escapeHtml(label)}</a></td><td class="page-num">${page}</td></tr>`;
}

function coverAndFront(pageNumbers) {
  const toc = [
    tocRow("Cover", "cover", 1),
    tocRow("How to read this document and summary", "front-matter", 2),
    tocRow("01 Overview and architecture", "01-overview-and-architecture", pageNumbers.overview),
    tocRow("02 Setup and deployment", "02-setup-and-deployment", pageNumbers.setup),
    ...partTitles.map((part, index) => tocRow(part.title, part.id, pageNumbers.parts[index])),
  ].join("");
  return `<section class="cover page" id="cover"><div class="cover-mark">AUTOMATIONS 365</div><h1>The Daily Operation:<br>Knowledge Transfer</h1><p class="subtitle">Payroll application handover · Evidence-based repository guide</p><dl><dt>Branch</dt><dd>${branch}</dd><dt>Commit</dt><dd>${commit}</dd><dt>Capture date</dt><dd>${captureDate}</dd></dl><p class="notice">Contains system details. Store privately.</p></section>
<section class="front page" id="front-matter"><h1>How to read this document</h1><p><strong>[Code]</strong> means the statement is supported by this repository and includes a source reference. <strong>[Verify in environment]</strong> means the value or behavior must be checked in Power Platform or on the target workstation.</p><p><strong>C/R/U/D/A/S</strong> means Create, Read, Update, Delete, Assign, and Share. The action-to-table matrix will use these letters in Part 2.</p><h2>Phase status</h2><table><thead><tr><th>Phase</th><th>Title</th><th>Status</th></tr></thead><tbody><tr><td>1</td><td>Inventory and setup</td><td>Done</td></tr><tr><td>2</td><td>Data model and action-to-table matrix</td><td>Not started</td></tr><tr><td>3</td><td>Business rules and security</td><td>Not started</td></tr><tr><td>4</td><td>Gaps, risks, and verification</td><td>Not started</td></tr></tbody></table><h2>Contents</h2><table class="toc"><tbody>${toc}</tbody></table><h2>Application summary</h2><p><strong>[Code]</strong> The Daily Operation is a Microsoft Power Apps Code App built with React, TypeScript, and Vite. Payroll is the current business module. Dataverse is accessed through the Power Apps SDK client and generated services. The current routed areas include payroll administration, employee records, payroll templates, My Payroll, and payslip viewing (<code>src/App.tsx › App</code>; <code>src/router.tsx › router</code>; <code>src/lib/power/data-client.ts › dataClient</code>).</p><p><strong>[Verify in environment]</strong> User role assignments, app sharing, target environment, Dataverse privileges, and the deployed version must be checked in Power Platform before making an operational change.</p></section>`;
}

function divider(part) {
  const statusText = part.status === "Done" ? "Done" : "Not started";
  return `<section class="divider page" id="${part.id}"><p class="eyebrow">${part.title.split(" — ")[0]}</p><h1>${escapeHtml(part.title.split(" — ")[1])}</h1><p class="goal">${escapeHtml(part.goal)}</p><dl><dt>Sections</dt><dd>${escapeHtml(part.sections)}</dd><dt>Status</dt><dd>${statusText}</dd><dt>Questions answered</dt><dd>${escapeHtml(part.questions)}</dd></dl></section>`;
}

function styles() {
  return `<style>
@page { size: A4 portrait; margin: 19mm 19mm 20mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Arial, sans-serif; color: #526174; } }
* { box-sizing: border-box; } html { color: #172033; font: 9.5pt/1.38 Arial, Helvetica, sans-serif; } body { margin: 0; }
a { color: #075a83; text-decoration: underline; } h1,h2,h3,h4 { color: #123957; line-height: 1.2; break-after: avoid; } h1 { font-size: 22pt; margin: 0 0 14pt; } h2 { font-size: 14pt; margin: 16pt 0 7pt; } h3 { font-size: 11pt; margin: 11pt 0 5pt; } p { margin: 0 0 7pt; orphans: 3; widows: 3; }
ul,ol { margin: 4pt 0 9pt 18pt; padding: 0; } li { margin: 0 0 3pt; break-inside: avoid; } code,pre { font-family: Consolas, "Courier New", monospace; font-size: 8.3pt; } code { overflow-wrap: anywhere; } pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f2f5f8; padding: 8pt; border: .5pt solid #ccd5df; break-inside: avoid; }
table { width: 100%; border-collapse: collapse; margin: 7pt 0 10pt; font-size: 8.5pt; } th { text-align: left; background: #e7eef4; color: #123957; font-weight: bold; } th,td { border: .5pt solid #b9c5d1; padding: 4pt 5pt; vertical-align: top; overflow-wrap: anywhere; } thead { display: table-header-group; } tr { break-inside: avoid; } blockquote { margin: 5pt 0 8pt; padding: 4pt 8pt; border-left: 3pt solid #4b8ca8; background: #f3f7f8; }
.page { page-break-after: always; } .cover { min-height: 250mm; display: flex; flex-direction: column; justify-content: center; padding: 15mm 10mm; } .cover-mark { color: #307c9d; font-weight: 700; letter-spacing: 2pt; margin-bottom: 24pt; } .cover h1 { font-size: 32pt; } .subtitle { font-size: 14pt; color: #526174; margin-bottom: 30pt; } dl { display: grid; grid-template-columns: 34mm 1fr; gap: 5pt 12pt; margin: 10pt 0 0; } dt { font-weight: 700; color: #123957; } dd { margin: 0; } .notice { margin-top: 26pt; border: 1pt solid #9b4b42; color: #7b3028; padding: 9pt; font-weight: 700; }
.front { font-size: 8.7pt; } .front h1 { font-size: 19pt; margin-bottom: 7pt; } .front h2 { font-size: 11pt; margin: 9pt 0 4pt; } .front p { margin-bottom: 5pt; } .front table { margin: 4pt 0 6pt; font-size: 7.8pt; } .front th,.front td { padding: 2.7pt 4pt; } .toc td:last-child { width: 14mm; text-align: right; } .toc a { text-decoration: none; color: #172033; }
.divider { page-break-before: always; min-height: 250mm; display: flex; flex-direction: column; justify-content: center; } .eyebrow { text-transform: uppercase; letter-spacing: 1.5pt; color: #307c9d; font-weight: 700; } .divider h1 { font-size: 26pt; } .goal { font-size: 13pt; max-width: 155mm; color: #526174; margin: 10pt 0 24pt; } .divider dl { grid-template-columns: 37mm 1fr; row-gap: 10pt; max-width: 165mm; } .source { page-break-before: always; } .source h1 { font-size: 20pt; border-bottom: 2pt solid #307c9d; padding-bottom: 6pt; }
</style>`;
}

function documentHtml(frontNumbers) {
  const parts = partTitles.map(divider).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The Daily Operation: Knowledge Transfer</title><meta name="author" content="Automations 365"><meta name="description" content="Evidence-based knowledge transfer for The Daily Operation Power Apps Code App.">${styles()}</head><body>${coverAndFront(frontNumbers)}${divider(partTitles[0])}<article class="source" id="01-overview-and-architecture">${markdownToHtml(overview)}</article><article class="source" id="02-setup-and-deployment">${markdownToHtml(setup)}</article>${parts.slice(parts.indexOf("<section class=\"divider page\" id=\"part-2\""))}</body></html>`;
}

function oneSectionHtml(markdown) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Section page count</title>${styles()}</head><body><article>${markdownToHtml(markdown)}</article></body></html>`;
}

function frontMatterOnlyHtml() {
  const sections = coverAndFront({ overview: 4, setup: 5, parts: [3, 8, 9, 10] });
  const start = sections.indexOf('<section class="front page"');
  const end = sections.indexOf("</section>", start) + "</section>".length;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Front matter</title>${styles()}</head><body>${sections.slice(start, end)}</body></html>`;
}

function countPages(pdfPath) {
  const data = readFileSync(pdfPath).toString("latin1");
  const matches = data.match(/\/Type\s*\/Page(?!s)\b/g);
  if (!matches?.length) throw new Error(`Could not read page objects from ${pdfPath}`);
  return matches.length;
}

function printPdf(htmlPath, pdfPath, profilePath) {
  rmSync(profilePath, { recursive: true, force: true });
  mkdirSync(profilePath, { recursive: true });
  execFileSync(edgePath, [
    "--headless", "--disable-gpu", "--disable-background-networking", "--no-first-run",
    "--no-default-browser-check", `--user-data-dir=${profilePath}`,
    `--print-to-pdf=${pdfPath}`, "--no-pdf-header-footer", pathToFileURL(htmlPath).href,
  ], { stdio: "inherit", timeout: 120000 });
  if (!existsSync(pdfPath)) throw new Error(`Edge did not create ${pdfPath}`);
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(tempDir, { recursive: true });
const front = path.join(tempDir, "front.html");
const frontPdf = path.join(tempDir, "front.pdf");
writeFileSync(front, frontMatterOnlyHtml());
printPdf(front, frontPdf, path.join(tempDir, "profile-front"));
const frontPages = countPages(frontPdf);

function measuredPages(markdown, name) {
  const htmlPath = path.join(tempDir, `${name}.html`);
  const pdfPath = path.join(tempDir, `${name}.pdf`);
  writeFileSync(htmlPath, oneSectionHtml(markdown));
  printPdf(htmlPath, pdfPath, path.join(tempDir, `profile-${name}`));
  return countPages(pdfPath);
}

const overviewPages = measuredPages(overview, "overview");
const setupPages = measuredPages(setup, "setup");
const overviewPage = 3 + frontPages;
const setupPage = overviewPage + overviewPages;
const partsPage = [2 + frontPages, setupPage + setupPages, setupPage + setupPages + 1, setupPage + setupPages + 2];
const html = documentHtml({ overview: overviewPage, setup: setupPage, parts: partsPage });
writeFileSync(outputHtml, `${html}\n`, "utf8");
const finalProfile = path.join(tempDir, "profile-final");
printPdf(outputHtml, outputPdf, finalProfile);
const actualPages = countPages(outputPdf);
const expectedPages = setupPage + setupPages + 2;
if (actualPages !== expectedPages) {
  throw new Error(`PDF page count mismatch: expected ${expectedPages}, found ${actualPages}. Check page overflow in the cover/front matter.`);
}
rmSync(tempDir, { recursive: true, force: true });
console.log(`HTML: ${outputHtml}`);
console.log(`PDF: ${outputPdf}`);
console.log(`Pages: ${actualPages} (front matter ${frontPages}; overview ${overviewPages}; setup ${setupPages})`);
