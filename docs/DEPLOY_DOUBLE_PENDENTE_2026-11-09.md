# Deploy Double pendente — segunda-feira, 09/11/2026

Registrado em 07/11/2026 por solicitação do usuário. Execução adiada para segunda-feira, 09/11/2026, no fuso America/Sao_Paulo. Status: pendente; este documento registra a tarefa, sem execução automática agendada.

## Objetivo

Publicar no Double as mesmas alterações de código já disponibilizadas no Nexos, incluindo os gráficos 3D dos dashboards. Preservar os dados, uploads, credenciais e configurações próprios de cada instalação.

- Destino: https://double.chorstconsult.com.br.
- Servidor: `200.142.149.2`, usuário `root`, porta SSH `22`.
- Referência publicada no Nexos: commit `1b2ff769c1a1eb15f480d3d67a133785e95828f1`.
- Repositório: https://github.com/Chorst09/nexoscrm, branch `main`.
- Relatório da publicação de referência: [DEPLOY_NEXOS_2026-11-07.md](DEPLOY_NEXOS_2026-11-07.md).
- Referências anteriores do Double: aplicação em `/var/www/nexoscrm`, frontend em `frontend/dist` e processo PM2 `nexoscrm-api`. Confirmar os caminhos e o virtual host ativos antes de publicar.

## Bloqueio atual

Em 07/11/2026, a conexão SSH com `200.142.149.2:22` foi recusada antes da autenticação. É necessário liberar/ativar o serviço SSH ou obter a porta correta antes da publicação. Não houve alteração na produção do Double nessas tentativas.

A conferência pública confirmou que ambos os sites e suas APIs estavam respondendo HTTP 200, com banco conectado. O Nexos corresponde ao build novo; o Double ainda serve os arquivos da versão anterior.

## Procedimento para retomar

1. Restabelecer o SSH e confirmar a instalação que atende `double.chorstconsult.com.br`, sem atualizar outros serviços do servidor.
2. Obter o código da revisão de referência no Git e gerar os pacotes novamente se necessário. Não depender de arquivos temporários em `/tmp` para retomar na segunda-feira.
3. Registrar a versão ativa e as contagens e hashes dos registros principais do banco do Double.
4. Gerar backup completo do PostgreSQL e validar com `pg_restore --list`. Preservar também configurações, uploads, anexos, fontes substituídas e dependências anteriores, em diretório restrito a root.
5. Preparar fontes e dependências em staging, verificar SHA-256 e conferir a compatibilidade do Prisma com o banco do Double. Não executar seed, reset, restauração de banco ou migrações gerais automaticamente.
6. Testar a nova API isoladamente, com consultas somente de leitura e sem ativar integrações ou criar registros de teste em produção.
7. Ativar o backend validado e trocar o frontend por uma release versionada, preservando a versão anterior e os assets usados por abas abertas. Reiniciar somente o processo do Double.
8. Conferir os arquivos públicos do Double contra o pacote de referência e validar os dashboards B2B e Geral no navegador, incluindo filtros e layout mobile.
9. Comparar os dados e arquivos persistentes com o estado anterior, registrar o resultado e manter a reversão disponível. Atualizar este documento com o relatório da publicação e enviar o registro ao GitHub.

## Preservação dos ambientes

Igualar o código dos dois sistemas não significa copiar o banco do Nexos para o Double. Não transferir entre os servidores arquivos `.env`, credenciais, uploads, anexos ou dumps como parte da sincronização da aplicação. Cada ambiente deve continuar usando seus próprios dados e configurações.

Se for necessário reverter, restaurar somente o código, as dependências e o apontamento da release anterior. Não restaurar o dump sobre o banco ativo sem avaliar e preservar os dados criados após a publicação.
