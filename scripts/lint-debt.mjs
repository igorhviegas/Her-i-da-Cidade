// Regenera docs/lint-debt.md a partir do ESLint: mantém o texto explicativo de cada regra e atualiza o total, as contagens e as listas.
// Uso: npm run lint:debt   (depois de reduzir avisos; o doc deixa de mentir sobre o tamanho da dívida)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DOC = 'docs/lint-debt.md';
const run = spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js', '.', '-f', 'json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
let results;
try { results = JSON.parse(run.stdout); } catch { console.error('Não consegui ler a saída do ESLint:\n' + (run.stderr || run.stdout).slice(0, 500)); process.exit(1); }

let errors = 0;
let warnings = 0;
const byRule = new Map(); // regra -> Map(arquivo -> linhas)
for (const file of results) {
  const rel = path.relative(process.cwd(), file.filePath).split(path.sep).join('/');
  for (const message of file.messages) {
    if (message.severity === 2) errors += 1; else warnings += 1;
    const rule = message.ruleId ?? '(sem regra)';
    const files = byRule.get(rule) ?? new Map();
    files.set(rel, [...(files.get(rel) ?? []), message.line]);
    byRule.set(rule, files);
  }
}

const count = (files) => [...files.values()].reduce((sum, lines) => sum + lines.length, 0);
const list = (files) => [...files.entries()]
  .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  .map(([file, lines]) => `- \`${file}\` (${lines.length}): linhas ${[...lines].sort((x, y) => x - y).join(', ')}`);

// Texto explicativo de cada regra, preservado do doc atual (as linhas "- `arquivo`" são regeneradas).
const previous = readFileSync(DOC, 'utf8').replace(/\r\n/g, '\n');
const prose = new Map();
for (const block of previous.split('\n## ').slice(1)) {
  const [title, ...rest] = block.split('\n');
  prose.set(title.split(' — ')[0].trim(), rest.filter((line) => !line.startsWith('- `')).join('\n').trim());
}

const sections = [...byRule.entries()]
  .sort((a, b) => count(b[1]) - count(a[1]) || a[0].localeCompare(b[0]))
  .map(([rule, files]) => [`## ${rule} — ${count(files)}`, prose.get(rule) || '', list(files).join('\n')].filter(Boolean).join('\n\n'));

const headerEnd = previous.indexOf('\n## ');
const header = previous
  .slice(0, headerEnd)
  .replace(/Gerado a partir de `[^`]+`\./, 'Gerado por `npm run lint:debt` (a partir do ESLint).')
  .replace(/Total: \*\*[^*]+\*\*/, `Total: **${warnings} avisos, ${errors} erros**`);
writeFileSync(DOC, `${header}\n\n${sections.join('\n\n')}\n`);
console.log(`docs/lint-debt.md: ${warnings} avisos, ${errors} erros, ${byRule.size} regras`);
