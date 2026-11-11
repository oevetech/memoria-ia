# memoria-ia

**Memória de projeto para IAs de programação — Claude Code, Codex e Gemini/Antigravity — trabalhando juntas nos mesmos arquivos.**
Toda sessão nova começa sabendo onde o projeto está e o próximo passo, gastando o mínimo de crédito, e duas IAs nunca editam o mesmo projeto ao mesmo tempo.

- **Sem servidor, sem banco, sem IA extra.** Só arquivos de texto dentro do projeto + ganchos que leem esses arquivos.
- **Automático:** ao abrir uma sessão, a retomada do projeto chega sozinha para a IA.
- **Cobra o registro:** se a IA alterou arquivos e não anotou nada, ela é lembrada (uma vez, sem insistir).
- **Barato:** ao entrar, a IA recebe só *Sempre*, *Agora*, *Próximo* e *Pendências* (~500 tokens); decisões, armadilhas e histórico só por comando.
- **Trava entre IAs:** a 1ª IA que edita pega a trava; outra IA que tentar editar é barrada pelo gancho e avisa você. Só você libera.
- **Sem bagunça:** as seções são atualizadas por comando (`agora`, `proximo`, `pendencia`, `anotar`), sem reescrever o arquivo à mão.
- **Português** por padrão. Funciona em Windows, Linux e macOS (precisa só do Node.js).

## Como funciona

Cada projeto ganha:

| Arquivo | Para quê |
|---|---|
| `CONTINUAR_AQUI.md` | **O único que a IA lê ao entrar.** Regras + Agora + Próximo + Pendências + Decisões + Armadilhas + últimas observações (~80 linhas). |
| `memoria/OBSERVACOES.md` | 1 linha por marco: bug corrigido, função entregue, decisão, descoberta — **sempre com o porquê**. |
| `memoria/SESSOES.md` | Resumo de cada sessão: pedido, feito, aprendido, próximo e **o que falhou** (para não repetir). |
| `memoria/arquivo/` | Texto antigo tirado do CONTINUAR_AQUI. Só para busca. |
| `CLAUDE.md` · `AGENTS.md` · `GEMINI.md` | Apontam para o CONTINUAR_AQUI (cada IA lê o seu sozinha). |

E as IAs ganham (no seu usuário, valendo para todo projeto):

| | Claude Code | Codex | Antigravity / Gemini |
|---|---|---|---|
| Retomada automática ao abrir | gancho `SessionStart` | gancho `SessionStart` | gancho `SessionStart` |
| Trava antes de editar | gancho `PreToolUse` | gancho `PreToolUse` | gancho `PreToolUse` |
| Lembrete de registrar | gancho `Stop` | gancho `Stop` | gancho `Stop` |
| Skills `memoria` e `passagem` | ✔ | ✔ | ✔ |
| Instrução global de reforço | — | `~/.codex/AGENTS.md` | `~/.gemini/GEMINI.md` + regra do plugin |

## Instalar

```bash
git clone https://github.com/oevetech/memoria-ia
cd memoria-ia
node instalar.mjs
```

O instalador detecta o que você tem (Claude Code, Codex, Antigravity/Gemini) e configura cada um. Ele faz backup (`*.bak-memoria-ia`) antes de mexer em qualquer configuração e só acrescenta o que é dele.

Só uma IA: `node instalar.mjs --so claude` (ou `codex`, `agy`). Desfazer: `node instalar.mjs --remover`.

**Só no Claude Code**, também dá para instalar por dentro dele:

```
/plugin marketplace add oevetech/memoria-ia
/plugin install memoria-ia@memoria-ia
```

**Só no Codex:** `codex plugin marketplace add oevetech/memoria-ia` → `codex plugin add memoria-ia@memoria-ia` e, no `~/.codex/config.toml`, `[features]` `hooks = true`.

Depois de instalar, reinicie a IA. No Codex, aceite confiar nos ganchos se ele perguntar.

## Cérebro central (1.2): erros e soluções de TODOS os projetos

A memória de cada projeto guarda o andamento *daquele* projeto. O **cérebro** é uma pasta única, fora de todos os projetos,
onde qualquer IA (Claude, Codex, Gemini) anota um erro resolvido e qualquer outra IA, em qualquer projeto, encontra a solução
antes de gastar tempo pesquisando de novo.

```bash
memoria cerebro iniciar "G:/projetos_claude/cerebro-ia"     # uma vez (grava ~/.memoria-ia/config.json)
memoria cerebro buscar "SDK location not found"             # 5 linhas mais parecidas (~150 tokens)
memoria cerebro ver E-AND-0001                              # card completo
memoria cerebro anotar AND "<erro exato>" "<causa>" "<solucao>" ["tags"] ["o que NAO funcionou"]
memoria cerebro somar E-AND-0001 "aconteceu também no app X"
```

- **Barato:** a IA nunca lê o cérebro inteiro. `INDICE.md` tem 1 linha por solução; a busca pontua as linhas (palavras raras
  valem mais + trecho exato) e mostra só as 5 melhores; o card (`solucoes/<ID>.md`) abre só pelo código.
- **Código do erro:** `E-<ÁREA>-NNNN` — AND (Android), ESP, WIN, WEB, PY, NODE, GIT, IA, HA, CPP, GEN.
- **Sem duplicata:** se já existe algo parecido, o `anotar` recusa e sugere `somar` (`--forcar` se for outro problema).
- **Sem segredo:** texto com cara de token/chave é recusado.
- **Automático:** a retomada de toda sessão ganha 1 linha lembrando de buscar no cérebro antes de pesquisar.
- Pasta alternativa por variável: `MEMORIA_CEREBRO=<pasta>`.

## Usar

Num projeto novo, peça à IA: *"instale a memoria-ia aqui"* (ou rode `node ~/.memoria-ia/memoria.mjs instalar`). Depois preencha **Agora**, **Próximo** e **Como trabalhar aqui** no `CONTINUAR_AQUI.md`.

Comandos (a IA usa sozinha; o caminho exato aparece no início de cada sessão — abaixo, `memoria` = `node ~/.memoria-ia/memoria.mjs`):

```bash
memoria obs bugfix 1.2 "Botão não salvava" "faltava await no fetch" "app.js"   # 1 marco = 1 linha, com o porquê
memoria agora "Estado: ..." "Versão: ..." "Como voltar: ..."                   # reescreve só a seção Agora
memoria proximo "testar no celular" "publicar"                                  # reescreve só Próximo (numera sozinho)
memoria pendencia add "login cai às vezes"   |   memoria pendencia fechar P-03 "timeout do token"
memoria anotar armadilhas "não usar a porta 80"                                 # também: decisoes, sempre, como...
memoria secao armadilhas        # abre uma seção sob demanda
memoria buscar "fetch"          # índice: só as linhas que batem
memoria ver O-0012              # a entrada e as vizinhas
memoria sessao "<pedido>" "<feito>" "<aprendido>" "<próximo>" "<o que falhou>"   # fim da sessão (libera a trava)
memoria trava ver               # quem está editando
memoria status                  # tamanho, custo da retomada e trava
```

Tipos de observação: `bugfix` · `feature` · `perf` · `refactor` · `mudanca` · `decisao` · `descoberta` · `seguranca`.

**Regra de ouro:** registre só o que seria doloroso redescobrir. O óbvio pelo código ou pelo git não entra.

Trocando de IA no meio do trabalho? Peça **"passagem"**: a skill atualiza Agora/Próximo/Armadilhas e resume o que falhou, para a próxima IA continuar do ponto exato.

## Trava entre IAs

- A primeira IA que **edita** um arquivo do projeto pega a trava (`.memoria-ia-trava.json`, já vai para o `.gitignore`).
- Outra IA que tentar editar é **barrada antes da edição**, avisa você quem está com a trava e desde quando, e não consegue liberar nem apagar a trava pelo shell.
- A dona libera sozinha ao encerrar (`memoria sessao`) ou com `memoria trava liberar`.
- **Trava de outra IA, só você libera**, no seu terminal: `node ~/.memoria-ia/memoria.mjs trava liberar --forcar`.

## Segurança das cópias

O instalador sela as cópias do script com sha256. Se alguma for alterada fora do instalador (por outra IA, por exemplo), a retomada e o `status` avisam. Os ganchos usam, nesta ordem: o script do plugin → o clone do Codex vindo do GitHub (somente leitura) → `~/.memoria-ia`.

## Ajustes

- `MEMORIA_IA_NIVEL=completo`: injeta o `CONTINUAR_AQUI.md` inteiro em vez da retomada curta.
- `MEMORIA_IA_LEMBRETE=0`: desliga o lembrete de registrar.

## Testes

```bash
node tests/testar.mjs
```

## Créditos

Ideias inspiradas no [claude-mem](https://github.com/thedotmack/claude-mem) (Apache-2.0): índice curto no início da sessão, busca em camadas, registrar só o que é difícil de redescobrir, passagem de bastão. Diferença principal: aqui não há um segundo agente observando cada passo — a própria IA registra os marcos, o que mantém o custo perto de zero.

Licença MIT.
