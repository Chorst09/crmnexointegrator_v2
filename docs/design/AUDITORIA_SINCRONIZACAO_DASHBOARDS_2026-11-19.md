# Auditoria de sincronização dos dashboards

Ambiente: frontend local `localhost:5173`, API `localhost:3100`, PostgreSQL no container `nexosintegrator`, porta 5434. Esta auditoria não confirma publicação ou configuração da VPS.

## Resultado

Foram revisados os fluxos de dados do Geral, B2B, B2G, Pré-vendas, Financeiro, Metas/Vendedores, Projetos, Simuladores e Automações. Os dashboards principais consultam fontes persistidas e receberam correções de atualização, paginação, escopo e reconciliação. A fonte de Regras de Automação permanece indisponível no banco local e é sinalizada como tal.

## Correções

| Área | Divergência encontrada | Ajuste |
| --- | --- | --- |
| Atualização | Alguns painéis consultavam os dados apenas ao abrir | Revalidação a cada 30 segundos enquanto visíveis, ao retornar à janela e por evento de sincronização; atualização em segundo plano |
| Geral | Recortes internos de datas podiam excluir registros antigos antes do filtro escolhido na tela | Consulta da carteira autorizada completa; paginação completa de Pré-vendas também no fallback |
| B2G | Atualização periódica recarregava oportunidades, mantendo órgãos e agenda antigos | Revalidação conjunta das fontes do dashboard |
| Analytics B2G | Busca nacional de contingência podia alimentar indicadores com demonstrações; prazos vencidos entravam na lista futura | Indicadores baseados em licitações monitoradas no CRM, falhas explícitas, datas futuras e valores numéricos |
| Projetos | Gráfico semanal gerado por multiplicadores e variações fixas; filtros não afetavam todos os indicadores | Entradas reais por semana, conforme cadastro e situação atual; KPIs e gráficos usam o mesmo filtro |
| Projetos | Primeira página de até 200 projetos tratada como carteira completa; escopos diferentes entre lista e resumo | Leitura de todas as páginas e escopo comum por empresa e participação do usuário |
| Simuladores | Limite de 1.000 propostas no dashboard; falha podia ser convertida em sucesso vazio | Consulta completa autorizada e erro explícito da fonte |
| Simuladores/Financeiro | Propostas sem gerente de conta podiam desaparecer por comparação SQL com valor nulo | Preservação dessas propostas sem liberar dados de responsáveis protegidos |
| Simuladores | Versões podiam receber responsável diferente quando a origem não era encontrada | Origem validada por tipo; versão preserva responsável original; origem ausente não inventa atribuição |
| Metas/Vendedores | Metas fora do usuário/tenant e vendas repetidas em períodos sobrepostos | Escopo aplicado antes do cálculo e resumo de vendas distintas, preservando o realizado individual de cada meta |
| Automações | Leitura parcial de fontes paginadas e ausência de estrutura interpretada como lista vazia | Paginação completa e aviso de fonte indisponível; workflow do Geral usa a mesma origem de workflows avançados da tela |
| Inicialização | Rotina tentava semear 58 registros demonstrativos automaticamente | Semeadura desabilitada em produção e dependente de opt-in explícito em desenvolvimento |

As correções de API foram mantidas nas estruturas `apps/api` e `backend` quando há implementações equivalentes.

## Validação

- 130 testes automatizados de dashboards, receita, escopo, paginação, propostas, Pré-vendas e sincronização.
- Build de produção e três testes do prebuild aprovados; saída em diretório temporário.
- Registros controlados criados em duas contas locais comuns, sem utilizar identidade ou credenciais de usuários existentes.
- Reconciliação de IDs de oportunidades B2B/B2G, pipeline, vendas ganhas, metas e propostas com o PostgreSQL.
- Solicitação de Pré-vendas de 2020 incluída na carteira completa.
- Duas metas com períodos sobrepostos não duplicam a mesma venda no resumo.
- Proposta sem gerente de conta permanece no Simulador e no Financeiro.
- Solicitação anônima ao dashboard de propostas retorna 401.
- Alterações no banco verificadas no navegador ao revalidar os dashboards.
- Registros temporários removidos ao final; os dados existentes não foram usados como massa de edição.

O manifesto JSON complementar contém apenas o resumo das conferências, sem tokens, senhas ou registros de clientes.

## Limites

- `AutomationRule` não está disponível no cliente Prisma nem como tabela no banco local. O painel não apresenta essa fonte como sincronizada. Não foi criada estrutura vazia apenas para esconder a pendência.
- O teste HTTP usa contas comuns. Escopos administrativos por tenant são cobertos por testes automatizados; nenhuma identidade administrativa existente foi representada por token fabricado.
- Projetos e oportunidades refletem a situação atual dos registros. O gráfico de Projetos é agrupado pela data de entrada e não afirma reconstruir mudanças históricas de status.
- Comparações de valores continuam dependentes dos campos atuais e do significado de cada indicador. Receita contratada, mensalidade ativa, previsão e recebimento não são valores intercambiáveis.
- Integrações externas e dados da VPS não foram validados nesta auditoria local.
