# 📤 Instruções para Commit e Push no GitHub

## 🎯 Objetivo

Fazer commit de todos os arquivos de migração preparados e fazer push para o GitHub.

## 📋 Arquivos a Fazer Commit

### Scripts de Migração
- `scripts/preparar-servidor-definitivo.sh`
- `scripts/backup-completo.sh`
- `scripts/restaurar-backup.sh`
- `scripts/verificar-migracao.sh`
- `scripts/testar-scripts.sh`

### Documentação
- `GUIA_MIGRACAO_GITHUB.md`
- `CHECKLIST_MIGRACAO_RAPIDO.md`
- `MIGRACAO_README.md`
- `PREPARACAO_GITHUB_COMPLETA.md`
- `INSTRUCOES_COMMIT_GITHUB.md`

### Configuração
- `ecosystem.config.js`
- `.github/workflows/deploy-migration.yml`

## 🚀 Passo a Passo

### 1. Verificar Status do Git

```bash
# Ir para o diretório do projeto
cd ~/Documents/DESENVOLVIMENTO/EM\ PRODUÇÃO/crmautomatizadokvm

# Ver status
git status

# Deve mostrar os arquivos não rastreados:
# - scripts/backup-completo.sh
# - scripts/restaurar-backup.sh
# - scripts/verificar-migracao.sh
# - scripts/testar-scripts.sh
# - GUIA_MIGRACAO_GITHUB.md
# - CHECKLIST_MIGRACAO_RAPIDO.md
# - MIGRACAO_README.md
# - PREPARACAO_GITHUB_COMPLETA.md
# - INSTRUCOES_COMMIT_GITHUB.md
# - ecosystem.config.js
# - .github/workflows/deploy-migration.yml
```

### 2. Adicionar Arquivos ao Git

```bash
# Adicionar todos os arquivos de migração
git add scripts/backup-completo.sh
git add scripts/restaurar-backup.sh
git add scripts/verificar-migracao.sh
git add scripts/testar-scripts.sh
git add GUIA_MIGRACAO_GITHUB.md
git add CHECKLIST_MIGRACAO_RAPIDO.md
git add MIGRACAO_README.md
git add PREPARACAO_GITHUB_COMPLETA.md
git add INSTRUCOES_COMMIT_GITHUB.md
git add ecosystem.config.js
git add .github/workflows/deploy-migration.yml

# Ou adicionar tudo de uma vez
git add scripts/ GUIA_MIGRACAO_GITHUB.md CHECKLIST_MIGRACAO_RAPIDO.md MIGRACAO_README.md PREPARACAO_GITHUB_COMPLETA.md INSTRUCOES_COMMIT_GITHUB.md ecosystem.config.js .github/
```

### 3. Verificar Arquivos Adicionados

```bash
git status

# Deve mostrar:
# On branch main
# Changes to be committed:
#   new file:   scripts/backup-completo.sh
#   new file:   scripts/restaurar-backup.sh
#   new file:   scripts/verificar-migracao.sh
#   new file:   scripts/testar-scripts.sh
#   new file:   GUIA_MIGRACAO_GITHUB.md
#   ...
```

### 4. Fazer Commit

```bash
git commit -m "feat: adicionar scripts e documentação de migração para novo servidor KVM

- Adicionar script preparar-servidor-definitivo.sh para preparar novo servidor
- Adicionar script backup-completo.sh para fazer backup completo
- Adicionar script restaurar-backup.sh para restaurar backup
- Adicionar script verificar-migracao.sh para verificar migração
- Adicionar script testar-scripts.sh para validar scripts
- Adicionar GUIA_MIGRACAO_GITHUB.md com instruções completas
- Adicionar CHECKLIST_MIGRACAO_RAPIDO.md com checklist rápido
- Adicionar MIGRACAO_README.md com resumo da migração
- Adicionar PREPARACAO_GITHUB_COMPLETA.md com status de preparação
- Adicionar ecosystem.config.js com configuração PM2
- Adicionar GitHub Actions workflow para validar scripts
- Todos os scripts testados e prontos para uso
- Migração estimada em 35-90 minutos"
```

### 5. Fazer Push para GitHub

```bash
# Push para a branch main
git push origin main

# Ou se estiver em outra branch
git push origin SEU_BRANCH

# Verificar se foi bem-sucedido
git log --oneline -5
```

### 6. Verificar no GitHub

```bash
# Abrir no navegador
https://github.com/seu-usuario/crm-comercial

# Verificar:
# - Arquivos aparecem no repositório
# - Commit aparece no histórico
# - GitHub Actions foi acionado (se configurado)
```

## 📝 Mensagem de Commit Alternativa (Mais Curta)

```bash
git commit -m "feat: adicionar scripts de migração para novo servidor KVM

Scripts de backup, restauração e verificação prontos para uso.
Documentação completa incluída.
Tempo estimado de migração: 35-90 minutos."
```

## 🔍 Verificar Antes de Fazer Push

```bash
# Ver o que será enviado
git log origin/main..HEAD

# Ver diferenças
git diff --cached

# Ver status final
git status
```

## 🚨 Se Cometer um Erro

### Desfazer Último Commit (antes de fazer push)

```bash
# Desfazer commit mas manter arquivos
git reset --soft HEAD~1

# Ou desfazer tudo
git reset --hard HEAD~1
```

### Desfazer Arquivo Específico

```bash
# Remover arquivo do staging
git reset HEAD arquivo.sh

# Ou desfazer mudanças no arquivo
git checkout -- arquivo.sh
```

## 📊 Verificar Histórico

```bash
# Ver últimos commits
git log --oneline -10

# Ver commits com detalhes
git log --oneline --graph --all

# Ver commits de um arquivo específico
git log --oneline scripts/backup-completo.sh
```

## 🔐 Segurança

### Verificar Credenciais Git

```bash
# Ver configuração
git config --list

# Configurar usuário (se necessário)
git config --global user.name "Seu Nome"
git config --global user.email "seu-email@example.com"
```

### Verificar Chave SSH

```bash
# Testar conexão SSH
ssh -T git@github.com

# Deve retornar:
# Hi seu-usuario! You've successfully authenticated, but GitHub does not provide shell access.
```

## 📋 Checklist Final

- [ ] Todos os arquivos criados
- [ ] Scripts com permissão de execução
- [ ] Documentação completa
- [ ] Arquivos adicionados ao git
- [ ] Commit feito com mensagem descritiva
- [ ] Push realizado com sucesso
- [ ] Arquivos aparecem no GitHub
- [ ] GitHub Actions acionado (se aplicável)

## 🎉 Pronto!

Após fazer push com sucesso, os arquivos estarão disponíveis no GitHub para a migração.

### Próximos Passos

1. **No novo servidor KVM:**
   ```bash
   git clone https://github.com/seu-usuario/crm-comercial.git
   cd crm-comercial
   chmod +x scripts/*.sh
   ```

2. **Seguir o guia de migração:**
   ```bash
   cat GUIA_MIGRACAO_GITHUB.md
   ```

3. **Executar scripts:**
   ```bash
   ./scripts/preparar-servidor-definitivo.sh
   ./scripts/backup-completo.sh
   ./scripts/restaurar-backup.sh
   ./scripts/verificar-migracao.sh
   ```

---

**Desenvolvido com ❤️ para facilitar sua migração**

Última atualização: 27 de Fevereiro de 2026
