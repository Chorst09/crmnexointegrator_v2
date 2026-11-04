# Cancelamento e reprovação de cotações de pré-vendas

Na tela Solicitações, os cards e a lista oferecem **Cancelar** e **Reprovar** em todas as etapas em aberto, inclusive após assumir a cotação. Ambas as ações abrem um formulário com motivo obrigatório de até 4.000 caracteres. Arrastar o card para Reprovado/Canceladas e alterar o status na aba Ações seguem a mesma regra.

O encerramento salva o status, o motivo, o usuário e a data; preserva cotações, itens e observações anteriores; e registra a decisão no histórico de aprovações. Demandas encerradas deixam os indicadores de trabalho ativo e continuam disponíveis para consulta nas colunas de encerramento e na lista.

O responsável comercial recebe o motivo no sino de notificações e na atividade de origem, que é encerrada diretamente na coluna **Canceladas** ou **Reprovadas**. O destinatário é o responsável da atividade vinculada; quando não há atividade, o sistema cria uma para o solicitante. A área comercial de origem (B2B/B2G) é preservada. O retorno mostra o motivo e não oferece geração de proposta ou preços para uma cotação encerrada. O retorno encerrado não oferece Iniciar ou Concluir e não entra nos indicadores de pendências ou atrasos. Reprovações usam a coluna própria Reprovadas, distinta de Canceladas, preservando a decisão e o motivo nos metadados existentes, sem alteração do enum do banco. Retornos antigos ainda gravados como pendentes também são classificados corretamente na interface.

## Persistência e permissões

As duas implementações da API (`apps/api` e `backend`) compartilham o mesmo comportamento. Não há alteração de schema nem migração: a decisão usa `calculoDetalhes.encerramento`, `calculoDetalhes.historicoEncerramentos`, `PreSalesApproval`, a descrição estruturada da atividade e `Notification`.

O status, o histórico, a atividade e a notificação são salvos na mesma transação. Falhas revertem a operação completa. Atualizações condicionais impedem que cliques concorrentes dupliquem o retorno. Repetir o mesmo encerramento preserva o motivo original e não envia nova notificação. Uma decisão diferente sobre uma cotação já encerrada retorna conflito.

Somente administradores ou usuários com acesso a pré-vendas podem encerrar, respeitando a empresa da solicitação e da atividade. As notificações são sempre pessoais, inclusive para administradores. Rotas antigas de rejeição/edição também passam pela validação do motivo. Uma cotação cancelada/reprovada não pode ser reaberta por edição, cálculo, aprovação ou devolução.

## APIs

- `POST /api/pre-vendas/:id/encerrar`: `{ status: "CANCELADA" | "REPROVADO", motivo: string }`.
- `POST /api/activities-simple/:id/encerrar-prevendas`: mesmo corpo para demandas recebidas por atividade.
- `GET /api/pre-vendas/retornos-comerciais`: últimas 20 notificações pessoais e total não lido.
- `POST /api/pre-vendas/retornos-comerciais/:notificationId/ler`: marca somente um retorno do usuário autenticado como lido.

O sino atualiza os retornos a cada 30 segundos, ao receber foco e ao abrir o painel. O aviso é interno ao CRM; não dispara e-mail ou WhatsApp.

## Validação

- `node --test scripts/tests/commercial-activity-status.test.mjs scripts/tests/pre-sales-stage.test.cjs scripts/tests/pre-sales-closure.test.cjs scripts/tests/pre-sales-activity-visibility.test.cjs`: 70 testes passaram.
- `npm run build --workspace=apps/web`: compilação e verificações obrigatórias do projeto.
- Conferência do formulário com confirmação desabilitada sem motivo e dos botões e painel de notificações em produção, sem encerrar cotações reais. Os testes incluem decisões legadas, falhas, permissões e devolução ao comercial.

A implantação preserva as correções existentes da API, mantém backup para reversão e troca o frontend apenas após verificar a integridade dos arquivos. Os manifestos de publicação ficam em `/var/www/nexoscrm/backups/pre-sales-closure-*/deployment.json`.
