# memoria-ia

**Memória de projeto para IAs de programação — Claude Code, Codex e Gemini/Antigravity.**
Toda sessão nova começa sabendo onde o projeto está, o próximo passo e o *porquê* das coisas, gastando o mínimo de crédito.

- **Sem servidor, sem banco, sem IA extra.** Só arquivos de texto dentro do projeto + ganchos que leem esses arquivos.
- **Automático:** ao abrir uma sessão, a retomada do projeto chega sozinha para a IA.
- **Cobra o registro:** se a IA alterou arquivos e não anotou nada, ela é lembrada (uma vez, sem insistir).
- **Barato:** a IA lê ~60–80 linhas ao entrar; o histórico só é consultado por busca, em camadas.
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

## Usar

Num projeto novo, peça à IA: *"instale a memoria-ia aqui"* (ou rode `node ~/.memoria-ia/memoria.mjs instalar`). Depois preencha **Agora**, **Próximo** e **Como trabalhar aqui** no `CONTINUAR_AQUI.md`.

Comandos (a IA usa sozinha; o caminho exato aparece no início de cada sessão):

```bash
node ~/.memoria-ia/memoria.mjs obs bugfix 1.2 "Botão não salvava" "faltava await no fetch" "app.js"
node ~/.memoria-ia/memoria.mjs sessao "<pedido>" "<feito>" "<aprendido>" "<próximo>" "<o que falhou>"
node ~/.memoria-ia/memoria.mjs buscar "fetch"      # índice: só as linhas que batem
node ~/.memoria-ia/memoria.mjs ver O-0012          # a entrada e as vizinhas
node ~/.memoria-ia/memoria.mjs status              # tamanho e custo do CONTINUAR_AQUI
```

Tipos de observação: `bugfix` · `feature` · `perf` · `refactor` · `mudanca` · `decisao` · `descoberta` · `seguranca`.

**Regra de ouro:** registre só o que seria doloroso redescobrir. O óbvio pelo código ou pelo git não entra.

Trocando de IA no meio do trabalho? Peça **"passagem"**: a skill atualiza Agora/Próximo/Armadilhas e resume o que falhou, para a próxima IA continuar do ponto exato.

Desligar o lembrete numa sessão: variável de ambiente `MEMORIA_IA_LEMBRETE=0`.

## Testes

```bash
node tests/testar.mjs
```

## Créditos

Ideias inspiradas no [claude-mem](https://github.com/thedotmack/claude-mem) (Apache-2.0): índice curto no início da sessão, busca em camadas, registrar só o que é difícil de redescobrir, passagem de bastão. Diferença principal: aqui não há um segundo agente observando cada passo — a própria IA registra os marcos, o que mantém o custo perto de zero.

Licença MIT.
