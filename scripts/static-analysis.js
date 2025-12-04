#!/usr/bin/env node
/**
 * Static Bug Analyzer
 * Runs ESLint and TypeScript type checking, then generates a unified report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const ESLINT_JSON = path.join(REPORTS_DIR, 'eslint-results.json');
const TSC_OUTPUT = path.join(REPORTS_DIR, 'tsc-output.txt');
const UNIFIED_REPORT = path.join(REPORTS_DIR, 'static-analysis-report.html');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

console.log('🔍 Running Static Bug Analysis...\n');

let eslintResults = { errors: [], warnings: [] };
let tscResults = { errors: [], warnings: [] };
let hasErrors = false;

// 1. Run ESLint
console.log('📋 Running ESLint...');
try {
  execSync(
    `npx eslint "{src,tests}/**/*.{ts,tsx}" --format json --output-file ${ESLINT_JSON}`,
    { stdio: 'inherit' }
  );
  if (fs.existsSync(ESLINT_JSON)) {
    const eslintData = JSON.parse(fs.readFileSync(ESLINT_JSON, 'utf8'));
    eslintData.forEach(file => {
      file.messages.forEach(msg => {
        const issue = {
          file: file.filePath,
          line: msg.line,
          column: msg.column,
          severity: msg.severity === 2 ? 'error' : 'warning',
          message: msg.message,
          rule: msg.ruleId || 'unknown',
          source: msg.source || '',
        };
        if (msg.severity === 2) {
          eslintResults.errors.push(issue);
          hasErrors = true;
        } else {
          eslintResults.warnings.push(issue);
        }
      });
    });
  }
  console.log(`   ✓ Found ${eslintResults.errors.length} errors, ${eslintResults.warnings.length} warnings\n`);
} catch (error) {
  // ESLint exits with non-zero on errors, but we still want the JSON
  if (fs.existsSync(ESLINT_JSON)) {
    const eslintData = JSON.parse(fs.readFileSync(ESLINT_JSON, 'utf8'));
    eslintData.forEach(file => {
      file.messages.forEach(msg => {
        const issue = {
          file: file.filePath,
          line: msg.line,
          column: msg.column,
          severity: msg.severity === 2 ? 'error' : 'warning',
          message: msg.message,
          rule: msg.ruleId || 'unknown',
          source: msg.source || '',
        };
        if (msg.severity === 2) {
          eslintResults.errors.push(issue);
          hasErrors = true;
        } else {
          eslintResults.warnings.push(issue);
        }
      });
    });
    console.log(`   ✓ Found ${eslintResults.errors.length} errors, ${eslintResults.warnings.length} warnings\n`);
  } else {
    console.log('   ⚠️  ESLint JSON output not found\n');
  }
}

// 2. Run TypeScript type checking
console.log('🔷 Running TypeScript type checker...');
try {
  execSync('npx tsc --noEmit --pretty false', { 
    stdio: 'pipe',
    encoding: 'utf8'
  });
  console.log('   ✓ No type errors found\n');
} catch (error) {
  const tscOutput = error.stdout || error.stderr || '';
  fs.writeFileSync(TSC_OUTPUT, tscOutput);
  
  const lines = tscOutput.split('\n').filter(line => line.trim());
  
  lines.forEach(line => {
    // Parse TypeScript error format: file.ts(line,col): error TS####: message
    const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
    if (match) {
      const [, file, lineNum, col, severity, code, message] = match;
      const issue = {
        file: path.resolve(file),
        line: parseInt(lineNum),
        column: parseInt(col),
        severity: severity,
        message: message,
        rule: code,
        source: '',
      };
      if (severity === 'error') {
        tscResults.errors.push(issue);
        hasErrors = true;
      } else {
        tscResults.warnings.push(issue);
      }
    }
  });
  console.log(`   ✓ Found ${tscResults.errors.length} errors, ${tscResults.warnings.length} warnings\n`);
}

// 3. Generate unified HTML report
console.log('📊 Generating unified report...');

const totalErrors = eslintResults.errors.length + tscResults.errors.length;
const totalWarnings = eslintResults.warnings.length + tscResults.warnings.length;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Static Bug Analysis Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    header h1 { font-size: 2em; margin-bottom: 10px; }
    header .timestamp { opacity: 0.9; font-size: 0.9em; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .stat-card h3 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .stat-card.error h3 { color: #dc3545; }
    .stat-card.warning h3 { color: #ffc107; }
    .stat-card.success h3 { color: #28a745; }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      font-size: 1.5em;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e9ecef;
    }
    .issue {
      background: #f8f9fa;
      border-left: 4px solid #dc3545;
      padding: 15px;
      margin-bottom: 15px;
      border-radius: 4px;
    }
    .issue.warning {
      border-left-color: #ffc107;
    }
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .issue-file {
      font-weight: bold;
      color: #495057;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.95em;
    }
    .issue-location {
      color: #6c757d;
      font-size: 0.9em;
    }
    .issue-message {
      color: #212529;
      margin: 8px 0;
    }
    .issue-rule {
      display: inline-block;
      background: #e9ecef;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      color: #495057;
      font-family: 'Monaco', 'Courier New', monospace;
      margin-right: 8px;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: bold;
    }
    .badge.error { background: #dc3545; color: white; }
    .badge.warning { background: #ffc107; color: #212529; }
    .badge.eslint { background: #4b32c3; color: white; }
    .badge.typescript { background: #3178c6; color: white; }
    .empty {
      text-align: center;
      padding: 40px;
      color: #6c757d;
    }
    .empty::before {
      content: "✓";
      display: block;
      font-size: 3em;
      color: #28a745;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔍 Static Bug Analysis Report</h1>
      <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
    </header>
    
    <div class="summary">
      <div class="stat-card ${totalErrors > 0 ? 'error' : 'success'}">
        <h3>${totalErrors}</h3>
        <p>Errors</p>
      </div>
      <div class="stat-card ${totalWarnings > 0 ? 'warning' : 'success'}">
        <h3>${totalWarnings}</h3>
        <p>Warnings</p>
      </div>
      <div class="stat-card">
        <h3>${eslintResults.errors.length + eslintResults.warnings.length}</h3>
        <p>ESLint Issues</p>
      </div>
      <div class="stat-card">
        <h3>${tscResults.errors.length + tscResults.warnings.length}</h3>
        <p>TypeScript Issues</p>
      </div>
    </div>
    
    <div class="content">
      ${totalErrors > 0 ? `
      <div class="section">
        <h2>❌ Errors (${totalErrors})</h2>
        ${[...eslintResults.errors, ...tscResults.errors].map(issue => `
          <div class="issue">
            <div class="issue-header">
              <span class="issue-file">${path.relative(process.cwd(), issue.file)}</span>
              <span class="issue-location">Line ${issue.line}, Col ${issue.column}</span>
            </div>
            <div class="issue-message">${escapeHtml(issue.message)}</div>
            <div>
              <span class="issue-rule">${issue.rule}</span>
              <span class="badge ${issue.rule.startsWith('TS') ? 'typescript' : 'eslint'}">${issue.rule.startsWith('TS') ? 'TypeScript' : 'ESLint'}</span>
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      ${totalWarnings > 0 ? `
      <div class="section">
        <h2>⚠️ Warnings (${totalWarnings})</h2>
        ${[...eslintResults.warnings, ...tscResults.warnings].map(issue => `
          <div class="issue warning">
            <div class="issue-header">
              <span class="issue-file">${path.relative(process.cwd(), issue.file)}</span>
              <span class="issue-location">Line ${issue.line}, Col ${issue.column}</span>
            </div>
            <div class="issue-message">${escapeHtml(issue.message)}</div>
            <div>
              <span class="issue-rule">${issue.rule}</span>
              <span class="badge ${issue.rule.startsWith('TS') ? 'typescript' : 'eslint'}">${issue.rule.startsWith('TS') ? 'TypeScript' : 'ESLint'}</span>
            </div>
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      ${totalErrors === 0 && totalWarnings === 0 ? `
      <div class="empty">
        <h2>No Issues Found!</h2>
        <p>Your code passed all static analysis checks.</p>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`;

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

fs.writeFileSync(UNIFIED_REPORT, html);
console.log(`   ✓ Report generated: ${UNIFIED_REPORT}\n`);

// Summary
console.log('📈 Summary:');
console.log(`   ESLint: ${eslintResults.errors.length} errors, ${eslintResults.warnings.length} warnings`);
console.log(`   TypeScript: ${tscResults.errors.length} errors, ${tscResults.warnings.length} warnings`);
console.log(`   Total: ${totalErrors} errors, ${totalWarnings} warnings\n`);

if (hasErrors) {
  console.log('❌ Static analysis found errors. Please fix them before committing.');
  process.exit(1);
} else {
  console.log('✅ Static analysis passed!');
  process.exit(0);
}

