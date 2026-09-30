# 🛡️ Garantias de Segurança - Deploy do CRM

## ✅ O Finanças Zen NÃO será afetado

### Por que é seguro?

#### 1. **Diretórios Completamente Separados**
```
/var/www/
├── financaszen/          ← Finanças Zen (não será tocado)
│   └── ...
└── crm-comercial/        ← CRM (novo diretório)
    ├── apps/
    ├── logs/
    └── ...
```

#### 2. **Portas Diferentes**
| Aplicação | Porta | Status |
|-----------|-------|--------|
| Finanças Zen | 80 (HTTP) | ✅ Mantém funcionando |
| CRM Comercial | 8081 | 🆕 Nova instalação |

#### 3. **Processos PM2 Independentes**
```bash
pm2 list
# Resultado esperado:
# ┌─────┬──────────────┬─────────┬─────────┬──────────┐
# │ id  │ name         │ status  │ port    │ ...      │
# ├─────┼──────────────┼─────────┼─────────┼──────────┤
# │ 0   │ financaszen  │ online  │ 80      │ ...      │  ← Não afetado
# │ 1   │ crm-api      │ online  │ 8081    │ ...      │  ← Novo
# └─────┴──────────────┴─────────┴─────────┴──────────┘
```

#### 4. **Bancos de Dados Separados**
```
PostgreSQL:
├── financaszen_db        ← Banco do Finanças Zen (não tocado)
└── crm_comercial         ← Banco do CRM (novo)
```

#### 5. **Configurações Nginx Independentes**
```
/etc/nginx/sites-available/
├── financaszen           ← Configuração existente (não modificada)
└── crm-comercial         ← Nova configuração (porta 8081)
```

## 🔒 Verificações de Segurança Implementadas

### No Script `server-setup.sh`:
```bash
# Verifica se não está no diretório do Finanças Zen
if [[ "$CURRENT_DIR" == *"financaszen"* ]]; then
    echo "❌ ERRO: Você está no diretório do Finanças Zen!"
    exit 1
fi
```

### No Script `deploy-to-server.sh`:
```bash
# Confirmação antes de prosseguir
read -p "Deseja continuar? (s/N): "
```

### Script de Verificação Prévia:
```bash
# Execute ANTES do deploy
./verify-server-safety.sh usuario@72.60.195.200
```

## 📋 Checklist de Segurança

Antes de fazer o deploy, execute:

```bash
# 1. Verificar segurança
./verify-server-safety.sh usuario@72.60.195.200

# 2. Confirmar que Finanças Zen está funcionando
curl http://72.60.195.200

# 3. Confirmar que porta 8081 está livre
curl http://72.60.195.200:8081
# Deve dar timeout ou erro (porta livre)
```

## 🚀 Processo de Deploy Seguro

### Passo 1: Verificação
```bash
./verify-server-safety.sh usuario@72.60.195.200
```

### Passo 2: Deploy
```bash
./deploy-to-server.sh usuario@72.60.195.200
```

### Passo 3: Configuração no Servidor
```bash
ssh usuario@72.60.195.200
cd /var/www/crm-comercial
./server-setup.sh
```

### Passo 4: Verificação Final
```bash
# Verificar Finanças Zen ainda funciona
curl http://72.60.195.200
# Deve retornar HTML do Finanças Zen

# Verificar CRM funcionando
curl http://72.60.195.200:8081/api/health
# Deve retornar: {"status":"ok","service":"crm-api",...}

# Verificar processos PM2
ssh usuario@72.60.195.200 "pm2 list"
# Deve mostrar ambos os processos rodando
```

## ⚠️ O que NÃO será afetado

- ✅ Finanças Zen continuará rodando na porta 80
- ✅ Banco de dados do Finanças Zen não será tocado
- ✅ Arquivos do Finanças Zen não serão modificados
- ✅ Configurações do Nginx do Finanças Zen permanecem
- ✅ Processo PM2 do Finanças Zen continua ativo
- ✅ Usuários do Finanças Zen não serão afetados

## 🆘 Rollback (se necessário)

Se algo der errado com o CRM:

```bash
# Parar apenas o CRM
pm2 stop crm-api
pm2 delete crm-api

# Finanças Zen continua funcionando normalmente!
```

## 📞 Suporte

Se tiver dúvidas ou quiser verificar algo específico antes do deploy, execute:

```bash
# Ver o que está rodando no servidor
ssh usuario@72.60.195.200 "pm2 list && netstat -tulpn | grep LISTEN"
```

## ✅ Conclusão

**É 100% SEGURO fazer o deploy do CRM.**

O Finanças Zen e o CRM são aplicações completamente independentes que:
- Rodam em portas diferentes
- Usam diretórios diferentes
- Têm processos diferentes
- Usam bancos de dados diferentes

Não há nenhuma possibilidade de um afetar o outro.
