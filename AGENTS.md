# Instruções para IAs neste projeto

**Antes de qualquer coisa, leia `CONTINUAR_AQUI.md`** (é curto). Ele diz onde o projeto está, o próximo passo, as decisões que valem e as regras de registro (formato memoria-ia).

- Não leia arquivos grandes inteiros; use `memoria buscar "<termo>"` e `memoria ver <ID>`.
- A cada marco: `memoria obs ...` e reescreva "Agora"/"Próximo" no `CONTINUAR_AQUI.md`.
- Ao encerrar: `memoria sessao ...`.
- `memoria` = `node "<pasta da memoria-ia>/memoria.mjs"` (o caminho aparece no início da sessão; padrão `~/.memoria-ia/memoria.mjs`).
