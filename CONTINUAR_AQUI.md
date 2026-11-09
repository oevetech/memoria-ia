# CONTINUAR AQUI — memoria-ia

> Retomada para **qualquer IA** (Claude, Codex, Gemini/Antigravity…) e para o dono do projeto. Formato **memoria-ia**.
> **Ao entrar, leia só este arquivo** (~80 linhas). Com a memoria-ia instalada, ele já chega sozinho no início da sessão.

## Regras de trabalho (não apagar)
1. **Entrada barata:** leia só este arquivo. Detalhe sob demanda: `memoria buscar "<termo>"` → `memoria ver <ID>`.
2. **Nunca leia inteiros:** logs, registros longos, `memoria/arquivo/`. Busque o trecho.
3. **Registre na hora de cada MARCO** (a sessão pode cair): `memoria obs <tipo> <versao> "<titulo>" "<porque>" "<arquivos>"`.
   - Marco = bug corrigido, função entregue/publicada, decisão do dono, descoberta que muda o rumo.
   - Tipos: bugfix · feature · perf · refactor · mudanca · decisao · descoberta · seguranca.
   - **Só o que seria doloroso redescobrir.** Não registre o óbvio pelo código/git (passos intermediários, renomear, instalar pacote).
   - Depois, **reescreva** "Agora" e "Próximo" abaixo (não empilhe histórico aqui).
4. **Ao encerrar:** `memoria sessao "<pedido>" "<feito>" "<aprendido>" "<proximo>" "<o que falhou e por quê>"`.
5. **Curto:** fatos, números, caminhos, **sempre o porquê**. Sem narrativa.
6. **Pendência resolvida:** sai da lista e vira `obs bugfix` citando o ID (P-xx).
7. **Passou de ~80 linhas?** Mova o excesso para `memoria/arquivo/`.
8. **Mudança arriscada:** backup antes e anote em "Como voltar".
9. **Segredos nunca entram aqui** (chaves, senhas, tokens). Texto entre `<private>` e `</private>` não se registra.
10. **Várias IAs no projeto:** diga quem está mexendo em "Agora". Responda no idioma do dono.

`memoria` = o comando que a memoria-ia mostra no início da sessão (`node ".../memoria.mjs"`).

## Agora
- **Estado:** v1.0.1 pronta e testada (42/42). Funciona em Claude Code, Codex 0.166 e Antigravity (Gemini).
- **Versão / onde roda:** `plugin/scripts/memoria.mjs` (Node, sem dependências); instalador `instalar.mjs`; repositório github.com/oevetech/memoria-ia.
- **Como voltar:** git (cada versão é um commit/tag).
- **Quem está mexendo:** livre.

## Próximo
1. Usar no dia a dia e ajustar o lembrete (`lembrete`) se incomodar ou se faltar.
2. Testar de verdade no Antigravity e no Codex (ganchos instalados pelo `instalar.mjs`).

## Pendências abertas
- P-01 Antigravity: ganchos seguem a doc local (`agy-customizations/docs/hooks.md`); falta confirmar numa sessão real (09/11).
- P-02 Gemini CLI clássico: só recebe a instrução global (`~/.gemini/GEMINI.md`), sem gancho automático (09/11).

## Decisões que valem (não refazer sem o dono pedir)
- Sem servidor/banco/IA observadora: a própria IA registra os marcos — custo perto de zero (09/11).
- Um único script Node para as 3 IAs; mesmo formato de arquivos do kit antigo (`memoria.ps1`), compatível (09/11).
- Lembrete no `Stop` só se houve edição depois do último registro, no máximo 1x a cada 30 min por sessão (09/11).

## Armadilhas conhecidas
- Codex só roda ganchos com `[features] hooks = true` no `~/.codex/config.toml` (o instalador liga).
- Codex pode não definir `PLUGIN_ROOT`: o lançador cai para `~/.memoria-ia/memoria.mjs` (o instalador copia).
- Antigravity roda o gancho na pasta do `hooks.json` (por isso o caminho relativo `scripts/memoria.mjs`) e usa `cmd /c` no Windows: nada de `~` em comandos.
- `node -e` coloca o 1º argumento em `argv[1]`: o script detecta isso.

## Como trabalhar aqui
- **Testar:** `node tests/testar.mjs` → precisa "42/42" (ou mais).
- **Instalar/atualizar na máquina:** `node instalar.mjs` (`--local` usa esta pasta; `--remover` desfaz).
- **Mapa:** `plugin/scripts/memoria.mjs` comandos e ganchos · `plugin/kit/` modelo do projeto · `plugin/skills/` memoria e passagem · `plugin/hooks*` ganchos (Claude, Codex, Antigravity) · `.claude-plugin/` e `.agents/plugins/` marketplaces.

## Últimas observações (histórico: `memoria/OBSERVACOES.md`)
- O-0001 — v1.0.0: plugin para Claude Code, Codex e Antigravity com retomada automática e lembrete
