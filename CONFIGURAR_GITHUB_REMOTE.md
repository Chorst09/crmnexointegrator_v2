# 🔧 Configurar GitHub Remote

## 📌 Situação Atual

O repositório local foi criado mas não tem um remote configurado para o GitHub.

## 🚀 Passo a Passo para Configurar

### 1. Criar Repositório no GitHub

1. Acesse https://github.com/new
2. Preencha os dados:
   - **Repository name**: `crm-comercial`
   - **Description**: `CRM Comercial - Sistema de Gestão de Vendas`
   - **Visibility**: Private (recomendado)
   - **Initialize this repository with**: Deixe em branco
3. Clique em "Create repository"

### 2. Configurar Remote Local

```bash
# Ir para o diretório do projeto
cd ~/Documents/DESENVOLVIMENTO/EM\ PRODUÇÃO/crmautomatizadokvm

# Adicionar remote (substitua seu-usuario pelo seu usuário GitHub)
git remote add origin https://github.com/seu-usuario/crm-comercial.git

# Ou se preferir usar SSH (mais seguro):
git remote add origin git@github.com:seu-usuario/crm-comercial.git

# Verificar se foi adicionado
git remote -v
# Deve mostrar:
# origin  https://github.com/seu-usuario/crm-comercial.git (fetch)
# origin  https://github.com/seu-usuario/crm-comercial.git (push)
```

### 3. Fazer Push da Branch Main

```bash
# Fazer push da branch main
git push -u origin main

# Ou se a branch padrão for 'master':
git push -u origin master
```

### 4. Verificar no GitHub

1. Acesse https://github.com/seu-usuario/crm-comercial
2. Verifique se os arquivos aparecem
3. Verifique o histórico de commits

## 🔐 Autenticação SSH (Recomendado)

Se preferir usar SSH em vez de HTTPS:

### 1. Gerar Chave SSH (se não tiver)

```bash
# Gerar chave SSH
ssh-keygen -t ed25519 -C "seu-email@example.com"

# Ou se preferir RSA:
ssh-keygen -t rsa -b 4096 -C "seu-email@example.com"

# Pressione Enter para aceitar o local padrão
# Digite uma senha (opcional)
```

### 2. Adicionar Chave ao SSH Agent

```bash
# Iniciar SSH agent
eval "$(ssh-agent -s)"

# Adicionar chave privada
ssh-add ~/.ssh/id_ed25519
```

### 3. Adicionar Chave Pública ao GitHub

```bash
# Copiar chave pública
cat ~/.ssh/id_ed25519.pub | pbcopy

# Ou ver a chave:
cat ~/.ssh/id_ed25519.pub
```

1. Acesse https://github.com/settings/keys
2. Clique em "New SSH key"
3. Cole a chave pública
4. Clique em "Add SSH key"

### 4. Testar Conexão SSH

```bash
ssh -T git@github.com

# Deve retornar:
# Hi seu-usuario! You've successfully authenticated, but GitHub does not provide shell access.
```

### 5. Atualizar Remote para SSH

```bash
# Se já adicionou com HTTPS, remova:
git remote remove origin

# Adicione com SSH:
git remote add origin git@github.com:seu-usuario/crm-comercial.git

# Verifique:
git remote -v
```

## 📋 Checklist

- [ ] Repositório criado no GitHub
- [ ] Remote adicionado localmente
- [ ] SSH configurado (opcional)
- [ ] Push realizado com sucesso
- [ ] Arquivos aparecem no GitHub
- [ ] Histórico de commits visível

## 🚀 Após Configurar

Agora você pode:

1. **Fazer push de mudanças:**
   ```bash
   git push origin main
   ```

2. **Fazer pull de mudanças:**
   ```bash
   git pull origin main
   ```

3. **Clonar em outro servidor:**
   ```bash
   git clone https://github.com/seu-usuario/crm-comercial.git
   # Ou com SSH:
   git clone git@github.com:seu-usuario/crm-comercial.git
   ```

## 🆘 Troubleshooting

### Erro: "fatal: 'origin' does not appear to be a git repository"

```bash
# Verificar remotes
git remote -v

# Se vazio, adicione:
git remote add origin https://github.com/seu-usuario/crm-comercial.git
```

### Erro: "Permission denied (publickey)"

```bash
# Verificar SSH
ssh -T git@github.com

# Se falhar, adicione chave ao agent:
ssh-add ~/.ssh/id_ed25519
```

### Erro: "fatal: The current branch main has no upstream branch"

```bash
# Fazer push com -u para definir upstream:
git push -u origin main
```

## 📞 Suporte

Para mais informações sobre GitHub:
- Documentação: https://docs.github.com
- SSH Setup: https://docs.github.com/en/authentication/connecting-to-github-with-ssh
- HTTPS Setup: https://docs.github.com/en/get-started/getting-started-with-git/about-remote-repositories

---

**Desenvolvido com ❤️ para facilitar sua migração**

Última atualização: 27 de Fevereiro de 2026
