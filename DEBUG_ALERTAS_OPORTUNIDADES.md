# Debug: Problema ao Salvar Alertas em Oportunidades B2B

## 🐛 Problema Reportado

Ao tentar gerar um alerta em oportunidades B2B, após inserir data e horário, não consegue salvar.

## 🔍 Investigação

### Como Funciona o Alerta:

O componente `OpportunityCalendarAlert` **NÃO salva** o alerta no banco de dados do CRM. Ele:

1. ✅ Abre um formulário para criar evento de calendário
2. ✅ Valida título, data e horário
3. ✅ Gera um link ou arquivo .ics para agenda externa:
   - **Google Agenda**
   - **Microsoft 365** (trabalho)
   - **Outlook.com** (pessoal)
   - **Arquivo .ics** (para importar em qualquer agenda)

### Botão que aparece:
- "Abrir na agenda" (Google/Microsoft/Outlook)
- "Baixar alerta (.ics)" (arquivo)

**Não existe botão "Salvar" porque o alerta não é salvo no CRM.**

---

## 🧪 Como Testar (com logs de debug)

1. **Abrir console do navegador:**
   - Pressionar **F12**
   - Ir na aba **Console**

2. **Ir em Oportunidades B2B**

3. **Clicar em "Gerar alerta"**

4. **Preencher:**
   - Ação / título
   - Data e horário
   - Agenda (Google, Microsoft, etc)

5. **Clicar em "Abrir na agenda" ou "Baixar alerta"**

6. **Verificar logs no console:**
   ```
   [OpportunityCalendarAlert] generate() chamado
   [OpportunityCalendarAlert] title: ...
   [OpportunityCalendarAlert] when: ...
   [OpportunityCalendarAlert] start: ...
   [OpportunityCalendarAlert] now: ...
   [OpportunityCalendarAlert] start <= now: ...
   ```

---

## 🔍 Possíveis Problemas:

### 1. Data/hora no passado
**Erro mostrado:** 
> "O horário escolhido (dd/mm/aaaa hh:mm:ss) já passou no seu fuso local..."

**Solução:**
- Escolher uma data/hora **futura**
- Ou clicar no botão "Usar daqui a 30 minutos"

### 2. Campo de data vazio
**Erro mostrado:**
> "Informe uma data e horário válidos."

**Solução:**
- Preencher o campo "Data e horário"

### 3. Título vazio
**Erro mostrado:**
> "Informe a ação / título do alerta."

**Solução:**
- Preencher o campo "Ação / título"

### 4. Pop-up bloqueado (Google/Microsoft/Outlook)
**Sintoma:** Clica em "Abrir na agenda" mas nada acontece

**Solução:**
- Permitir pop-ups do site no navegador
- Ou escolher "Arquivo de calendário (.ics)" para baixar

---

## 📋 O que verificar nos logs:

Se aparecer:
```
[OpportunityCalendarAlert] ERRO: data no passado
```
→ O horário escolhido já passou. Escolher horário futuro.

```
[OpportunityCalendarAlert] ERRO: data inválida
```
→ Formato de data inválido ou campo vazio.

```
[OpportunityCalendarAlert] ERRO: título vazio
```
→ Precisa preencher o título.

```
[OpportunityCalendarAlert] Validações OK, gerando alerta
```
→ Validações passaram, o alerta deve ser gerado.

---

## 🎯 Comportamento Esperado

1. ✅ Usuário preenche título, data/hora futura
2. ✅ Clica em "Abrir na agenda"
3. ✅ Abre nova aba com Google/Microsoft/Outlook
4. ✅ Evento pré-preenchido aparece
5. ✅ Usuário salva na agenda externa
6. ✅ Lembrete configurado (15 min antes por padrão)

**O alerta NÃO fica salvo no CRM - fica apenas na agenda pessoal do usuário.**

---

## 📸 Me envie os logs do console

Quando testar, copie os logs que começam com `[OpportunityCalendarAlert]` e me envie para eu identificar o problema exato.

---

**Status:** Debug adicionado, aguardando deploy para testar
