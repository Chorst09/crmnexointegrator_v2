// Documentação do módulo Pré-Vendas

export const docPreVendasContent = [
  {
    title: '📋 O que é este módulo?',
    content: `O Pré-Vendas recebe demandas do Comercial (B2B/B2G), realiza cotações com distribuidores, precifica soluções e devolve propostas estruturadas ao time de vendas. O fluxo é bidirecional: o Comercial envia solicitações e o Pré-Vendas devolve propostas.`
  },
  {
    title: '📊 Dashboard — KPIs disponíveis',
    content: `Solicitações:
• Novas Solicitações — aguardando assumir pela equipe.
• Em Precificação — em processo de cotação/cálculo.
• Aguardando Aprovação — enviadas para revisão do Comercial.
• Finalizadas — concluídas no período.

Registro de Oportunidades:
• Total, Abertas, Ganhas, Valor Potencial (R$).

POCs (Provas de Conceito):
• Total, Em Andamento, Bloqueadas, Aprovadas, Atrasadas.

Alertas automáticos de validade: vencidas, vence em 7/15/30 dias.`
  },
  {
    title: '➕ Criando uma solicitação',
    content: `1. Clique em "Nova Solicitação" no Dashboard.

Etapa 1 — Dados básicos:
• Título (obrigatório).
• Descrição detalhada da necessidade.
• Prioridade: Baixa / Média / Alta / Urgente.

Etapa 2 — Detalhes técnicos:
• Tipos de Precificação (checkboxes): Venda, Locação, Serviços, Rateio, etc.
• Prazo esperado de retorno.
• Orçamento estimado (R$).

2. Clique em "Criar Solicitação".`
  },
  {
    title: '📥 Recebendo solicitações do Comercial B2B',
    content: `As solicitações chegam automaticamente quando um vendedor cria uma atividade do tipo "Solicitação de Orçamento" com destino "Pré-Vendas".

Você verá a solicitação na coluna ENTRADA do Kanban em Solicitações.

Toda atualização de status no Pré-Vendas é sincronizada automaticamente com a atividade original no Comercial — sem necessidade de atualizar manualmente em dois lugares.`
  }
];

export const docSolicitacoesContent = [
  {
    title: '📋 O que é este módulo?',
    content: `Fila de trabalho operacional do Pré-Vendas. Exibe todas as solicitações em um Kanban com 4 colunas de fluxo. Duas visualizações: Kanban (padrão) e Lista.`
  },
  {
    title: '🗂️ Colunas do Kanban',
    content: `• ENTRADA — recebida, aguardando ser assumida pela equipe.
• COTAÇÃO — sendo cotada com distribuidores/fornecedores.
• PRECIFICAÇÃO — custo recebido, calculando preço de venda.
• REVISÃO — pronta para revisão final antes de devolver ao Comercial.

Solicitações DEVOLVIDAS (finalizadas) aparecem apenas na visualização Lista.`
  },
  {
    title: '▶️ Passo 1 — Assumir a solicitação',
    content: `1. Clique no card na coluna ENTRADA.
2. Clique em "Avançar Etapa" ou "Assumir".
3. A solicitação move para a coluna COTAÇÃO.

A solicitação fica registrada como "Em Precificação" no sistema.`
  },
  {
    title: '💰 Passo 2 — Registrar cotação com distribuidor',
    content: `1. Clique em "Abrir Cotação" no card.
2. No modal, vá para a aba COTAÇÕES.
3. Preencha:
   • Distribuidor (obrigatório).
   • Número do Orçamento.
   • Modalidade: Venda / Locação / Serviços.
   • Itens: Descrição, Quantidade, Custo Unitário.
4. Clique em "Salvar Cotação".
5. Repita para cada distribuidor consultado.

Você pode adicionar múltiplas cotações de distribuidores diferentes para comparar preços.`
  },
  {
    title: '🧮 Passo 3 — Enviar para Precificação',
    content: `1. No modal de Cotação, vá para a aba PRECIFICAÇÃO.
2. Clique em "Enviar para Precificação".
3. O sistema salva os dados da cotação e abre automaticamente a Calculadora de Precificação com os custos já importados.
4. Na calculadora, defina o preço de venda, margem e condições.
5. Salve o resultado na calculadora.`
  },
  {
    title: '📤 Passo 4 — Devolver proposta ao Comercial',
    content: `1. Clique em "Avançar Etapa" na coluna PRECIFICAÇÃO → REVISÃO.
2. No modal de Resposta, preencha:
   • Mensagem/Observações para o Comercial.
   • Valor Sugerido (R$).
   • Custo Total (R$).
   • Margem de Lucro (%).
   • Número da Proposta vinculada (se houver).
3. Clique em "Enviar Resposta".
4. A solicitação muda para DEVOLVIDA e a atividade original no B2B é atualizada automaticamente.`
  },
  {
    title: '❌ Cancelando uma solicitação',
    content: `Clique em "Cancelar" em qualquer etapa do fluxo.

Se a solicitação veio de uma atividade B2B, o status da atividade original será atualizado automaticamente para "Cancelada" — sem necessidade de ação manual no Comercial.`
  },
  {
    title: '🔍 Filtros disponíveis',
    content: `• Busca textual — por título, empresa ou responsável.
• Apenas Minhas — exibe somente solicitações atribuídas ao usuário logado.
• Fila — filtra por área de destino (Pré-Vendas, Comercial, etc.).`
  }
];

export const docOrcamentosContent = [
  {
    title: '📋 O que é este módulo?',
    content: `Visão consolidada de todos os orçamentos registrados no Pré-Vendas. Permite criar orçamentos manualmente, registrar custos de distribuidores e enviar para precificação.`
  },
  {
    title: '➕ Criando um orçamento manual',
    content: `1. Clique em "Novo Orçamento".

Etapa 1 — Dados da Solicitação:
• Título (obrigatório).
• Descrição.
• Nome do Cliente.
• Modalidade: Venda / Locação / Serviço.
• Quem solicitou (dropdown de usuários).
• Para quem encaminhar (dropdown de usuários).
• Oportunidade ID (opcional — vincula a uma oportunidade existente).
• Prioridade e Prazo esperado.

Etapa 2 — Itens Solicitados:
• Adicione linhas: Descrição, Quantidade, Custo Unitário, ICMS Compra %.

2. Clique em "Criar Orçamento".`
  },
  {
    title: '🏭 Registrando custos de distribuidores',
    content: `1. Abra o orçamento desejado.
2. Clique em "Custos de Distribuidores".
3. Para cada cotação preencha:
   • Modalidade: Venda / Locação / Serviços.
   • Distribuidor (obrigatório).
   • Número do Orçamento.
   • Itens: Descrição, Quantidade, Custo Unitário.
4. Clique em "Salvar".
5. Repita para diferentes distribuidores.`
  },
  {
    title: '🧮 Ação Precificar',
    content: `Após registrar os custos de distribuidores:
1. Clique em "Precificar".
2. A calculadora de precificação abre automaticamente com os custos já importados.
3. Defina o preço de venda, margem e condições comerciais.
4. Salve o resultado.

Os dados são passados automaticamente via localStorage — não é necessário digitar os custos novamente.`
  },
  {
    title: '📊 Status dos Orçamentos',
    content: `• Nova (Solicitada) — recém criada, aguardando ação.
• Em Precificação — sendo cotada/calculada.
• Aguardando Aprovação — proposta gerada, aguardando aprovação interna.
• Finalizada — processo concluído.
• Rejeitada — orçamento rejeitado pelo solicitante.
• Cancelada — cancelada antes de finalizar.`
  }
];
