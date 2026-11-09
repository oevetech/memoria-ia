#!/usr/bin/env node
// memoria-ia — memoria de projeto para IAs (Claude Code, Codex, Antigravity/Gemini).
// Sem servidor, sem banco, sem IA extra: so arquivos de texto no projeto + ganchos que leem esses arquivos.
// Ideias inspiradas no claude-mem (github.com/thedotmack/claude-mem, Apache-2.0); codigo proprio.
//
// Uso manual:  node memoria.mjs <comando> [...]
//   obs <tipo> <versao> "<titulo>" "<porque>" ["<arquivos>"]   registra 1 observacao (1 linha)
//   sessao "<pedido>" "<feito>" "<aprendido>" "<proximo>" ["<falhou>"]
//   buscar "<termo>"          indice: so as linhas que batem (barato)
//   ver <O-0012|S-003>        a entrada e as vizinhas (linha do tempo)
//   ultimas [N]               ultimas N observacoes
//   status                    onde esta a memoria e quanto custa ler
//   instalar [pasta] [nome]   cria o kit no projeto sem sobrescrever nada
// Ganchos (chamados pelas IAs): contexto --ia <claude|codex|agy>  |  lembrete --ia <...>

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const VERSAO = '1.0.1';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(AQUI, 'memoria.mjs');
// kit ao lado do script (~/.memoria-ia/kit) ou na pasta do plugin (plugin/kit)
const KIT = fs.existsSync(path.join(AQUI, 'kit')) ? path.join(AQUI, 'kit') : path.resolve(AQUI, '..', 'kit');
const ARQ_RETOMADA = 'CONTINUAR_AQUI.md';
const LIMITE_CONTEXTO = 6000;           // caracteres injetados no inicio da sessao (~1.500 tokens)
const LIMITE_LINHAS = 80;
const TIPOS = ['bugfix', 'feature', 'perf', 'refactor', 'mudanca', 'decisao', 'descoberta', 'seguranca'];
const ESTADO = path.join(os.homedir(), '.memoria-ia', 'estado.json');
const LEMBRETE_INTERVALO_MS = 30 * 60 * 1000;

// Quando chamado por `node -e "...import(...)" args`, argv[1] ja e o 1o argumento.
const argv = process.argv.slice(process.argv[1] && /memoria\.mjs$/i.test(process.argv[1]) ? 2 : 1);

// ------------------------------------------------------------------ utilidades
const ler = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const existe = (f) => { try { fs.accessSync(f); return true; } catch { return false; } };
const limpo = (s) => String(s ?? '').replace(/[\r\n|]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
const tokens = (s) => Math.ceil(s.length / 3.6);
const hoje = (comHora) => {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  const base = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
  return comHora ? `${base} ${p(d.getHours())}:${p(d.getMinutes())}` : base;
};
const cmd = () => `node "${SCRIPT}"`;

function acharRaiz(inicio) {
  let d = path.resolve(inicio || process.cwd());
  const casa = path.resolve(os.homedir());
  for (;;) {
    if (existe(path.join(d, ARQ_RETOMADA))) return d;
    const pai = path.dirname(d);
    if (pai === d || d === casa) return null;
    d = pai;
  }
}
function pareceProjeto(d) {
  if (!d || path.resolve(d) === path.resolve(os.homedir())) return false;
  return ['.git', 'package.json', 'platformio.ini', 'pyproject.toml', 'Cargo.toml', 'README.md', 'src']
    .some((n) => existe(path.join(d, n)));
}
function proximoId(texto, re, prefixo, digitos) {
  let max = 0;
  for (const m of texto.matchAll(re)) max = Math.max(max, parseInt(m[1], 10));
  return `${prefixo}-${String(max + 1).padStart(digitos, '0')}`;
}
function garantir(f, cabecalho) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (!existe(f)) fs.writeFileSync(f, cabecalho, 'utf8');
}
function raizOuSair() {
  const r = acharRaiz(process.cwd());
  if (!r) { console.log(`Sem ${ARQ_RETOMADA} aqui nem nas pastas acima. Crie o kit: ${cmd()} instalar`); process.exit(2); }
  return r;
}
async function lerStdin() {
  if (process.stdin.isTTY) return {};
  return new Promise((ok) => {
    let s = '';
    const fim = () => { try { ok(s.trim() ? JSON.parse(s) : {}); } catch { ok({}); } };
    const t = setTimeout(fim, 1500);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { s += c; });
    process.stdin.on('end', () => { clearTimeout(t); fim(); });
    process.stdin.on('error', () => { clearTimeout(t); ok({}); });
  });
}
const arqObs = (r) => path.join(r, 'memoria', 'OBSERVACOES.md');
const arqSes = (r) => path.join(r, 'memoria', 'SESSOES.md');
const CAB_OBS = '# Observacoes (so acrescentar; 1 linha cada; mais nova EMBAIXO)\n# ID | data | versao | tipo | titulo | porque | arquivos\n\n';
const CAB_SES = '# Sessoes (so acrescentar; mais nova EMBAIXO)\n\n';

// ------------------------------------------------------------------ comandos manuais
function obs([tipo, versao, titulo, porque, arquivos]) {
  if (!tipo || !titulo || !porque) { console.log(`uso: ${cmd()} obs <tipo> <versao> "<titulo>" "<porque>" ["<arquivos>"]`); process.exit(2); }
  if (!TIPOS.includes(tipo)) { console.log(`tipo invalido: ${tipo} (use: ${TIPOS.join(', ')})`); process.exit(2); }
  const r = raizOuSair(), f = arqObs(r);
  garantir(f, CAB_OBS);
  const id = proximoId(ler(f), /^O-(\d+)/gm, 'O', 4);
  let linha = `${id} | ${hoje()} | ${limpo(versao) || '-'} | ${tipo} | ${limpo(titulo)} | porque: ${limpo(porque)}`;
  if (arquivos) linha += ` | arq: ${limpo(arquivos)}`;
  fs.appendFileSync(f, linha + '\n', 'utf8');
  console.log(linha);
  console.log(`Lembrete: se mudou o rumo, reescreva "Agora"/"Proximo" em ${ARQ_RETOMADA}.`);
}
function sessao([pedido, feito, aprendido, proximo, falhou]) {
  if (!pedido || !feito) { console.log(`uso: ${cmd()} sessao "<pedido>" "<feito>" "<aprendido>" "<proximo>" ["<falhou>"]`); process.exit(2); }
  const r = raizOuSair(), f = arqSes(r);
  garantir(f, CAB_SES);
  const id = proximoId(ler(f), /^## S-(\d+)/gm, 'S', 3);
  let bloco = `## ${id} | ${hoje(true)}\n- Pedido: ${limpo(pedido)}\n- Feito: ${limpo(feito)}\n- Aprendido: ${limpo(aprendido) || '-'}\n- Proximo: ${limpo(proximo) || '-'}\n`;
  if (falhou) bloco += `- Falhou (nao repetir): ${limpo(falhou)}\n`;
  fs.appendFileSync(f, bloco + '\n', 'utf8');
  console.log(bloco);
}
function arquivosMemoria(r) {
  const lista = [path.join(r, ARQ_RETOMADA)];
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p); else if (/\.md$/i.test(e.name)) lista.push(p);
    }
  };
  if (existe(path.join(r, 'memoria'))) andar(path.join(r, 'memoria'));
  return lista;
}
function buscar([termo]) {
  if (!termo) { console.log(`uso: ${cmd()} buscar "<termo>"`); process.exit(2); }
  const r = raizOuSair(), t = termo.toLowerCase();
  let n = 0;
  for (const f of arquivosMemoria(r)) {
    ler(f).split(/\r?\n/).forEach((l, i) => {
      if (n < 40 && l.toLowerCase().includes(t)) { console.log(`${path.relative(r, f)}:${i + 1}: ${l.slice(0, 220)}`); n++; }
    });
  }
  if (!n) console.log('(nada encontrado)');
  else if (n >= 40) console.log('(parei em 40; refine o termo)');
}
function ver([id]) {
  if (!id) { console.log(`uso: ${cmd()} ver <O-0012|S-003>`); process.exit(2); }
  const r = raizOuSair();
  if (/^S-/i.test(id)) {
    const txt = ler(arqSes(r)), m = txt.split(/^(?=## S-)/m).find((b) => b.startsWith(`## ${id.toUpperCase()}`));
    console.log(m ? m.trim() : '(sessao nao encontrada)');
    return;
  }
  const linhas = ler(arqObs(r)).split(/\r?\n/).filter((l) => /^O-\d+/.test(l));
  const i = linhas.findIndex((l) => l.startsWith(id.toUpperCase()));
  if (i < 0) { console.log('(observacao nao encontrada)'); return; }
  linhas.slice(Math.max(0, i - 2), i + 3).forEach((l, k) => console.log((Math.max(0, i - 2) + k === i ? '>> ' : '   ') + l));
}
function ultimas([n]) {
  const r = raizOuSair();
  const linhas = ler(arqObs(r)).split(/\r?\n/).filter((l) => /^O-\d+/.test(l));
  console.log(linhas.slice(-(parseInt(n, 10) || 10)).join('\n') || '(sem observacoes ainda)');
}
function status() {
  const r = acharRaiz(process.cwd());
  if (!r) { console.log(`Sem memoria neste projeto. Para criar: ${cmd()} instalar`); return; }
  const t = ler(path.join(r, ARQ_RETOMADA)), linhas = t.split(/\r?\n/).length;
  const nObs = (ler(arqObs(r)).match(/^O-\d+/gm) || []).length, nSes = (ler(arqSes(r)).match(/^## S-\d+/gm) || []).length;
  console.log(`memoria-ia ${VERSAO} | projeto: ${r}`);
  console.log(`${ARQ_RETOMADA}: ${linhas} linhas, ~${tokens(t)} tokens${linhas > LIMITE_LINHAS ? `  << passou de ${LIMITE_LINHAS}: mova o excesso para memoria/arquivo/` : ''}`);
  console.log(`observacoes: ${nObs} | sessoes: ${nSes}`);
}
function instalar([destino, nome]) {
  const d = path.resolve(destino || process.cwd());
  if (!existe(d)) { console.log(`Pasta nao existe: ${d}`); process.exit(1); }
  if (path.resolve(d) === path.resolve(os.homedir())) { console.log('Nao instalo na pasta do usuario; entre na pasta do projeto.'); process.exit(1); }
  const nomeProj = nome || path.basename(d);
  const itens = ['CONTINUAR_AQUI.md', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md', 'memoria/OBSERVACOES.md', 'memoria/SESSOES.md', 'memoria/arquivo/LEIA.md'];
  for (const i of itens) {
    const de = path.join(KIT, i), para = path.join(d, i);
    if (existe(para)) {
      if (/^(CLAUDE|AGENTS|GEMINI)\.md$/.test(i)) {
        const t = ler(para);
        if (!t.includes(ARQ_RETOMADA)) {
          fs.writeFileSync(para, `> **IAs: leiam primeiro \`${ARQ_RETOMADA}\`** (retomada curta do projeto; regras de registro la dentro).\n\n` + t, 'utf8');
          console.log(`aviso no topo: ${i}`);
        } else console.log(`ja aponta, mantido: ${i}`);
      } else console.log(`ja existe, mantido: ${i}`);
      continue;
    }
    fs.mkdirSync(path.dirname(para), { recursive: true });
    let t = ler(de);
    if (i === ARQ_RETOMADA) t = t.replace('<NOME DO PROJETO>', nomeProj);
    fs.writeFileSync(para, t, 'utf8');
    console.log(`criado: ${i}`);
  }
  console.log(`Pronto. Preencha "Agora", "Proximo" e "Como trabalhar aqui" em ${ARQ_RETOMADA}.`);
}

// ------------------------------------------------------------------ ganchos
function opt(nome, padrao) { const i = argv.indexOf(`--${nome}`); return i >= 0 ? argv[i + 1] : padrao; }
function cwdDoGancho(e) { return e.cwd || (Array.isArray(e.workspacePaths) && e.workspacePaths[0]) || process.cwd(); }
function responder(ia, evento, texto, bloquear) {
  if (ia === 'agy') {
    if (evento === 'SessionStart') return console.log(JSON.stringify(texto ? { injectSteps: [{ systemMessage: { systemMessage: texto } }] } : {}));
    return console.log(JSON.stringify(bloquear ? { decision: 'continue', reason: texto } : {}));
  }
  if (ia === 'texto') { if (texto) console.log(texto); return; }
  if (evento === 'SessionStart') return console.log(JSON.stringify(texto ? { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texto } } : {}));
  return console.log(JSON.stringify(bloquear ? { decision: 'block', reason: texto } : {}));
}
function comandosCurtos() {
  return [
    '## Comandos memoria-ia (use estes; nao leia arquivos grandes inteiros)',
    `- Registrar marco: ${cmd()} obs <${TIPOS.join('|')}> <versao> "<titulo>" "<porque>" ["<arquivos>"]`,
    `- Fim da sessao:   ${cmd()} sessao "<pedido>" "<feito>" "<aprendido>" "<proximo>" ["<o que falhou>"]`,
    `- Procurar:        ${cmd()} buscar "<termo>"   |   ${cmd()} ver <O-0012>`,
    `- Marco = bug corrigido, funcao entregue, decisao do usuario, descoberta que muda o rumo. Nao registre o obvio pelo codigo/git.`,
    `- Depois de um marco, REESCREVA "Agora" e "Proximo" no ${ARQ_RETOMADA}.`,
  ].join('\n');
}
async function contexto() {
  const ia = opt('ia', 'texto'), e = await lerStdin();
  const base = cwdDoGancho(e), r = acharRaiz(base);
  if (!r) {
    if (!pareceProjeto(base)) return responder(ia, 'SessionStart', '');
    return responder(ia, 'SessionStart',
      `memoria-ia: esta pasta ainda nao tem ${ARQ_RETOMADA}. Se o usuario for trabalhar neste projeto, ofereca criar a memoria (barato): ${cmd()} instalar "${base}"`);
  }
  let t = ler(path.join(r, ARQ_RETOMADA)).replace(/^﻿/, '');
  let aviso = '';
  if (t.length > LIMITE_CONTEXTO) {
    t = t.slice(0, LIMITE_CONTEXTO);
    aviso = `\n\n[memoria-ia: ${ARQ_RETOMADA} passou de ${LIMITE_CONTEXTO} caracteres e foi cortado. Resuma-o (regra: ~${LIMITE_LINHAS} linhas; excesso vai para memoria/arquivo/).]`;
  }
  const obsLinhas = ler(arqObs(r)).split(/\r?\n/).filter((l) => /^O-\d+/.test(l)).slice(-5);
  const novas = obsLinhas.filter((l) => !t.includes(l.split(' | ')[0]));
  const extra = novas.length ? `\n\n## Observacoes recentes que ainda nao estao no ${ARQ_RETOMADA}\n${novas.map((l) => '- ' + l.slice(0, 200)).join('\n')}` : '';
  const corpo = `${t}${aviso}${extra}\n\n${comandosCurtos()}`;
  const cab = `# memoria-ia: retomada do projeto (${path.basename(r)}) | ~${tokens(corpo)} tokens | leia antes de agir\n\n`;
  responder(ia, 'SessionStart', cab + corpo);
}
function lerEstado() { try { return JSON.parse(ler(ESTADO)) || {}; } catch { return {}; } }
function salvarEstado(s) {
  try {
    fs.mkdirSync(path.dirname(ESTADO), { recursive: true });
    const chaves = Object.keys(s).sort((a, b) => (s[b] || 0) - (s[a] || 0)).slice(0, 200);
    fs.writeFileSync(ESTADO, JSON.stringify(Object.fromEntries(chaves.map((k) => [k, s[k]]))), 'utf8');
  } catch { /* sem estado: so deixa de limitar a frequencia */ }
}
// Le a transcricao da sessao (JSONL de qualquer uma das IAs) e diz se houve edicao de arquivo
// depois do ultimo registro na memoria. Heuristica por texto: barata e sem depender do formato exato.
const RE_EDICAO = /"(?:name|tool_name|type)"\s*:\s*"(?:Edit|Write|MultiEdit|NotebookEdit|apply_patch|write_file|replace|edit_file|write_to_file|replace_file_content|multi_replace_file_content|create_file)"/;
const RE_MEMORIA = /CONTINUAR_AQUI\.md|OBSERVACOES\.md|SESSOES\.md|memoria\.(?:mjs|ps1)[^"\n]{0,40}\b(?:obs|sessao)\b/;
function editouSemRegistrar(transcricao) {
  if (!transcricao || !existe(transcricao)) return false;
  let txt;
  try {
    const st = fs.statSync(transcricao), max = 3 * 1024 * 1024;
    const fd = fs.openSync(transcricao, 'r'), ini = Math.max(0, st.size - max), buf = Buffer.alloc(st.size - ini);
    fs.readSync(fd, buf, 0, buf.length, ini); fs.closeSync(fd);
    txt = buf.toString('utf8');
  } catch { return false; }
  let ultEd = -1, ultMem = -1;
  txt.split('\n').forEach((l, i) => {
    if (RE_MEMORIA.test(l)) ultMem = i;
    else if (RE_EDICAO.test(l)) ultEd = i;
  });
  return ultEd > ultMem;
}
async function lembrete() {
  const ia = opt('ia', 'texto'), e = await lerStdin();
  if (process.env.MEMORIA_IA_LEMBRETE === '0') return responder(ia, 'Stop', '', false);
  if (e.stop_hook_active || e.stopHookActive) return responder(ia, 'Stop', '', false);
  if (ia === 'agy' && e.terminationReason && e.terminationReason !== 'NO_TOOL_CALL') return responder(ia, 'Stop', '', false);
  const r = acharRaiz(cwdDoGancho(e));
  if (!r) return responder(ia, 'Stop', '', false);
  const sessaoId = e.session_id || e.conversationId || 'sem-id';
  const est = lerEstado(), agora = Date.now();
  if (est[sessaoId] && agora - est[sessaoId] < LEMBRETE_INTERVALO_MS) return responder(ia, 'Stop', '', false);
  if (!editouSemRegistrar(e.transcript_path || e.transcriptPath)) return responder(ia, 'Stop', '', false);
  est[sessaoId] = agora; salvarEstado(est);
  responder(ia, 'Stop',
    `memoria-ia: voce alterou arquivos nesta sessao e nao registrou nada na memoria do projeto (${ARQ_RETOMADA}). ` +
    `Se houve um MARCO (bug corrigido, funcao entregue, decisao do usuario, descoberta importante): registre com ` +
    `${cmd()} obs <tipo> <versao> "<titulo>" "<porque>" ["<arquivos>"] e reescreva "Agora"/"Proximo" em ${ARQ_RETOMADA}. ` +
    `Se foi so uma mudanca pequena/obvia, nao registre: apenas encerre normalmente. Seja breve (economia de credito).`, true);
}

// ------------------------------------------------------------------ principal
const [comando, ...resto] = argv;
const tabela = { obs, sessao, buscar, ver, ultimas, status, instalar, contexto, lembrete };
if (!comando || !tabela[comando]) {
  console.log(`memoria-ia ${VERSAO}\ncomandos: obs | sessao | buscar | ver | ultimas | status | instalar  (ganchos: contexto, lembrete)\nexemplo: ${cmd()} obs bugfix 1.2 "Botao nao salvava" "faltava await no fetch" "app.js"`);
  process.exit(comando ? 2 : 0);
}
try { await tabela[comando](resto); }
catch (err) {
  // Gancho nunca pode travar a IA: em erro, responde vazio.
  if (comando === 'contexto' || comando === 'lembrete') { console.log('{}'); process.exit(0); }
  console.error(`memoria-ia: ${err.message}`); process.exit(1);
}
