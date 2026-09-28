# 🎨 Deploy Manual - Melhorias Dark Mode

## Passo 1: Enviar arquivo para o servidor

Abra um terminal e execute:

```bash
scp crm-update-darkmode.tar.gz usuario@72.60.195.200:/tmp/
```

Quando pedir a senha, digite: `Ch@#horst1977#@`

---

## Passo 2: Conectar no servidor

```bash
ssh usuario@72.60.195.200
```

Senha: `Ch@#horst1977#@`

---

## Passo 3: No servidor, extrair e atualizar

```bash
cd /var/www/crm-comercial
tar -xzf /tmp/crm-update-darkmode.tar.gz
```

---

## Passo 4: Reiniciar o serviço

```bash
sudo systemctl restart crm-comercial
```

Ou se não tiver systemd:

```bash
pm2 restart crm-comercial
```

---

## Passo 5: Limpar cache do nginx (opcional)

```bash
sudo systemctl reload nginx
```

---

## Passo 6: Limpar arquivo temporário

```bash
rm /tmp/crm-update-darkmode.tar.gz
```

---

## ✅ Pronto!

Acesse: http://72.60.195.200:8081

**IMPORTANTE:** Faça um hard refresh no navegador:
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

---

## 🎯 O que foi alterado?

- ✅ Títulos agora visíveis no dark mode (text-gray-100)
- ✅ Subtítulos com melhor contraste (text-gray-300/400)
- ✅ Cards com fundos mais claros (slate-800/50)
- ✅ Ícones com cores ajustadas para dark mode
- ✅ Bordas mais visíveis (slate-700)
- ✅ Todos os textos legíveis no modo escuro
