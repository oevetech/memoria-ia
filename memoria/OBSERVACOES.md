# Observacoes (so acrescentar; 1 linha cada; mais nova EMBAIXO)
# ID | data | versao | tipo | titulo | porque | arquivos

O-0001 | 09/11/26 | 1.0.0 | feature | v1.0.0: plugin para Claude Code, Codex e Antigravity com retomada automatica e lembrete | porque: usuario quer memoria propria tipo claude-mem, barata e forcada em todo projeto | arq: plugin/scripts/memoria.mjs, instalar.mjs
O-0002 | 09/11/26 | 1.0.0 | decisao | Sem observador/servidor: a IA registra os marcos | porque: claude-mem roda uma 2a IA a cada passo (gasta credito); objetivo aqui e custo minimo
O-0003 | 09/11/26 | 1.0.1 | bugfix | instalar falhava rodando de ~/.memoria-ia | porque: KIT procurava ../kit (= ~/kit); agora usa o kit ao lado do script se existir. Achado por outra IA ao validar a instalacao | arq: plugin/scripts/memoria.mjs
O-0004 | 09/11/26 | 1.1.0 | feature | Retomada curta, comandos por secao, trava entre IAs e selo sha256 | porque: retomada de ~1.570 tokens tinha so 9% de Agora/Proximo; varias IAs nos mesmos arquivos precisavam de trava real; copia em ~/.memoria-ia foi alterada por outra IA | arq: plugin/scripts/memoria.mjs, tools/gerar_manifestos.mjs, instalar.mjs
O-0005 | 11/11/26 | 1.2.0 | feature | Cerebro central de erros/solucoes (memoria cerebro ...) + --pasta + status [pasta] | porque: dono quer um catalogo unico entre projetos para IA nao repesquisar o que outra ja resolveu; Codex errou status fora da pasta | arq: plugin/scripts/memoria.mjs,plugin/skills/memoria/SKILL.md,tests/testar.mjs,README.md
