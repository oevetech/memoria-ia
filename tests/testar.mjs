// Testes da memoria-ia: node tests/testar.mjs  (cria tudo numa pasta temporaria e apaga no fim)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = path.join(RAIZ, 'plugin');
const SCRIPT = path.join(PLUGIN, 'scripts', 'memoria.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'memoria-ia-teste-'));
const HOME_FAKE = path.join(TMP, 'home');
fs.mkdirSync(HOME_FAKE);
let falhas = 0, total = 0;
const ok = (c, msg) => { total++; if (!c) { falhas++; console.log('FALHOU:', msg); } };
const env = { ...process.env, USERPROFILE: HOME_FAKE, HOME: HOME_FAKE, CLAUDE_PLUGIN_ROOT: '', PLUGIN_ROOT: '' };
const run = (args, { cwd = TMP, input, extraEnv = {} } = {}) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { cwd, input: input === undefined ? '' : input, env: { ...env, ...extraEnv }, encoding: 'utf8' });
const json = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };

// ---- projeto novo
const proj = path.join(TMP, 'proj');
fs.mkdirSync(path.join(proj, 'src'), { recursive: true });
fs.writeFileSync(path.join(proj, 'README.md'), '# proj');

let r = run(['contexto', '--ia', 'claude'], { input: JSON.stringify({ cwd: proj, session_id: 's0' }) });
let j = json(r);
ok(j && /instalar/.test(j.hookSpecificOutput?.additionalContext || ''), 'projeto sem memoria: oferece instalar');
r = run(['contexto', '--ia', 'claude'], { input: JSON.stringify({ cwd: HOME_FAKE }) });
ok(r.stdout.trim() === '{}', 'pasta pessoal: nao injeta nada');

r = run(['instalar', proj, 'Projeto Teste']);
ok(fs.existsSync(path.join(proj, 'CONTINUAR_AQUI.md')) && /Projeto Teste/.test(fs.readFileSync(path.join(proj, 'CONTINUAR_AQUI.md'), 'utf8')), 'instalar cria o CONTINUAR_AQUI com o nome');
fs.writeFileSync(path.join(proj, 'CLAUDE.md'), '# meu claude antigo\n');
fs.rmSync(path.join(proj, 'AGENTS.md'));
r = run(['instalar', proj]);
ok(/^> \*\*IAs/.test(fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8')) && /meu claude antigo/.test(fs.readFileSync(path.join(proj, 'CLAUDE.md'), 'utf8')), 'CLAUDE.md existente ganha aviso e mantem o conteudo');
ok(/ja existe, mantido: CONTINUAR_AQUI.md/.test(r.stdout), 'instalar de novo nao sobrescreve');

r = run(['obs', 'bugfix', '1.0', 'Botão não salvava', 'faltava await | no fetch', 'app.js'], { cwd: path.join(proj, 'src') });
ok(/^O-0001 \| \d\d\/\d\d\/\d\d \| 1\.0 \| bugfix \| Botão não salvava \| porque: faltava await no fetch \| arq: app\.js/m.test(r.stdout), 'obs de subpasta, com acento e sem quebrar a coluna |');
run(['obs', 'decisao', '-', 'Só 2 rostos', 'pedido do dono'], { cwd: proj });
r = run(['obs', 'xyz', '1', 'a', 'b'], { cwd: proj });
ok(r.status === 2, 'tipo invalido recusa');
r = run(['sessao', 'pedido', 'feito', 'aprendido', 'proximo', 'falhou X'], { cwd: proj });
ok(/## S-001/.test(r.stdout) && /Falhou \(nao repetir\): falhou X/.test(r.stdout), 'sessao com falhou');
r = run(['sessao', 'p2', 'f2'], { cwd: proj });
ok(/## S-002/.test(r.stdout), 'segunda sessao numera S-002');
r = run(['buscar', 'BOTÃO'], { cwd: proj });
ok(/OBSERVACOES\.md:\d+: O-0001/.test(r.stdout), 'buscar ignora maiusculas');
r = run(['ver', 'O-0002'], { cwd: proj });
ok(/>> O-0002/.test(r.stdout) && /O-0001/.test(r.stdout), 'ver mostra a vizinha');
r = run(['ver', 's-001'], { cwd: proj });
ok(/Pedido: pedido/.test(r.stdout), 'ver sessao');
r = run(['status'], { cwd: proj });
ok(/observacoes: 2 \| sessoes: 2/.test(r.stdout), 'status conta');

// ---- gancho de inicio nos 3 formatos
const entrada = JSON.stringify({ cwd: proj, session_id: 's1', source: 'startup' });
j = json(run(['contexto', '--ia', 'claude'], { input: entrada }));
const ctx = j?.hookSpecificOutput?.additionalContext || '';
ok(j?.hookSpecificOutput?.hookEventName === 'SessionStart' && /CONTINUAR AQUI — Projeto Teste/.test(ctx), 'claude: additionalContext com o CONTINUAR_AQUI');
ok(/O-0001/.test(ctx) && /Comandos memoria-ia/.test(ctx), 'claude: traz observacoes recentes e comandos');
ok(/~\d+ tokens/.test(ctx), 'mostra custo em tokens');
j = json(run(['contexto', '--ia', 'codex'], { input: entrada }));
ok(/Projeto Teste/.test(j?.hookSpecificOutput?.additionalContext || ''), 'codex: mesmo formato');
j = json(run(['contexto', '--ia', 'agy'], { input: JSON.stringify({ workspacePaths: [proj], conversationId: 'g1' }) }));
ok(/Projeto Teste/.test(j?.injectSteps?.[0]?.systemMessage?.systemMessage || ''), 'agy: injectSteps/systemMessage');
r = run(['contexto', '--ia', 'claude'], { input: 'lixo nao json', cwd: proj });
ok(/Projeto Teste/.test(json(r)?.hookSpecificOutput?.additionalContext || ''), 'stdin invalido: usa a pasta atual');
fs.appendFileSync(path.join(proj, 'CONTINUAR_AQUI.md'), '\n' + 'x'.repeat(9000));
j = json(run(['contexto', '--ia', 'claude'], { input: entrada }));
ok((j?.hookSpecificOutput?.additionalContext || '').length < 9000 && /foi cortado/.test(j.hookSpecificOutput.additionalContext), 'arquivo grande e cortado com aviso');

// ---- lancador usado no Codex (node -e, procura PLUGIN_ROOT e depois ~/.memoria-ia)
const ganchosCodex = JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'codex-hooks.json'), 'utf8'));
const lancador = ganchosCodex.hooks.SessionStart[0].hooks[0].command;
const codigo = lancador.match(/node -e "([^"]+)"/)[1];
const viaLancador = (extraEnv) => spawnSync(process.execPath, ['-e', codigo, 'contexto', '--ia', 'codex'], { input: entrada, env: { ...env, ...extraEnv }, encoding: 'utf8' });
r = viaLancador({ PLUGIN_ROOT: PLUGIN });
ok(/Projeto Teste/.test(r.stdout), 'lancador com PLUGIN_ROOT');
fs.mkdirSync(path.join(HOME_FAKE, '.memoria-ia'), { recursive: true });
fs.copyFileSync(SCRIPT, path.join(HOME_FAKE, '.memoria-ia', 'memoria.mjs'));
r = viaLancador({});
ok(/Projeto Teste/.test(r.stdout), 'lancador sem PLUGIN_ROOT usa ~/.memoria-ia');
ok(JSON.parse(fs.readFileSync(path.join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks.Stop[0].hooks[0].command.includes('lembrete --ia claude'), 'gancho Stop do Claude configurado');

// ---- lembrete (Stop)
const trans = path.join(TMP, 't.jsonl');
const linha = (o) => JSON.stringify(o) + '\n';
const editar = linha({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/a.js' } }] } });
const registrar = linha({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'node memoria.mjs obs bugfix 1 "x" "y"' } }] } });
const stop = (sid, extra = {}, ia = 'claude') => json(run(['lembrete', '--ia', ia], { input: JSON.stringify({ cwd: proj, session_id: sid, transcript_path: trans, ...extra }) }));
fs.writeFileSync(trans, editar);
j = stop('L1');
ok(j?.decision === 'block' && /memoria-ia/.test(j.reason), 'editou sem registrar: bloqueia com lembrete');
ok(Object.keys(stop('L1')).length === 0, 'na mesma sessao nao repete dentro de 30 min');
ok(Object.keys(stop('L2', { stop_hook_active: true })).length === 0, 'stop_hook_active: nao bloqueia de novo');
fs.writeFileSync(trans, editar + registrar);
ok(Object.keys(stop('L3')).length === 0, 'registrou depois de editar: nao incomoda');
fs.writeFileSync(trans, registrar + editar);
ok(stop('L4')?.decision === 'block', 'editou de novo depois do registro: lembra');
fs.writeFileSync(trans, linha({ type: 'user', message: 'oi' }));
ok(Object.keys(stop('L5')).length === 0, 'sem edicao: nao incomoda');
fs.writeFileSync(trans, editar);
j = json(run(['lembrete', '--ia', 'agy'], { input: JSON.stringify({ workspacePaths: [proj], conversationId: 'G1', transcriptPath: trans, terminationReason: 'NO_TOOL_CALL' }) }));
ok(j?.decision === 'continue', 'agy: decision continue');
j = json(run(['lembrete', '--ia', 'agy'], { input: JSON.stringify({ workspacePaths: [proj], conversationId: 'G2', transcriptPath: trans, terminationReason: 'USER_CANCELED' }) }));
ok(Object.keys(j || {}).length === 0, 'agy: cancelado pelo usuario nao bloqueia');
j = json(run(['lembrete', '--ia', 'claude'], { input: JSON.stringify({ cwd: proj, session_id: 'L6', transcript_path: trans }), extraEnv: { MEMORIA_IA_LEMBRETE: '0' } }));
ok(Object.keys(j || {}).length === 0, 'MEMORIA_IA_LEMBRETE=0 desliga');
j = json(run(['lembrete', '--ia', 'claude'], { input: JSON.stringify({ cwd: proj, session_id: 'L7', transcript_path: path.join(TMP, 'nao-existe.jsonl') }) }));
ok(Object.keys(j || {}).length === 0, 'sem transcricao: nao incomoda');

// ---- manifestos validos
for (const f of ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json', 'plugin/.claude-plugin/plugin.json', 'plugin/.codex-plugin/plugin.json', 'plugin/plugin.json', 'plugin/hooks.json', 'plugin/hooks/hooks.json', 'plugin/hooks/codex-hooks.json']) {
  let valido = true; try { JSON.parse(fs.readFileSync(path.join(RAIZ, f), 'utf8')); } catch { valido = false; }
  ok(valido, `JSON valido: ${f}`);
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`memoria-ia: ${total - falhas}/${total} testes OK`);
process.exit(falhas ? 1 : 0);
