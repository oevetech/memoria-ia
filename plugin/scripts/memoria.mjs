#!/usr/bin/env node
// memoria-ia — memoria de projeto para IAs (Claude Code, Codex, Antigravity/Gemini) trabalhando JUNTAS nos mesmos arquivos.
// Sem servidor, sem banco, sem IA extra: so arquivos de texto no projeto + ganchos que leem esses arquivos.
// Ideias inspiradas no claude-mem (github.com/thedotmack/claude-mem, Apache-2.0); codigo proprio e independente.
//
// Uso:  node memoria.mjs [--ia <claude|codex|agy>] <comando> [...]
//   obs <tipo> <versao> "<titulo>" "<porque>" ["<arquivos>"]    1 linha em memoria/OBSERVACOES.md
//   agora "<linha>" ["<linha>"...]          reescreve so a secao Agora do CONTINUAR_AQUI.md
//   proximo "<passo>" ["<passo>"...]        reescreve so a secao Proximo (numera sozinho)
//   pendencia add "<texto>" | pendencia fechar P-03 "<como resolveu>"   (fechar vira obs bugfix)
//   anotar <secao> "<linha>"                acrescenta 1 item numa secao (decisoes, armadilhas, sempre...)
//   secao [<nome>]                          mostra uma secao (sem nome: lista as secoes)
//   buscar "<termo>" | ver <O-0012|S-003> | ultimas [N]
//   sessao "<pedido>" "<feito>" "<aprendido>" "<proximo>" ["<falhou>"]   (libera a trava se for sua)
//   trava ver | trava pegar "<tarefa>" | trava liberar      (liberar trava de OUTRA IA: so o usuario, --forcar)
//   status [pasta] | instalar [pasta] [nome]            (--pasta <projeto> em qualquer comando = rodar como se estivesse la)
//   cerebro iniciar "<pasta>" | buscar "<erro>" | ver <E-AND-0001> | status
//   cerebro anotar <AREA> "<erro exato>" "<causa>" "<solucao>" ["tags"] ["o que nao funcionou"] | somar <ID> "<nota>"
//     -> catalogo CENTRAL de erros/solucoes de todos os projetos (pasta unica, fora dos projetos)
// Ganchos: contexto (inicio da sessao) | guarda (antes de editar: trava) | lembrete (fim do turno)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const VERSAO = '1.2.0';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(AQUI, 'memoria.mjs');
// kit ao lado do script (~/.memoria-ia/kit) ou na pasta do plugin (plugin/kit)
const KIT = fs.existsSync(path.join(AQUI, 'kit')) ? path.join(AQUI, 'kit') : path.resolve(AQUI, '..', 'kit');
const ARQ_RETOMADA = 'CONTINUAR_AQUI.md';
const ARQ_TRAVA = '.memoria-ia-trava.json';
const LIMITE_COMPLETO = 6000;
const LIMITE_LINHAS = 80;
const TIPOS = ['bugfix', 'feature', 'perf', 'refactor', 'mudanca', 'decisao', 'descoberta', 'seguranca'];
const ESTADO = path.join(os.homedir(), '.memoria-ia', 'estado.json');
const LEMBRETE_INTERVALO_MS = 30 * 60 * 1000;
const NOMES_IA = { claude: 'Claude', codex: 'Codex', agy: 'Gemini/Antigravity', texto: 'usuario' };
const SEMPRE_INJETAR = ['sempre', 'agora', 'proximo', 'pendencias'];   // secoes da retomada curta, nesta ordem
const FERRAMENTAS_EDICAO = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'apply_patch', 'write_file', 'replace', 'edit_file',
  'write_to_file', 'replace_file_content', 'multi_replace_file_content', 'create_file']);

// ------------------------------------------------------------------ argumentos
// `node -e "...import(...)" args` poe o 1o argumento em argv[1].
const brutos = process.argv.slice(process.argv[1] && /memoria\.mjs$/i.test(process.argv[1]) ? 2 : 1);
const opcoes = {};
const argv = [];
for (let i = 0; i < brutos.length; i++) {
  if (brutos[i] === '--ia' || brutos[i] === '--nivel' || brutos[i] === '--pasta') { opcoes[brutos[i].slice(2)] = brutos[++i]; continue; }
  if (brutos[i] === '--forcar') { opcoes.forcar = true; continue; }
  argv.push(brutos[i]);
}
// 1.2: --pasta <projeto> = rodar como se estivesse dentro dele (IA que roda comandos de outra pasta, ex.: Codex).
if (opcoes.pasta) { try { process.chdir(path.resolve(opcoes.pasta)); } catch { console.log(`Pasta nao existe: ${opcoes.pasta}`); process.exit(1); } }
const IA = (opcoes.ia || process.env.MEMORIA_IA_QUEM || 'texto').toLowerCase();

// ------------------------------------------------------------------ utilidades
const ler = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const existe = (f) => { try { fs.accessSync(f); return true; } catch { return false; } };
const limpo = (s) => String(s ?? '').replace(/[\r\n|]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
const tokens = (s) => Math.ceil(s.length / 3.6);
const norm = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const p2 = (n) => String(n).padStart(2, '0');
const hoje = (comHora) => {
  const d = new Date(), base = `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
  return comHora ? `${base} ${p2(d.getHours())}:${p2(d.getMinutes())}` : base;
};
const diaMes = () => { const d = new Date(); return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}`; };
const quando = (iso) => { const d = new Date(iso); return isNaN(d) ? String(iso) : `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const cmd = (ia = IA) => `node "${SCRIPT}"${ia && ia !== 'texto' ? ` --ia ${ia}` : ''}`;
const sair = (msg, codigo = 2) => { console.log(msg); process.exit(codigo); };

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
  return ['.git', 'package.json', 'platformio.ini', 'pyproject.toml', 'Cargo.toml', 'README.md', 'src'].some((n) => existe(path.join(d, n)));
}
function proximoId(texto, re, prefixo, digitos) {
  let max = 0;
  for (const m of texto.matchAll(re)) max = Math.max(max, parseInt(m[1], 10));
  return `${prefixo}-${String(max + 1).padStart(digitos, '0')}`;
}
function garantir(f, cabecalho) { fs.mkdirSync(path.dirname(f), { recursive: true }); if (!existe(f)) fs.writeFileSync(f, cabecalho, 'utf8'); }
function raizOuSair() {
  const r = acharRaiz(process.cwd());
  if (!r) sair(`Sem ${ARQ_RETOMADA} aqui nem nas pastas acima. Crie o kit: ${cmd()} instalar`);
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
const arqRet = (r) => path.join(r, ARQ_RETOMADA);
const CAB_OBS = '# Observacoes (so acrescentar; 1 linha cada; mais nova EMBAIXO)\n# ID | data | versao | tipo | titulo | porque | arquivos\n\n';
const CAB_SES = '# Sessoes (so acrescentar; mais nova EMBAIXO)\n\n';

// ------------------------------------------------------------------ secoes do CONTINUAR_AQUI (## Titulo)
function secoes(texto) {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/), lista = [];
  linhas.forEach((l, i) => { if (/^## /.test(l)) lista.push({ titulo: l.slice(3).trim(), ini: i }); });
  lista.forEach((s, k) => {
    s.fim = k + 1 < lista.length ? lista[k + 1].ini : linhas.length;
    s.corpo = linhas.slice(s.ini + 1, s.fim).join('\n').trim();
  });
  return { linhas, lista };
}
const acharSecao = (lista, chave) => lista.find((s) => norm(s.titulo).startsWith(norm(chave)));
function trocarCorpo(texto, chave, corpo, tituloNovo) {
  const { linhas, lista } = secoes(texto), s = acharSecao(lista, chave);
  if (!s) return `${linhas.join('\n').trimEnd()}\n\n## ${tituloNovo || chave}\n${corpo.trim()}\n`;
  const antes = linhas.slice(0, s.ini + 1), depois = linhas.slice(s.fim);
  return [...antes, ...corpo.trim().split('\n'), ...(depois.length ? [''] : []), ...depois].join('\n').replace(/\n*$/, '\n');
}
// Secao ainda com o modelo do kit (toda linha tem <...>) ou marcada (nenhuma): conta como vazia.
const ehModelo = (corpo) => !corpo || corpo.split('\n').filter((l) => l.trim()).every((l) => /<[^>]+>/.test(l) || /^\s*-?\s*\(nenhuma\)\s*$/.test(l));
const TITULOS = { agora: 'Agora', proximo: 'Próximo', pendencias: 'Pendências abertas', decisoes: 'Decisões que valem (não refazer sem o dono pedir)',
  armadilhas: 'Armadilhas conhecidas', sempre: 'Sempre (regras deste projeto)', como: 'Como trabalhar aqui' };

// ------------------------------------------------------------------ integridade (fecha a brecha de rodar copia alterada)
function hashArquivo(f) { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); } catch { return ''; } }
function avisoIntegridade() {
  const lado = path.join(AQUI, 'memoria.mjs.sha256');
  if (!existe(lado)) return '';
  const esperado = ler(lado).trim().split(/\s+/)[0];
  return esperado && esperado !== hashArquivo(SCRIPT)
    ? `AVISO memoria-ia: a copia ${SCRIPT} foi ALTERADA fora do instalador. Nao confie nela; avise o usuario para rodar o instalador (node instalar.mjs).`
    : '';
}

// ------------------------------------------------------------------ trava (varias IAs, mesmos arquivos)
const arqTrava = (r) => path.join(r, ARQ_TRAVA);
function lerTrava(r) { try { return JSON.parse(ler(arqTrava(r))); } catch { return null; } }
function gravarTrava(r, t) { fs.writeFileSync(arqTrava(r), JSON.stringify(t, null, 2) + '\n', 'utf8'); }
const nomeIA = (ia) => NOMES_IA[ia] || ia;
function textoTrava(t) { return `${nomeIA(t.dono)} desde ${quando(t.desde)}${t.tarefa ? ` (${t.tarefa})` : ''}`; }
function mensagemBloqueio(t) {
  return `TRAVA memoria-ia: este projeto esta sendo editado por ${textoTrava(t)}. NAO edite nada. ` +
    `Avise o usuario que existe essa trava; so ele libera (no terminal dele): ${cmd('texto')} trava liberar --forcar`;
}
function trava([acao, ...resto]) {
  const r = raizOuSair(), t = lerTrava(r);
  if (!acao || acao === 'ver') return console.log(t ? `TRAVADO por ${textoTrava(t)}; ultima edicao ${quando(t.renovada || t.desde)}` : 'LIVRE');
  if (acao === 'pegar') {
    if (IA === 'texto') sair('Diga quem pega a trava: --ia <claude|codex|agy>');
    if (t && t.dono !== IA) sair(mensagemBloqueio(t), 3);
    const agora = new Date().toISOString();
    gravarTrava(r, { dono: IA, tarefa: limpo(resto.join(' ')) || (t && t.tarefa) || '', desde: t ? t.desde : agora, renovada: agora });
    return console.log(`Trava com ${nomeIA(IA)}.`);
  }
  if (acao === 'liberar') {
    if (!t) return console.log('Ja estava LIVRE.');
    if (t.dono !== IA && !opcoes.forcar) sair(`A trava e de ${nomeIA(t.dono)}. So o usuario libera trava de outra IA: ${cmd('texto')} trava liberar --forcar`, 3);
    fs.rmSync(arqTrava(r), { force: true });
    return console.log(`LIVRE (era de ${nomeIA(t.dono)}).`);
  }
  sair('uso: trava ver | trava pegar "<tarefa>" | trava liberar [--forcar]');
}

// ------------------------------------------------------------------ comandos manuais
function obsEm(r, tipo, versao, titulo, porque, arquivos) {
  const f = arqObs(r);
  garantir(f, CAB_OBS);
  const id = proximoId(ler(f), /^O-(\d+)/gm, 'O', 4);
  let linha = `${id} | ${hoje()} | ${limpo(versao) || '-'} | ${tipo} | ${limpo(titulo)} | porque: ${limpo(porque)}`;
  if (arquivos) linha += ` | arq: ${limpo(arquivos)}`;
  fs.appendFileSync(f, linha + '\n', 'utf8');
  return linha;
}
function obs([tipo, versao, titulo, porque, arquivos]) {
  if (!tipo || !titulo || !porque) sair(`uso: ${cmd()} obs <tipo> <versao> "<titulo>" "<porque>" ["<arquivos>"]`);
  if (!TIPOS.includes(tipo)) sair(`tipo invalido: ${tipo} (use: ${TIPOS.join(', ')})`);
  console.log(obsEm(raizOuSair(), tipo, versao, titulo, porque, arquivos));
  console.log(`Se mudou o rumo: ${cmd()} agora "..." / proximo "..."`);
}
function editarSecao(chave, corpo) {
  const r = raizOuSair(), f = arqRet(r);
  fs.writeFileSync(f, trocarCorpo(ler(f), chave, corpo, TITULOS[chave]), 'utf8');
  return r;
}
function agoraCmd(linhas) {
  if (!linhas.length) sair(`uso: ${cmd()} agora "<linha>" ["<linha>"...]   (ex.: "Estado: ..." "Versao: ..." "Como voltar: ...")`);
  editarSecao('agora', linhas.map((l) => (/^\s*[-*]/.test(l) ? l : `- ${limpo(l)}`)).join('\n'));
  console.log('Agora atualizado.');
}
function proximoCmd(passos) {
  if (!passos.length) sair(`uso: ${cmd()} proximo "<passo>" ["<passo>"...]`);
  editarSecao('proximo', passos.map((p, i) => `${i + 1}. ${limpo(p).replace(/^\d+[.)]\s*/, '')}`).join('\n'));
  console.log('Proximo atualizado.');
}
function pendencia([acao, a, b]) {
  const r = raizOuSair(), f = arqRet(r), texto = ler(f);
  const { lista } = secoes(texto), s = acharSecao(lista, 'pendencias');
  const corpo = s && !ehModelo(s.corpo) ? s.corpo : '';
  if (acao === 'add' && a) {
    const id = proximoId(texto + '\n' + ler(arqObs(r)), /\bP-(\d+)/g, 'P', 2);
    fs.writeFileSync(f, trocarCorpo(texto, 'pendencias', `${corpo}\n- ${id} ${limpo(a)} (desde ${diaMes()})`, TITULOS.pendencias), 'utf8');
    return console.log(`${id} registrada.`);
  }
  if (acao === 'fechar' && a) {
    const id = a.toUpperCase(), linhas = corpo.split('\n');
    const alvo = linhas.find((l) => new RegExp(`\\b${id}\\b`).test(l));
    if (!alvo) sair(`${id} nao esta em Pendencias.`);
    const resto = linhas.filter((l) => l !== alvo).join('\n').trim();
    fs.writeFileSync(f, trocarCorpo(texto, 'pendencias', resto || '- (nenhuma)', TITULOS.pendencias), 'utf8');
    const desc = alvo.replace(/^[-*]\s*/, '').replace(new RegExp(`^${id}\\s*`), '').replace(/\s*\(desde [^)]*\)\s*$/, '');
    return console.log(obsEm(r, 'bugfix', '-', `Resolvida ${id}: ${desc}`, b || 'resolvida'));
  }
  sair(`uso: ${cmd()} pendencia add "<texto>"  |  ${cmd()} pendencia fechar P-03 "<como resolveu>"`);
}
function anotar([chave, linha]) {
  if (!chave || !linha) sair(`uso: ${cmd()} anotar <decisoes|armadilhas|sempre|como|...> "<linha>"`);
  const r = raizOuSair(), f = arqRet(r), texto = ler(f), s = acharSecao(secoes(texto).lista, chave);
  const corpo = s && !ehModelo(s.corpo) ? s.corpo + '\n' : '';
  fs.writeFileSync(f, trocarCorpo(texto, chave, `${corpo}- ${limpo(linha)} (${diaMes()})`, TITULOS[norm(chave)] || chave), 'utf8');
  console.log(`Anotado em ${s ? s.titulo : chave}.`);
}
function secao([nome]) {
  const r = raizOuSair(), { lista } = secoes(ler(arqRet(r)));
  if (!nome) return console.log(lista.map((s) => `${s.titulo} (${s.corpo ? s.corpo.split('\n').length : 0} linhas)`).join('\n'));
  const s = acharSecao(lista, nome);
  console.log(s ? `## ${s.titulo}\n${s.corpo}` : `(secao "${nome}" nao existe; secoes: ${lista.map((x) => x.titulo).join(' | ')})`);
}
function sessao([pedido, feito, aprendido, proximo, falhou]) {
  if (!pedido || !feito) sair(`uso: ${cmd()} sessao "<pedido>" "<feito>" "<aprendido>" "<proximo>" ["<falhou>"]`);
  const r = raizOuSair(), f = arqSes(r);
  garantir(f, CAB_SES);
  const id = proximoId(ler(f), /^## S-(\d+)/gm, 'S', 3);
  const quem = IA !== 'texto' ? ` (${nomeIA(IA)})` : '';
  let bloco = `## ${id} | ${hoje(true)}${quem}\n- Pedido: ${limpo(pedido)}\n- Feito: ${limpo(feito)}\n- Aprendido: ${limpo(aprendido) || '-'}\n- Proximo: ${limpo(proximo) || '-'}\n`;
  if (falhou) bloco += `- Falhou (nao repetir): ${limpo(falhou)}\n`;
  fs.appendFileSync(f, bloco + '\n', 'utf8');
  console.log(bloco.trim());
  const t = lerTrava(r);
  if (t && t.dono === IA) { fs.rmSync(arqTrava(r), { force: true }); console.log('Trava liberada (sessao encerrada).'); }
}
function arquivosMemoria(r) {
  const lista = [arqRet(r)];
  const andar = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) andar(p); else if (/\.md$/i.test(e.name)) lista.push(p); } };
  if (existe(path.join(r, 'memoria'))) andar(path.join(r, 'memoria'));
  return lista;
}
function buscar([termo]) {
  if (!termo) sair(`uso: ${cmd()} buscar "<termo>"`);
  const r = raizOuSair(), t = norm(termo);
  let n = 0;
  for (const f of arquivosMemoria(r)) {
    ler(f).split(/\r?\n/).forEach((l, i) => { if (n < 40 && norm(l).includes(t)) { console.log(`${path.relative(r, f)}:${i + 1}: ${l.slice(0, 220)}`); n++; } });
  }
  console.log(!n ? '(nada encontrado)' : n >= 40 ? '(parei em 40; refine o termo)' : '');
}
function ver([id]) {
  if (!id) sair(`uso: ${cmd()} ver <O-0012|S-003>`);
  const r = raizOuSair();
  if (/^S-/i.test(id)) {
    const m = ler(arqSes(r)).split(/^(?=## S-)/m).find((b) => b.startsWith(`## ${id.toUpperCase()}`));
    return console.log(m ? m.trim() : '(sessao nao encontrada)');
  }
  const linhas = ler(arqObs(r)).split(/\r?\n/).filter((l) => /^O-\d+/.test(l));
  const i = linhas.findIndex((l) => l.startsWith(id.toUpperCase()));
  if (i < 0) return console.log('(observacao nao encontrada)');
  linhas.slice(Math.max(0, i - 2), i + 3).forEach((l, k) => console.log((Math.max(0, i - 2) + k === i ? '>> ' : '   ') + l));
}
function ultimas([n]) {
  const linhas = ler(arqObs(raizOuSair())).split(/\r?\n/).filter((l) => /^O-\d+/.test(l));
  console.log(linhas.slice(-(parseInt(n, 10) || 10)).join('\n') || '(sem observacoes ainda)');
}
function status([pasta]) {
  const aviso = avisoIntegridade();
  if (aviso) console.log(aviso);
  const r = acharRaiz(pasta ? path.resolve(pasta) : process.cwd());   // 1.2: a pasta passada vale (antes era ignorada)
  if (!r) return console.log(`memoria-ia ${VERSAO} | sem memoria neste projeto. Para criar: ${cmd()} instalar`);
  const t = ler(arqRet(r)), linhas = t.split(/\r?\n/).length, curto = retomadaCurta(r, 'texto');
  const nObs = (ler(arqObs(r)).match(/^O-\d+/gm) || []).length, nSes = (ler(arqSes(r)).match(/^## S-\d+/gm) || []).length, tv = lerTrava(r);
  console.log(`memoria-ia ${VERSAO} | projeto: ${r}`);
  console.log(`${ARQ_RETOMADA}: ${linhas} linhas (~${tokens(t)} tokens no arquivo; a retomada injetada custa ~${tokens(curto)})${linhas > LIMITE_LINHAS ? `  << passou de ${LIMITE_LINHAS}: mova o excesso para memoria/arquivo/` : ''}`);
  console.log(`observacoes: ${nObs} | sessoes: ${nSes} | trava: ${tv ? textoTrava(tv) : 'LIVRE'}`);
}
function instalar([destino, nome]) {
  const d = path.resolve(destino || process.cwd());
  if (!existe(d)) sair(`Pasta nao existe: ${d}`, 1);
  if (path.resolve(d) === path.resolve(os.homedir())) sair('Nao instalo na pasta do usuario; entre na pasta do projeto.', 1);
  const itens = ['CONTINUAR_AQUI.md', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md', 'memoria/OBSERVACOES.md', 'memoria/SESSOES.md', 'memoria/arquivo/LEIA.md'];
  for (const i of itens) {
    const de = path.join(KIT, i), para = path.join(d, i);
    if (existe(para)) {
      if (/^(CLAUDE|AGENTS|GEMINI)\.md$/.test(i)) {
        const t = ler(para);
        if (!t.includes(ARQ_RETOMADA)) {
          fs.writeFileSync(para, `> **IAs: leiam primeiro \`${ARQ_RETOMADA}\`** (retomada curta do projeto; formato memoria-ia).\n\n` + t, 'utf8');
          console.log(`aviso no topo: ${i}`);
        } else console.log(`ja aponta, mantido: ${i}`);
      } else console.log(`ja existe, mantido: ${i}`);
      continue;
    }
    fs.mkdirSync(path.dirname(para), { recursive: true });
    let t = ler(de);
    if (i === ARQ_RETOMADA) t = t.replace('<NOME DO PROJETO>', nome || path.basename(d));
    fs.writeFileSync(para, t, 'utf8');
    console.log(`criado: ${i}`);
  }
  const gi = path.join(d, '.gitignore');
  if (existe(path.join(d, '.git')) && !ler(gi).includes(ARQ_TRAVA)) { fs.appendFileSync(gi, `${ler(gi) && !ler(gi).endsWith('\n') ? '\n' : ''}${ARQ_TRAVA}\n`, 'utf8'); console.log(`.gitignore: ${ARQ_TRAVA}`); }
  console.log(`Pronto. Preencha com: ${cmd()} agora "..." | proximo "..." | anotar como "..."`);
}

// ------------------------------------------------------------------ ganchos
function cwdDoGancho(e) { return e.cwd || (Array.isArray(e.workspacePaths) && e.workspacePaths[0]) || process.cwd(); }
// Antigravity exige "decision" no PreToolUse: resposta {} conta como NEGADO (bloqueava tudo, ate projeto novo).
// Liberado = fluxo normal de permissao: edicao/shell pedem confirmacao ("ask", respeita "sempre permitir"); leitura passa.
let decisaoLivreAgy = 'ask';
function responder(ia, evento, texto, bloquear) {
  if (ia === 'texto') { if (texto) console.log(texto); return; }
  if (ia === 'agy') {
    if (evento === 'SessionStart') return console.log(JSON.stringify(texto ? { injectSteps: [{ systemMessage: { systemMessage: texto } }] } : {}));
    if (evento === 'PreToolUse') return console.log(JSON.stringify(bloquear ? { decision: 'deny', reason: texto } : { decision: decisaoLivreAgy }));
    return console.log(JSON.stringify(bloquear ? { decision: 'continue', reason: texto } : {}));
  }
  if (evento === 'SessionStart') return console.log(JSON.stringify(texto ? { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: texto } } : {}));
  if (evento === 'PreToolUse') {
    return console.log(JSON.stringify(bloquear ? { decision: 'block', reason: texto,
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: texto } } : {}));
  }
  return console.log(JSON.stringify(bloquear ? { decision: 'block', reason: texto } : {}));
}
function retomadaCurta(r, ia) {
  const texto = ler(arqRet(r)).replace(/^﻿/, '');
  const { lista } = secoes(texto);
  const partes = [];
  const titulo = (texto.match(/^# (.+)$/m) || [])[1] || path.basename(r);
  if (norm(process.env.MEMORIA_IA_NIVEL || opcoes.nivel || '') === 'completo') {
    partes.push(texto.length > LIMITE_COMPLETO ? texto.slice(0, LIMITE_COMPLETO) + `\n[cortado em ${LIMITE_COMPLETO} caracteres]` : texto);
  } else {
    const usadas = [];
    for (const chave of SEMPRE_INJETAR) {
      const s = acharSecao(lista, chave);
      if (s && !ehModelo(s.corpo)) { partes.push(`## ${s.titulo}\n${s.corpo}`); usadas.push(s); }
    }
    if (!acharSecao(lista, 'agora')) {   // formato livre (sem secao Agora): manda o comeco do arquivo
      partes.push(texto.slice(0, 2500) + (texto.length > 2500 ? '\n[...]' : ''));
    } else if (!usadas.some((s) => norm(s.titulo).startsWith('agora'))) {
      partes.push('Agora/Proximo ainda nao preenchidos: preencha com memoria agora "Estado: ..." e memoria proximo "<passo>".');
    }
    const outras = lista.filter((s) => !usadas.includes(s) && !/^regras|^ultimas/.test(norm(s.titulo)) && s.corpo && !ehModelo(s.corpo));
    if (outras.length) partes.push(`Mais no ${ARQ_RETOMADA} (abra so se precisar): ${outras.map((s) => `${s.titulo.replace(/\s*\(.*\)$/, '')} [${s.corpo.split('\n').length}]`).join(' · ')} -> memoria secao <nome>`);
  }
  const obsL = ler(arqObs(r)).split(/\r?\n/).filter((l) => /^O-\d+/.test(l)).slice(-3)
    .map((l) => { const c = l.split(' | '); return `${c[0]} ${c[3] || ''}: ${(c[4] || '').slice(0, 90)}`; });
  if (obsL.length) partes.push(`Ultimas obs: ${obsL.join(' · ')}`);
  const lc = linhaCerebro(ia);
  if (lc) partes.push(lc);
  partes.push(`memoria = ${cmd(ia)}  ->  obs <tipo> <versao> "<titulo>" "<porque>" ["<arq>"] | agora "..." | proximo "..." | pendencia add|fechar | anotar <secao> "..." | secao <nome> | buscar "<termo>" | ver <ID> | sessao ... | trava ver. Regras: skill "memoria".`);
  return `# memoria-ia: ${titulo}\n\n${partes.join('\n\n')}`;
}
async function contexto() {
  const e = await lerStdin(), base = cwdDoGancho(e), r = acharRaiz(base);
  const aviso = avisoIntegridade();
  if (!r) {
    if (!pareceProjeto(base)) return responder(IA, 'SessionStart', aviso);
    const lc = linhaCerebro(IA);
    return responder(IA, 'SessionStart', `${aviso ? aviso + '\n' : ''}memoria-ia: esta pasta ainda nao tem ${ARQ_RETOMADA}. Se o usuario for trabalhar neste projeto, ofereca criar a memoria: ${cmd(IA)} instalar "${base}"${lc ? `\n${lc}` : ''}`);
  }
  const t = lerTrava(r);
  const linhaTrava = t && t.dono !== IA ? `${mensagemBloqueio(t)}\n\n` : t ? `(Trava deste projeto e sua: ${textoTrava(t)}.)\n\n` : '';
  const corpo = retomadaCurta(r, IA);
  responder(IA, 'SessionStart', `${aviso ? aviso + '\n\n' : ''}${linhaTrava}${corpo}\n(~${tokens(corpo)} tokens)`);
}
function caminhoDaFerramenta(entrada) {
  if (!entrada || typeof entrada !== 'object') return '';
  for (const k of ['file_path', 'path', 'notebook_path', 'TargetFile', 'AbsolutePath', 'filePath', 'target_file']) if (typeof entrada[k] === 'string') return entrada[k];
  if (typeof entrada.patch === 'string' || typeof entrada.input === 'string') {
    const m = String(entrada.patch || entrada.input).match(/\*\*\* (?:Update|Add|Delete) File: (.+)/);
    if (m) return m[1].trim();
  }
  return '';
}
async function guarda() {
  const e = await lerStdin();
  const nome = e.tool_name || e.toolCall?.name || '', entrada = e.tool_input || e.toolCall?.args || {};
  const base = cwdDoGancho(e);
  const ehShell = /^(Bash|run_command|shell|exec_command|local_shell)$/i.test(nome);
  decisaoLivreAgy = !nome || ehShell || FERRAMENTAS_EDICAO.has(nome) ? 'ask' : 'allow';
  if (ehShell) {
    const c = String(entrada.command || entrada.CommandLine || entrada.cmd || (Array.isArray(entrada.command) ? entrada.command.join(' ') : ''));
    const r = acharRaiz(base), t = r && lerTrava(r);
    if (t && t.dono !== IA && /memoria\.mjs[\s\S]*\btrava\b[\s\S]*\b(liberar|pegar)\b/i.test(c)) return responder(IA, 'PreToolUse', mensagemBloqueio(t), true);
    if (t && t.dono !== IA && new RegExp(ARQ_TRAVA.replace(/\./g, '\\.')).test(c)) return responder(IA, 'PreToolUse', mensagemBloqueio(t), true);
    return responder(IA, 'PreToolUse', '', false);
  }
  if (!FERRAMENTAS_EDICAO.has(nome)) return responder(IA, 'PreToolUse', '', false);
  const alvo = caminhoDaFerramenta(entrada);
  const r = acharRaiz(alvo ? path.dirname(path.resolve(base, alvo)) : base);
  if (!r || IA === 'texto') return responder(IA, 'PreToolUse', '', false);
  const t = lerTrava(r), agora = new Date().toISOString();
  if (!t) { gravarTrava(r, { dono: IA, tarefa: `automatica: 1a edicao (${alvo ? path.basename(alvo) : nome})`, desde: agora, renovada: agora }); return responder(IA, 'PreToolUse', '', false); }
  if (t.dono === IA) {
    if (Date.now() - new Date(t.renovada || t.desde).getTime() > 60000) gravarTrava(r, { ...t, renovada: agora });
    return responder(IA, 'PreToolUse', '', false);
  }
  return responder(IA, 'PreToolUse', mensagemBloqueio(t), true);
}
function lerEstado() { try { return JSON.parse(ler(ESTADO)) || {}; } catch { return {}; } }
function salvarEstado(s) {
  try {
    fs.mkdirSync(path.dirname(ESTADO), { recursive: true });
    const chaves = Object.keys(s).sort((a, b) => (s[b] || 0) - (s[a] || 0)).slice(0, 200);
    fs.writeFileSync(ESTADO, JSON.stringify(Object.fromEntries(chaves.map((k) => [k, s[k]]))), 'utf8');
  } catch { /* sem estado: so deixa de limitar a frequencia */ }
}
// Houve edicao de arquivo depois do ultimo registro na memoria? (heuristica por texto na transcricao de qualquer IA)
const RE_EDICAO = new RegExp(`"(?:name|tool_name|type)"\\s*:\\s*"(?:${[...FERRAMENTAS_EDICAO].join('|')})"`);
const RE_MEMORIA = /CONTINUAR_AQUI\.md|OBSERVACOES\.md|SESSOES\.md|memoria\.(?:mjs|ps1)[^"\n]{0,60}\b(?:obs|sessao|agora|proximo|pendencia|anotar|somar)\b/;
function editouSemRegistrar(transcricao) {
  if (!transcricao || !existe(transcricao)) return false;
  let txt;
  try {
    const st = fs.statSync(transcricao), max = 3 * 1024 * 1024, ini = Math.max(0, st.size - max), buf = Buffer.alloc(st.size - ini);
    const fd = fs.openSync(transcricao, 'r'); fs.readSync(fd, buf, 0, buf.length, ini); fs.closeSync(fd);
    txt = buf.toString('utf8');
  } catch { return false; }
  let ultEd = -1, ultMem = -1;
  txt.split('\n').forEach((l, i) => { if (RE_MEMORIA.test(l)) ultMem = i; else if (RE_EDICAO.test(l)) ultEd = i; });
  return ultEd > ultMem;
}
async function lembrete() {
  const e = await lerStdin();
  const nada = () => responder(IA, 'Stop', '', false);
  if (process.env.MEMORIA_IA_LEMBRETE === '0' || e.stop_hook_active || e.stopHookActive) return nada();
  if (IA === 'agy' && e.terminationReason && e.terminationReason !== 'NO_TOOL_CALL') return nada();
  const r = acharRaiz(cwdDoGancho(e));
  if (!r) return nada();
  const sid = e.session_id || e.conversationId || 'sem-id', est = lerEstado(), agora = Date.now();
  if (est[sid] && agora - est[sid] < LEMBRETE_INTERVALO_MS) return nada();
  if (!editouSemRegistrar(e.transcript_path || e.transcriptPath)) return nada();
  est[sid] = agora; salvarEstado(est);
  responder(IA, 'Stop', `memoria-ia: voce editou arquivos e nao registrou nada. Se foi um marco (bug corrigido, entrega, decisao, descoberta): ` +
    `${cmd(IA)} obs ... e, se mudou o rumo, agora/proximo. Se foi trivial, so encerre. Seja breve.`, true);
}

// ------------------------------------------------------------------ cerebro (catalogo CENTRAL de erros e solucoes)
// UMA pasta fora de todos os projetos, para todas as IAs. Leitura barata em 2 camadas:
//   INDICE.md        = 1 linha por solucao (ID | area | tags | erro | causa curta | projetos | data). A busca le so isto
//                      e imprime as 5 linhas mais parecidas (~150 tokens, nao importa o tamanho do cerebro).
//   solucoes/<ID>.md = card completo (erro exato, causa, solucao, o que NAO funcionou, ocorrencias).
// Codigo: E-<AREA>-NNNN (ex.: E-AND-0007). Pasta: env MEMORIA_CEREBRO ou ~/.memoria-ia/config.json {"cerebro": "..."}.
const AREAS = { AND: 'Android/Gradle/Kotlin', ESP: 'ESP32/ESPHome/embarcado', WIN: 'Windows/PowerShell/drivers', WEB: 'Web/JS/HTML/Vercel',
  PY: 'Python', NODE: 'Node/npm', GIT: 'Git/GitHub/gh', IA: 'Ferramentas de IA (Claude/Codex/Gemini/ganchos)', HA: 'Home Assistant',
  CPP: 'C/C++/CMake', GEN: 'Geral/outros' };
const CONFIG = path.join(os.homedir(), '.memoria-ia', 'config.json');
const CAB_INDICE = '# Cerebro — indice (1 linha por solucao; NAO leia inteiro: use memoria cerebro buscar "<erro>")\n# ID | area | tags | erro/sintoma | causa | projetos | data\n\n';
const PARADAS = new Set(('a o e de da do das dos em no na nos nas um uma para por com sem que se nao the of to in on for is at and or ' +
  'not error erro failed falhou falha cannot could exception warning').split(' '));
const RE_SEGREDO = /(sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,})/;

function pastaCerebro() {
  if (process.env.MEMORIA_CEREBRO) return path.resolve(process.env.MEMORIA_CEREBRO);
  try { const c = JSON.parse(ler(CONFIG)); if (c.cerebro) return path.resolve(c.cerebro); } catch { /* sem config */ }
  return '';
}
const arqIndice = (c) => path.join(c, 'INDICE.md');
const arqCard = (c, id) => path.join(c, 'solucoes', `${id}.md`);
function cerebroOuSair() {
  const c = pastaCerebro();
  if (!c || !existe(arqIndice(c))) sair(`Cerebro nao configurado. Crie/aponte: ${cmd()} cerebro iniciar "<pasta>"`);
  return c;
}
const palavras = (s) => [...new Set(norm(s).replace(/[^a-z0-9_.:/-]+/g, ' ').split(/[\s/:]+/)
  .map((w) => w.replace(/^[.-]+|[.-]+$/g, '')).filter((w) => w.length > 1 && !PARADAS.has(w)))];
const linhasIndice = (c) => ler(arqIndice(c)).split(/\r?\n/).filter((l) => /^E-[A-Z]+-\d+ \|/.test(l));
/** Pontua cada linha do indice contra a consulta: palavras em comum (as raras valem mais) + trecho exato. */
function pontuar(c, consulta) {
  const q = palavras(consulta), linhas = linhasIndice(c);
  if (!q.length) return [];
  const df = new Map();
  const tok = linhas.map((l) => { const s = new Set(palavras(l)); s.forEach((w) => df.set(w, (df.get(w) || 0) + 1)); return s; });
  const frase = norm(consulta).slice(0, 60);
  return linhas.map((l, i) => {
    let p = 0;
    for (const w of q) if (tok[i].has(w)) p += Math.log(1 + linhas.length / (df.get(w) || 1));
    if (frase.length >= 12 && norm(l).includes(frase)) p += 5;
    return { l, p: p / Math.sqrt(q.length) };
  }).filter((x) => x.p > 0.35).sort((a, b) => b.p - a.p);
}
function semSegredo(...textos) {
  if (RE_SEGREDO.test(textos.join(' '))) sair('Recusado: o texto parece ter chave/token/senha. Troque por <SEGREDO> e anote de novo.', 1);
}
function projetoAtual() { const r = acharRaiz(process.cwd()); return path.basename(r || process.cwd()); }

function cerebroIniciar([pasta]) {
  if (!pasta) sair(`uso: ${cmd()} cerebro iniciar "<pasta do cerebro>"`);
  const c = path.resolve(pasta);
  fs.mkdirSync(path.join(c, 'solucoes'), { recursive: true });
  garantir(arqIndice(c), CAB_INDICE);
  garantir(path.join(c, 'README.md'), `# Cerebro (memoria-ia)\n\nCatalogo UNICO de erros e solucoes de todos os projetos, para qualquer IA.\n\n` +
    `- Antes de pesquisar um erro: \`memoria cerebro buscar "<texto do erro>"\` -> \`memoria cerebro ver <ID>\`.\n` +
    `- Resolveu algo que custou tempo: \`memoria cerebro anotar <AREA> "<erro exato>" "<causa>" "<solucao>" ["tags"] ["o que NAO funcionou"]\`.\n` +
    `- Mesmo erro em outro projeto ou info nova: \`memoria cerebro somar <ID> "<nota>"\`.\n- NAO edite INDICE.md a mao; NAO leia INDICE.md inteiro.\n\n` +
    `Areas: ${Object.entries(AREAS).map(([k, v]) => `${k} (${v})`).join(', ')}.\n`);
  for (const f of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) garantir(path.join(c, f), 'Esta pasta e o cerebro da memoria-ia. Leia README.md (curto). Nunca leia INDICE.md inteiro: use `memoria cerebro buscar`.\n');
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
  let cfg = {}; try { cfg = JSON.parse(ler(CONFIG)) || {}; } catch { /* novo */ }
  fs.writeFileSync(CONFIG, JSON.stringify({ ...cfg, cerebro: c }, null, 2) + '\n', 'utf8');
  console.log(`Cerebro pronto em ${c} (${linhasIndice(c).length} solucoes). Config: ${CONFIG}`);
}
function cerebroBuscar([consulta, n]) {
  if (!consulta) sair(`uso: ${cmd()} cerebro buscar "<texto do erro ou sintoma>"`);
  const c = cerebroOuSair(), achados = pontuar(c, consulta).slice(0, parseInt(n, 10) || 5);
  if (!achados.length) return console.log('(nada parecido no cerebro — resolva e depois: memoria cerebro anotar ...)');
  achados.forEach((x) => console.log(x.l.length > 260 ? x.l.slice(0, 257) + '...' : x.l));
  console.log('-> detalhes: memoria cerebro ver <ID>');
}
function cerebroVer([id]) {
  if (!id) sair(`uso: ${cmd()} cerebro ver <E-AND-0001>`);
  const c = cerebroOuSair(), f = arqCard(c, id.toUpperCase());
  console.log(existe(f) ? ler(f).trim() : '(solucao nao encontrada)');
}
function cerebroAnotar([area, erro, causa, solucao, tags = '', falhou = '']) {
  if (!area || !erro || !causa || !solucao) {
    sair(`uso: ${cmd()} cerebro anotar <AREA> "<erro exato/sintoma>" "<causa>" "<solucao (passos/comandos)>" ["tag1,tag2"] ["o que NAO funcionou"]\nAreas: ${Object.keys(AREAS).join(' ')}`);
  }
  const A = area.toUpperCase();
  if (!AREAS[A]) sair(`Area desconhecida: ${area}. Use: ${Object.keys(AREAS).join(' ')}`);
  semSegredo(erro, causa, solucao, tags, falhou);
  const c = cerebroOuSair();
  const parecido = pontuar(c, erro)[0];   // so o erro: tags diluem o trecho exato
  if (parecido && parecido.p >= 2.2 && !opcoes.forcar) {
    sair(`Ja existe algo parecido:\n${parecido.l}\nSe e o mesmo problema: ${cmd()} cerebro somar ${parecido.l.split(' | ')[0]} "<o que ha de novo>"\nSe e outro mesmo: repita com --forcar`, 3);
  }
  const proj = projetoAtual(), data = hoje(false);
  fs.mkdirSync(path.join(c, 'solucoes'), { recursive: true });
  for (let tent = 0; tent < 20; tent++) {   // 2 IAs anotando juntas: flag 'wx' garante ID unico
    const usados = linhasIndice(c).map((l) => l.split(' | ')[0]).concat(fs.readdirSync(path.join(c, 'solucoes')).map((f) => f.replace(/\.md$/, '')));
    const id = proximoId(usados.join('\n'), new RegExp(`^E-${A}-(\\d+)`, 'gm'), `E-${A}`, 4);
    const card = `# ${id} — ${limpo(erro).slice(0, 120)}\n\n- Area: ${A} (${AREAS[A]})\n- Tags: ${limpo(tags) || '-'}\n- Primeira vez: ${data}, projeto ${proj}, por ${nomeIA(IA)}\n\n` +
      `## Erro / sintoma (texto exato)\n${String(erro).trim()}\n\n## Causa\n${String(causa).trim()}\n\n## Solucao\n${String(solucao).trim()}\n\n` +
      `## O que NAO funcionou\n${String(falhou).trim() || '-'}\n\n## Ocorrencias\n- ${data} ${proj} (${nomeIA(IA)})\n`;
    try { fs.writeFileSync(arqCard(c, id), card, { encoding: 'utf8', flag: 'wx' }); } catch (e) { if (e.code === 'EEXIST') continue; throw e; }
    fs.appendFileSync(arqIndice(c), `${id} | ${A} | ${limpo(tags).slice(0, 60)} | ${limpo(erro).slice(0, 110)} | ${limpo(causa).slice(0, 80)} | ${proj} | ${data}\n`, 'utf8');
    return console.log(`${id} anotado no cerebro.`);
  }
  sair('Nao consegui gerar um ID livre (muitas gravacoes ao mesmo tempo?)', 1);
}
function cerebroSomar([id, nota]) {
  if (!id || !nota) sair(`uso: ${cmd()} cerebro somar <ID> "<o que ha de novo: outro projeto, variacao, solucao melhor>"`);
  semSegredo(nota);
  const c = cerebroOuSair(), ID = id.toUpperCase(), f = arqCard(c, ID);
  if (!existe(f)) sair('(solucao nao encontrada)', 1);
  const proj = projetoAtual();
  fs.appendFileSync(f, `- ${hoje(false)} ${proj} (${nomeIA(IA)}): ${limpo(nota)}\n`, 'utf8');
  const txt = ler(arqIndice(c));
  const nova = txt.split('\n').map((l) => {
    if (!l.startsWith(`${ID} | `)) return l;
    const col = l.split(' | ');
    if (col.length >= 7 && !col[5].split(',').map((s) => s.trim()).includes(proj)) col[5] = `${col[5].trim()},${proj}`;
    return col.join(' | ');
  }).join('\n');
  if (nova !== txt) fs.writeFileSync(arqIndice(c), nova, 'utf8');
  console.log(`${ID}: ocorrencia somada.`);
}
function cerebroStatus() {
  const c = pastaCerebro();
  if (!c || !existe(arqIndice(c))) return console.log(`cerebro: nao configurado (${cmd()} cerebro iniciar "<pasta>")`);
  const l = linhasIndice(c), por = {};
  l.forEach((x) => { const a = x.split(' | ')[1]; por[a] = (por[a] || 0) + 1; });
  console.log(`cerebro: ${c} | ${l.length} solucoes${l.length ? ` (${Object.entries(por).map(([a, n]) => `${a} ${n}`).join(', ')})` : ''} | indice ~${tokens(ler(arqIndice(c)))} tokens (a busca mostra so 5 linhas)`);
}
function cerebro([acao, ...args]) {
  const t = { iniciar: cerebroIniciar, buscar: cerebroBuscar, ver: cerebroVer, anotar: cerebroAnotar, somar: cerebroSomar, status: cerebroStatus };
  if (!t[acao]) sair(`uso: ${cmd()} cerebro iniciar|buscar|ver|anotar|somar|status ...`);
  return t[acao](args);
}
/** 1 linha para a retomada (so se o cerebro existir). */
function linhaCerebro(ia) {
  const c = pastaCerebro();
  if (!c || !existe(arqIndice(c))) return '';
  return `Cerebro central (${linhasIndice(c).length} solucoes de todos os projetos): erro/obstaculo? ANTES de pesquisar: ${cmd(ia)} cerebro buscar "<erro>". ` +
    'Resolveu algo que custou tempo: cerebro anotar <AREA> "<erro>" "<causa>" "<solucao>" (mesmo erro: cerebro somar <ID>).';
}

// ------------------------------------------------------------------ principal
const [comando, ...resto] = argv;
const tabela = { obs, agora: agoraCmd, proximo: proximoCmd, pendencia, anotar, secao, sessao, buscar, ver, ultimas, status, instalar, trava, contexto, guarda, lembrete, cerebro };
if (!comando || !tabela[comando]) {
  console.log(`memoria-ia ${VERSAO}\ncomandos: obs | agora | proximo | pendencia | anotar | secao | buscar | ver | ultimas | sessao | trava | status | instalar | cerebro\nexemplo: ${cmd()} obs bugfix 1.2 "Botao nao salvava" "faltava await no fetch" "app.js"`);
  process.exit(comando ? 2 : 0);
}
try { await tabela[comando](resto); }
catch (err) {
  if (['contexto', 'guarda', 'lembrete'].includes(comando)) { console.log(comando === 'guarda' && IA === 'agy' ? '{"decision":"ask"}' : '{}'); process.exit(0); }   // gancho nunca trava a IA
  console.error(`memoria-ia: ${err.message}`); process.exit(1);
}
