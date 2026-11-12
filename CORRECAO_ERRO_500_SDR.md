# Correção do Erro 500 - Role SDR

## 🐛 Problema Identificado

Após aplicar a migration do role SDR no banco de dados, a API começou a retornar erro 500:

```
Invalid `prisma.user.findMany()` invocation:
Value 'SDR' not found in enum 'Role'
```

**Causa:** O Prisma Client no servidor estava desatualizado. O banco tinha o valor 'SDR' no enum, mas o client gerado ainda usava o schema antigo.

---

## ✅ Solução Aplicada

### 1. Atualizar schema.prisma no servidor
```bash
scp backend/prisma/schema.prisma root@200.142.149.2:/var/www/nexoscrm/backend/prisma/
```

### 2. Limpar cache do Prisma Client
```bash
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma/client
```

### 3. Regenerar Prisma Client
```bash
cd /var/www/nexoscrm/backend
npx prisma generate
```

### 4. Reiniciar API
```bash
pm2 restart nexoscrm-api
```

---

## ✅ Resultado

- ✅ Prisma Client regenerado com enum Role incluindo SDR
- ✅ API reiniciada com sucesso
- ✅ Erro 500 resolvido
- ✅ Endpoint /api/users funcionando
- ✅ Josiele pode fazer login e ver todas as oportunidades

---

**Data:** 2026-11-11  
**Servidor:** 200.142.149.2  
**Status:** ✅ RESOLVIDO
