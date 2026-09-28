# 🚀 Atualização Rápida - Dark Mode

## ⚡ Método Mais Rápido (Recomendado)

### 1. Abra o Terminal e execute CADA comando separadamente:

```bash
scp crm-update-darkmode.tar.gz usuario@72.60.195.200:/tmp/
```
**Senha quando pedir:** `Ch@#horst1977#@`

---

### 2. Conecte no servidor:

```bash
ssh usuario@72.60.195.200
```
**Senha:** `Ch@#horst1977#@`

---

### 3. No servidor, execute:

```bash
cd /var/www/crm-comercial && tar -xzf /tmp/crm-update-darkmode.tar.gz && rm /tmp/crm-update-darkmode.tar.gz
```

---

### 4. Reinicie o serviço:

```bash
sudo systemctl restart crm-comercial
```

OU se usar PM2:

```bash
pm2 restart crm-comercial
```

---

### 5. Limpe o cache do navegador:

- Abra: http://72.60.195.200:8081
- Pressione: **Ctrl + Shift + R** (Windows/Linux) ou **Cmd + Shift + R** (Mac)

---

## 🔧 Se der erro de conexão SSH

O servidor pode estar com firewall bloqueando. Tente:

### Opção 1: Verificar se SSH está rodando
```bash
ping 72.60.195.200
```

### Opção 2: Usar porta alternativa (se configurada)
```bash
ssh -p 2222 usuario@72.60.195.200
```

### Opção 3: Deploy via painel de controle
Se você tem acesso ao painel de controle do servidor (cPanel, Plesk, etc):
1. Faça upload do arquivo `crm-update-darkmode.tar.gz` via FTP/SFTP
2. Use o terminal do painel para extrair
3. Reinicie o serviço

---

## 📱 Precisa de ajuda?

Se nenhum método funcionar, me avise qual erro aparece e vou ajustar a solução!
