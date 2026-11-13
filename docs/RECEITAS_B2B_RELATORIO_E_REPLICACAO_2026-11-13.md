# Receitas B2B — relatório das melhorias e guia de replicação

Data: 13/11/2026. Ambiente de validação: `http://localhost:3100/dashboard`.

Este documento descreve a melhoria visual anterior e a evolução funcional atual. O pacote ZIP complementar contém os arquivos finais, os testes e um manifesto SHA-256 para conferência. Não contém banco, credenciais, arquivos `.env` ou dados de clientes.

## 1. Resultado da primeira etapa: seção mais compacta

Antes, os seis cards consumiam muito espaço com ícones, números grandes e descrições permanentes. A composição da receita dependia de um gráfico de rosca separado.

Depois:

- Os seis indicadores continuam separados entre **Vendas ganhas** e **Em negociação**.
- Cards com padding de 12 × 14 px, ícones de 15 px e números entre 20 e 28 px em desktop.
- Três colunas em desktop; uma coluna com organização interna compacta em telas até 700 px.
- Explicações dos indicadores acessíveis pelo ícone de informação.
- Valores com alinhamento numérico e cor principal do tema; ciano identifica recorrência e laranja identifica receita pontual.
- Composição mostra o total do período, valores absolutos e participação percentual em uma barra horizontal.
- Evolução das receitas usa barras empilhadas, facilitando a leitura do total de cada intervalo.
- Tipografia explícita nos títulos evita interferência das regras globais do sistema.

A redução de espaço foi feita por CSS e reorganização do componente, sem alterar o significado dos seis indicadores.

## 2. Resultado da segunda etapa: análise e conferência

| Melhoria | Comportamento implementado |
| --- | --- |
| Comparação anterior | Variação em reais e percentual nos três indicadores de vendas ganhas; variação em reais do total do período |
| Detalhamento | Clique no valor abre uma janela com cliente, oportunidade, responsável, mensalidade, vigência/previsão e contribuição para o indicador |
| Projeção | Próximos 12 meses completos, com receitas das vendas ganhas e potencial ponderado das oportunidades abertas |
| Renovações | Faixas cumulativas de 30, 60 e 90 dias mostram quantidade e MRR associado às vigências que terminam; clique abre os registros |
| Pontual detalhado | Produtos e implantação/setup aparecem separadamente, com detalhamento individual |
| Gráfico/tabela/exportação | Alternância entre gráfico e tabela mensal, com totais; exportação CSV compatível com Excel para o horizonte selecionado |

O gráfico histórico agora separa três componentes: recorrente, produtos e setup. A projeção acrescenta uma série de potencial ponderado em uma pilha separada, para evitar confundir negociações abertas com vendas ganhas.

Os alertas são exibidos no painel. Esta entrega não cria notificações por e-mail nem tarefas automáticas.

## 3. Regras de cálculo

### 3.1 Fonte e autorização

Os cálculos usam as oportunidades já autorizadas pelo endpoint `GET /api/dashboard?type=b2b`. Permanecem os filtros de empresa/tenant, usuário responsável e probabilidade. O novo módulo não executa consultas adicionais e não amplia o escopo de acesso.

Todos os valores são projeções comerciais a partir das oportunidades. Não representam pagamentos recebidos ou conciliação bancária.

### 3.2 Normalização de campos

| Conceito | Campos atuais | Compatibilidade legada |
| --- | --- | --- |
| Receita recorrente | `revenueType = MENSAL` | `projectType = MONTHLY` |
| Duração | `contractPeriodMonths` | `projectMonths` ou `contractMonths`; fallback 12 meses |
| Mensalidade | `monthlyRecurringValue` | `monthlyValue`; fallback valor total dividido pela duração |
| Valor recorrente contratado | `totalContractValue` | `value` |
| Produtos pontuais | `totalProductsValue`, para `revenueType = PONTUAL` | `value` |
| Implantação/setup | `setupValue` | `installationFee` |
| Início da venda ganha | `actualCloseDate` | Não usar `updatedAt` como fechamento |
| Início estimado da negociação | `expectedCloseDate` | Ausência ou data vencida exclui da projeção futura |
| Probabilidade | `probability` | Limitada entre 0 e 100 |

Nesta segunda etapa, o normalizador passou a respeitar `setupValue` também para receitas do tipo `MENSAL`. Isso permite reconhecer a implantação inicial de um contrato recorrente como receita pontual.

### 3.3 Indicadores

- **MRR ativo:** soma das mensalidades das vendas ganhas iniciadas e cuja vigência ainda não terminou na data de referência.
- **Recorrente no período:** soma das parcelas mensais com vencimento dentro das datas inclusivas do filtro.
- **Pontual no período:** produtos mais setup reconhecidos na data de fechamento, dentro do filtro. Inclui o setup de contratos recorrentes.
- **Potencial mensal:** soma das mensalidades das oportunidades abertas recorrentes, sem ponderação.
- **Recorrente total:** soma de mensalidade × duração das oportunidades abertas recorrentes, sem ponderação.
- **Potencial pontual:** produtos e setup das oportunidades abertas pontuais, sem ponderação.
- **Total do período:** recorrente no período + pontual no período. O MRR não é somado novamente a esse total.

### 3.4 Datas, parcelas e vencimentos

- O calendário corrente usa `America/Sao_Paulo`; as datas de negócio são normalizadas para dias UTC, evitando deslocamentos na iteração.
- Primeira parcela na data de fechamento; parcelas seguintes no mesmo dia dos meses seguintes.
- Se o mês não possui esse dia, utiliza-se seu último dia. Exemplo: fechamento em 31/01 gera parcela em 28/02 ou 29/02.
- A data final da vigência é exclusiva: fechamento + duração em meses. Não existe parcela adicional nessa data.
- As faixas de renovação são cumulativas: um contrato que vence em 20 dias participa de 30, 60 e 90 dias. Não somar as três faixas.
- Vendas ganhas sem fechamento ficam fora da projeção e são sinalizadas no painel.
- Para esta implementação, a vigência deriva das oportunidades; não consulta a tabela de contratos nem usa datas de renovação negociadas fora da oportunidade.

### 3.5 Comparação entre períodos

O intervalo anterior é imediatamente anterior ao início do filtro e tem a mesma quantidade de dias inclusivos. Seu início e fim aparecem na interface.

Exemplo: filtro 01/10/2026–14/10/2026, com 14 dias, compara com 17/09/2026–30/09/2026. Não é uma comparação automática com o mesmo mês do ano anterior.

`delta = atual - anterior`

`percentual = ((atual - anterior) / anterior) × 100`

Se a base anterior for zero, o percentual é `null` e a interface informa “sem base percentual”. Não se exibe crescimento infinito. O MRR compara a posição atual com a posição no último dia do intervalo anterior. Para “Todo o histórico”, a comparação é desativada.

### 3.6 Projeção futura

- Horizonte: primeiro dia do próximo mês até o último dia do décimo segundo mês.
- **Vendas ganhas:** parcelas futuras de contratos recorrentes já fechados; cessam após o número contratado de parcelas.
- **Potencial ponderado:** parcelas e produtos/setup de oportunidades abertas, multiplicados pela probabilidade individual. Usa a previsão de fechamento como início esperado.
- Não presume renovação automática ou novos negócios ainda não cadastrados.
- Oportunidades sem previsão ou com previsão até a data atual ficam fora do potencial futuro e são contadas na mensagem de exclusão.
- O início previsto ainda no mês atual pode produzir parcelas nos meses futuros. Valores pontuais com data no mês atual não entram no horizonte de meses completos seguintes.
- Produtos e setup das vendas já ganhas aparecem no histórico na data de fechamento; não reaparecem na projeção futura.

### 3.7 Exportação

O botão gera `.csv`, não um arquivo nativo `.xlsx`. O arquivo usa UTF-8 com BOM, separador ponto e vírgula e vírgula decimal para abertura no Excel em português. Exporta as linhas mensais do horizonte ativo, incluindo meses zerados e as colunas de recorrência, produtos, setup, total ganho e potencial ponderado.

## 4. Arquivos e responsabilidades

| Arquivo | Responsabilidade |
| --- | --- |
| `apps/web/src/components/B2BRevenueCards.jsx` | Seis indicadores compactos, comparações e barra de composição |
| `apps/web/src/components/B2BRevenueCards.css` | Cards, painel, tabela, controles, modal e responsividade |
| `apps/web/src/components/B2BRevenuePanel.jsx` | Orquestra detalhamento, renovações, projeção, gráfico/tabela e CSV |
| `apps/web/src/pages/Dashboard.jsx` | Integra o painel usando `revenue`, `revenueInsights` e rótulo do período |
| `apps/api/lib/b2bDashboardAnalytics.js` | Normalização e indicadores existentes; acrescenta `revenueInsights` |
| `apps/api/lib/b2bRevenueInsights.js` | Comparação, memória de cálculo por oportunidade, meses, projeção e vencimentos |
| `backend/lib/b2bDashboardAnalytics.js` | Mesma integração na segunda estrutura de backend deste repositório |
| `backend/lib/b2bRevenueInsights.js` | Cópia equivalente do cálculo na segunda estrutura |
| `scripts/tests/b2b-revenue-insights.test.cjs` | Testes de reconciliação, comparação, projeção e vencimentos |

Dependências frontend já existentes: React 18, ReactDOM, Lucide, Chart.js, react-chartjs-2, `DashboardAdvancedChart` e `ThemeProvider`. Não foi adicionada dependência externa.

## 5. Contrato de resposta da API

O endpoint mantém os campos existentes e acrescenta:

```text
revenueInsights
  comparison
    available, start, end, days
    metrics.{activeMrr, periodRecurring, periodOneTime, total}
      current, previous, delta, percent
  breakdown.{products, setup}
  details.{activeMrr, periodRecurring, periodOneTime,
           recurringPipelineMonthly, recurringPipelineTotal,
           oneTimePipeline, periodProducts, periodSetup}[]
    id, number, title, client, owner, monthly, months,
    start, end, expected, amount
  monthly[]
    month, label, recurring, products, setup, potential, total
  projection[]
    month, label, recurring, products, setup, potential, total
  projectionPeriod.{start, end}
  expirations
    rows[]: dados do detalhe + days
    bands[]: days, count, monthlyRevenue
  exclusions.{undatedWins, unscheduledOpen}
```

`total` nas linhas mensais corresponde exclusivamente a receitas das vendas ganhas. `potential` é separado. O frontend não soma os dois sob o rótulo “Total ganho”.

## 6. Como replicar em outro sistema

1. Identificar qual backend e qual página estão realmente em execução. Este projeto possui `apps/api` e `backend`; o destino pode ter somente uma estrutura.
2. Fazer backup/versionar os arquivos do destino antes de incorporar as alterações.
3. Mapear os campos da seção 3.2 e preservar os filtros de autorização do destino. Não carregar toda a carteira no navegador para depois filtrar por usuário.
4. Incorporar o módulo `b2bRevenueInsights.js` ao lado do normalizador existente. Ele recebe linhas normalizadas, com campos internos `__monthly`, `__months`, `__monthlyValue`, `__setup`, `__value`, `__closed`, `__expected` e `__probability`, além das identificações e relações de cliente/responsável.
5. No retorno de `buildB2BDashboardAnalytics`, adicionar `revenueInsights: buildB2BRevenueInsights(rows, range, period)`. Usar o mesmo conjunto autorizado dos KPIs.
6. Garantir que o select da API inclua os campos de receita, fechamento, previsão, probabilidade, número, título e relações `company.name` e `owner.name`. Neste projeto esses campos já estão selecionados.
7. Incorporar os três arquivos frontend de receitas e adaptar os imports de gráfico e tema. No destino sem `ThemeProvider`, substituir por seu mecanismo de tema; no destino sem `DashboardAdvancedChart`, usar um gráfico de barras empilhadas equivalente.
8. Na página do dashboard, renderizar:

```jsx
<B2BRevenuePanel
  revenue={dashboardData.revenue}
  insights={dashboardData.revenueInsights}
  historyLabel={historyLabel}
/>
```

9. Garantir as variáveis CSS `--crm-ink`, `--crm-muted`, `--crm-border`, `--crm-workspace-panel` e `--crm-surface-2-rgb`. A última contém três números separados por espaços.
10. Não copiar `Dashboard.jsx` inteiro sobre uma página diferente. Aplicar a integração pontual e manter as demais funcionalidades do destino.
11. Rodar os testes e a compilação. Reiniciar o backend e atualizar a página, pois os módulos importados ficam em memória no processo Node.
12. Publicar frontend e backend juntos quando o destino for remoto. Esta entrega foi aplicada somente no ambiente local; não executa deploy em produção.

Não houve criação de novas colunas nesta evolução. Se o sistema de destino não tiver os campos de receita atuais, será necessário mapear seus equivalentes ou criar uma migração adequada ao banco daquele sistema.

### Pré-requisito identificado no diagnóstico anterior

O erro 500 local foi causado pela preferência explícita por um Prisma Client antigo de `backend/node_modules`. `apps/api/lib/prisma.cjs` passou a usar a resolução padrão `require('@prisma/client')`. Se o destino apresentar `Unknown field contractPeriodMonths`, conferir o cliente gerado e o schema usados pelo processo, além da presença da coluna no banco. O patch desse ajuste está no pacote como referência; não substituir configurações de conexão do destino sem revisão.

Também foi removido da rota de dashboard um bloco B2B duplicado com `require` incompatível com ESM e uma importação de logger cuja dependência não estava instalada. A correção do 500 é pré-requisito de funcionamento, separada das melhorias visuais e analíticas descritas acima.

## 7. Validação e critérios de aceite

Comando de testes:

```sh
node --test scripts/tests/b2b-revenue-insights.test.cjs scripts/tests/b2b-dashboard.test.cjs scripts/tests/b2b-revenue-sync.test.cjs scripts/tests/b2b-general-revenue.test.cjs scripts/tests/prisma-client-resolution.test.cjs
npm run build --workspace=crm-web
```

Resultado: 29 testes passaram. Compilação frontend concluída. Validação HTTP local autenticada retornou 200 para ano, mês e histórico completo; os totais mensais reconciliaram com os indicadores. Conferidos pela interface: abertura do detalhamento, projeção de 12 meses, tabela mensal e download CSV concluído.

Os testes incluem fim de mês, término de vigência, exclusão de perdidas e previsões vencidas, base anterior zero, ausência de fechamento e reconciliação de produtos/setup. As mesmas regras são verificadas nas duas estruturas de backend.

Conferências para o destino:

- Soma das contribuições do detalhamento = valor do respectivo indicador.
- Soma de produtos + setup = receita pontual no período.
- Soma dos totais mensais = recorrente + pontual no período.
- MRR não entra novamente no total acumulado.
- Projeção possui 12 linhas, incluindo meses sem receita.
- Contrato deixa de gerar parcelas quando sua duração termina.
- Base anterior zero não gera percentual infinito.
- Faixas de renovação mantêm a indicação “cumulativas”.
- Modais fecham por botão e Escape; tabelas possuem rolagem horizontal em telas pequenas.
- Exportação corresponde ao horizonte ativo.
- Filtros de tenant e usuário continuam aplicados antes de qualquer cálculo.

## 8. Limites conhecidos

A memória de cálculo deriva do cadastro atual das oportunidades. Alterações retroativas no valor, probabilidade ou duração recalculam o histórico, pois não existe nesta entrega um livro de eventos financeiros imutável. A comparação do MRR histórico é estimada com os campos atuais. Cancelamentos, aditivos, renovação efetiva, pagamento e inadimplência não são inferidos automaticamente.

O pacote é uma referência de implementação a ser integrada. A mera cópia dos componentes para um sistema com outro modelo de dados não garante equivalência financeira; o mapeamento da seção 3 é parte necessária da replicação.
