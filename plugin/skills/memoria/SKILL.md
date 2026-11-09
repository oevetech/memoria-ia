---
name: memoria
description: Memoria do projeto e trabalho conjunto entre IAs (formato memoria-ia). Use para registrar um marco (bug corrigido, funcao entregue, decisao, descoberta), atualizar Agora/Proximo/Pendencias, procurar o que ja foi feito ("ja resolvemos isso?"), lidar com a trava entre IAs, encerrar a sessao ou criar a memoria num projeto novo.
---

# memoria-ia

`memoria` = o comando mostrado no fim da retomada do inicio da sessao (`node ".../memoria.mjs" --ia <voce>`).
A retomada traz so Sempre/Agora/Proximo/Pendencias; o resto do `CONTINUAR_AQUI.md` abre sob demanda.

## Regras
1. **Nao leia arquivos grandes inteiros** (logs, `memoria/arquivo/`). Use `memoria secao <nome>`, `buscar`, `ver`.
2. **Registre na hora de cada marco** (a sessao pode cair): `memoria obs <tipo> <versao> "<titulo>" "<porque>" ["<arquivos>"]`.
   Tipos: bugfix, feature, perf, refactor, mudanca, decisao, descoberta, seguranca.
   So o que seria doloroso redescobrir; nao registre o obvio pelo codigo/git.
3. **Mudou o rumo?** `memoria agora "Estado: ..." "Versao: ..." "Como voltar: ..."` e `memoria proximo "<passo>" "<passo>"`.
   Use os comandos, nao edite o CONTINUAR_AQUI a mao (so a secao certa muda; nada se apaga por engano).
4. **Pendencias:** `memoria pendencia add "<texto>"`; resolveu: `memoria pendencia fechar P-03 "<como>"` (vira obs bugfix).
5. **Decisoes/armadilhas/regras do projeto:** `memoria anotar decisoes|armadilhas|sempre "<linha>"`.
6. **Ao encerrar:** `memoria sessao "<pedido>" "<feito>" "<aprendido>" "<proximo>" ["<o que falhou e por que>"]` (libera a trava se for sua).
7. **Segredos nunca** (chaves, senhas, tokens). Texto entre `<private>` e `</private>` nao se registra.
8. Responda no idioma do dono do projeto. Curto: fatos, numeros, caminhos, sempre o porque.

## Trava (varias IAs, mesmos arquivos)
- A 1a IA que editar um arquivo do projeto pega a trava sozinha; ela vale ate a sessao dessa IA terminar (`memoria sessao`) ou o usuario liberar.
- Se uma edicao sua for **barrada pela trava**: nao insista, nao contorne (nada de escrever por shell, copiar o projeto ou criar outra pasta). Avise o usuario quem esta com a trava e desde quando; **so ele libera**.
- `memoria trava ver` mostra o estado. Terminou antes de encerrar a sessao? `memoria trava liberar` (so a sua).

## Procurar (barato, em camadas)
1. `memoria buscar "<termo>"` -> so as linhas que batem.  2. `memoria ver <O-0012>` -> a entrada e as vizinhas; `ver S-003` -> sessao.  3. So entao abra arquivos citados.

## Projeto sem memoria
`memoria instalar "<pasta>" "<Nome>"`, depois `memoria agora ...`, `memoria proximo ...`, `memoria anotar como "Compilar: ..."`.
