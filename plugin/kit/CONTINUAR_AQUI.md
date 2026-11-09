# CONTINUAR AQUI — <NOME DO PROJETO>

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
- **Estado:** <uma frase: o que funciona e o que está no meio>
- **Versão / onde roda:** <versão, aparelho, URL, porta>
- **Como voltar:** <backup mais recente e como restaurar>
- **Quem está mexendo:** <livre | IA + tarefa>

## Próximo
1. <passo mais importante, concreto>

## Pendências abertas
- P-01 <problema> — <o que se sabe> (desde dd/mm)

## Decisões que valem (não refazer sem o dono pedir)
- <decisão> — porque <motivo> (dd/mm)

## Armadilhas conhecidas
- <o que já fez alguém perder tempo e como evitar>

## Como trabalhar aqui
- **Compilar/testar:** <comando>
- **Publicar/gravar:** <comando>
- **Mapa:** <pasta/arquivo> = <o que é>

## Últimas observações (máx. 10; histórico em `memoria/OBSERVACOES.md`)
- <O-0001 | dd/mm | versão | tipo | título | porquê>
