---
name: passagem
description: Passagem de bastao entre sessoes ou IAs (Claude, Codex, Gemini). Use quando o usuario disser "passagem", "vou trocar de IA", "continuar depois", quando a sessao ficou longa/confusa ou quando a mesma solucao falhou varias vezes.
---

# Passagem (handoff) no formato memoria-ia

Objetivo: a proxima IA continua exatamente daqui, lendo so o `CONTINUAR_AQUI.md`.

1. Pense no arco inteiro da sessao: objetivo do usuario, o que mudou, o que **falhou e por que**, sua teoria atual.
2. Reescreva no `CONTINUAR_AQUI.md`:
   - **Agora:** estado em 1-2 frases, versao/onde roda, como voltar, "Quem esta mexendo: livre".
   - **Proximo:** passos numerados e concretos (comando, arquivo, o que conferir).
   - **Pendencias:** acrescente o que ficou aberto (P-xx), com o que se sabe.
   - **Armadilhas:** acrescente tentativas que falharam e por que (para nao repetir).
3. Registre os marcos que faltaram: `memoria obs ...` (um por marco).
4. Feche com `memoria sessao "<pedido>" "<feito>" "<aprendido>" "<proximo>" "<o que falhou e por que>"`.
5. Responda ao usuario em 3 linhas: onde parou, proximo passo, e que a proxima IA so precisa abrir a pasta.

Curto e factual: caminhos, comandos, numeros. Sem segredos.
