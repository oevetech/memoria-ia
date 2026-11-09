#!/usr/bin/env node
// Instalador da memoria-ia: configura Claude Code, Codex e Antigravity/Gemini no SEU usuario (vale para todo projeto).
//   node instalar.mjs              instala/atualiza usando o GitHub (oevetech/memoria-ia)
//   node instalar.mjs --local      usa esta pasta como fonte (para testar antes de publicar)
//   node instalar.mjs --remover    desfaz (plugins, ganchos, blocos de instrucao); nao apaga a memoria dos projetos
//   node instalar.mjs --so claude,codex,agy   limita a algumas IAs
// Nunca sobrescreve configuracoes inteiras: so acrescenta/retira o que e da memoria-ia, com backup antes.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.join(RAIZ, 'plugin');
const HOME = os.homedir();
const NOME = 'memoria-ia';
const GITHUB = 'oevetech/memoria-ia';
const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const REMOVER = args.includes('--remover');
const SO = (() => { const i = args.indexOf('--so'); return i >= 0 ? args[i + 1].split(',') : ['claude', 'codex', 'agy']; })();
const FONTE = LOCAL ? RAIZ : GITHUB;
const MARCA_INI = '<!-- memoria-ia:inicio -->', MARCA_FIM = '<!-- memoria-ia:fim -->';

const log = (s) => console.log(s);
const existe = (f) => { try { fs.accessSync(f); return true; } catch { return false; } };
const ler = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
function backup(f) { if (existe(f)) { const b = `${f}.bak-memoria-ia`; if (!existe(b)) fs.copyFileSync(f, b); } }
function rodar(prog, a) {
  const r = spawnSync(prog, a, { encoding: 'utf8', shell: process.platform === 'win32' });
  return { ok: r.status === 0, saida: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}
function temComando(prog) { return rodar(prog, ['--version']).ok; }
function copiarPasta(de, para) {
  fs.mkdirSync(para, { recursive: true });
  for (const e of fs.readdirSync(de, { withFileTypes: true })) {
    const a = path.join(de, e.name), b = path.join(para, e.name);
    if (e.isDirectory()) copiarPasta(a, b); else fs.copyFileSync(a, b);
  }
}
function blocoEm(arquivo, texto) {
  backup(arquivo);
  let t = ler(arquivo);
  const re = new RegExp(`\\n?${MARCA_INI}[\\s\\S]*?${MARCA_FIM}\\n?`, 'g');
  t = t.replace(re, '\n').trimEnd();
  if (texto) t = (t ? t + '\n\n' : '') + `${MARCA_INI}\n${texto.trim()}\n${MARCA_FIM}\n`;
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, t ? t + (t.endsWith('\n') ? '' : '\n') : '', 'utf8');
}
const INSTRUCAO = `# memoria-ia (instrucao global)
- Em todo projeto com \`CONTINUAR_AQUI.md\`: leia-o antes de agir (ele chega no inicio da sessao pelo gancho) e siga as regras do topo dele.
- A cada marco (bug corrigido, funcao entregue, decisao do usuario, descoberta): \`node "${path.join(HOME, '.memoria-ia', 'memoria.mjs')}" obs <tipo> <versao> "<titulo>" "<porque>" ["<arquivos>"]\` e reescreva "Agora"/"Proximo" no CONTINUAR_AQUI.md.
- Procurar historico: \`... memoria.mjs buscar "<termo>"\` e \`... memoria.mjs ver <ID>\`; nunca leia arquivos grandes inteiros.
- Projeto sem \`CONTINUAR_AQUI.md\` em que o usuario vai trabalhar: ofereca \`... memoria.mjs instalar\`.`;

// ---------------------------------------------------------------- base comum (~/.memoria-ia)
function base() {
  const d = path.join(HOME, '.memoria-ia');
  if (REMOVER) { for (const f of ['memoria.mjs', 'kit']) fs.rmSync(path.join(d, f), { recursive: true, force: true }); log('- ~/.memoria-ia: script e kit removidos'); return; }
  fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(path.join(PLUGIN, 'scripts', 'memoria.mjs'), path.join(d, 'memoria.mjs'));
  fs.rmSync(path.join(d, 'kit'), { recursive: true, force: true });
  copiarPasta(path.join(PLUGIN, 'kit'), path.join(d, 'kit'));
  log(`- ~/.memoria-ia: script e kit atualizados (${path.join(d, 'memoria.mjs')})`);
}

// ---------------------------------------------------------------- Claude Code
function claude() {
  if (!temComando('claude')) { log('- Claude Code: nao encontrado, pulei'); return; }
  if (REMOVER) {
    rodar('claude', ['plugin', 'uninstall', `${NOME}@${NOME}`]);
    rodar('claude', ['plugin', 'marketplace', 'remove', NOME]);
    log('- Claude Code: plugin e marketplace removidos'); return;
  }
  let r = rodar('claude', ['plugin', 'marketplace', 'add', FONTE]);
  if (!r.ok && /already|ja existe|exists/i.test(r.saida)) r = rodar('claude', ['plugin', 'marketplace', 'update', NOME]);
  if (!r.ok) { log(`- Claude Code: falhou ao adicionar o marketplace:\n  ${r.saida.split('\n').slice(-3).join('\n  ')}`); return; }
  r = rodar('claude', ['plugin', 'install', `${NOME}@${NOME}`, '--scope', 'user']);
  log(r.ok || /already|instalad/i.test(r.saida) ? '- Claude Code: plugin instalado (vale para todos os projetos; reinicie o Claude Code)'
    : `- Claude Code: falhou ao instalar o plugin:\n  ${r.saida.split('\n').slice(-3).join('\n  ')}`);
}

// ---------------------------------------------------------------- Codex
function ligarHooksCodex(toml) {
  if (/^\[features\][^[]*?^\s*hooks\s*=\s*true/m.test(toml)) return toml;
  if (/^\[features\]/m.test(toml)) {
    if (/^\[features\][^[]*?^\s*hooks\s*=/m.test(toml)) return toml.replace(/(^\[features\][^[]*?^\s*hooks\s*=\s*)\w+/m, '$1true');
    return toml.replace(/^\[features\]\s*$/m, '[features]\nhooks = true');
  }
  return toml.trimEnd() + '\n\n[features]\nhooks = true\n';
}
function codex() {
  if (!temComando('codex')) { log('- Codex: nao encontrado, pulei'); return; }
  const dir = process.env.CODEX_HOME || path.join(HOME, '.codex');
  if (REMOVER) {
    rodar('codex', ['plugin', 'remove', `${NOME}@${NOME}`]);
    rodar('codex', ['plugin', 'marketplace', 'remove', NOME]);
    blocoEm(path.join(dir, 'AGENTS.md'), '');
    log('- Codex: plugin, marketplace e instrucao global removidos (a chave [features] hooks foi mantida)'); return;
  }
  let r = rodar('codex', ['plugin', 'marketplace', 'add', FONTE]);
  if (!r.ok && /already/i.test(r.saida)) { rodar('codex', ['plugin', 'marketplace', 'remove', NOME]); r = rodar('codex', ['plugin', 'marketplace', 'add', FONTE]); }
  if (!r.ok) { log(`- Codex: falhou ao adicionar o marketplace:\n  ${r.saida.split('\n').slice(-3).join('\n  ')}`); return; }
  r = rodar('codex', ['plugin', 'add', `${NOME}@${NOME}`]);
  const cfg = path.join(dir, 'config.toml');
  backup(cfg);
  const antes = ler(cfg), depois = ligarHooksCodex(antes);
  if (depois !== antes) fs.writeFileSync(cfg, depois, 'utf8');
  blocoEm(path.join(dir, 'AGENTS.md'), INSTRUCAO);
  log(r.ok || /already/i.test(r.saida) ? '- Codex: plugin instalado, ganchos ligados ([features] hooks = true) e instrucao global em ~/.codex/AGENTS.md (reinicie o Codex e confie nos ganchos se ele perguntar)'
    : `- Codex: falhou ao instalar o plugin:\n  ${r.saida.split('\n').slice(-3).join('\n  ')}`);
}

// ---------------------------------------------------------------- Antigravity / Gemini
function agy() {
  const g = path.join(HOME, '.gemini');
  if (!existe(g)) { log('- Antigravity/Gemini: ~/.gemini nao existe, pulei'); return; }
  const destino = path.join(g, 'config', 'plugins', NOME);
  if (REMOVER) {
    fs.rmSync(destino, { recursive: true, force: true });
    blocoEm(path.join(g, 'GEMINI.md'), '');
    log('- Antigravity/Gemini: plugin e instrucao global removidos'); return;
  }
  fs.rmSync(destino, { recursive: true, force: true });
  copiarPasta(PLUGIN, destino);
  blocoEm(path.join(g, 'GEMINI.md'), INSTRUCAO);  // Gemini CLI classico le ~/.gemini/GEMINI.md
  log(`- Antigravity/Gemini: plugin em ${destino} (ganchos, regra e skills) + instrucao em ~/.gemini/GEMINI.md`);
}

log(`memoria-ia — ${REMOVER ? 'removendo' : `instalando (fonte: ${FONTE})`}`);
base();
if (SO.includes('claude')) claude();
if (SO.includes('codex')) codex();
if (SO.includes('agy') || SO.includes('gemini')) agy();
log(REMOVER ? 'Pronto. A memoria dos projetos (CONTINUAR_AQUI.md e memoria/) continua nos projetos.'
  : 'Pronto. Abra uma sessao nova num projeto: a retomada chega sozinha. Projeto sem memoria? Peca "instale a memoria-ia aqui".');
