# CORRIGIR CRIAÇÃO DE TAREFAS EM PRODUÇÃO
## Solução do erro 500 no Kanban

---

## 🎯 O QUE FAZER

Você precisa **reconectar no servidor de produção e executar comandos** para reconstruir o Docker com o schema correto.

---

## 📋 PASSO A PASSO

### OPÇÃO 1: Script Automático (MAIS FÁCIL)

**1. No seu computador, abra o Terminal/PowerShell e execute:**

```bash
ssh root@209.50.241.25 'bash -s' < fix-production-now.sh
```

**2. Quando pedir a senha, digite:**
```
[Sua senha root do servidor]
```

**3. Aguarde até aparecer a mensagem de conclusão (leva 3-5 minutos)**

---

### OPÇÃO 2: Comandos Manuais (Se o script não funcionar)

**1. Conecte no servidor:**
```bash
ssh root@209.50.241.25
```

**2. Digite sua senha quando solicitado**

**3. Copie e cole CADA COMANDO ABAIXO, um por vez:**

```bash
cd /opt/nexoscrm/apps/api
```

Aguarde até terminar, depois:

```bash
docker compose down
```

Aguarde, depois:

```bash
rm -rf .prisma
rm -rf node_modules/.prisma
rm -rf dist
```

Depois:

```bash
docker compose build backend --no-cache
```

⏳ **ESTE COMANDO LEVA 2-3 MINUTOS** - deixe executar completamente

Depois:

```bash
docker compose up -d backend
```

Aguarde 5 segundos, depois:

```bash
docker compose logs backend --tail 30
```

**4. Verifique os logs:**
- Se aparecer ❌ **TODO** ou **erro** = o problema ainda existe
- Se aparecer ✅ **sem erros Prisma** = funcionou!

---

## ✅ COMO TESTAR SE FUNCIONOU

**1. Abra o navegador e vá para:**
```
https://nexos.chorstconsult.com.br/projetos/[id-qualquer-projeto]
```

**2. Clique na aba "Quadro"**

**3. Clique em **"+ Adicionar Tarefa"** em qualquer coluna (por exemplo, em PENDENTE)**

**4. Preencha:**
- Título: "Teste de Tarefa"
- Descrição: "Teste"
- Clique em "Salvar"

**5. Verifique:**
- ✅ Se a tarefa apareceu na coluna = **PROBLEMA RESOLVIDO! 🎉**
- ❌ Se receber erro 500 = temos que investigar mais

---

## 🆘 SE AINDA DER ERRO

Se após seguir os passos acima ainda houver erro 500, execute:

```bash
docker compose logs backend | grep -i error
```

E compartilhe comigo a mensagem de erro que aparecer.

---

## 📞 RESUMO RÁPIDO

| Ação | Comando |
|------|---------|
| Conectar ao servidor | `ssh root@209.50.241.25` |
| Ir para pasta do app | `cd /opt/nexoscrm/apps/api` |
| Parar containers | `docker compose down` |
| Limpar cache Prisma | `rm -rf .prisma node_modules/.prisma dist` |
| Reconstruir Docker | `docker compose build backend --no-cache` |
| Iniciar novamente | `docker compose up -d backend` |
| Ver logs | `docker compose logs backend --tail 30` |

---

## ❓ DÚVIDAS

**P: Quanto tempo leva?**
R: Uns 5-10 minutos no total (3 min de build + reinício)

**P: Vai derrubar o site?**
R: Sim, por 2-3 minutos enquanto reconstrói, depois volta ao normal

**P: Preciso fazer git push?**
R: Não! O código já está no servidor. Apenas reconstrói o Docker.

**P: E se a senha estiver errada?**
R: Pede para digitar de novo. Tente 3 vezes antes de contatar suporte.
