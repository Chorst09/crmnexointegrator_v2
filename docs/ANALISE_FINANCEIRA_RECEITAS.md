# Receita mensal e pontual na análise financeira

As visões Geral, B2B e B2G usam a mesma decomposição financeira:

- **Recorrente mensal:** soma das mensalidades, em R$/mês.
- **Recorrente no prazo:** mensalidade multiplicada pela duração do contrato.
- **Pontual:** produtos, projetos, setup e implantação cobrados uma única vez.
- **Total:** recorrente no prazo + pontual + valores sem classificação.

Os controles **Contratos ganhos** e **Em negociação** mantêm os valores contratados
separados dos potenciais. O filtro de período utiliza a data de cadastro das
oportunidades, conforme o comportamento existente. As mensalidades incluem os
contratos históricos desse recorte; não representam automaticamente receita ativa,
faturada ou recebida no mês.

Exemplo: R$ 1.000/mês × 12 meses + R$ 500 de implantação = R$ 12.500 contratados.
O gráfico mensal mostra R$ 1.000/mês. A composição do total mostra R$ 12.000 de
recorrência e R$ 500 pontuais, em unidades comparáveis.

Os cálculos respeitam os campos modernos `revenueType`, `monthlyRecurringValue`,
`contractPeriodMonths`, `totalProductsValue` e `setupValue`; os campos legados
`projectType`, `monthlyValue`, `projectMonths`, `contractMonths`, `installationFee`;
e os valores mensais/pontuais B2G presentes no JSON da descrição. Zeros explícitos
são preservados. Um prazo ausente não é substituído por 12 meses. Cadastros
incompletos ou sem classificação são sinalizados.

O resultado comercial existente foi identificado como **contratos ganhos menos
comissões aprovadas**, pois a base utilizada não apura recebimentos, impostos ou
todos os custos operacionais. As estimativas do Simulador permanecem separadas.

A normalização está em `backend/lib/financial-revenue.cjs` e sua cópia em
`apps/api/lib/financial-revenue.cjs`. O teste garante a igualdade entre as versões,
a conciliação dos totais, a compatibilidade com contratos B2G mistos e a preservação
dos filtros de responsável/privacidade existentes.
