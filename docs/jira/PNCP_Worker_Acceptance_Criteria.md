# 📋 CRITÉRIOS DE ACEITE - Worker de Ingestão Diária PNCP

## 🎯 **RESUMO DA TASK**

**Título:** Desenvolvimento de Worker de Ingestão Diária para API PNCP  
**Tipo:** Story  
**Prioridade:** Alta  
**Pontos de História:** 13  

**Descrição:**
Como Engenheiro de Dados, quero implementar um worker automatizado que consuma diariamente a API oficial do PNCP (Portal Nacional de Contratações Públicas) para consolidar dados de licitações, editais e contratos públicos em nosso sistema, permitindo análise integrada e inteligência de mercado B2G.

---

## 🏗️ **CRITÉRIOS DE ACEITE FUNCIONAIS**

### ✅ **AC01 - Consumo da API PNCP**
**DADO** que o worker está configurado e em execução  
**QUANDO** executado via cron ou manualmente  
**ENTÃO** deve:
- [ ] Conectar com a API oficial em `https://pncp.gov.br/api/consulta/v1`
- [ ] Consumir o endpoint `/contratacoes/publicacao` com filtro por data
- [ ] Buscar dados das últimas 24 horas por padrão
- [ ] Aceitar parâmetro `--date=YYYY-MM-DD` para datas específicas
- [ ] Processar todas as modalidades prioritárias: Pregão Eletrônico (6), Dispensa (8), Inexigibilidade (9)
- [ ] Respeitar paginação automática (máximo 500 registros por página)

### ✅ **AC02 - Filtros e Parâmetros**
**DADO** que a API retorna grandes volumes de dados  
**QUANDO** fazendo requisições  
**ENTÃO** deve:
- [ ] Filtrar por data de publicação (dataInicial/dataFinal)
- [ ] Iterar por todas as modalidades de contratação relevantes
- [ ] Processar todas as páginas de resultados automaticamente
- [ ] Permitir filtros opcionais por UF, CNPJ, modalidade via parâmetros

### ✅ **AC03 - Extração e Normalização de Dados**
**DADO** que a API retorna dados em JSON  
**QUANDO** processando cada registro  
**ENTÃO** deve extrair e mapear:
- [ ] **Identificação:** numeroControlePNCP, numeroCompra, anoCompra, processo
- [ ] **Objeto:** objetoCompra, informacaoComplementar
- [ ] **Modalidade:** modalidadeId, modalidadeNome, modoDisputa
- [ ] **Órgão:** CNPJ, razão social, poder, esfera (estrutura JSON)
- [ ] **Unidade:** código, nome, município, UF (estrutura JSON)
- [ ] **Valores:** valorTotalEstimado, valorTotalHomologado
- [ ] **Datas:** dataPublicacao, dataAbertura, dataEncerramento
- [ ] **Links:** linkSistemaOrigem, justificativas
- [ ] **Amparo Legal:** código, nome, descrição (JSON)

### ✅ **AC04 - Armazenamento Inteligente (UPSERT)**
**DADO** que podem existir registros duplicados ou atualizações  
**QUANDO** salvando no banco de dados  
**ENTÃO** deve:
- [ ] Usar `numeroControlePNCP` como chave única de negócio
- [ ] Implementar UPSERT (INSERT se novo, UPDATE se existente)
- [ ] Detectar alterações via hash SHA-256 dos dados
- [ ] Pular registros sem alterações (otimização)
- [ ] Atualizar campos `updated_at` apenas quando necessário
- [ ] Manter histórico de `statusProcessamento` (NOVO, PROCESSADO, ERRO)

---

## 🔧 **CRITÉRIOS DE ACEITE TÉCNICOS**

### ✅ **AC05 - Estrutura do Banco de Dados**
**DADO** que precisamos armazenar dados estruturados  
**QUANDO** criando a infraestrutura  
**ENTÃO** deve:
- [ ] Criar tabela `licitacoes_pncp` com todos os campos necessários
- [ ] Implementar índices otimizados para busca rápida:
  - [ ] Índice único em `numero_controle_pncp`
  - [ ] Índice em `data_publicacao_pncp` (DESC)
  - [ ] Índice composto em `modalidade_id, modalidade_nome`
  - [ ] Índice GIN para campos JSON (`orgao_entidade`, `unidade_orgao`)
  - [ ] Índice em expressões JSON para CNPJ e UF
- [ ] Criar constraints de integridade (valores positivos, datas válidas)
- [ ] Implementar trigger para `updated_at` automático
- [ ] Criar views úteis para consultas comuns

### ✅ **AC06 - Modelo Prisma**
**DADO** que usamos Prisma como ORM  
**QUANDO** definindo o modelo  
**ENTÃO** deve:
- [ ] Criar model `LicitacaoPncp` mapeado para a tabela
- [ ] Definir tipos TypeScript para campos JSON
- [ ] Implementar enum `StatusProcessamentoPncp`
- [ ] Adicionar índices correspondentes no schema Prisma
- [ ] Usar tipos `Decimal` para valores monetários
- [ ] Mapear campos com snake_case para camelCase

### ✅ **AC07 - Tratamento de Erros e Resiliência**
**DADO** que APIs externas podem ter instabilidades  
**QUANDO** ocorrerem erros  
**ENTÃO** deve:
- [ ] Implementar retry automático com backoff exponencial (3 tentativas)
- [ ] Respeitar rate limits (1 segundo entre requests)
- [ ] Tratar timeouts (30 segundos por request)
- [ ] Capturar e logar erros HTTP (400, 403, 500, etc.)
- [ ] Continuar processamento mesmo com falhas pontuais
- [ ] Marcar registros com erro no banco (`status = ERRO`)
- [ ] Não interromper execução por falhas de itens individuais

### ✅ **AC08 - Sistema de Logging**
**DADO** que precisamos monitorar e debugar execuções  
**QUANDO** o worker estiver rodando  
**ENTÃO** deve:
- [ ] Implementar logs estruturados em JSON
- [ ] Níveis: DEBUG, INFO, WARN, ERROR
- [ ] Logar início/fim de execução com timestamps
- [ ] Registrar estatísticas: total processado, inserido, atualizado, erros
- [ ] Logar performance: requests por segundo, tempo médio
- [ ] Salvar logs em arquivos separados (sucesso e erro)
- [ ] Rotação automática de logs (manter 30 dias)

---

## 🚀 **CRITÉRIOS DE ACEITE DE IMPLEMENTAÇÃO**

### ✅ **AC09 - Automação e Agendamento**
**DADO** que precisa rodar diariamente  
**QUANDO** configurando a automação  
**ENTÃO** deve:
- [ ] Executar via cron job diariamente às 06:00
- [ ] Funcionar via linha de comando: `node fetchPncpData.ts`
- [ ] Aceitar parâmetros: `--date=YYYY-MM-DD`, `--verbose`
- [ ] Fornecer script de instalação do cron (`install-cron.sh`)
- [ ] Criar wrapper script para ambiente e logs
- [ ] Configurar variáveis de ambiente adequadas

### ✅ **AC10 - Configuração e Manutenibilidade**
**DADO** que o sistema precisa ser configurável  
**QUANDO** instalando/mantendo  
**ENTÃO** deve:
- [ ] Arquivo `package.json` com todas as dependências
- [ ] Configurações centralizadas em constantes
- [ ] Documentação técnica completa no código
- [ ] Scripts npm para desenvolvimento e teste
- [ ] Arquivo README com instruções de uso
- [ ] Configuração de TypeScript adequada

### ✅ **AC11 - Performance e Otimização**
**DADO** que pode processar grandes volumes  
**QUANDO** executando  
**ENTÃO** deve:
- [ ] Processar em lotes de até 100 registros
- [ ] Limitar requests concorrentes (máximo 3)
- [ ] Usar connection pooling do Prisma
- [ ] Implementar paginação eficiente
- [ ] Cache de consultas de verificação (hash)
- [ ] Processar todas as modalidades em paralelo quando possível

---

## 📊 **CRITÉRIOS DE ACEITE DE QUALIDADE**

### ✅ **AC12 - Testes e Validação**
**DADO** que o código deve ser confiável  
**QUANDO** desenvolvendo  
**ENTÃO** deve:
- [ ] Validar estrutura da resposta da API
- [ ] Verificar tipos TypeScript em tempo de compilação
- [ ] Implementar type guards para dados da API
- [ ] Validar CNPJ e formatos de data
- [ ] Testar cenários de erro e recuperação
- [ ] Executar teste manual com `--verbose --date=YYYY-MM-DD`

### ✅ **AC13 - Monitoramento e Métricas**
**DADO** que precisamos acompanhar a saúde do sistema  
**QUANDO** em produção  
**ENTÃO** deve:
- [ ] Gerar relatório de execução com estatísticas
- [ ] Salvar métricas no banco (`SystemSetting`)
- [ ] Calcular performance (registros/segundo)
- [ ] Detectar anomalias (muito poucos/muitos registros)
- [ ] Alertas para falhas críticas (via logs)
- [ ] Dashboard de monitoramento (opcional)

### ✅ **AC14 - Segurança e Compliance**
**DADO** que manipulamos dados públicos sensíveis  
**QUANDO** processando  
**ENTÃO** deve:
- [ ] Não armazenar credenciais em código
- [ ] Usar HTTPS para todas as requisições
- [ ] Implementar User-Agent identificativo
- [ ] Respeitar robots.txt e políticas de uso da API
- [ ] Sanitizar dados de entrada
- [ ] Não expor informações sensíveis em logs

---

## 🎯 **CRITÉRIOS DE ACEITE DE NEGÓCIO**

### ✅ **AC15 - Integração com Sistema Existente**
**DADO** que temos tabela `BidNotice` existente  
**QUANDO** integrando  
**ENTÃO** deve:
- [ ] Coexistir com dados existentes sem conflitos
- [ ] Usar padrões consistentes (UUIDs, timestamps)
- [ ] Permitir relacionamento futuro entre tabelas
- [ ] Seguir nomenclatura do schema existente
- [ ] Manter compatibilidade com Prisma client atual

### ✅ **AC16 - Valor de Negócio Entregue**
**DADO** que queremos insights de mercado B2G  
**QUANDO** sistema estiver funcionando  
**ENTÃO** deve permitir:
- [ ] Identificar oportunidades de licitação por modalidade
- [ ] Analisar órgãos com maior volume de contratações
- [ ] Filtrar por região (UF) e município
- [ ] Acompanhar valores estimados por categoria
- [ ] Identificar editais com prazos próximos ao vencimento
- [ ] Análise histórica de tendências

---

## 📋 **CHECKLIST DE ENTREGA**

### 📁 **Arquivos Obrigatórios**
- [ ] `database/migrations/create_licitacoes_pncp_table.sql`
- [ ] `database/prisma/licitacoes_pncp_model.prisma`
- [ ] `scripts/workers/fetchPncpData.ts`
- [ ] `scripts/workers/types/pncp.types.ts`
- [ ] `scripts/workers/package.json`
- [ ] `scripts/workers/setup/install-cron.sh`
- [ ] `docs/jira/PNCP_Worker_Acceptance_Criteria.md`

### 🧪 **Testes Obrigatórios**
- [ ] Execução manual com sucesso
- [ ] Teste com data específica (`--date`)
- [ ] Teste modo verboso (`--verbose`)
- [ ] Verificação de UPSERT (inserção + atualização)
- [ ] Teste de tratamento de erro (API offline)
- [ ] Validação de estrutura do banco
- [ ] Teste de instalação do cron

### 📖 **Documentação Entregue**
- [ ] Comentários detalhados no código
- [ ] README com instruções de uso
- [ ] Documentação de tipos TypeScript
- [ ] Scripts de instalação e configuração
- [ ] Exemplos de uso e troubleshooting

---

## 🎉 **DEFINIÇÃO DE PRONTO (DoD)**

### ✅ **A task estará PRONTA quando:**

1. **Funcionalidade Completa:** Todos os critérios de aceite passando
2. **Código Revisado:** Code review aprovado por arquiteto sênior
3. **Testes Executados:** Todos os testes manuais documentados passando
4. **Documentação Atualizada:** README e comentários completos
5. **Deploy Realizado:** Instalado em ambiente de produção
6. **Monitoramento Ativo:** Logs funcionando e primeira execução validada
7. **Handover Completo:** Equipe treinada para operação e manutenção

---

## 📞 **CONTATOS E DEPENDÊNCIAS**

**Desenvolvedor Responsável:** AI Assistant (Engenheiro de Dados)  
**Revisor de Código:** Arquiteto Sênior  
**Product Owner:** Gerente de Produto B2G  

**Dependências Técnicas:**
- Acesso ao servidor de produção
- Permissões para criação de cron jobs
- Acesso ao banco PostgreSQL
- Instalação do Node.js e dependências

**Riscos Identificados:**
- Instabilidade da API PNCP (mitigação: retry + logs)
- Rate limiting agressivo (mitigação: delays configuráveis)
- Volume alto de dados (mitigação: processamento em lotes)

---

## 📈 **MÉTRICAS DE SUCESSO**

**KPIs Técnicos:**
- Uptime > 99% das execuções diárias
- Tempo médio de execução < 10 minutos
- Taxa de erro < 1% dos registros processados

**KPIs de Negócio:**
- Cobertura > 80% das licitações publicadas diariamente
- Latência < 24h entre publicação PNCP e disponibilidade no sistema
- Precisão > 99% na extração de dados críticos (valores, datas, órgãos)

---

*Documento criado em: 2026-09-03*  
*Versão: 1.0*  
*Status: Pronto para Desenvolvimento*