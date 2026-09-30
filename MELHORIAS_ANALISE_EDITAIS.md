# 🔧 Melhorias na Análise de Editais e TR

## 🎯 Problema Identificado

A análise de editais e TR não está trazendo as informações corretas, principalmente dos **ITENS/TR**.

## 📊 Análise do Sistema de Referência

Baseado no sistema https://crmb2g.chorstconsult.com.br/, o módulo "Análise de Edital/TR com AI" deve:

1. **Ler automaticamente** edital ou termo de referência
2. **Extrair riscos**, requisitos e pontos críticos
3. **Identificar ITENS** com precisão
4. **Extrair especificações técnicas** detalhadas
5. **Salvar análises** para consulta rápida

## 🔍 Problemas Atuais no Código

### 1. Extração de Itens Muito Restritiva

O código atual tem muitas validações que podem estar bloqueando itens válidos:

```javascript
// Problemas identificados:
- hasStrongItemSignal() muito restritivo
- looksLikeAdministrativeContext() bloqueando itens válidos
- isWeakItemName() rejeitando nomes curtos mas válidos
- Limite de 20 itens pode ser insuficiente
```

### 2. Padrões de Regex Limitados

Os padrões atuais podem não capturar todos os formatos de itens:

```javascript
// Padrões que podem falhar:
- Item 1.1 - Descrição
- ITEM 01: Descrição
- 1. Descrição do item
- Lote 1 - Descrição
```

### 3. Extração de Quantidade Imprecisa

A extração de quantidade pode falhar em formatos comuns:

```javascript
// Formatos não capturados:
- "Quantidade: 10 unidades"
- "Qtd: 5 licenças"
- "10 (dez) unidades"
```

## ✅ Melhorias Propostas

### 1. Melhorar Padrões de Extração de Itens

```javascript
// Padrões mais abrangentes
const ITEM_PATTERNS = [
  // Item 1, Item 01, Item 1.1
  /^(?:item|lote)\s*(\d{1,3}(?:\.\d+)*)\s*[:\-–]?\s*(.{4,500})$/i,
  
  // 1. Descrição, 1 - Descrição
  /^(\d{1,3}(?:\.\d+)*)\s*[\.\-–]\s*(.{10,500})$/,
  
  // ITEM: Descrição
  /^(?:item|lote)\s*[:\-–]\s*(.{10,500})$/i,
  
  // Descrição com código no início
  /^(\d{4,8})\s+(.{10,500})$/,
  
  // Tabela: | Item | Descrição | Qtd |
  /\|\s*(?:item|lote)?\s*(\d+)\s*\|\s*(.{5,300})\s*\|\s*(\d+)/i
];
```

### 2. Melhorar Extração de Quantidade

```javascript
const QUANTITY_PATTERNS = [
  // Quantidade: 10 unidades
  /(?:quantidade|qtd|quant)[\s:]*(\d+(?:[.,]\d+)?)\s*(unidade|un|und|licen[cç]a|kit|pe[cç]a|item|conjunto)/i,
  
  // 10 (dez) unidades
  /(\d+)\s*\([^)]+\)\s*(unidade|un|und|licen[cç]a|kit|pe[cç]a)/i,
  
  // 10 unidades
  /(\d+(?:[.,]\d+)?)\s*(unidade|un|und|licen[cç]a|kit|pe[cç]a|item|conjunto|meses?|anos?)/i,
  
  // Tabela com quantidade
  /\|\s*(\d+(?:[.,]\d+)?)\s*\|\s*(un|und|unidade|licen[cç]a)/i
];
```

### 3. Melhorar Extração de Especificações

```javascript
const extractItemSpecs = (lines, itemIndex) => {
  const specs = [];
  const maxLookahead = 10;
  
  for (let i = itemIndex + 1; i < Math.min(itemIndex + maxLookahead, lines.length); i++) {
    const line = lines[i];
    
    // Parar se encontrar próximo item
    if (/^(?:item|lote)\s*\d+/i.test(line)) break;
    
    // Capturar especificações técnicas
    if (/(?:especifica[cç][aã]o|caracter[ií]stica|requisito|descri[cç][aã]o)/i.test(line)) {
      specs.push(line);
    }
    
    // Capturar linhas com detalhes técnicos
    if (/(?:m[ií]nimo|m[áa]ximo|compatível|suporte|processador|mem[óo]ria|disco|tela|sistema)/i.test(line)) {
      specs.push(line);
    }
  }
  
  return specs.join(' ').trim() || 'Conforme edital/TR';
};
```

### 4. Adicionar Extração de Tabelas

```javascript
const extractItemsFromTable = (text) => {
  const items = [];
  
  // Detectar tabelas com formato | Item | Descrição | Qtd |
  const tablePattern = /\|[^\|]+\|[^\|]+\|[^\|]+\|/g;
  const tableMatches = text.match(tablePattern);
  
  if (tableMatches) {
    for (const row of tableMatches) {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      
      if (cells.length >= 3) {
        const [itemNum, description, quantity] = cells;
        
        if (/\d+/.test(itemNum) && description.length > 5) {
          items.push({
            name: description,
            quantity: quantity || 'Não identificado',
            specs: 'Conforme edital/TR'
          });
        }
      }
    }
  }
  
  return items;
};
```

### 5. Melhorar Validação de Itens

```javascript
const isValidItem = (name, quantity, context) => {
  // Remover validações muito restritivas
  
  // Aceitar se tem palavras-chave técnicas
  const technicalKeywords = /(?:software|hardware|licen[cç]a|servidor|equipamento|computador|notebook|impressora|scanner|switch|roteador|firewall|storage|backup|sistema|aplica[cç][aã]o|servi[cç]o|suporte|manuten[cç][aã]o|instala[cç][aã]o|configura[cç][aã]o)/i;
  
  if (technicalKeywords.test(name)) return true;
  
  // Aceitar se tem quantidade válida
  if (/\d+\s*(?:un|und|unidade|licen[cç]a|kit)/i.test(quantity)) return true;
  
  // Aceitar se tem código de produto
  if (/\b[A-Z0-9]{4,}\b/.test(name)) return true;
  
  // Aceitar se tem especificação técnica
  if (/(?:GB|TB|GHz|MHz|polegada|pol|"|'|core|thread)/i.test(name)) return true;
  
  // Rejeitar apenas se for claramente administrativo
  const adminKeywords = /^(?:prazo|per[ií]odo|vig[êe]ncia|data|local|endere[cç]o|contato|telefone|email|observa[cç][aã]o|nota|aviso)$/i;
  
  return !adminKeywords.test(name);
};
```

### 6. Adicionar Extração de Contexto

```javascript
const extractItemContext = (lines, itemIndex) => {
  const context = {
    section: '',
    lote: '',
    grupo: ''
  };
  
  // Procurar seção/lote/grupo nas linhas anteriores
  for (let i = Math.max(0, itemIndex - 5); i < itemIndex; i++) {
    const line = lines[i];
    
    if (/^(?:lote|grupo)\s*(\d+)/i.test(line)) {
      context.lote = line.match(/^(?:lote|grupo)\s*(\d+)/i)[1];
    }
    
    if (/^(?:se[cç][aã]o|cap[ií]tulo)\s*(\d+)/i.test(line)) {
      context.section = line.match(/^(?:se[cç][aã]o|cap[ií]tulo)\s*(\d+)/i)[1];
    }
  }
  
  return context;
};
```

## 🚀 Implementação das Melhorias

### Arquivo a Modificar:
`backend/api/ai-analysis.cjs`

### Funções a Atualizar:

1. **extractEditalItemsFromLines()** - Linha 1054
   - Adicionar novos padrões de regex
   - Melhorar validação de itens
   - Aumentar limite de itens para 50
   - Adicionar extração de tabelas

2. **hasStrongItemSignal()** - Linha 997
   - Tornar menos restritivo
   - Adicionar mais palavras-chave técnicas

3. **shouldAcceptItemCandidate()** - Linha 1040
   - Simplificar validação
   - Aceitar mais formatos

4. **ITEM_QUANTITY_PATTERN** - Constante
   - Adicionar mais padrões de quantidade

## 📝 Exemplo de Resultado Esperado

### Antes (Atual):
```json
{
  "items": [
    {
      "name": "Software de gestão",
      "quantity": "Não identificado",
      "specs": "Conforme edital/TR"
    }
  ]
}
```

### Depois (Melhorado):
```json
{
  "items": [
    {
      "name": "Software de gestão empresarial ERP",
      "quantity": "10 licenças",
      "specs": "Sistema integrado com módulos financeiro, contábil, fiscal e RH. Compatível com Windows Server 2019 ou superior. Banco de dados SQL Server. Suporte técnico 24x7.",
      "lote": "1",
      "section": "2"
    },
    {
      "name": "Servidor Dell PowerEdge R740",
      "quantity": "2 unidades",
      "specs": "Processador Intel Xeon Gold 6230 (2.1GHz, 20 cores). Memória RAM 128GB DDR4. Storage 4TB SAS. Fonte redundante 750W.",
      "lote": "1",
      "section": "2"
    }
  ]
}
```

## 🧪 Testes Necessários

### 1. Testar com Diferentes Formatos

- [ ] Edital com tabela de itens
- [ ] Edital com lista numerada
- [ ] Edital com itens em parágrafos
- [ ] TR com especificações técnicas detalhadas
- [ ] Edital com múltiplos lotes

### 2. Testar Extração de Quantidade

- [ ] "Quantidade: 10 unidades"
- [ ] "Qtd: 5 licenças"
- [ ] "10 (dez) unidades"
- [ ] Tabela com coluna de quantidade

### 3. Testar Extração de Especificações

- [ ] Especificações em linhas seguintes
- [ ] Especificações em tabela
- [ ] Especificações técnicas detalhadas
- [ ] Requisitos mínimos e desejáveis

## 📊 Métricas de Sucesso

- ✅ Taxa de extração de itens: >90%
- ✅ Precisão de quantidade: >85%
- ✅ Qualidade de especificações: >80%
- ✅ Tempo de processamento: <30 segundos

## 🔗 Referências

- Sistema de referência: https://crmb2g.chorstconsult.com.br/
- Módulo: Análise de Edital/TR com AI
- Funcionalidade: Leitura automática com extração de riscos, requisitos e pontos críticos

---

**Desenvolvido com ❤️ para melhorar a análise de editais**

Última atualização: 16 de Abril de 2026
