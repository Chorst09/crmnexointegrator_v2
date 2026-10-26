# HTTPS do CRM — 26/10/2026

Endereço oficial: **https://double.chorstconsult.com.br**.

Certificado Let's Encrypt emitido e instalado no Apache às aproximadamente 09:05, horário de São Paulo. Certificado específico para `double.chorstconsult.com.br`, emissor `Let's Encrypt YR2`, válido até **24/01/2027**, com renovação automática configurada. As chaves privadas permanecem exclusivamente no servidor.

## Configuração instalada

- DNS A do domínio aponta para `200.142.149.2`; nenhum registro AAAA foi encontrado na verificação.
- Certificado em `/etc/letsencrypt/live/double.chorstconsult.com.br/fullchain.pem` e chave em `privkey.pem` no mesmo diretório.
- Virtual host dedicado na porta 443, com TLS 1.2/1.3, certificado correspondente ao nome do domínio e encaminhamento HTTPS informado à API por `X-Forwarded-Proto`.
- API na porta 3026, frontend na 3027 e uploads mantidos atrás do proxy. Cache, compressão e bloqueio de `/BACKUP/` preservados no virtual host HTTPS.
- HTTP redireciona para HTTPS com status **308**, preservando caminho e parâmetros. A rota ACME continua disponível por HTTP para futuras renovações.
- Configuração persistida tanto em `/var/www/site-double/apache.conf`, usada no build Docker, quanto no Apache em execução.
- Alteração aplicada com `httpd -t` e recarga graciosa. Não houve reinício da API nem dos contêineres.

## Renovação

Certbot usa o método [webroot](https://eff-certbot.readthedocs.io/en/stable/using.html#webroot), sem interromper os serviços:

- Webroot: `/etc/letsencrypt/acme-webroot`.
- Apache expõe somente `/.well-known/acme-challenge/` por um Alias para o diretório público de desafios. Esse caminho é visível no contêiner pelo bind mount já existente de `/etc/letsencrypt`; não foi necessário ampliar permissões de diretórios de chaves.
- Agendamento: `certbot.timer`, confirmado habilitado e ativo.
- Após uma renovação desse domínio, `/etc/letsencrypt/renewal-hooks/deploy/50-double-crm-apache` valida e recarrega o Apache.
- Fonte do hook: `scripts/renew-crm-apache-hook.sh`. Instalar com permissão `0755` no caminho acima.

Verificação manual de renovação:

```sh
certbot renew --cert-name double.chorstconsult.com.br --dry-run
```

O hook também foi executado manualmente com `RENEWED_LINEAGE` apontando para o certificado do CRM, com validação de sintaxe aprovada.

A simulação de renovação foi concluída com sucesso pelo Certbot: `all simulated renewals succeeded`. A rota ACME permaneceu acessível após a ativação do redirecionamento HTTPS.

## Validação

- Acesso externo por HTTPS validado sem desabilitar a conferência da cadeia ou do nome do certificado.
- HTTP 308 confirmado com preservação de `/login?tls=check`.
- Doze verificações HTTPS com HTTP 200 e conexão TLS autorizada: página inicial, login, JS e CSS de entrada, arquivos dos módulos Dashboard/Empresas/Oportunidades e cinco endpoints de API, incluindo autenticação e consultas autenticadas.
- Cache imutável dos assets e `private, no-store` da API preservados.
- Site institucional `https://doubletelecom.com.br/` conferido após a alteração: HTTP 200 e validação TLS aprovada.
- Evidência operacional sem tokens em `/var/www/nexoscrm/backups/https-https-20261026-090505/verification.json`.
- O script de manutenção de desempenho foi adaptado à nova topologia: aplica políticas nos dois virtual hosts que servem a aplicação e preserva o virtual host exclusivo de redirecionamento HTTP.

## Backup e recuperação

- Antes de preparar os desafios: `/var/www/nexoscrm/backups/https-challenge-20261026-090444/apache.conf`.
- Antes de ativar HTTPS: `/var/www/nexoscrm/backups/https-https-20261026-090505/apache.conf`.
- Script de configuração: `scripts/configure-crm-https.py`, também instalado em `/var/www/nexoscrm/scripts/`.

Para recuperar uma configuração anterior, restaurar o backup escolhido tanto em `/var/www/site-double/apache.conf` quanto em `site-double-apache:/usr/local/apache2/conf/extra/httpd-vhosts.conf`; executar `docker exec site-double-apache httpd -t` antes de `docker exec site-double-apache httpd -k graceful`. Não excluir o certificado nem a chave para reverter apenas a configuração do proxy.
