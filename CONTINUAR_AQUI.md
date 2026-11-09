# CONTINUAR AQUI — memoria-ia

> Retomada para qualquer IA (Claude, Codex, Gemini/Antigravity) e para o dono. Formato **memoria-ia**: regras na skill "memoria".
> Atualize com comandos (`memoria agora|proximo|pendencia|anotar`), não editando à mão. Várias IAs no projeto: respeite a trava.

## Sempre (regras deste projeto)
- Mudou código: `node tests/testar.mjs` precisa passar inteiro antes de commit.
- Mudou manifesto/gancho: edite `tools/gerar_manifestos.mjs` e rode-o (não edite os JSON à mão); versão igual em script e manifestos.
- Código só em `G:/projetos_claude/memoria-ia` (clones do Codex em `~/.codex/.tmp` e cópias em `~/.memoria-ia` não são para editar).

## Agora
- Estado: v1.1.0 — retomada curta (Sempre/Agora/Próximo/Pendências), comandos por seção, trava entre IAs, selo sha256 das cópias. 81/81 testes.
- Versão / onde roda: github.com/oevetech/memoria-ia (público); instalado no Claude Code, Codex e Antigravity do dono.
- Como voltar: git tags (v1.0.0, v1.0.1, v1.1.0).

## Próximo
1. Dono reinstalar a 1.1.0 (`node instalar.mjs`) e abrir sessão nova no Pobrito para ver a retomada curta e a trava.
2. Confirmar numa sessão real do Codex e do Antigravity que os ganchos rodam (P-01).

## Pendências abertas
- P-01 Antigravity/Codex: ganchos seguem a doc local e os testes; falta confirmar numa sessão real (desde 09/11)
- P-02 Gemini CLI clássico: só recebe a instrução global (`~/.gemini/GEMINI.md`), sem gancho automático (desde 09/11)

## Decisões que valem (não refazer sem o dono pedir)
- Sem servidor/banco/IA observadora: a própria IA registra os marcos — custo perto de zero (09/11)
- Um único script Node para as 3 IAs; arquivos compatíveis com o kit antigo (`memoria.ps1`) (09/11)
- Retomada injetada = Sempre + Agora + Próximo + Pendências + 3 últimas obs; o resto sob demanda (`secao`) (09/11)
- Trava: 1ª IA que edita pega; outra IA é barrada pelo gancho; só o usuário libera trava de outra IA (`--forcar`) (09/11)
- Lembrete no `Stop` só se houve edição depois do último registro, no máximo 1x a cada 30 min por sessão (09/11)

## Armadilhas conhecidas
- Codex só roda ganchos com `[features] hooks = true` no `~/.codex/config.toml` (o instalador liga).
- Codex pode não definir `PLUGIN_ROOT`: o lançador tenta o clone do Codex (somente leitura) e depois `~/.memoria-ia` (selado com sha256).
- `node -e "..." <args>`: o 1º argumento não pode começar com `--` (o Node acha que é opção dele) — comando antes de `--ia`.
- Antigravity roda o gancho na pasta do `hooks.json` e usa `cmd /c` no Windows: nada de `~` em comandos.
- Codex roda em sandbox (`CodexSandboxOffline`): pode não ter rede e não grava no clone do marketplace.
- Editar o CONTINUAR_AQUI à mão já apagou seções (Codex, 09/11): por isso os comandos `agora|proximo|pendencia|anotar`.

## Como trabalhar aqui
- Testar: `node tests/testar.mjs`
- Instalar/atualizar na máquina: `node instalar.mjs` (`--local` usa esta pasta; `--remover` desfaz; `--so claude,codex,agy`)
- Mapa: `plugin/scripts/memoria.mjs` comandos e ganchos · `plugin/kit/` modelo do projeto · `plugin/skills/` memoria e passagem · `tools/gerar_manifestos.mjs` gera ganchos e manifestos · `.claude-plugin/` e `.agents/plugins/` marketplaces
