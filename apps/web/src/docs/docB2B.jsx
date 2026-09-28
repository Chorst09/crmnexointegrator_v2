// Conteúdo de documentação do Módulo B2B

export const docEmpresasContent = [
  {
    title: '📋 O que é este módulo?',
    content: `Cadastro central de todas as empresas privadas — clientes ativos, prospects e leads. Cada empresa pode ter múltiplos contatos, documentos e histórico de oportunidades vinculadas.`
  },
  {
    title: '➕ Como cadastrar uma empresa',
    content: `1. Clique em "Nova Empresa" no canto superior direito.
2. Preencha o Nome da Empresa (obrigatório).
3. Informe CNPJ/CPF, Segmento, Porte e Status.
4. Adicione o Website da empresa.
5. Preencha o Contato Principal (Nome, Email, Telefone, Cargo).
6. Preencha o Contato de Compras (responsável por contratos/pedidos).
7. Informe Endereço, Cidade e Estado.
8. Clique em Salvar.`
  },
  {
    title: '🔖 Status das empresas',
    content: `• Lead — empresa recém captada, sem qualificação ainda.
• Prospect — em processo de qualificação ou abordagem ativa.
• Ativo — cliente em relacionamento comercial ativo.
• Inativo — sem movimentação recente.
• Perdido (Churned) — cliente cancelado ou perdido para a concorrência.`
  },
  {
    title: '⭐ Lead Score',
    content: `Número de 0 a 100 calculado automaticamente com base em dados de engajamento, histórico de oportunidades e atividades registradas.

Faixas:
• 80–100 → Hot (prioridade máxima de abordagem)
• 60–79 → Warm (abordar em breve)
• 40–59 → Cold (monitorar)
• 0–39 → Low Priority (nutrir com conteúdo)`
  },
  {
    title: '📂 Visualizando detalhes de uma empresa',
    content: `Clique no ícone de olho (👁) na linha da empresa para abrir o painel de detalhes.

Abas disponíveis:
• Cadastro — todos os dados cadastrais completos.
• Documentos — upload e download de arquivos (contratos, certidões, propostas).
• Links rápidos — clique em qualquer oportunidade, contrato ou atividade vinculada para navegar diretamente.`
  },
  {
    title: '📎 Upload de documentos',
    content: `1. Abra o painel de detalhes da empresa (ícone de olho).
2. Vá para a aba Documentos.
3. Clique em "Adicionar Documentos".
4. Selecione um ou mais arquivos do seu computador.
5. Clique em "Enviar".

Os arquivos ficam armazenados vinculados permanentemente à empresa.`
  },
  {
    title: '🔍 Filtros e busca',
    content: `• Busca textual: filtra por nome, CNPJ, segmento, website ou cidade.
• Filtro por Status: Lead / Prospect / Ativo / Inativo / Perdido.
• Exclusão em lote: marque várias empresas e clique em "Excluir selecionados".`
  }
];

export const docOportunidadesContent = [
  {
    title: '📋 O que é este módulo?',
    content: `Pipeline de vendas no formato Kanban. Cada oportunidade representa uma negociação em andamento com uma empresa. Arraste os cards entre as colunas para avançar no funil.`
  },
  {
    title: '🔄 Etapas do funil',
    content: `LEAD → QUALIFICAÇÃO → DIAGNÓSTICO → PROPOSTA → NEGOCIAÇÃO → GANHOU | PERDEU

• Lead: contato inicial, sem qualificação formal.
• Qualificação: verificação de fit e interesse do cliente.
• Diagnóstico: levantamento de necessidades técnicas e de negócio.
• Proposta: proposta comercial enviada ao cliente.
• Negociação: ajustes de preço, prazo e condições.
• Ganhou: negócio fechado com sucesso.
• Perdeu: negócio encerrado sem venda.`
  },
  {
    title: '➕ Como criar uma oportunidade',
    content: `1. Clique em "Nova Oportunidade".
2. Preencha o Título e Nome do Projeto.
3. Selecione o Tipo de Projeto Cliente: Cliente Novo / Cliente da Base / Renovação.
4. Selecione o Tipo de Projeto: Pontual ou Mensal.
5. Se mensal, informe o Número de Meses.
6. Informe o Valor estimado (R$) e a Probabilidade de fechamento (0–100%).
7. Selecione a Empresa e o Responsável (vendedor).
8. Defina a Data de Fechamento Prevista.
9. Clique em Salvar.`
  },
  {
    title: '🖱️ Mover oportunidades no Kanban',
    content: `Clique e arraste qualquer card para outra coluna para avançar ou retroceder a etapa da negociação.

Atenção: oportunidades nas colunas "Ganhou" e "Perdeu" não podem ser arrastadas.

Ao mover para "Perdeu", um modal obrigatório solicitará o motivo da perda.`
  },
  {
    title: '📝 Registrar acompanhamentos (Follow-ups)',
    content: `1. Clique em qualquer card de oportunidade para abrir os detalhes.
2. Role até a seção de acompanhamentos.
3. Selecione o Tipo: Nota / Ligação / E-mail / Reunião / WhatsApp.
4. Digite o conteúdo do acompanhamento.
5. Clique em "Adicionar".

Cada acompanhamento é salvo com data/hora e nome do usuário que registrou.`
  },
  {
    title: '❌ Motivos de perda',
    content: `Ao mover uma oportunidade para "Perdeu", selecione o motivo:

• Preço acima do esperado
• Concorrência venceu
• Prazo de entrega inviável
• Cliente optou por não investir
• Produto não atende aos requisitos
• Orçamento insuficiente do cliente
• Relacionamento com concorrente
• Decisão interna do cliente
• Outro`
  },
  {
    title: '📊 KPIs e filtros',
    content: `KPIs no topo:
• Total de Oportunidades, Valor Total, Taxa de Conversão, Ticket Médio.

Filtros:
• Busca textual: título, projeto, empresa ou responsável.
• Etapa: filtre por uma etapa específica do funil.
• Vendedor: filtre por responsável.

Aba Histórico: exibe todas as oportunidades, incluindo ganhas e perdidas.`
  }
];

export const docAtividadesContent = [
  {
    title: '📋 O que é este módulo?',
    content: `Agenda de tarefas comerciais. Registra todas as ações relacionadas às negociações. O tipo especial "Solicitação de Orçamento" dispara automaticamente uma solicitação no módulo Pré-Vendas.`
  },
  {
    title: '📌 Tipos de atividade',
    content: `• Ligação (CALL) — registro de chamada telefônica.
• Reunião (MEETING) — reunião presencial ou online.
• E-mail (EMAIL) — troca de mensagens com cliente.
• Tarefa (TASK) — tarefa interna genérica.
• Follow-up — acompanhamento de negociação.
• Solicitação de Orçamento — envia automaticamente para o módulo Pré-Vendas.`
  },
  {
    title: '➕ Como criar uma atividade',
    content: `1. Clique em "Nova Atividade".
2. Selecione o Tipo (Ligação, Reunião, etc.).
3. Defina a Prioridade: Baixa / Média / Alta / Urgente.
4. Informe o Assunto (obrigatório).
5. Adicione uma Descrição detalhada.
6. Defina a Data e Hora de Vencimento.
7. Selecione o Responsável.
8. Defina a Origem (área que origina a demanda).
9. Defina o Destino (área que receberá a atividade).
10. Clique em Salvar.`
  },
  {
    title: '📤 Enviando solicitação para o Pré-Vendas',
    content: `1. Crie uma atividade do tipo "Solicitação de Orçamento".
2. Defina o Destino como "Pré-Vendas".
3. Salve a atividade.

A solicitação aparecerá automaticamente na fila do módulo Pré-Vendas → Solicitações, com todos os dados da atividade já preenchidos. O status é sincronizado automaticamente entre os dois módulos.`
  },
  {
    title: '✅ Ações rápidas nas linhas',
    content: `• Iniciar — muda o status de Pendente para Em Andamento.
• Concluir — finaliza a atividade com sucesso.
• Cancelar — cancela sem concluir.

Atividades vencidas e não concluídas ficam destacadas em vermelho automaticamente.`
  },
  {
    title: '📊 KPIs e filtros',
    content: `KPIs: Total, Pendentes, Em Andamento, Concluídas, Atrasadas.

Filtros:
• Busca textual.
• Status: Pendente / Em Andamento / Concluída / Cancelada.
• Tipo: Ligação / Reunião / E-mail / Tarefa / Follow-up / Solicitação.
• Prioridade: Baixa / Média / Alta / Urgente.
• Destino: filtre por área responsável.`
  }
];

export const docLeadsContent = [
  {
    title: '📋 O que é este módulo?',
    content: `Central de Lead Scoring e distribuição automática de leads. Permite visualizar a pontuação de cada empresa, redistribuir leads ociosos e criar oportunidades com um clique.`
  },
  {
    title: '⭐ Faixas de Lead Score',
    content: `• 80–100 → Hot (🔴) — abordar imediatamente, alta probabilidade de conversão.
• 60–79 → Warm (🟡) — abordar em breve, interesse demonstrado.
• 40–59 → Cold (🔵) — monitorar, ainda não demonstrou interesse claro.
• 0–39 → Low Priority (⚪) — nutrir com conteúdo, sem urgência.`
  },
  {
    title: '➕ Criando um lead manual',
    content: `1. Clique em "Novo Lead".
2. Preencha: Empresa, CNPJ, Segmento, Porte, Website.
3. Informe o Endereço: Cidade, Estado.
4. Informe o Contato Principal: Nome, Email, Telefone.
5. Marque "Distribuir automaticamente" para atribuir um vendedor automaticamente ao criar.
6. Clique em Salvar.`
  },
  {
    title: '🔄 Recalcular scores',
    content: `Clique em "Recalcular Todos os Scores" para atualizar as pontuações de todas as empresas com base no histórico recente de oportunidades, atividades e engajamento.

Recomendado fazer semanalmente para manter os scores atualizados.`
  },
  {
    title: '🔀 Redistribuir leads ociosos',
    content: `Na aba "Distribuição":
1. Selecione a estratégia de distribuição.
2. Clique em "Redistribuir Leads Ociosos".

O sistema redistribui automaticamente leads que não tiveram nenhuma interação nos últimos 3 dias, garantindo que nenhum lead fique sem acompanhamento.`
  }
];
