# Integração n8n no CRM NEXOS

Esta pasta contém a infraestrutura pronta para rodar o **n8n** na VPS usando a imagem oficial Docker (`n8nio/n8n:latest`) e conectá-lo diretamente aos módulos **Integrações** e **Automações → Workflows** do CRM NEXOS.

> **Nota sobre `n8n-master.zip`:** arquivos `.zip` estão ignorados no `.gitignore` para manter o repositório leve. Em produção, utilize sempre a imagem oficial `n8nio/n8n:latest` via `docker-compose.n8n.yml`.

## Passo 1 — Subir o n8n na VPS
```bash
cd /caminho/do/projeto/automacoes
docker compose -f docker-compose.n8n.yml up -d
```

## Passo 2 — Configurar Nginx + SSL (HTTPS)
1. Aponte o DNS `n8n.chorstconsult.com.br` para o IP da VPS.
2. Copie `nginx-n8n.conf` para `/etc/nginx/sites-available/n8n.chorstconsult.com.br`, ative em `sites-enabled` e gere o certificado:
```bash
sudo certbot --nginx -d n8n.chorstconsult.com.br
sudo systemctl reload nginx
```

## Passo 3 — Conectar no CRM NEXOS
1. Acesse `https://n8n.chorstconsult.com.br`, crie sua conta admin e gere uma **API Key** em **Settings → n8n API**.
2. No CRM NEXOS, abra **Integrações → Plataformas CRM & Automação → n8n**.
3. Preencha:
   - **URL da Instância:** `https://n8n.chorstconsult.com.br`
   - **API Key:** cole a chave gerada no n8n
   - **Webhook Secret (opcional):** token para autenticar retornos do n8n para `/api/n8n/webhook-inbound`
4. Clique em **Testar Conexão** e **Salvar**.
5. Abra **Automações → Workflows → Motor n8n** para listar, ativar/pausar, executar webhooks e acompanhar execuções em tempo real.
