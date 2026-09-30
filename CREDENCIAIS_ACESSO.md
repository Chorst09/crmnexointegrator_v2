# 🔐 Credenciais de Acesso - CRM Comercial

## 🌐 URLs de Acesso

### Produção
- **URL:** http://72.60.195.200:8081
- **Domínio:** http://crm.chorstconsult.com.br

### Local (Desenvolvimento)
- **URL:** http://localhost:3001

---

## 👤 Credenciais de Login

### Administrador
- **Email:** `admin@crm.com`
- **Senha:** `admin123`
- **Perfil:** ADMIN (acesso total)

### Vendedores (Teste)
1. **João Silva**
   - Email: `joao@crm.com`
   - Senha: `senha123`
   - Perfil: SELLER

2. **Maria Santos**
   - Email: `maria@crm.com`
   - Senha: `senha123`
   - Perfil: SELLER

3. **Carlos Oliveira**
   - Email: `carlos@crm.com`
   - Senha: `senha123`
   - Perfil: SELLER

4. **Ana Costa**
   - Email: `ana@crm.com`
   - Senha: `senha123`
   - Perfil: SELLER

---

## 🔧 Configurações Técnicas

### API
- **Porta Produção:** 3000
- **Porta Local:** 3002
- **Base URL:** `/api`

### Banco de Dados
- **Tipo:** PostgreSQL
- **Porta:** 5432
- **Database:** `crm_com`

---

## 💡 Dicas

1. **Primeiro Acesso:** Use as credenciais do administrador
2. **Esqueceu a senha?** Entre em contato com o suporte
3. **Modo Escuro:** Ative/desative no ícone no canto superior direito
4. **Cache:** Se não ver as alterações, pressione `Ctrl+Shift+R`

---

## 🆘 Problemas Comuns

### Login não funciona
- ✅ Verifique se está usando `admin@crm.com` (não `crm@admin.com`)
- ✅ Senha correta: `admin123`
- ✅ Limpe o cache do navegador

### Página não carrega
- ✅ Verifique se a API está rodando: `pm2 status`
- ✅ Reinicie: `pm2 restart crm-api`

### Textos não aparecem no dark mode
- ✅ Faça hard refresh: `Ctrl+Shift+R`
- ✅ Limpe o cache do navegador
