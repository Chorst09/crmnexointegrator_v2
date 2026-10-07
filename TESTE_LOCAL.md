# 🧪 Guia de Teste Local

## Passo 1: Iniciar o Backend (API)

Abra um terminal e execute:

```bash
cd backend
npm run dev
```

A API deve iniciar na porta **3026** (ou a porta configurada no `.env`)

---

## Passo 2: Iniciar o Frontend

Abra **OUTRO** terminal e execute:

```bash
cd apps/web
npm run dev
```

O frontend deve abrir em **http://localhost:5173** (ou outra porta que o Vite indicar)

---

## Passo 3: Testar a Funcionalidade

1. Acesse o frontend: **http://localhost:5173**
2. Faça login
3. Vá até **Oportunidades**
4. Abra uma oportunidade que tenha reuniões de kickoff
5. Clique em **"Abrir reunião →"**
6. Abra o **Console do navegador** (F12 → Console)
7. Verifique os logs:
   - `🚀 Abrindo reunião: [id]`
   - `✅ Fechando modal...`
   - `🔄 Navegando para /kickoff...`

## ✅ O que deve acontecer:

- ✅ Modal da oportunidade fecha
- ✅ Página recarrega
- ✅ Abre a página de Gestão de Kickoff em tela cheia
- ✅ A reunião específica é carregada

## ❌ Se não funcionar:

Verifique no console:
- Se os logs aparecem
- Se há algum erro
- Qual é a última mensagem antes de falhar

---

## Parar os servidores:

Pressione **Ctrl+C** em cada terminal para parar.
