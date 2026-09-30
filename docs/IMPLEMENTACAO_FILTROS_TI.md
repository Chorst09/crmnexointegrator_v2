# 🚀 Sistema Avançado de Filtros TI - Guia de Implementação

## 📋 Visão Geral

Este sistema estende o Portal de Busca B2G existente com filtros inteligentes para o setor de Tecnologia da Informação, mantendo **100% de compatibilidade** com o sistema atual.

## ⚠️ IMPORTANTE - SEGURANÇA

### Backup Obrigatório
```bash
# 1. SEMPRE fazer backup antes de implementar
psql -d sua_base -f database/backup/backup_before_filtros_ti.sql

# 2. Verificar integridade
SELECT * FROM backup_filtros_ti_20260904.verificar_integridade();
```

## 🗄️ Estrutura do Banco de Dados

### Novas Tabelas (Não afeta o sistema atual)

| Tabela | Propósito | Relacionamento |
|--------|-----------|----------------|
| `categorias_filtro_ti` | Categorias principais (Hardware, Software, etc.) | N/A |
| `palavras_chave_ti` | Palavras-chave do sistema com sinônimos | → `categorias_filtro_ti` |
| `palavras_chave_customizadas` | Termos personalizados dos usuários | → `categorias_filtro_ti` |
| `historico_buscas_ti` | Analytics e otimização | N/A |
| `mv_palavras_chave_consolidadas` | View materializada (performance) | View |

### Funcionalidades do Sistema

#### 🔍 Busca Inteligente
- **Stemming português**: Encontra "computador" ao buscar "computadores"
- **Remoção de acentos**: "informática" = "informatica"
- **Sinônimos automáticos**: "notebook" inclui "laptop", "portátil"
- **Scoring de relevância**: Prioriza resultados mais relevantes

#### 🎯 Categorias Pré-definidas
1. **Termos Gerais**: TI, Informática, TIC, Processamento de Dados
2. **Hardware**: Computadores, Servidores, Notebooks, Switches, etc.
3. **Software**: Licenças, Microsoft, Windows, Oracle, Antivírus
4. **Serviços**: Desenvolvimento, Suporte Técnico, Cloud, Data Center
5. **Infraestrutura**: Cabeamento, Fibra Óptica, Racks, Firewalls

## 📝 Implementação Passo a Passo

### Fase 1: Estruturas do Banco

```bash
# 1. Backup de segurança
psql -d sua_base -f database/backup/backup_before_filtros_ti.sql

# 2. Criar estruturas
psql -d sua_base -f database/migrations/create_filtros_ti_system.sql

# 3. Popular com dados
psql -d sua_base -f database/seeds/seed_filtros_ti_data.sql

# 4. Verificar instalação
SELECT 'Sistema de Filtros TI instalado com sucesso!' as status,
       (SELECT count(*) FROM categorias_filtro_ti) as categorias,
       (SELECT count(*) FROM palavras_chave_ti) as palavras_sistema;
```

### Fase 2: Backend API

```javascript
// Adicionar ao arquivo de rotas principal (app.js ou routes/index.js)
const filtrosTIRouter = require('./api/filtros-ti-search');
app.use('/api/filtros-ti', filtrosTIRouter);
```

### Fase 3: Frontend (Componentes React)

```jsx
// Importar e usar o componente
import FiltrosTIAvancados from '../components/FiltrosTIAvancados';

// No componente pai
const [filtrosTI, setFiltrosTI] = useState({});

<FiltrosTIAvancados
  onFiltrosChange={setFiltrosTI}
  filtrosAtivos={filtrosTI}
  carregando={false}
/>
```

## 🔧 Configurações Avançadas

### Performance

```sql
-- Atualizar estatísticas periodicamente (executar diariamente)
ANALYZE categorias_filtro_ti;
ANALYZE palavras_chave_ti;
ANALYZE mv_palavras_chave_consolidadas;

-- Refresh da view materializada (executar após mudanças)
SELECT refresh_palavras_chave_consolidadas();
```

### Monitoramento

```sql
-- Verificar uso dos filtros
SELECT 
    filtros_aplicados->>'categorias' as categorias_usadas,
    COUNT(*) as total_buscas,
    AVG(tempo_execucao_ms) as tempo_medio_ms
FROM historico_buscas_ti
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY filtros_aplicados->>'categorias'
ORDER BY total_buscas DESC;

-- Top termos customizados
SELECT 
    palavra_customizada,
    contador_uso,
    COUNT(*) OVER () as total_palavras_customizadas
FROM palavras_chave_customizadas
WHERE aprovada = true
ORDER BY contador_uso DESC
LIMIT 10;
```

## 📊 Estrutura de Resposta da API

### Endpoint Principal: `POST /api/filtros-ti/buscar`

```json
{
  "success": true,
  "data": {
    "editais": [
      {
        "id": "uuid-do-edital",
        "numeroControlePncp": "12345678901234567890",
        "titulo": "Aquisição de equipamentos de informática",
        "objeto": "Descrição completa do objeto...",
        "valor": {
          "estimado": 500000.00,
          "formatado": "R$ 500.000,00"
        },
        "modalidade": {
          "nome": "Pregão Eletrônico"
        },
        "situacao": {
          "nome": "Divulgada no PNCP"
        },
        "orgao": {
          "nome": "Prefeitura Municipal de São Paulo",
          "uf": "SP"
        },
        "datas": {
          "aberturaProposta": "2026-12-15T10:00:00Z",
          "encerramentoProposta": "2026-12-20T18:00:00Z",
          "aberturaPropostaFormatada": "15/12/2026 10:00",
          "encerramentoPropostaFormatada": "20/12/2026 18:00"
        },
        "relevancia": {
          "score": 850,
          "termosEncontrados": ["computador", "informática"]
        },
        "fonte": "PNCP_API",
        "vigente": true
      }
    ],
    "meta": {
      "paginacao": {
        "pagina": 1,
        "tamanhoPagina": 20,
        "total": 1,
        "temProximaPagina": false
      },
      "filtrosAplicados": {
        "categorias": ["hardware"],
        "termoLivre": "computador",
        "uf": "SP",
        "periodo": {
          "dataInicio": "2026-12-01",
          "dataFim": "2026-12-31"
        },
        "faixaValor": {
          "valorMin": 100000,
          "valorMax": 1000000
        }
      },
      "performance": {
        "tempoExecucaoMs": 245,
        "timestampBusca": "2026-09-04T14:30:45.123Z"
      }
    },
    "estatisticas": {
      "totalEditais": 15432,
      "editaisVigentes": 3421,
      "valorMedio": 750000.00,
      "maiorValor": 50000000.00,
      "estadosEnvolvidos": 27
    },
    "categoriasDisponiveis": [
      {
        "codigo": "hardware",
        "nome": "Hardware/Equipamentos",
        "descricao": "Equipamentos físicos e componentes de TI",
        "cor": "#3b82f6",
        "icone": "hard-drive",
        "quantidadePalavras": 15,
        "ordem": 2
      }
    ]
  }
}
```

## 🔄 Compatibilidade com Sistema Atual

### Fallback Automático
O sistema mantém total compatibilidade. Se os novos endpoints falharem, automaticamente usa o sistema original:

```javascript
// Lógica de fallback automático
try {
  // Tenta usar novo sistema com filtros TI
  const response = await fetch('/api/filtros-ti/buscar', ...);
} catch (error) {
  // Em caso de erro, usa sistema tradicional
  const fallbackResponse = await fetch('/api/b2g-search', ...);
}
```

## 🚨 Troubleshooting

### Problemas Comuns

1. **Performance lenta**
   ```sql
   -- Verificar índices
   SELECT schemaname, tablename, attname, n_distinct, correlation
   FROM pg_stats
   WHERE tablename IN ('palavras_chave_ti', 'categorias_filtro_ti');
   ```

2. **View desatualizada**
   ```sql
   SELECT refresh_palavras_chave_consolidadas();
   ```

3. **Rollback completo** (EMERGÊNCIA APENAS)
   ```sql
   SELECT backup_filtros_ti_20260904.rollback_sistema_filtros();
   ```

## 📈 Evolução e Melhorias Futuras

### Funcionalidades Planejadas
- [ ] Machine Learning para sugestão automática de termos
- [ ] Integração com APIs de classificação automática
- [ ] Dashboard de analytics para gestores
- [ ] Sistema de alertas personalizados
- [ ] Export de dados filtrados
- [ ] API para integrações externas

### Otimizações de Performance
- [ ] Cache Redis para consultas frequentes  
- [ ] Índices parciais para queries específicas
- [ ] Particionamento por data nas tabelas de histórico
- [ ] Compressão de dados antigos

## 📞 Suporte e Contato

- **Documentação**: `docs/IMPLEMENTACAO_FILTROS_TI.md`
- **Logs**: Verificar `historico_buscas_ti` para debugging
- **Backup**: Manter `backup_filtros_ti_20260904` por 30 dias mínimo
- **Performance**: Monitorar `tempo_execucao_ms` no histórico

---

✅ **Sistema implementado com sucesso!**  
🔒 **Backup de segurança criado**  
🚀 **Portal B2G com filtros TI avançados operacional**