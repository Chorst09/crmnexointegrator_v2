# 🚀 Worker de Ingestão PNCP - Portal Nacional de Contratações Públicas

## 📋 Sobre

Worker automatizado para ingestão diária de dados da API oficial do PNCP (Portal Nacional de Contratações Públicas). Consolida informações de licitações, editais e contratos públicos para análise integrada e inteligência de mercado B2G.

## ⚡ Status: **IMPLEMENTAÇÃO CONCLUÍDA**

- ✅ **Banco de dados:** Tabela `licitacoes_pncp` criada com 14 índices otimizados
- ✅ **Worker TypeScript:** Código robusto com retry automático e logs estruturados  
- ✅ **Integração Prisma:** Modelo integrado ao schema principal
- ✅ **Tratamento de erros:** Resiliência com backoff exponencial
- ✅ **Automação:** Scripts de instalação do cron job prontos

## 🏗️ Arquitetura

```
API PNCP → Worker TypeScript → Validação/UPSERT → PostgreSQL → Logs/Métricas
```

## 📦 Instalação Rápida

### 1. Estrutura já criada
```bash
✅ database/migrations/create_licitacoes_pncp_table.sql (executado)
✅ scripts/workers/fetchPncpData.ts (compilado)
✅ Modelo Prisma adicionado ao schema principal
✅ Dependências instaladas (axios, date-fns, @prisma/client)
```

### 2. Configurar execução automática (cron)
```bash
cd scripts/workers/setup
chmod +x install-cron.sh
./install-cron.sh
```

## 🎯 Uso

### **Execução Manual:**
```bash
cd scripts/workers

# Execução padrão (dia anterior)
node fetchPncpData.js

# Data específica  
node fetchPncpData.js --date=2026-09-01

# Modo verboso (logs detalhados)
node fetchPncpData.js --verbose

# Ajuda
node fetchPncpData.js --help
```

### **Execução via NPM:**
```bash
cd scripts/workers

# Scripts disponíveis
npm run test      # Teste com data específica
npm run logs      # Ver logs em tempo real
npm run errors    # Ver logs de erro
```

## 📊 Monitoramento

### **Logs em Tempo Real:**
```bash
# Logs gerais
tail -f logs/workers/pncp-worker.log

# Logs de erro
tail -f logs/workers/pncp-worker-error.log

# Via npm
npm run logs
npm run errors
```

### **Estrutura dos Logs:**
```json
{
  "timestamp": "2026-09-03T20:44:28.427Z",
  "level": "INFO",
  "message": "🚀 Iniciando Worker de Ingestão PNCP",
  "data": { "date": "2026-09-02" }
}
```

## 📈 Dados Capturados

### **Informações Principais:**
- **Identificação:** Número de controle PNCP, processo, ano
- **Modalidade:** Pregão Eletrônico, Dispensa, Inexigibilidade
- **Órgão:** CNPJ, razão social, poder, esfera
- **Valores:** Estimado, homologado (precisão 4 decimais)
- **Datas:** Publicação, abertura, encerramento propostas
- **Localização:** UF, município, unidade administrativa

### **Modalidades Prioritárias:**
- `6` - Pregão Eletrônico
- `8` - Dispensa de Licitação  
- `9` - Inexigibilidade

## 🔧 Configuração Avançada

### **Variáveis de Ambiente:**
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/nexoscrm
NODE_ENV=production
```

### **Configurações do Worker:**
```typescript
// Localização: fetchPncpData.ts linha 67
const CONFIG = {
  baseUrl: 'https://pncp.gov.br/api/consulta/v1',
  timeout: 30000,        // 30 segundos
  maxRetries: 3,         // 3 tentativas
  retryDelay: 1000,      // 1 segundo inicial
  rateLimitDelay: 1000,  // 1 segundo entre requests
  batchSize: 100         // Processar em lotes
};
```

## 📋 Consultas Úteis

### **Verificar dados inseridos:**
```sql
-- Total de licitações por modalidade
SELECT modalidade_nome, COUNT(*) as total, SUM(valor_total_estimado) as valor_total
FROM licitacoes_pncp 
WHERE status_processamento = 'PROCESSADO'
GROUP BY modalidade_nome 
ORDER BY total DESC;

-- Licitações por UF
SELECT unidade_orgao->>'ufSigla' as uf, COUNT(*) as total
FROM licitacoes_pncp 
WHERE status_processamento = 'PROCESSADO'
GROUP BY unidade_orgao->>'ufSigla' 
ORDER BY total DESC;

-- Licitações em andamento (propostas abertas)
SELECT * FROM v_licitacoes_pncp_em_andamento LIMIT 10;
```

### **Estatísticas do sistema:**
```sql
-- Status de processamento
SELECT status_processamento, COUNT(*) FROM licitacoes_pncp GROUP BY status_processamento;

-- Última execução
SELECT value FROM "SystemSetting" WHERE key = 'pncp_last_execution';
```

## 🚨 Troubleshooting

### **Problemas Comuns:**

**1. API PNCP indisponível (503/502):**
```
✅ Comportamento normal - retry automático ativado
📋 Worker continuará tentando com outras modalidades
```

**2. Erro de conexão com banco:**
```bash
# Verificar se PostgreSQL está rodando
ps aux | grep postgres

# Testar conexão
psql -d nexoscrm -c "SELECT 1"
```

**3. Dependências ausentes:**
```bash
cd scripts/workers
npm install
```

**4. Permissões de cron:**
```bash
# Verificar se cron está ativo
systemctl status cron  # Linux
sudo launchctl list | grep cron  # macOS

# Ver crontab atual
crontab -l
```

### **Debug Mode:**
```bash
# Execução com logs detalhados
node fetchPncpData.js --verbose --date=2026-09-01 2>&1 | tee debug.log
```

## 📊 Métricas de Performance

### **Esperado em Produção:**
- ⚡ **Tempo de execução:** < 10 minutos/dia
- ⚡ **Taxa de sucesso:** > 99% dos registros
- ⚡ **Cobertura:** 80%+ das licitações diárias
- ⚡ **Throughput:** 1000+ registros/execução

### **Monitoramento Automático:**
```bash
# Verificar última execução
cat logs/workers/pncp-worker.log | grep "RELATÓRIO DE EXECUÇÃO" | tail -1

# Estatísticas resumidas
grep "totalProcessado\|totalInserido\|totalErros" logs/workers/pncp-worker.log | tail -5
```

## 🎯 Resultados Esperados

### **Inteligência de Mercado B2G:**
- 🎯 **Oportunidades:** Identificação automática de licitações relevantes
- 🎯 **Análise Regional:** Distribuição por UF e município  
- 🎯 **Tendências:** Volume e valores por modalidade
- 🎯 **Alertas:** Editais com prazos próximos ao vencimento

### **Dashboard Executivo:**
- 📈 Gráficos de volume de licitações por período
- 📈 Mapa de calor por região
- 📈 Ranking de órgãos com maior volume
- 📈 Análise de valores médios por modalidade

## 🔐 Segurança

### **Medidas Implementadas:**
- ✅ Rate limiting respeitoso (1 req/segundo)
- ✅ Validação de dados com type guards
- ✅ Sanitização de inputs
- ✅ Uso de HTTPS obrigatório
- ✅ Logs não expõem dados sensíveis
- ✅ Hash SHA-256 para integridade dos dados

## 📞 Suporte

### **Contatos:**
- **Desenvolvedor:** AI Assistant (Engenheiro de Dados)
- **Documentação:** `docs/jira/PNCP_Worker_Acceptance_Criteria.md`

### **Logs Importantes:**
```bash
# Localização dos logs
/path/to/nexoscrm/logs/workers/pncp-worker.log       # Logs gerais
/path/to/nexoscrm/logs/workers/pncp-worker-error.log # Logs de erro
```

## ⚡ Status Final

```
🎉 IMPLEMENTAÇÃO 100% CONCLUÍDA
✅ Banco de dados configurado
✅ Worker funcionando e testado
✅ Logs estruturados ativos  
✅ Sistema de retry funcionando
✅ Pronto para produção

🚀 PRÓXIMO PASSO: Configurar cron job em produção
```

---

**Versão:** 1.0.0  
**Data:** 2026-09-03  
**Status:** Produção Ready ✅