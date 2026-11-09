---
name: memoria
description: Memoria do projeto (formato memoria-ia). Use para registrar um marco (bug corrigido, funcao entregue, decisao, descoberta), procurar o que ja foi feito ("ja resolvemos isso?", "por que fizemos X?"), resumir a sessao ao encerrar ou criar a memoria num projeto novo.
---

# memoria-ia

A retomada do projeto fica em `CONTINUAR_AQUI.md` (chega sozinha no inicio da sessao). O historico fica em `memoria/`.
O comando e `node "<pasta>/memoria.mjs"`; o caminho exato aparece no bloco "Comandos memoria-ia" do inicio da sessao
(padrao: `~/.memoria-ia/memoria.mjs`). Abaixo, `memoria` = esse comando.

## Procurar (barato, em camadas)
1. `memoria buscar "<termo>"` -> so as linhas que batem (indice com IDs).
2. `memoria ver <O-0012>` -> a entrada e as vizinhas (o que aconteceu em volta). `memoria ver S-003` -> resumo da sessao.
3. So entao abra arquivos citados em `arq:`. Nunca leia `memoria/arquivo/` ou logs inteiros.

## Registrar um marco (na hora, nao so no fim)
`memoria obs <tipo> <versao> "<titulo>" "<porque>" ["<arquivos>"]`
- tipos: bugfix, feature, perf, refactor, mudanca, decisao, descoberta, seguranca
- titulo curto; **porque** = causa real / motivo da decisao; arquivos principais.
- Registre so o que seria doloroso redescobrir. Pule o obvio pelo codigo/git.
- Depois **reescreva** "Agora" e "Proximo" no `CONTINUAR_AQUI.md` (edite o arquivo; nao empilhe historico la).
- Pendencia resolvida: tire da lista "Pendencias" e cite o ID (P-xx) no titulo.

## Encerrar a sessao
`memoria sessao "<pedido>" "<feito>" "<aprendido>" "<proximo>" ["<o que falhou e por que>"]`

## Projeto sem memoria
`memoria instalar "<pasta>" "<Nome>"` cria o kit sem sobrescrever nada. Depois preencha Agora, Proximo e Como trabalhar aqui.

## Regras
- Nunca grave segredos (chaves, senhas, tokens). Texto entre `<private>` e `</private>` nao se registra.
- `memoria status` mostra o tamanho do CONTINUAR_AQUI; passou de ~80 linhas, mova o excesso para `memoria/arquivo/`.
