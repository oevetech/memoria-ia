// Gera manifestos e ganchos das 3 IAs: node tools/gerar_manifestos.mjs
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const w = (f, o) => { fs.mkdirSync(path.dirname(path.join(R, f)), { recursive: true }); fs.writeFileSync(path.join(R, f), JSON.stringify(o, null, 2) + '\n'); };
const V = '1.2.1', REPO = 'https://github.com/oevetech/memoria-ia';
const DESC = 'Memoria de projeto para IAs (Claude Code, Codex, Gemini/Antigravity): retomada curta, observacoes com o porque e busca barata. Sem servidor e sem IA extra.';
// Lancador: usa o script do plugin (PLUGIN_ROOT/CLAUDE_PLUGIN_ROOT); se nao houver, ~/.memoria-ia/memoria.mjs.
// Lancador sem brecha: 1) script do plugin (CLAUDE_PLUGIN_ROOT/PLUGIN_ROOT); 2) clone do Codex vindo do GitHub
// (somente leitura para o Codex); 3) ~/.memoria-ia (copia do instalador, com conferencia de sha256).
const L = (args) => `node -e "const p=require('path'),o=require('os'),f=require('fs'),u=require('url');const h=o.homedir(),r=process.env.CLAUDE_PLUGIN_ROOT||process.env.PLUGIN_ROOT,c=process.env.CODEX_HOME||p.join(h,'.codex');const s=[r&&p.join(r,'scripts','memoria.mjs'),p.join(c,'.tmp','marketplaces','memoria-ia','plugin','scripts','memoria.mjs'),p.join(h,'.memoria-ia','memoria.mjs')].find(x=>x&&f.existsSync(x));if(s)import(u.pathToFileURL(s).href);else console.log('{}')" ${args}`;
const ganchos = (ia, editores) => ({
  SessionStart: [{ matcher: 'startup|clear|compact', hooks: [{ type: 'command', command: L(`contexto --ia ${ia}`), timeout: 15 }] }],
  PreToolUse: [{ matcher: editores, hooks: [{ type: 'command', command: L(`guarda --ia ${ia}`), timeout: 10 }] }],
  Stop: [{ hooks: [{ type: 'command', command: L(`lembrete --ia ${ia}`), timeout: 15 }] }],
});
// Claude Code
w('.claude-plugin/marketplace.json', { name: 'memoria-ia', owner: { name: 'oevetech' }, metadata: { description: DESC },
  plugins: [{ name: 'memoria-ia', version: V, source: './plugin', description: DESC }] });
w('plugin/.claude-plugin/plugin.json', { name: 'memoria-ia', version: V, description: DESC, author: { name: 'oevetech' }, repository: REPO, homepage: REPO, license: 'MIT', keywords: ['memoria', 'memory', 'contexto', 'retomada', 'pt-br'] });
w('plugin/hooks/hooks.json', { description: 'memoria-ia: entrega a retomada do projeto no inicio e lembra de registrar marcos', hooks: ganchos('claude', 'Edit|Write|MultiEdit|NotebookEdit|Bash') });
// Codex
w('.agents/plugins/marketplace.json', { name: 'memoria-ia', interface: { displayName: 'memoria-ia' },
  plugins: [{ name: 'memoria-ia', source: { source: 'local', path: './plugin' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }] });
const cx = ganchos('codex', '.*');
for (const ev of Object.values(cx)) for (const g of ev) for (const h of g.hooks) h.commandWindows = h.command;
w('plugin/hooks/codex-hooks.json', { hooks: cx });
w('plugin/.codex-plugin/plugin.json', { name: 'memoria-ia', version: V, description: DESC, author: { name: 'oevetech', url: 'https://github.com/oevetech' }, homepage: REPO, repository: REPO, license: 'MIT',
  skills: './skills/', hooks: './hooks/codex-hooks.json',
  interface: { displayName: 'memoria-ia', shortDescription: 'Retomada curta do projeto em toda sessao.', developerName: 'oevetech', category: 'Productivity', capabilities: ['Interactive', 'Write'], websiteURL: REPO } });
// Antigravity (Gemini): plugin em ~/.gemini/config/plugins/memoria-ia (comando roda na pasta do hooks.json)
w('plugin/plugin.json', { name: 'memoria-ia', author: { name: 'oevetech', url: 'https://github.com/oevetech' }, homepage: REPO, repository: REPO });
w('plugin/hooks.json', { 'memoria-ia': {
  SessionStart: [{ type: 'command', command: 'node scripts/memoria.mjs contexto --ia agy', timeout: 15 }],
  PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: 'node scripts/memoria.mjs guarda --ia agy', timeout: 10 }] }],
  Stop: [{ type: 'command', command: 'node scripts/memoria.mjs lembrete --ia agy', timeout: 15 }] } });
console.log('ok');
