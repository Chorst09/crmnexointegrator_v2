# 🚀 Como Fazer Login no CRM NEXOS

## ⚡ Acesso Rápido

### 1️⃣ Abra o Navegador
```
http://localhost:5174
```

### 2️⃣ Clique em "Entrar"
No canto superior direito da landing page

### 3️⃣ Use as Credenciais do MASTER
```
Email: chorstconsult@gmail.com
Senha: <ADMIN_PASSWORD>
```

### 4️⃣ Clique em "Entrar"
Você será redirecionado para a área de administração

---

## ✅ Pronto!

Você está logado como MASTER com acesso total ao sistema.

---

## 🔍 Verificar se Está Funcionando

Execute este comando no terminal:
```bash
./test-login-final.sh
```

Se todos os testes passarem (✅), o login está funcionando.

---

## 📱 Outros Usuários para Testar

| Email | Senha | Tipo |
|-------|-------|------|
| admin@crm.com | admin123 | Administrador |
| joao@crm.com | vendedor123 | Vendedor |
| maria@crm.com | vendedor123 | Vendedor |

---

## ❓ Problemas?

1. Verifique se os servidores estão rodando:
   ```bash
   # Frontend deve estar em http://localhost:5174
   # API deve estar em http://localhost:3002
   ```

2. Execute o teste de diagnóstico:
   ```bash
   ./test-login-final.sh
   ```

3. Consulte a documentação completa:
   - `LOGIN_FUNCIONANDO.md` - Status completo
   - `TESTE_LOGIN_CORRIGIDO.md` - Detalhes técnicos
   - `USUARIOS_TESTE.md` - Lista de usuários

---

**Tudo funcionando! 🎉**
