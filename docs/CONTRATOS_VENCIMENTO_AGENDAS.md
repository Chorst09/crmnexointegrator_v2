# Gestão de contratos e alerta de vencimento

Implementação local de 05/11/2026. Sem publicação, migração no banco em uso ou envio real de e-mails durante os testes.

## Fluxo

- Gestão > Contratos reúne os contratos cadastrados nas empresas e as novas cópias geradas nos uploads de oportunidades. A URL /contratos e os links das empresas foram preservados.
- Anexar um arquivo na seção Contratos de uma oportunidade cria o documento original e um contrato em rascunho, com uma cópia física independente. Uploads da seção Documentos não criam contrato. O vínculo de empresa/oportunidade é obtido no servidor e não pode ser trocado em uma cópia.
- O rascunho não recebe datas presumidas: complete início/vencimento, confira número/título/valor e altere o status para Ativo ou A Renovar. O valor inicial zero é um dado a completar. Um anexo cria um registro; arquivos distintos criam registros distintos.
- Remover o original da oportunidade não apaga a cópia em Contratos. A gravação dos registros ocorre numa transação; falhas removem os arquivos enviados e copiados. sourceDocumentId é único e registra a procedência. Arquivos anteriores à implantação não são importados retroativamente.
- O anexo original impede excluir a oportunidade; depois de removê-lo, a cópia permanece, mesmo se a oportunidade for excluída (vínculo opcional e descrição da origem preservada). Contratos vinculados impedem transferir a oportunidade para outra empresa.

## Alerta em Google e Microsoft

O alerta fica habilitado por padrão, inclusive nos contratos já cadastrados. Somente contratos Ativos ou A Renovar, com vencimento informado e ainda não vencidos, geram aviso. Pode ser desativado na edição. Não há renovação automática do contrato ao enviar o alerta.

O responsável é o gerente de contas atribuído na empresa. Se a empresa não tiver gerente, usa-se o responsável da oportunidade de origem. O próprio responsável precisa conectar sua agenda na seção Minha agenda, disponível tanto em Lead quanto em Contratos. Uma conexão atende os dois módulos, sem credenciais novas. O servidor mantém os limites de tenant e de acesso à oportunidade; não envia informações de oportunidade privada a quem não pode acessá-la.

É criado um compromisso de aviso às 9h de Brasília, 30 dias corridos antes do vencimento, com a identificação do contrato e a data final. O evento dura 30 minutos e possui lembrete no próprio horário. Esse formato evita o limite de 28 dias dos lembretes nativos do Google. Google usa e-mail e popup da agenda conectada. Microsoft usa notificação de agenda e e-mail pela conta conectada para o endereço do usuário no CRM.

Se o contrato já estiver dentro dos 30 dias quando for ativado ou quando a agenda for conectada, o compromisso é marcado para cerca de dois minutos após a sincronização; o e-mail Microsoft é recuperado na execução, até o vencimento. Não é possível enviar um aviso retroativo exatamente no trigésimo dia. O aviso inclui a data real de vencimento.

Alterar o vencimento atualiza o compromisso existente. Cancelar/renovar/expirar, desativar o alerta ou trocar o responsável remove o aviso anterior; se aplicável, o novo responsável recebe outro. O processo verifica mudanças a cada minuto. Alterações externas na agenda não voltam para o CRM. Ao conectar as duas agendas, pode haver um aviso por provedor. Desconectar a agenda remove também os compromissos de leads.

O trabalhador de agendas e sua tolerância a falhas são os mesmos descritos em LEAD_PROXIMA_ACAO_AGENDAS.md: dependência do servidor ativo, tentativas de reenvio e possível duplicação de e-mail Microsoft numa interrupção entre aceite pelo provedor e confirmação no banco.

## Publicação

1. Aplicar as migrações anteriores de Lead/CompanyDocument e a migração 20261105150000_contract_expiration_and_opportunity_copy. Ela permite datas vazias em rascunhos, adiciona origem da oportunidade e habilita o alerta. Preserva valores e datas existentes.
2. Gerar o Prisma Client do backend utilizado e reiniciar o servidor. As duas estruturas de backend incluem a implementação; o legado inclui a atualização no ensure-schema.
3. Configurar as credenciais OAuth e CALENDAR_TOKEN_KEY conforme LEAD_PROXIMA_ACAO_AGENDAS.md. Os escopos existentes já atendem contratos; não há novos escopos.
4. Preservar e incluir no backup os diretórios private-uploads/companies e private-uploads/contracts. Contratos antigos ainda são baixados pelos caminhos registrados no banco. No backend legado, o acesso público a /uploads/contracts passa a ser bloqueado; downloads exigem autenticação e autorização.
5. Validar com contas reais um contrato com vencimento futuro e outro já dentro dos 30 dias, edição do vencimento, troca de gerente e cancelamento.

## Verificação

Testes cobrem cálculo dos 30 dias, limites de mês/ano bissexto, rascunhos, datas inválidas, ativação, autorização/tenant, cópia independente, rollback, preservação da origem, criação/atualização/cancelamento em ambos os provedores e recuperação de aviso Microsoft. Provedores são simulados; a integração real depende da configuração e publicação.

Referências oficiais:
- [Google Calendar: eventos e limite dos lembretes](https://developers.google.com/workspace/calendar/api/v3/reference/events)
- [Microsoft Graph: criar evento](https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0)
- [Microsoft Graph: enviar e-mail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)
