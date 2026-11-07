# Próxima ação do lead e agendas

Implementação local em 05/11/2026. Não publicada e sem envio real de e-mails nos testes.

## Uso

1. No cadastro do lead, preencha a próxima ação, data/horário, antecedência do lembrete e gerente de contas responsável.
2. O próprio responsável acessa Lead > Minha agenda e conecta Google Calendar ou Microsoft Outlook. A autorização é individual; conectar a conta do administrador não conecta a conta de outros gerentes.
3. Para alterar uma ação já cadastrada, clique no lead e use Salvar próxima ação. Limpe descrição e data para remover a ação.
4. O processo do servidor verifica mudanças a cada minuto. Compromissos têm duração de 30 minutos. Uma ação por lead. O status da conexão mostra a última execução e erros pendentes.

Fluxo unidirecional: CRM → agenda. Mudanças feitas diretamente na agenda não voltam para o CRM. A conversão em oportunidade, exclusão do lead, remoção da ação ou mudança do responsável remove o compromisso antigo na próxima execução. Ações futuras do novo responsável são criadas na agenda que ele conectou. Não se recriam ações antigas sem sincronização anterior.

Google configura lembretes nativos por e-mail e popup na conta Google conectada. Microsoft configura a notificação da agenda e envia e-mail pela conta Microsoft conectada para o endereço do responsável cadastrado no CRM, na antecedência escolhida. O destinatário Microsoft deve estar correto no cadastro de usuário. Conectar as duas contas pode gerar dois alertas. A sincronização e o e-mail Microsoft dependem do processo do servidor ativo; tolerância normal de um minuto. Se o servidor ficar indisponível, alertas Microsoft são recuperados até uma hora após o compromisso. A entrega final depende dos provedores.

## Configuração para ativação

Aplicar as migrações de origem do lead e próxima ação, gerar o Prisma Client do backend utilizado e reiniciar o servidor. O backend legado também inclui as estruturas no ensure-schema. Não executar migrações destrutivas ou db push com perda de dados.

Variáveis (somente no servidor; nunca VITE_):

```dotenv
CALENDAR_TOKEN_KEY=<chave hexadecimal de 64 caracteres gerada com openssl rand -hex 32>
LEAD_GOOGLE_CLIENT_ID=<OAuth client ID>
LEAD_GOOGLE_CLIENT_SECRET=<OAuth client secret>
LEAD_GOOGLE_REDIRECT_URI=https://SEU-DOMINIO/api/lead-calendar/google/callback
LEAD_MICROSOFT_CLIENT_ID=<application client ID>
LEAD_MICROSOFT_CLIENT_SECRET=<client secret VALUE>
LEAD_MICROSOFT_REDIRECT_URI=https://SEU-DOMINIO/api/lead-calendar/microsoft/callback
```

Use URLs de retorno exatas. A tela web e a API devem usar o mesmo site para o cookie de retorno OAuth (ex.: crm.exemplo.com e api.exemplo.com); ambientes em domínios distintos precisam de um proxy de API no domínio do CRM. Desenvolvimento em localhost aceita HTTP. Produção usa HTTPS. Faça backup seguro de CALENDAR_TOKEN_KEY: trocar ou perder a chave exige reconectar contas. Não coloque tokens em logs.

Google Cloud: habilitar Calendar API, configurar tela de consentimento e criar cliente OAuth de aplicação Web com o callback acima. Escopo: https://www.googleapis.com/auth/calendar.events. Liberar usuários de teste ou publicar o consentimento conforme o ambiente. Em modo de teste do Google, o acesso offline pode expirar e exigir nova conexão.

Microsoft Entra: registrar aplicação Web, configurar o callback e suportar os tipos de conta desejados (trabalho/escola e contas pessoais para o endpoint common). Permissões delegadas: Calendars.ReadWrite, Mail.Send e offline_access. O administrador do tenant pode precisar consentir conforme a política da organização.

Rotas /api/lead-calendar/status, /:provider/connect e /:provider/disconnect exigem autenticação. Apenas o callback é público e exige state de uso único, prazo de dez minutos, PKCE e cookie HTTP-only do navegador que iniciou a conexão. Tokens e verificadores ficam criptografados com AES-256-GCM. O worker verifica o tenant do responsável e ignora tenants suspensos. Um advisory lock do PostgreSQL coordena os processos.

A desconexão tenta excluir os eventos criados pelo CRM antes de remover credenciais. Se o provedor estiver inacessível ou a autorização tiver sido revogada, a tela permite, após confirmação explícita, remover apenas a conexão local; nesse caso os eventos devem ser removidos manualmente e a permissão pode ser revogada no provedor. Conectar outra conta exige desconectar a anterior.

## Validação e limites

Testes com provedores simulados cobrem state, PKCE, criptografia, isolamento de tenant, criação, edição, cancelamento, retry e lembrete Microsoft. Validar os dois fluxos com contas reais após configurar as credenciais e publicar. Nenhuma conta real foi conectada nesta implementação.

E-mails Microsoft têm processamento pelo menos uma vez: se houver interrupção entre o aceite do provedor e a confirmação no banco, uma tentativa seguinte pode repetir o alerta. O lock reduz concorrência; não há garantia de entrega exatamente uma vez. O worker usa transação de até 55 segundos; grandes volumes de contas/eventos exigirão divisão em lotes e fila dedicada. O CRM não interpreta respostas a convites nem alterações externas.

Documentação oficial usada:
- [Google: criação de eventos e lembretes](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
- [Microsoft Graph: criar evento](https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0)
- [Microsoft: OAuth authorization code e PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)

- [Microsoft Graph: enviar e-mail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0)
