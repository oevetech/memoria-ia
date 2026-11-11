// Testes da memoria-ia: node tests/testar.mjs  (cria tudo numa pasta temporaria e apaga no fim)
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
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
const env = { ...process.env, USERPROFILE: HOME_FAKE, HOME: HOME_FAKE, CLAUDE_PLUGIN_ROOT: '', PLUGIN_ROOT: '', CODEX_HOME: '', MEMORIA_IA_NIVEL: '', MEMORIA_IA_QUEM: '' };
const run = (args, { cwd = TMP, input, extraEnv = {}, script = SCRIPT } = {}) =>
  spawnSync(process.execPath, [script, ...args], { cwd, input: input === undefined ? '' : input, env: { ...env, ...extraEnv }, encoding: 'utf8' });
const json = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };
const vazio = (j) => j && Object.keys(j).length === 0;
const ler = (f) => fs.readFileSync(f, 'utf8');

// ---------------------------------------------------------------- projeto novo e kit
const proj = path.join(TMP, 'proj');
fs.mkdirSync(path.join(proj, 'src'), { recursive: true });
fs.mkdirSync(path.join(proj, '.git'));
fs.writeFileSync(path.join(proj, 'README.md'), '# proj');
const CA = path.join(proj, 'CONTINUAR_AQUI.md');

let j = json(run(['--ia', 'claude', 'contexto'], { input: JSON.stringify({ cwd: proj, session_id: 's0' }) }));
ok(/instalar/.test(j?.hookSpecificOutput?.additionalContext || ''), 'projeto sem memoria: oferece instalar');
ok(run(['--ia', 'claude', 'contexto'], { input: JSON.stringify({ cwd: HOME_FAKE }) }).stdout.trim() === '{}', 'pasta pessoal: nao injeta nada');

let r = run(['instalar', proj, 'Projeto Teste']);
ok(/Projeto Teste/.test(ler(CA)), 'instalar cria o CONTINUAR_AQUI com o nome');
ok(ler(path.join(proj, '.gitignore')).includes('.memoria-ia-trava.json'), 'instalar poe a trava no .gitignore');
fs.writeFileSync(path.join(proj, 'CLAUDE.md'), '# meu claude antigo\n');
r = run(['instalar', proj]);
ok(/^> \*\*IAs/.test(ler(path.join(proj, 'CLAUDE.md'))) && /meu claude antigo/.test(ler(path.join(proj, 'CLAUDE.md'))), 'CLAUDE.md existente ganha aviso e mantem o conteudo');
ok(/ja existe, mantido: CONTINUAR_AQUI.md/.test(r.stdout), 'instalar de novo nao sobrescreve');
j = json(run(['--ia', 'claude', 'contexto'], { input: JSON.stringify({ cwd: proj }) }));
ok(/ainda nao preenchidos/.test(j?.hookSpecificOutput?.additionalContext || '') && !/<passo mais importante/.test(j.hookSpecificOutput.additionalContext), 'kit vazio: pede para preencher, nao despeja o modelo');

// ---------------------------------------------------------------- comandos estruturados
const emProj = (args, o = {}) => run(args, { cwd: path.join(proj, 'src'), ...o });
emProj(['agora', 'Estado: tudo ok', 'Versao: 1.0']);
emProj(['proximo', 'testar no celular', '2. publicar']);
let t = ler(CA);
ok(/## Agora\n- Estado: tudo ok\n- Versao: 1\.0\n\n## Próximo/.test(t), 'agora reescreve so a secao Agora');
ok(/## Próximo\n1\. testar no celular\n2\. publicar\n/.test(t), 'proximo numera e tira numero repetido');
ok(/## Decisões que valem/.test(t) && /## Armadilhas conhecidas/.test(t) && /## Como trabalhar aqui/.test(t), 'outras secoes continuam intactas');
r = emProj(['pendencia', 'add', 'login cai as vezes']);
ok(/P-01 registrada/.test(r.stdout) && /- P-01 login cai as vezes \(desde \d\d\/\d\d\)/.test(ler(CA)) && !/\(nenhuma\)/.test(ler(CA)), 'pendencia add troca o (nenhuma)');
emProj(['pendencia', 'add', 'tela pisca']);
r = emProj(['pendencia', 'fechar', 'p-01', 'timeout do token']);
ok(!/P-01/.test(secaoDe(ler(CA), 'Pendências')) && /P-02 tela pisca/.test(ler(CA)), 'pendencia fechar tira so a P-01');
ok(/O-0001 \| .* \| bugfix \| Resolvida P-01: login cai as vezes \| porque: timeout do token/.test(ler(path.join(proj, 'memoria', 'OBSERVACOES.md'))), 'fechar vira obs bugfix');
emProj(['anotar', 'armadilhas', 'nao usar a porta 80']);
ok(/- nao usar a porta 80 \(\d\d\/\d\d\)/.test(secaoDe(ler(CA), 'Armadilhas')) && !/<o que já fez/.test(ler(CA)), 'anotar substitui o modelo da secao');
emProj(['anotar', 'armadilhas', 'segunda armadilha']);
ok(/porta 80[\s\S]*segunda armadilha/.test(secaoDe(ler(CA), 'Armadilhas')), 'anotar acrescenta no fim');
emProj(['anotar', 'Ideias', 'modo escuro']);
ok(/## Ideias\n- modo escuro/.test(ler(CA)), 'anotar cria secao nova');
r = emProj(['secao', 'armadilhas']);
ok(/## Armadilhas conhecidas\n- nao usar a porta 80/.test(r.stdout), 'secao mostra uma secao');
ok(/Agora \(2 linhas\)/.test(emProj(['secao']).stdout), 'secao sem nome lista as secoes');

r = emProj(['obs', 'bugfix', '1.0', 'Botão não salvava', 'faltava await | no fetch', 'app.js']);
ok(/^O-0002 \| \d\d\/\d\d\/\d\d \| 1\.0 \| bugfix \| Botão não salvava \| porque: faltava await no fetch \| arq: app\.js/m.test(r.stdout), 'obs com acento e sem quebrar a coluna |');
ok(emProj(['obs', 'xyz', '1', 'a', 'b']).status === 2, 'tipo invalido recusa');
r = emProj(['--ia', 'codex', 'sessao', 'pedido', 'feito', 'aprendido', 'proximo', 'falhou X']);
ok(/## S-001 \| .* \(Codex\)/.test(r.stdout) && /Falhou \(nao repetir\): falhou X/.test(r.stdout), 'sessao com IA e falhou');
ok(/OBSERVACOES\.md:\d+: O-0002/.test(emProj(['buscar', 'BOTAO']).stdout), 'buscar ignora maiusculas e acentos');
ok(/>> O-0002/.test(emProj(['ver', 'O-0002']).stdout), 'ver observacao');
ok(/Pedido: pedido/.test(emProj(['ver', 's-001']).stdout), 'ver sessao');

// ---------------------------------------------------------------- retomada curta
fs.writeFileSync(CA, ler(CA).replace('## Sempre (regras deste projeto)\n- <regra curta que toda IA precisa saber antes de mexer; ex.: "compilar com X antes de publicar">',
  '## Sempre (regras deste projeto)\n- compilar com make antes de publicar'));
const entrada = JSON.stringify({ cwd: proj, session_id: 's1', source: 'startup' });
j = json(run(['--ia', 'claude', 'contexto'], { input: entrada }));
const ctx = j?.hookSpecificOutput?.additionalContext || '';
ok(j?.hookSpecificOutput?.hookEventName === 'SessionStart', 'claude: SessionStart');
ok(/## Sempre[\s\S]*compilar com make[\s\S]*## Agora[\s\S]*tudo ok[\s\S]*## Próximo[\s\S]*## Pendências[\s\S]*P-02/.test(ctx), 'retomada: Sempre, Agora, Proximo e Pendencias, nessa ordem');
ok(!/porta 80/.test(ctx) && /Armadilhas conhecidas \[2\]/.test(ctx), 'armadilhas ficam fora, so no indice com contagem');
ok(/Ultimas obs: O-0001 bugfix: Resolvida P-01/.test(ctx) && /O-0002 bugfix: Botão/.test(ctx), 'ultimas obs so com ID, tipo e titulo');
ok(/--ia claude/.test(ctx) && /skill "memoria"/.test(ctx), 'linha de comandos com a identidade da IA');
ok(ctx.length < 1500, `retomada curta (${ctx.length} caracteres)`);
j = json(run(['--ia', 'claude', 'contexto'], { input: entrada, extraEnv: { MEMORIA_IA_NIVEL: 'completo' } }));
ok(/porta 80/.test(j?.hookSpecificOutput?.additionalContext || ''), 'MEMORIA_IA_NIVEL=completo manda o arquivo inteiro');
j = json(run(['--ia', 'codex', 'contexto'], { input: entrada }));
ok(/tudo ok/.test(j?.hookSpecificOutput?.additionalContext || ''), 'codex: mesmo formato');
j = json(run(['--ia', 'agy', 'contexto'], { input: JSON.stringify({ workspacePaths: [proj], conversationId: 'g1' }) }));
ok(/tudo ok/.test(j?.injectSteps?.[0]?.systemMessage?.systemMessage || ''), 'agy: injectSteps/systemMessage');
ok(/tudo ok/.test(json(run(['--ia', 'claude', 'contexto'], { input: 'lixo', cwd: proj }))?.hookSpecificOutput?.additionalContext || ''), 'stdin invalido: usa a pasta atual');
const livre = path.join(TMP, 'livre');
fs.mkdirSync(livre);
fs.writeFileSync(path.join(livre, 'CONTINUAR_AQUI.md'), '# Meu formato\nestado: x\n' + 'y'.repeat(4000));
j = json(run(['--ia', 'claude', 'contexto'], { input: JSON.stringify({ cwd: livre }) }));
ok(/Meu formato/.test(j?.hookSpecificOutput?.additionalContext || '') && j.hookSpecificOutput.additionalContext.length < 3200, 'formato livre: manda o comeco, limitado');

// ---------------------------------------------------------------- trava entre IAs
const TRAVA = path.join(proj, '.memoria-ia-trava.json');
const guarda = (ia, nome, entradaFerr, sid = 'x') => json(run(['--ia', ia, 'guarda'], { input: JSON.stringify({ cwd: proj, session_id: sid, tool_name: nome, tool_input: entradaFerr }) }));
ok(vazio(guarda('claude', 'Read', { file_path: path.join(proj, 'README.md') })) && !fs.existsSync(TRAVA), 'leitura nao pega trava');
ok(vazio(guarda('claude', 'Edit', { file_path: path.join(proj, 'src', 'a.js') })) && JSON.parse(ler(TRAVA)).dono === 'claude', '1a edicao pega a trava automaticamente');
ok(vazio(guarda('claude', 'Write', { file_path: path.join(proj, 'b.js') })), 'dono continua editando');
j = guarda('codex', 'apply_patch', { input: '*** Begin Patch\n*** Update File: src/a.js\n' });
ok(j?.decision === 'block' && j?.hookSpecificOutput?.permissionDecision === 'deny' && /Claude/.test(j.reason) && /so ele libera/.test(j.reason), 'outra IA (Codex) e barrada com aviso');
j = json(run(['--ia', 'agy', 'guarda'], { input: JSON.stringify({ workspacePaths: [proj], toolCall: { name: 'write_to_file', args: { TargetFile: path.join(proj, 'c.js') } } }) }));
ok(j?.decision === 'deny', 'Antigravity tambem e barrado (decision deny)');
const outroAgy = path.join(TMP, 'outroAgy');
fs.mkdirSync(outroAgy);
const agyG = (nome, args) => json(run(['--ia', 'agy', 'guarda'], { input: JSON.stringify({ workspacePaths: [outroAgy], toolCall: { name: nome, args } }) }));
ok(agyG('write_to_file', { TargetFile: path.join(outroAgy, 'novo.js') })?.decision === 'ask', 'Antigravity em projeto novo: edicao segue o fluxo normal (ask), nunca {}');
ok(agyG('run_command', { CommandLine: 'dir' })?.decision === 'ask', 'Antigravity: shell comum segue o fluxo normal (ask)');
ok(agyG('view_file', { AbsolutePath: path.join(outroAgy, 'x') })?.decision === 'allow', 'Antigravity: leitura liberada (allow)');
ok(guarda('codex', 'Bash', { command: `node "${SCRIPT}" --ia codex trava liberar --forcar` })?.decision === 'block', 'IA barrada nao consegue liberar a trava pelo shell');
ok(guarda('codex', 'Bash', { command: 'rm .memoria-ia-trava.json' })?.decision === 'block', 'IA barrada nao consegue apagar o arquivo da trava');
ok(vazio(guarda('codex', 'Bash', { command: 'ls -la' })), 'shell comum da outra IA continua liberado (leitura)');
const outro = path.join(TMP, 'outro');
fs.mkdirSync(outro);
ok(vazio(json(run(['--ia', 'codex', 'guarda'], { input: JSON.stringify({ cwd: outro, tool_name: 'Edit', tool_input: { file_path: path.join(outro, 'x') } }) }))), 'pasta sem memoria-ia: nao trava nada');
j = json(run(['--ia', 'codex', 'contexto'], { input: JSON.stringify({ cwd: proj }) }));
ok(/^TRAVA memoria-ia: .*Claude/.test(j?.hookSpecificOutput?.additionalContext || ''), 'retomada da outra IA abre com o aviso da trava');
ok(/TRAVADO por Claude/.test(emProj(['trava', 'ver']).stdout), 'trava ver');
ok(emProj(['--ia', 'codex', 'trava', 'pegar', 'x']).status === 3, 'outra IA nao pega trava ocupada');
ok(emProj(['--ia', 'codex', 'trava', 'liberar']).status === 3 && fs.existsSync(TRAVA), 'outra IA nao libera sem --forcar');
emProj(['--ia', 'claude', 'sessao', 'p', 'f']);
ok(!fs.existsSync(TRAVA), 'sessao encerrada pelo dono libera a trava');
emProj(['--ia', 'agy', 'trava', 'pegar', 'refatorar']);
ok(JSON.parse(ler(TRAVA)).dono === 'agy' && /refatorar/.test(ler(TRAVA)), 'trava pegar manual com tarefa');
ok(/LIVRE \(era de Gemini/.test(emProj(['trava', 'liberar', '--forcar']).stdout) && !fs.existsSync(TRAVA), 'usuario libera com --forcar');

// ---------------------------------------------------------------- lancador e integridade
const lancador = JSON.parse(ler(path.join(PLUGIN, 'hooks', 'codex-hooks.json'))).hooks.SessionStart[0].hooks[0].command;
const codigo = lancador.match(/node -e "([^"]+)"/)[1];
const viaLancador = (extraEnv) => spawnSync(process.execPath, ['-e', codigo, 'contexto', '--ia', 'codex'], { input: entrada, env: { ...env, ...extraEnv }, encoding: 'utf8' });
ok(viaLancador({}).stdout.trim() === '{}', 'lancador sem nenhum script: responde {} sem erro');
fs.mkdirSync(path.join(HOME_FAKE, '.memoria-ia'), { recursive: true });
const copia = path.join(HOME_FAKE, '.memoria-ia', 'memoria.mjs');
fs.writeFileSync(copia, ler(SCRIPT).replace("const VERSAO = '", "const VERSAO = 'COPIA-"));
ok(/tudo ok/.test(viaLancador({}).stdout), 'lancador cai para ~/.memoria-ia');
const clone = path.join(HOME_FAKE, '.codex', '.tmp', 'marketplaces', 'memoria-ia', 'plugin', 'scripts');
fs.mkdirSync(clone, { recursive: true });
fs.writeFileSync(path.join(clone, 'memoria.mjs'), ler(SCRIPT).replace('# memoria-ia: ${titulo}', '# memoria-ia(clone): ${titulo}'));
ok(/memoria-ia\(clone\)/.test(viaLancador({}).stdout), 'clone do Codex (vindo do GitHub) tem prioridade sobre ~/.memoria-ia');
ok(/tudo ok/.test(viaLancador({ PLUGIN_ROOT: PLUGIN }).stdout) && !/clone/.test(viaLancador({ PLUGIN_ROOT: PLUGIN }).stdout), 'PLUGIN_ROOT tem prioridade maxima');
fs.cpSync(path.join(PLUGIN, 'kit'), path.join(HOME_FAKE, '.memoria-ia', 'kit'), { recursive: true });
const proj2 = path.join(TMP, 'proj2');
fs.mkdirSync(proj2);
run(['instalar', proj2, 'P2'], { script: copia });
ok(fs.existsSync(path.join(proj2, 'CONTINUAR_AQUI.md')) && /P2/.test(ler(path.join(proj2, 'CONTINUAR_AQUI.md'))), 'copia instalada (~/.memoria-ia) acha o kit ao lado');
fs.writeFileSync(`${copia}.sha256`, crypto.createHash('sha256').update(fs.readFileSync(copia)).digest('hex') + '  memoria.mjs\n');
ok(!/ALTERADA/.test(run(['status'], { script: copia, cwd: proj }).stdout), 'copia selada e intacta: sem aviso');
fs.appendFileSync(copia, '\n// mexida por outra IA\n');
ok(/foi ALTERADA fora do instalador/.test(run(['status'], { script: copia, cwd: proj }).stdout), 'copia alterada: status avisa');
j = json(run(['--ia', 'claude', 'contexto'], { script: copia, input: entrada }));
ok(/^AVISO memoria-ia: .*ALTERADA/.test(j?.hookSpecificOutput?.additionalContext || ''), 'copia alterada: a retomada abre com o aviso');

// ---------------------------------------------------------------- lembrete (fim do turno)
const trans = path.join(TMP, 't.jsonl');
const linha = (o) => JSON.stringify(o) + '\n';
const editar = linha({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/a.js' } }] } });
const registrar = linha({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'node memoria.mjs --ia claude obs bugfix 1 "x" "y"' } }] } });
const atualizar = linha({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'node memoria.mjs --ia claude proximo "a"' } }] } });
const stop = (sid, extra = {}, ia = 'claude') => json(run(['--ia', ia, 'lembrete'], { input: JSON.stringify({ cwd: proj, session_id: sid, transcript_path: trans, ...extra }) }));
fs.writeFileSync(trans, editar);
j = stop('L1');
ok(j?.decision === 'block' && /memoria-ia/.test(j.reason) && j.reason.split(' ').length < 45, 'editou sem registrar: lembrete curto');
ok(vazio(stop('L1')), 'na mesma sessao nao repete dentro de 30 min');
ok(vazio(stop('L2', { stop_hook_active: true })), 'stop_hook_active: nao bloqueia de novo');
fs.writeFileSync(trans, editar + registrar);
ok(vazio(stop('L3')), 'registrou depois de editar: nao incomoda');
fs.writeFileSync(trans, editar + atualizar);
ok(vazio(stop('L3b')), 'atualizar Proximo tambem conta como registro');
fs.writeFileSync(trans, registrar + editar);
ok(stop('L4')?.decision === 'block', 'editou de novo depois do registro: lembra');
fs.writeFileSync(trans, linha({ type: 'user', message: 'oi' }));
ok(vazio(stop('L5')), 'sem edicao: nao incomoda');
fs.writeFileSync(trans, editar);
ok(json(run(['--ia', 'agy', 'lembrete'], { input: JSON.stringify({ workspacePaths: [proj], conversationId: 'G1', transcriptPath: trans, terminationReason: 'NO_TOOL_CALL' }) }))?.decision === 'continue', 'agy: decision continue');
ok(vazio(json(run(['--ia', 'agy', 'lembrete'], { input: JSON.stringify({ workspacePaths: [proj], conversationId: 'G2', transcriptPath: trans, terminationReason: 'USER_CANCELED' }) }))), 'agy: cancelado pelo usuario nao bloqueia');
ok(vazio(json(run(['--ia', 'claude', 'lembrete'], { input: JSON.stringify({ cwd: proj, session_id: 'L6', transcript_path: trans }), extraEnv: { MEMORIA_IA_LEMBRETE: '0' } }))), 'MEMORIA_IA_LEMBRETE=0 desliga');

// ---------------------------------------------------------------- manifestos e ganchos
for (const f of ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json', 'plugin/.claude-plugin/plugin.json', 'plugin/.codex-plugin/plugin.json', 'plugin/plugin.json', 'plugin/hooks.json', 'plugin/hooks/hooks.json', 'plugin/hooks/codex-hooks.json']) {
  let valido = true; try { JSON.parse(ler(path.join(RAIZ, f))); } catch { valido = false; }
  ok(valido, `JSON valido: ${f}`);
}
const hc = JSON.parse(ler(path.join(PLUGIN, 'hooks', 'hooks.json'))).hooks;
ok(hc.SessionStart[0].matcher === 'startup|clear|compact', 'nao reinjeta ao retomar (resume)');
ok(/Edit/.test(hc.PreToolUse[0].matcher) && /guarda/.test(hc.PreToolUse[0].hooks[0].command), 'Claude: gancho da trava antes de editar');
const ha = JSON.parse(ler(path.join(PLUGIN, 'hooks.json')))['memoria-ia'];
ok(/guarda/.test(ha.PreToolUse[0].hooks[0].command) && /contexto/.test(ha.SessionStart[0].command), 'Antigravity: ganchos de inicio e trava');
const versoes = ['.claude-plugin/marketplace.json', 'plugin/.claude-plugin/plugin.json', 'plugin/.codex-plugin/plugin.json'].map((f) => JSON.stringify(JSON.parse(ler(path.join(RAIZ, f)))).match(/"version":"([^"]+)"/)[1]);
ok(versoes.every((v) => v === ler(SCRIPT).match(/const VERSAO = '([^']+)'/)[1]), `versoes iguais em todos os manifestos (${versoes.join(', ')})`);


// ---------------------------------------------------------------- cerebro central (1.2)
{
  const CER = path.join(TMP, 'cerebro');
  const envC = { MEMORIA_CEREBRO: '' };   // usa o config.json do HOME falso
  let rc = run(['cerebro', 'buscar', 'x'], { cwd: proj, extraEnv: envC });
  ok(/nao configurado/.test(rc.stdout), 'cerebro: sem config avisa como iniciar');
  rc = run(['cerebro', 'iniciar', CER], { extraEnv: envC });
  ok(fs.existsSync(path.join(CER, 'INDICE.md')) && fs.existsSync(path.join(CER, 'solucoes')), 'cerebro iniciar cria INDICE e solucoes/');
  ok(JSON.parse(ler(path.join(HOME_FAKE, '.memoria-ia', 'config.json'))).cerebro === CER, 'cerebro iniciar grava a pasta no config');
  rc = run(['--ia', 'claude', 'cerebro', 'anotar', 'AND', 'SDK location not found. Define a valid SDK location with sdk.dir', 'local.properties sem sdk.dir',
    'criar local.properties com sdk.dir=C:\\...\\android-build\\sdk', 'gradle,sdk'], { cwd: proj, extraEnv: envC });
  ok(/E-AND-0001 anotado/.test(rc.stdout), 'anotar gera codigo E-AND-0001');
  const card = ler(path.join(CER, 'solucoes', 'E-AND-0001.md'));
  ok(/## Solucao/.test(card) && /proj \(Claude\)/.test(card), 'card completo com projeto e IA');
  rc = run(['cerebro', 'anotar', 'ESP', 'Brownout detector was triggered', 'fonte fraca no Wi-Fi', 'capacitor 470uF + fonte 2A'], { cwd: proj, extraEnv: envC });
  ok(/E-ESP-0001/.test(rc.stdout), 'numeracao separada por area');
  rc = run(['cerebro', 'buscar', 'FAILURE: SDK location not found while building app'], { cwd: proj, extraEnv: envC });
  ok(/^E-AND-0001/.test(rc.stdout) && !/E-ESP/.test(rc.stdout), 'buscar acha pelo texto do erro e nao traz o resto');
  ok(rc.stdout.split('\n').length <= 7, 'buscar imprime poucas linhas');
  rc = run(['cerebro', 'buscar', 'tela azul impressora'], { cwd: proj, extraEnv: envC });
  ok(/nada parecido/.test(rc.stdout), 'buscar sem resultado diz que nao achou');
  rc = run(['cerebro', 'anotar', 'AND', 'SDK location not found', 'outra causa', 'outra solucao', 'sdk'], { cwd: proj, extraEnv: envC });
  ok(rc.status === 3 && /somar E-AND-0001/.test(rc.stdout), 'anotar duplicado sugere somar');
  rc = run(['cerebro', 'anotar', 'WIN', 'SDK location not found no PowerShell', 'x', 'y'], { cwd: proj, extraEnv: envC });
  ok(/E-WIN-0001 anotado/.test(rc.stdout), 'duplicata so conta na mesma area');
  const outro = path.join(TMP, 'app2'); fs.mkdirSync(outro);
  rc = run(['cerebro', 'somar', 'E-AND-0001', 'mesmo erro no app2'], { cwd: outro, extraEnv: envC });
  ok(/proj,app2/.test(ler(path.join(CER, 'INDICE.md'))) && /mesmo erro no app2/.test(ler(path.join(CER, 'solucoes', 'E-AND-0001.md'))), 'somar acrescenta projeto e ocorrencia');
  rc = run(['cerebro', 'anotar', 'GIT', 'push recusado', 'token', 'usar ghp_abcdefghijklmnopqrstuvwxyz1234'], { cwd: proj, extraEnv: envC });
  ok(rc.status === 1 && /Recusado/.test(rc.stdout), 'anotar recusa texto com token');
  rc = run(['cerebro', 'anotar', 'XYZ', 'a', 'b', 'c'], { cwd: proj, extraEnv: envC });
  ok(/Area desconhecida/.test(rc.stdout), 'area invalida recusada');
  ok(/1\. SDK|SDK location/.test(run(['cerebro', 'ver', 'e-and-0001'], { extraEnv: envC }).stdout), 'ver aceita minusculas');
  j = json(run(['--ia', 'claude', 'contexto'], { input: JSON.stringify({ cwd: proj, session_id: 'c1' }), extraEnv: envC }));
  ok(/Cerebro central \(3 solucoes/.test(j?.hookSpecificOutput?.additionalContext || ''), 'retomada traz 1 linha do cerebro');
  ok(/projeto: .*proj/.test(run(['status', proj], { cwd: TMP }).stdout), 'status aceita a pasta do projeto');
  ok(/projeto: .*proj/.test(run(['--pasta', proj, 'status'], { cwd: TMP }).stdout), '--pasta roda como se estivesse no projeto');
}

function secaoDe(texto, titulo) { const m = texto.match(new RegExp(`## ${titulo}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`)); return m ? m[1] : ''; }
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`memoria-ia: ${total - falhas}/${total} testes OK`);
process.exit(falhas ? 1 : 0);
