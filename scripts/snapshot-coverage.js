const fs = require("fs");
const path = require("path");

const summaryJson = path.join("coverage", "coverage-summary.json");
const out = path.join("reports", "coverage-summary.md");

if (!fs.existsSync("reports")) fs.mkdirSync("reports", { recursive: true });

let md = `# Coverage Summary (snapshot)\n\n`;
if (fs.existsSync(summaryJson)) {
  const s = JSON.parse(fs.readFileSync(summaryJson, "utf8"));
  const b = s.total.branches.pct;
  const f = s.total.functions.pct;
  const l = s.total.lines.pct;
  const st = s.total.statements.pct;
  md += `- **Branches**: ${b}%\n- **Functions**: ${f}%\n- **Lines**: ${l}%\n- **Statements**: ${st}%\n\n`;
} else {
  md += `_No coverage-summary.json found._\n\n`;
}
md += `Open full HTML report locally at \`coverage/lcov-report/index.html\`.\n`;
fs.writeFileSync(out, md);
console.log("Wrote", out);
