# ✅ Preparação Completa para Migração no GitHub

## 📌 Status: PRONTO PARA MIGRAÇÃO

Todos os arquivos necessários foram preparados e estão prontos no GitHub para a migração para o novo servidor KVM.

## 📦 Arquivos Criados

### Scripts de Migração (4 scripts)
```
scripts/
├── preparar-servidor-definitivo.sh    ✅ Prepara novo servidor
├── backup-completo.sh                 ✅ Faz backup completo
├── restaurar-backup.sh                ✅ Restaura backup
├── verificar-migracao.sh              ✅ Verifica migração
└── testar-scripts.sh                  ✅ Testa os scripts
```

### Documentação (4 documentos)
```
├── GUIA_MIGRACAO_GITHUB.md            ✅ Guia completo (passo a passo)
├── CHECKLIST_MIGRACAO_RAPIDO.md       ✅ Checklist rápido
├── MIGRACAO_README.md                 ✅ README da migração
└── scripts/README_SCRIPTS_MIGRACAO.md ✅ Documentação dos scripts
```

### Configuração (2 arquivos)
```
├── ecosystem.config.js                ✅ Configuração PM2
└── .github/workflows/deploy-migration.yml ✅ CI/CD GitHub Actions
```

## 🚀 Como Usar

### 1. Clonar Repositório no Novo Servidor

```bash
# SSH no novo servidor
ssh root@SEU_IP_NOVO

# Clonar repositório
git clone https://github.com/seu-usuario/crm-comercial.git
cd crm-comercial

# Dar permissão aos scripts
chmod +x scripts/*.sh
```

### 2. Seguir o Guia de Migração

```bash
# Opção A: Guia Completo (recomendado para primeira vez)
cat GUIA_MIGRACAO_GITHUB.md

# Opção B: Checklist Rápido (para referência rápida)
cat CHECKLIST_MIGRACAO_RAPIDO.md

# Opção C: README da Migração
cat MIGRACAO_README.md
```

### 3. Executar Scripts na Ordem

```bash
# Fase 1: Preparar novo servidor
./scripts/preparar-servidor-definitivo.sh

# Fase 2: Fazer backup (no servidor provisório)
./scripts/backup-completo.sh

# Fase 3: Restaurar backup (no novo servidor)
./scripts/restaurar-backup.sh ~/crm-backup-YYYYMMDD-HHMMSS

# Fase 4: Verificar migração
./scripts/verificar-migracao.sh
```

## 📋 Checklist de Preparação

### Arquivos de Script
- [x] `preparar-servidor-definitivo.sh` - Criado e testado
- [x] `backup-completo.sh` - Criado e testado
- [x] `restaurar-backup.sh` - Criado e testado
- [x] `verificar-migracao.sh` - Criado e testado
- [x] `testar-scripts.sh` - Criado e testado
- [x] Todos os scripts com permissão de execução

### Documentação
- [x] `GUIA_MIGRACAO_GITHUB.md` - Guia completo
- [x] `CHECKLIST_MIGRACAO_RAPIDO.md` - Checklist rápido
- [x] `MIGRACAO_README.md` - README da migração
- [x] `scripts/README_SCRIPTS_MIGRACAO.md` - Documentação dos scripts

### Configuração
- [x] `ecosystem.config.js` - Configuração PM2
- [x] `.github/workflows/deploy-migration.yml` - CI/CD

### Validação
- [x] Todos os scripts com sintaxe válida
- [x] Todos os arquivos de documentação criados
- [x] Configuração do PM2 validada
- [x] GitHub Actions configurado

## 🔍 Validação dos Scripts

Para validar se todos os scripts estão corretos:

```bash
cd scripts
./testar-scripts.sh

# Saída esperada:
# ✓ Todos os testes passaram!
# Os scripts estão prontos para uso.
```

## 📊 Resumo da Migração

### Tempo Total Estimado
- **Preparação**: 5-10 minutos
- **Backup**: 5-15 minutos
- **Transferência**: 5-30 minutos
- **Restauração**: 5-10 minutos
- **Configuração**: 10-15 minutos
- **Verificação**: 5-10 minutos
- **TOTAL**: 35-90 minutos

### O que será migrado
- ✅ Banco de dados PostgreSQL (com todos os dados)
- ✅ Aplicação Node.js (API + Frontend)
- ✅ Arquivos de upload (1000+)
- ✅ Configurações (.env)
- ✅ Processos PM2

### Verificações Automáticas
- ✅ Integridade de arquivos (MD5)
- ✅ Conexão com banco de dados
- ✅ Contagem de registros
- ✅ Status de processos
- ✅ Portas abertas
- ✅ Firewall configurado
- ✅ Recursos do sistema

## 🔐 Segurança

Após a migração, execute:

```bash
# 1. Alterar senhas padrão
sudo -u postgres psql -c "ALTER USER crm_user WITH PASSWORD 'senha_forte';"

# 2. Configurar SSL/HTTPS
sudo apt-get install certbot
sudo certbot certonly --standalone -d seu-dominio.com

# 3. Configurar backups automáticos
crontab -e
# Adicionar: 0 2 * * * /var/www/crm-comercial/scripts/backup-completo.sh

# 4. Monitorar logs
pm2 logs crm-api
```

## 📞 Suporte

Se encontrar problemas durante a migração:

1. **Verifique os logs**
   ```bash
   pm2 logs crm-api --lines 100
   ```

2. **Execute a verificação**
   ```bash
   ./scripts/verificar-migracao.sh
   ```

3. **Consulte a documentação**
   - `GUIA_MIGRACAO_GITHUB.md` - Guia completo
   - `CHECKLIST_MIGRACAO_RAPIDO.md` - Checklist rápido
   - `scripts/README_SCRIPTS_MIGRACAO.md` - Documentação dos scripts

4. **Troubleshooting comum**
   - PostgreSQL não conecta: `psql -U crm_user -h localhost -d crm_comercial -c "SELECT 1"`
   - API não responde: `pm2 logs crm-api`
   - Porta em uso: `netstat -tulpn | grep 8081`

## 🎯 Próximos Passos

### Antes da Migração
1. [ ] Revisar `GUIA_MIGRACAO_GITHUB.md`
2. [ ] Preparar novo servidor KVM
3. [ ] Testar acesso SSH a ambos os servidores
4. [ ] Verificar espaço em disco (50GB+)

### Durante a Migração
1. [ ] Executar `preparar-servidor-definitivo.sh`
2. [ ] Executar `backup-completo.sh`
3. [ ] Transferir backup
4. [ ] Executar `restaurar-backup.sh`
5. [ ] Atualizar .env
6. [ ] Executar `verificar-migracao.sh`

### Após a Migração
1. [ ] Testar login
2. [ ] Verificar dados
3. [ ] Configurar SSL/HTTPS
4. [ ] Configurar backups automáticos
5. [ ] Manter servidor provisório por 7-14 dias

## 📚 Documentação Disponível

| Documento | Propósito | Público |
|-----------|-----------|---------|
| `GUIA_MIGRACAO_GITHUB.md` | Guia completo passo a passo | ✅ |
| `CHECKLIST_MIGRACAO_RAPIDO.md` | Checklist rápido para referência | ✅ |
| `MIGRACAO_README.md` | README da migração | ✅ |
| `scripts/README_SCRIPTS_MIGRACAO.md` | Documentação dos scripts | ✅ |
| `PREPARACAO_GITHUB_COMPLETA.md` | Este arquivo | ✅ |

## ✅ Validação Final

Todos os arquivos foram criados e validados:

```bash
# Validar scripts
cd scripts && ./testar-scripts.sh

# Resultado esperado:
# ✓ Todos os testes passaram!
# Os scripts estão prontos para uso.
```

## 🚀 Pronto para Migração!

O repositório está completamente preparado para a migração. Todos os scripts, documentação e configurações estão no GitHub e prontos para uso.

### Para começar:
1. Clone o repositório no novo servidor
2. Siga o `GUIA_MIGRACAO_GITHUB.md`
3. Execute os scripts na ordem
4. Verifique com `verificar-migracao.sh`

---

**Desenvolvido com ❤️ para facilitar sua migração**

Última atualização: 27 de Fevereiro de 2026
Status: ✅ PRONTO PARA MIGRAÇÃO
