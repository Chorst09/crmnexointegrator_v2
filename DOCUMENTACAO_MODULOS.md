# CRM Nexos — Documentação de Uso por Módulo

> Documentação detalhada para usuários finais. Versão 1.0 — Agosto 2026.

---

## Índice

1. [Módulo B2B — Vendas Privado](#módulo-b2b)
2. [Módulo B2G — Governo](#módulo-b2g)
3. [Módulo Pré-Vendas](#módulo-pré-vendas)
4. [Módulo Gestão](#módulo-gestão)

---

---

# Módulo B2B

## Visão Geral

O módulo B2B (Business-to-Business) é o coração comercial do CRM, voltado para a gestão de vendas ao setor privado. Ele concentra todo o funil comercial: desde a captação de leads até o fechamento de contratos, incluindo acompanhamento de oportunidades, atividades e simuladores de precificação.

**Acesso:** Menu lateral → seção **B2B PRIVADO**

**Perfis com acesso:** MASTER, ADMIN, USER, USER_B2B

---

## 1. Dashboard B2B

**Caminho:** B2B Privado → Dashboard B2B

### O que é
Painel executivo com visão consolidada do desempenho comercial. Exibe KPIs em tempo real, gráficos de evolução e o funil de vendas completo.

### KPIs Disponíveis
| Indicador | O que mostra |
|---|---|
| Pipeline Total | Soma de todas as oportunidades abertas |
| Receita Fechada | Total de oportunidades ganhas no período |
| Ticket Médio | Valor médio por oportunidade |
| Taxa de Conversão | % de oportunidades ganhas sobre o total |
| SLA Comercial | Tempo médio de avanço no funil |

Cada KPI exibe uma seta indicando variação em relação ao mês anterior (▲ crescimento / ▼ queda).

### Filtros
- **Período:** 30 dias, Mês Atual, Trimestre, Ano, Customizado (datas específicas)
- **Gerente de Contas:** filtra por responsável pela oportunidade
- **Temperatura:** 0%, 25%, 50%, 75%, 100% (probabilidade de fechamento)

### Gráficos
- **Receita Mensal:** evolução mês a mês (linha)
- **Forecast vs Meta:** projeção versus objetivo (linha dupla)
- **Fontes de Oportunidade:** canais de origem (rosca)
- **Velocidade por Etapa:** tempo médio em cada etapa do funil (barras)
- **Funil de Vendas:** representação visual do pipeline
- **Termômetro de Temperatura:** distribuição de oportunidades por probabilidade

### Modo Apresentação
Clique no botão **"Apresentação"** no canto superior direito para entrar em tela cheia. Use as setas do teclado ou PageUp/PageDown para navegar entre os slides. Ideal para reuniões executivas e revisões de pipeline.

---

## 2. Empresas

**Caminho:** B2B Privado → Empresas

### O que é
Cadastro central de todas as empresas privadas — clientes ativos, prospects e leads. Cada empresa pode ter múltiplos contatos, documentos e histórico de oportunidades vinculadas.

### KPIs do Painel
- **Total:** quantidade total de empresas cadastradas
- **Leads:** empresas no estágio inicial de prospecção
- **Ativos:** clientes em relacionamento ativo
- **Hot:** empresas com Lead Score 80 ou mais
- **Warm:** empresas com Lead Score entre 60 e 79

### Como Cadastrar uma Empresa
1. Clique no botão **"Nova Empresa"** (canto superior direito)
2. Preencha os campos:
   - **Nome da Empresa** (obrigatório)
   - **CNPJ/CPF**
   - **Segmento** (ex: Tecnologia, Saúde, Indústria)
   - **Porte:** Micro / Pequena / Média / Grande / Enterprise
   - **Status:** Lead / Prospect / Ativo / Inativo / Perdido
   - **Website**
   - **Endereço, Cidade, Estado**
3. Na seção **Contato Principal:** informe Nome, Email, Telefone e Cargo do contato principal
4. Na seção **Contato de Compras:** informe o contato responsável por compras/contratos
5. Clique em **Salvar**

### Status das Empresas
| Status | Significado |
|---|---|
| Lead | Empresa recém captada, sem qualificação |
| Prospect | Em processo de qualificação/abordagem |
| Ativo | Cliente em relacionamento comercial ativo |
| Inativo | Sem movimentação recente |
| Perdido (Churned) | Cliente que cancelou ou foi perdido para concorrência |

### Lead Score
Número de 0 a 100 calculado automaticamente com base em dados de engajamento, histórico de oportunidades e atividades. Empresas com score mais alto devem receber prioridade de abordagem.

### Visualizando Detalhes de uma Empresa
Clique no ícone de olho (👁) na linha da empresa para abrir o painel de detalhes com:
- **Aba Cadastro:** todos os dados cadastrais
- **Aba Documentos:** upload e download de arquivos (contratos, propostas, certidões)
- **Links rápidos:** clique em qualquer oportunidade, contrato ou atividade vinculada para navegar diretamente

### Upload de Documentos
Na visualização da empresa, clique em **"Adicionar Documentos"**, selecione um ou mais arquivos e clique em **"Enviar"**. Os arquivos ficam armazenados vinculados à empresa.

### Filtros da Listagem
- **Busca textual:** nome, CNPJ, segmento, website, cidade
- **Status:** filtre por Lead, Prospect, Ativo, Inativo ou Perdido

### Exclusão em Lote
Marque várias empresas com o checkbox e clique em **"Excluir selecionados"**.


---

## 3. Oportunidades

**Caminho:** B2B Privado → Oportunidades

### O que é
Pipeline de vendas no formato Kanban. Cada oportunidade representa uma negociação em andamento com uma empresa. O Kanban permite visualizar e mover oportunidades entre etapas arrastando os cards.

### Etapas do Funil
```
LEAD → QUALIFICAÇÃO → DIAGNÓSTICO → PROPOSTA → NEGOCIAÇÃO → GANHOU | PERDEU
```

### KPIs do Painel
- **Total de Oportunidades:** quantidade no período filtrado
- **Valor Total:** soma de todas as oportunidades abertas
- **Taxa de Conversão:** % de oportunidades ganhas
- **Ticket Médio:** valor médio por oportunidade

### Como Criar uma Oportunidade
1. Clique em **"Nova Oportunidade"**
2. Preencha:
   - **Título:** nome da oportunidade
   - **Nome do Projeto:** nome interno do projeto
   - **Tipo de Projeto Cliente:** Cliente Novo / Cliente da Base / Renovação
   - **Tipo de Projeto:** Pontual (único) / Mensal (recorrente)
   - **Número de Meses:** se for projeto mensal
   - **Valor (R$):** valor estimado
   - **Probabilidade:** de 0 a 100%
   - **Etapa:** posição inicial no funil
   - **Empresa:** selecione a empresa vinculada
   - **Responsável:** vendedor responsável
   - **Data de Fechamento Prevista**
3. Clique em **Salvar**

### Mover Oportunidades no Kanban
Clique e arraste o card de uma coluna para outra. Oportunidades nas etapas **Ganhou** e **Perdeu** não podem ser arrastadas.

### Registrar Motivo de Perda
Ao mover uma oportunidade para **"Perdeu"**, um modal obrigatório solicitará o motivo:
- Preço acima do esperado
- Concorrência venceu
- Prazo de entrega inviável
- Cliente optou por não investir
- Produto não atende aos requisitos
- Orçamento insuficiente do cliente
- Relacionamento com concorrente
- Decisão interna do cliente
- Outro

### Acompanhamentos (Follow-ups)
Dentro do modal de detalhes de qualquer oportunidade, clique em **"Adicionar Acompanhamento"** para registrar uma interação. Tipos disponíveis:

| Tipo | Uso |
|---|---|
| Nota | Observação interna geral |
| Ligação | Registro de chamada telefônica |
| E-mail | Registro de troca de e-mails |
| Reunião | Registro de reunião presencial ou online |
| WhatsApp | Registro de conversa por WhatsApp |

Cada acompanhamento é salvo com data/hora e nome do usuário que registrou.

### Filtros
- **Busca textual:** título, nome do projeto, empresa, responsável
- **Etapa:** filtra por uma etapa específica do funil
- **Vendedor:** filtra por responsável

### Modo Histórico
Clique na aba **"Histórico"** para ver todas as oportunidades, incluindo ganhas e perdidas, com filtros e valores totais.

---

## 4. Atividades

**Caminho:** B2B Privado → Atividades

### O que é
Agenda de tarefas comerciais. Registra todas as ações relacionadas às negociações: ligações, reuniões, e-mails e tarefas genéricas. O tipo especial **Solicitação de Orçamento** dispara automaticamente uma solicitação no módulo Pré-Vendas.

### Tipos de Atividade
| Tipo | Ícone | Uso |
|---|---|---|
| Ligação (CALL) | 📞 | Registro de chamada telefônica |
| Reunião (MEETING) | 📅 | Reunião presencial ou online |
| E-mail (EMAIL) | ✉️ | Troca de e-mails com cliente |
| Tarefa (TASK) | ✅ | Tarefa interna genérica |
| Follow-up | 🔄 | Acompanhamento de negociação |
| **Solicitação de Orçamento** | 📋 | **Envia automaticamente para o Pré-Vendas** |

### Como Criar uma Atividade
1. Clique em **"Nova Atividade"**
2. Selecione o **Tipo**
3. Defina a **Prioridade:** Baixa / Média / Alta / Urgente
4. Informe o **Assunto** (obrigatório)
5. Adicione uma **Descrição** detalhada
6. Defina a **Data/Hora de Vencimento**
7. Selecione o **Responsável**
8. Defina a **Origem** (de qual área vem a demanda)
9. Defina o **Destino** (para qual área vai)
10. Clique em **Salvar**

### Criando uma Solicitação de Orçamento para o Pré-Vendas
1. Crie uma atividade do tipo **"Solicitação de Orçamento"**
2. Defina o **Destino** como "Pré-Vendas"
3. Salve — a atividade aparecerá automaticamente na fila de **Solicitações** do módulo Pré-Vendas

### Status das Atividades
| Status | Significado |
|---|---|
| Pendente | Criada, aguardando início |
| Em Andamento | Em execução |
| Concluída | Finalizada com sucesso |
| Cancelada | Cancelada antes de concluir |

### KPIs do Painel
- **Total:** todas as atividades no período
- **Pendentes:** aguardando início
- **Em Andamento:** em execução
- **Concluídas:** finalizadas
- **Atrasadas:** vencidas e não concluídas (destacadas em vermelho)

### Ações Rápidas nas Linhas
- **Iniciar:** muda status de Pendente para Em Andamento
- **Concluir:** finaliza a atividade
- **Cancelar:** cancela sem concluir

---

## 5. Leads

**Caminho:** B2B Privado → Lead

### O que é
Central de Lead Scoring e distribuição automática de leads. Permite visualizar o score de cada empresa, redistribuir leads ociosos e criar oportunidades com um clique.

### Aba Lead Scoring
Exibe as empresas com status **LEAD** ordenadas por pontuação. Cada empresa mostra:
- Score atual (badge colorido: vermelho = Hot, amarelo = Warm, azul = Cold)
- Dados de contato
- Ações de distribuição manual

**Faixas de Score:**
| Faixa | Classificação | Prioridade |
|---|---|---|
| 80–100 | 🔴 Hot | Abordar imediatamente |
| 60–79 | 🟡 Warm | Abordar em breve |
| 40–59 | 🔵 Cold | Monitorar |
| 0–39 | ⚪ Low Priority | Nutrir com conteúdo |

### Criando um Lead Manual
1. Clique em **"Novo Lead"**
2. Preencha: Empresa, CNPJ, Segmento, Porte, Website, Endereço, Cidade, Estado
3. Informe o **Contato Principal:** Nome, Email, Telefone
4. Marque **"Distribuir automaticamente"** para atribuir o lead a um vendedor automaticamente
5. Clique em **Salvar**

### Recalcular Scores
Clique em **"Recalcular Todos os Scores"** para atualizar as pontuações de todas as empresas com base no histórico recente de oportunidades e atividades.

### Aba Distribuição
- **Estratégia:** define como os leads são distribuídos (por carga de trabalho, etc.)
- **Redistribuir Leads Ociosos:** reatribui automaticamente leads que não tiveram interação há 3 ou mais dias


---

## 6. Simuladores

**Caminho:** B2B Privado → Simuladores

### O que é
Módulo completo de precificação e simulação de propostas comerciais. Contém calculadoras específicas para cada produto/serviço, dashboard de análise de propostas e geração de proposta comercial profissional.

Consulte a documentação específica do módulo Simuladores para detalhes completos.

---

## 7. Propostas e Templates

**Caminho:** B2B Privado → Propostas / Templates

### O que é
Gestão de propostas comerciais formais e templates reutilizáveis para padronizar o layout das propostas enviadas aos clientes.

---

# Módulo B2G

## Visão Geral

O módulo B2G (Business-to-Government) gerencia o relacionamento com órgãos governamentais e o acompanhamento de licitações públicas. Possui pipeline próprio com etapas específicas do processo licitatório e integração com IA para análise de editais e Termos de Referência.

**Acesso:** Menu lateral → seção **B2G GOVERNO**

**Perfis com acesso:** MASTER, ADMIN, USER, USER_B2G

---

## 1. Dashboard B2G

**Caminho:** B2G Governo → Dashboard

### O que é
Painel estratégico do módulo B2G com funil visual das licitações, KPIs e alertas de prazos.

### Funil B2G (etapas)
```
ANÁLISE → PROPOSTA ENVIADA → HABILITAÇÃO → RECURSO → SUSPENSO → HOMOLOGADO → CONCLUÍDO → GANHO / NO GO / PERDIDO
```

### KPIs
- Valor total por etapa do funil
- Quantidade de oportunidades por estágio
- Alertas de oportunidades próximas do prazo

### Filtros
- **Probabilidade/Temperatura:** 0%, 25%, 50%, 75%, 100%
- **Período:** últimos 30, 60, 90 ou 180 dias

### Alertas de Prazo
O sistema exibe automaticamente oportunidades com prazo de proposta próximo, classificadas por urgência.

### Modo Apresentação
Botão **"Apresentação"** disponível para reuniões estratégicas em tela cheia.

---

## 2. Órgãos

**Caminho:** B2G Governo → Órgãos

### O que é
Cadastro de órgãos governamentais — equivalente ao cadastro de Empresas do módulo B2B, mas voltado para entidades públicas.

### Campos do Cadastro
- **Nome do Órgão** (obrigatório)
- **CNPJ / Código do órgão**
- **Esfera / Área** (ex: Federal, Estadual, Municipal, Saúde, Educação)
- **Porte:** Micro / Pequena / Média / Grande / Enterprise
- **Status:** Lead / Prospect / Ativo / Inativo / Perdido
- **Website**
- **Contato do órgão:** Nome, Email, Telefone, Cargo
- **Contato Administrativo:** responsável por processos/contratos

### Uso
O cadastro de órgãos alimenta as oportunidades B2G — ao criar uma oportunidade de licitação, você vincula ao órgão correspondente.

---

## 3. Portal de Busca

**Caminho:** B2G Governo → Portal de Busca

### O que é
Ferramenta de busca de editais e licitações publicados no **PNCP (Portal Nacional de Contratações Públicas)** e outras fontes públicas. Permite encontrar oportunidades antes que a concorrência e adicioná-las ao pipeline B2G.

### Como Usar
1. Digite palavras-chave relacionadas ao seu produto/serviço
2. Filtre por UF, período, modalidade
3. Clique em um edital para ver detalhes
4. Clique em **"Adicionar ao Pipeline"** para criar uma oportunidade B2G

---

## 4. Análise de Editais/TR com IA

**Caminho:** B2G Governo → Análise Editais/TR

### O que é
Ferramenta de análise automática de PDFs de editais e Termos de Referência usando Inteligência Artificial. Em segundos, extrai e estrutura todas as informações relevantes do documento.

### Modos de Análise
- **Edital:** analisa o edital completo (objeto, prazos, exigências, documentação, itens, riscos)
- **Termo de Referência (TR):** análise técnica profunda focada em especificações e requisitos

### Como Analisar um Documento
1. Selecione o modo: **Edital** ou **TR**
2. Clique em **"Selecionar PDF"** e escolha o arquivo
3. O sistema extrai automaticamente o texto do PDF
4. Clique em **"Analisar"**
5. A IA processa o documento (pode levar 10–30 segundos)
6. O resultado aparece organizado em abas

### Resultado para Edital — Abas
| Aba | Conteúdo |
|---|---|
| **Geral** | Órgão, data da sessão, modalidade, portal eletrônico, objeto principal |
| **Prazos** | Cronograma completo: publicação, impugnação, proposta, abertura |
| **Exigências** | Requisitos jurídicos, técnicos, econômicos e fiscais por categoria |
| **Documentação** | Checklist automático de documentos obrigatórios |
| **Itens/TR** | Catálogo técnico de todos os itens com quantidade e especificações |
| **Riscos/IA** | Pontos de atenção e riscos identificados pela IA com severidade |

### Resultado para TR — Abas
| Aba | Conteúdo |
|---|---|
| **Resumo das Especificações** | Análise técnica detalhada: requisitos mínimos, normas (ABNT/ISO), SLA, garantias |
| **Itens/TR** | Caderno técnico com avaliação ATENDE / NÃO ATENDE para cada item |

### Score de Aderência
A IA calcula automaticamente um score de 0 a 100 indicando a viabilidade de participação:
- **≥ 75 → GO** (recomendado participar)
- **55–74 → GO COM RESSALVAS** (participar com atenção aos pontos críticos)
- **< 55 → NO GO** (não recomendado)

### Salvando a Análise
Clique em **"Salvar em Resumos"** para persistir a análise no banco de dados e consultá-la depois em **B2G → Resumos de Edital**.

### Convertendo em Oportunidade
Clique em **"Converter em Oportunidade"** para:
1. Criar automaticamente o edital no sistema
2. Gerar uma oportunidade vinculada no pipeline B2G
3. Ser redirecionado para a oportunidade criada para edição

### Provedores de IA (Fallback Automático)
O sistema tenta os provedores na seguinte ordem, usando o próximo caso o anterior falhe:
1. **Gemini** (Google — modelo gemini-2.5-flash)
2. **Groq** (modelo llama-3.3-70b-versatile)
3. **Mistral** (modelo mistral-large-latest)

---

## 5. Resumos de Edital

**Caminho:** B2G Governo → Resumos de Edital

### O que é
Repositório de todas as análises de editais e TR já realizadas e salvas. Permite consultar análises anteriores sem precisar re-analisar o PDF.

### Campos exibidos por resumo
- Título do documento
- Órgão licitante
- Tipo (Edital / TR)
- Score de aderência
- Recomendação (GO / GO COM RESSALVAS / NO GO)
- Data da análise
- Riscos identificados

---

## 6. Oportunidades B2G

**Caminho:** B2G Governo → Oportunidades

### O que é
Pipeline Kanban específico para licitações, com etapas alinhadas ao processo licitatório real.

### Campos do Formulário
- **Título:** nome da licitação
- **Tipo:** Edital / Termo de Referência / Ata de Registro de Preços
- **Código de referência** (número do edital/pregão)
- **Órgão/Organização**
- **UF** (estado)
- **Modalidade** (Pregão Eletrônico, Concorrência, etc.)
- **Descrição do objeto**
- **Valor estimado (R$)**
- **Data de abertura**
- **Prazo da proposta**
- **URL de origem** (link no portal público)
- **Tags**

### Status dos Editais
| Status | Significado |
|---|---|
| Monitorando | Em observação, ainda não iniciou análise |
| Análise em Andamento | Em processo de avaliação |
| Análise Concluída | Análise finalizada (GO/NO GO definido) |
| Proposta em Preparação | Equipe preparando proposta |
| Enviada | Proposta enviada ao órgão |
| Suspensa | Licitação suspensa pelo órgão |
| Encerrada | Processo encerrado |

### Follow-ups de Oportunidade B2G
Dentro do detalhe de cada oportunidade, registre interações por tipo: Ligação, E-mail, Reunião, WhatsApp ou Nota.

---

## 7. Atividades B2G

**Caminho:** B2G Governo → Atividades

### O que é
Agenda operacional exclusiva do B2G. Funciona da mesma forma que as Atividades B2B, mas segmentada para o contexto de licitações e órgãos governamentais.

---

## 8. Documentação B2G

**Caminho:** B2G Governo → Documentação

### O que é
Checklist documental para controle de habilitação em licitações. Monitora a validade de cada documento e emite alertas quando estão próximos do vencimento.

### Categorias de Documentos
- **Jurídico:** Contrato Social, Atos constitutivos
- **Fiscal:** Certidões negativas (Federal, Estadual, Municipal, FGTS, Trabalhista)
- **Técnico:** Atestados de capacidade técnica, certificações
- **Habilitação:** Documentos específicos de habilitação do edital
- **Financeiro:** Balanço patrimonial, demonstrações contábeis
- **Outros**

### Status de Validade
- ✅ **Válido:** dentro do prazo
- ⚠️ **Vencendo:** vence em até 30 dias (alerta automático)
- ❌ **Expirado:** fora do prazo de validade

---

## 9. Relatórios Estratégicos B2G

**Caminho:** B2G Governo → Relatórios Estratégicos

### O que é
Análise estratégica do desempenho no mercado governamental: win rate por modalidade, valores por UF, comparativo de períodos e análise de perdas.


---

# Módulo Pré-Vendas

## Visão Geral

O módulo Pré-Vendas é a área técnica e operacional responsável por receber demandas do Comercial (B2B e B2G), realizar cotações com distribuidores e fornecedores, precificar soluções e devolver propostas estruturadas ao time de vendas.

O fluxo é **bidirecional:** o Comercial envia solicitações para o Pré-Vendas e, após precificação, o Pré-Vendas devolve a proposta ao Comercial.

**Acesso:** Menu lateral → seção **PRÉ-VENDAS**

**Perfis com acesso:** MASTER, ADMIN, PRE_SALES

---

## 1. Dashboard Pré-Vendas

**Caminho:** Pré-Vendas → Dashboard

### O que é
Painel de controle central do Pré-Vendas. Exibe a situação geral das solicitações, POCs (Provas de Conceito), registro de oportunidades e gráficos de desempenho.

### KPIs de Solicitações
| Indicador | O que mostra |
|---|---|
| Novas Solicitações | Aguardando assumir pela equipe |
| Em Precificação | Em processo de cotação/cálculo |
| Aguardando Aprovação | Enviadas para revisão do Comercial |
| Finalizadas | Concluídas no período |

### KPIs de Registro de Oportunidades
| Indicador | O que mostra |
|---|---|
| Total | Todos os registros |
| Abertas | Em andamento |
| Ganhas | Convertidas em venda |
| Valor Potencial | Soma dos valores estimados |

### KPIs de POCs
- Total de Provas de Conceito
- Em Andamento
- Bloqueadas
- Aprovadas
- Atrasadas

### Alertas de Validade
O sistema exibe automaticamente alertas para registros de oportunidades próximos do vencimento:
- 🔴 **Vencidas:** vencimento já ultrapassado
- 🟠 **Vencem em 7 dias**
- 🟡 **Vencem em 15 dias**
- 🟢 **Vencem em 30 dias**

### Gráficos do Registro de Oportunidades
- **Por Status:** barras com contagem por cada status
- **Por Origem:** rosca com distribuição (B2B, B2G, Comercial, Pré-Vendas)
- **Por Modalidade x Valor:** barras com valor por tipo (Venda, Locação, Serviços)
- **Evolução Mensal:** linha dupla com quantidade e valor dos últimos 6 meses

### Criando uma Nova Solicitação pelo Dashboard
1. Clique em **"Nova Solicitação"**
2. **Etapa 1 — Dados básicos:**
   - Título (obrigatório)
   - Descrição detalhada
   - Prioridade: Baixa / Média / Alta / Urgente
3. **Etapa 2 — Detalhes técnicos:**
   - Tipos de Precificação (checkboxes): Venda, Locação, Serviços, Rateio, etc.
   - Prazo esperado de retorno
   - Orçamento estimado (R$)
4. Clique em **"Criar Solicitação"**

---

## 2. Solicitações

**Caminho:** Pré-Vendas → Solicitações

### O que é
Fila de trabalho operacional do Pré-Vendas. Exibe todas as solicitações recebidas (do Comercial B2B, B2G ou criadas diretamente no módulo) em um Kanban com 4 colunas de fluxo.

### Fontes de Solicitações
1. **Atividade "Solicitação de Orçamento"** criada no módulo B2B com destino PRE_VENDAS
2. **Nova Solicitação** criada diretamente no Pré-Vendas
3. **Orçamentos** criados no módulo Orçamentos

### Colunas do Kanban

| Coluna | Status | Significado |
|---|---|---|
| **ENTRADA** | Nova | Recebida, aguardando assumir |
| **COTAÇÃO** | Em Precificação | Sendo cotada com distribuidores |
| **PRECIFICAÇÃO** | Em Precificação | Custo recebido, calculando preço de venda |
| **REVISÃO** | Aguardando Aprovação | Pronta para revisão do Comercial |

> Solicitações **DEVOLVIDAS** (finalizadas) não aparecem no Kanban, apenas na lista.

### Modos de Visualização
- **Kanban:** visão por colunas (padrão)
- **Lista:** visão em tabela com todos os campos

### Filtros
- **Busca textual:** por título, empresa ou responsável
- **Apenas Minhas:** exibe somente solicitações do usuário logado
- **Fila:** filtra por área de destino

### Fluxo de Trabalho — Passo a Passo

#### Passo 1 — Assumir a solicitação
1. Clique no card na coluna **ENTRADA**
2. Clique em **"Avançar Etapa"** ou **"Assumir"**
3. A solicitação move para **COTAÇÃO**

#### Passo 2 — Registrar Cotação
1. Clique em **"Abrir Cotação"** no card
2. No modal, vá para a aba **COTAÇÕES**
3. Preencha:
   - **Distribuidor** (obrigatório)
   - **Nº Orçamento**
   - **Modalidade:** Venda / Locação / Serviços
   - **Itens** (tabela): Descrição, Quantidade, Custo Unitário
4. Clique em **"Salvar Cotação"**
5. Repita para múltiplos distribuidores se necessário

#### Passo 3 — Enviar para Precificação
1. Ainda no modal de Cotação, aba **PRECIFICAÇÃO**
2. Clique em **"Enviar para Precificação"**
3. O sistema salva os dados e abre automaticamente a **Calculadora de Precificação** com os custos já preenchidos
4. Calcule o preço de venda na calculadora
5. Salve o resultado

#### Passo 4 — Revisar e Devolver ao Comercial
1. De volta em Solicitações, clique em **"Avançar Etapa"** (coluna PRECIFICAÇÃO → REVISÃO)
2. No modal de Resposta, preencha:
   - **Mensagem/Observações** para o Comercial
   - **Valor Sugerido (R$)**
   - **Custo Total (R$)**
   - **Margem de Lucro (%)**
   - Número da Proposta vinculada (se aplicável)
3. Clique em **"Enviar Resposta"**
4. A solicitação muda para **DEVOLVIDA** e a atividade original no B2B é atualizada automaticamente

### Cancelando uma Solicitação
Clique em **"Cancelar"** em qualquer etapa. Se a solicitação veio de uma atividade B2B, o status da atividade original será atualizado para **Cancelada** automaticamente.

### Sincronização Bidirecional
Todas as atualizações de status no Pré-Vendas refletem automaticamente na atividade original do Comercial (B2B ou B2G). Não é necessário atualizar manualmente em dois lugares.

---

## 3. Orçamentos

**Caminho:** Pré-Vendas → Orçamentos

### O que é
Visão consolidada de todos os orçamentos registrados no Pré-Vendas, com capacidade de criação manual de orçamentos não vinculados a solicitações do Comercial.

### KPIs
- Total de orçamentos no período
- Em aberto
- Valor total
- Média por solicitação

### Como Criar um Orçamento Manual
1. Clique em **"Novo Orçamento"**
2. Preencha a **Etapa 1 — Dados da Solicitação:**
   - Título (obrigatório)
   - Descrição
   - Nome do Cliente
   - Modalidade: Venda / Locação / Serviço
   - Quem solicitou (dropdown de usuários)
   - Para quem encaminhar (dropdown de usuários)
   - Oportunidade ID (opcional — vincula à oportunidade)
   - Prioridade
   - Prazo esperado
3. Preencha a **Etapa 2 — Itens Solicitados:**
   - Adicione linhas com: Descrição, Quantidade, Custo Unitário, ICMS Compra %
4. Clique em **"Criar Orçamento"**

### Registrando Custos de Distribuidores
1. Abra o orçamento e clique em **"Custos de Distribuidores"**
2. Para cada cotação, informe:
   - Modalidade: Venda / Locação / Serviços
   - Distribuidor (obrigatório)
   - Número do Orçamento
   - Itens: Descrição, Quantidade, Custo Unitário
3. Clique em **"Salvar"**

### Ação Precificar
Após registrar os custos, clique em **"Precificar"** para abrir automaticamente a calculadora de precificação com os custos já importados.

---

## 4. Distribuidores e Fornecedores

**Caminho:** Pré-Vendas → Distribuidores / Fornecedores

### O que é
Cadastro das empresas parceiras que fornecem produtos e serviços para cotação. Distribuidores são usados no fluxo de cotação das Solicitações.

---

## 5. Registro de Oportunidades

**Caminho:** Pré-Vendas → Registro de Oportunidades

### O que é
Controle formal de oportunidades técnicas registradas pelo Pré-Vendas junto a fabricantes ou distribuidores. Cada registro tem prazo de validade e precisa ser renovado periodicamente.

---

## 6. Calculadoras

**Caminho:** Pré-Vendas → Calculadoras

### O que é
Ferramentas de cálculo rápido para venda, locação e serviços. Complementam as calculadoras do módulo Simuladores.

---

## 7. Precificação

**Caminho:** Pré-Vendas → Precificação

### O que é
DRE Gerencial, simulador de margens, analytics e calculadora de rateio de despesas. Permite calcular o preço de venda considerando todos os custos: impostos, comissões, despesas operacionais e margem de lucro desejada.

---

## 8. Gestão de POCs

**Caminho:** Pré-Vendas → Gestão de POCs

### O que é
Controle de Provas de Conceito (POCs) — testes técnicos realizados para demonstrar a solução ao cliente antes da compra. Cada POC tem etapas, responsáveis, equipamentos envolvidos e prazo.


---

# Módulo Gestão

## Visão Geral

O módulo Gestão concentra as ferramentas administrativas e estratégicas: catálogo de produtos, equipe comercial, comissões, metas, relatórios e pós-venda. É voltado para gestores e administradores que precisam acompanhar o desempenho geral da operação.

**Acesso:** Menu lateral → seção **GESTÃO**

**Perfis com acesso:** MASTER, ADMIN

---

## 1. Produtos

**Caminho:** Gestão → Produtos

### O que é
Catálogo centralizado de produtos e serviços oferecidos pela empresa. Os produtos cadastrados aqui podem ser referenciados nos orçamentos do Pré-Vendas e nas propostas comerciais.

### KPIs do Painel
- **Total:** quantidade de produtos cadastrados
- **Ativos:** produtos disponíveis para uso
- **Inativos:** produtos desativados
- **Preço Médio:** média de valores do catálogo

### Como Cadastrar um Produto
1. Clique em **"Novo Produto"**
2. Preencha:
   - **Nome** (obrigatório)
   - **Descrição:** detalhes técnicos ou comerciais do produto
   - **Categoria:** agrupamento livre (ex: "Internet", "PABX", "Serviços Gerenciados")
   - **Preço (R$):** preço de venda padrão
   - **Margem (%):** margem de lucro esperada
   - **Ativo:** toggle para ativar/desativar o produto
3. Clique em **Salvar**

### Ativando/Desativando Produtos
Clique diretamente no toggle de status na linha da tabela para ativar ou desativar um produto sem abrir o formulário de edição. Mudança imediata, sem confirmação adicional.

### Filtros
- **Busca textual:** nome ou categoria
- **Categoria:** filtra por agrupamento específico
- **Status:** Ativo / Inativo

---

## 2. Vendedores

**Caminho:** Gestão → Vendedores

### O que é
Gestão completa da equipe comercial: cadastro de vendedores, configuração de metas e organização por regiões.

### Três abas disponíveis

#### Aba Vendedores/Pré-Vendas
Lista toda a equipe com dados de contato, função, região e acesso por módulo (B2B/B2G).

**Informações exibidas por vendedor:**
- Nome e e-mail
- Função (Vendedor, Pré-Vendas, Diretor, Gerente, Admin)
- Região atribuída
- Módulos com acesso (B2B / B2G)
- Cota mensal (R$)
- Comissões configuradas

**Como Cadastrar um Vendedor**
1. Clique em **"Novo Vendedor"** (disponível apenas para ADMIN/MASTER)
2. Preencha:
   - **Nome** e **E-mail** (obrigatórios)
   - **Senha** inicial
   - **Função:** Vendedor / Pré-Vendas / Gerente / Diretor / Admin
   - **Região:** região comercial de atuação
   - **Cota Mensal (R$):** meta mensal de vendas
   - **Comissões:** percentuais por tipo de projeto:
     - Venda Pontual (%)
     - Projetos 12, 24, 36, 48, 60 meses (%)
   - **Acesso por módulo:** B2B e/ou B2G
3. Clique em **Salvar**

> **Importante:** ao selecionar a função, o acesso por módulo é ajustado automaticamente. Funções como Pré-Vendas perdem acesso ao B2B/B2G automaticamente.

#### Aba Metas
Define e acompanha as metas de vendas por vendedor e período. Cada meta tem:
- Vendedor responsável
- Período (mês/ano)
- Valor alvo (R$)
- Valor realizado (calculado automaticamente)
- % de atingimento

#### Aba Regiões
Cadastro de regiões comerciais para segmentar carteiras:
- Nome da região
- Descrição/cobertura geográfica
- Vendedores atribuídos

---

## 3. Comissões

**Caminho:** Gestão → Comissões

### O que é
Controle de comissões devidas aos vendedores por oportunidades ganhas. O sistema calcula automaticamente o valor da comissão com base nas regras configuradas por vendedor.

### KPIs
- **Total Pendente:** comissões aguardando aprovação
- **Total Aprovado:** comissões aprovadas mas ainda não pagas
- **Total Pago:** comissões já liquidadas no período
- **Cancelado:** comissões canceladas

### Como Funciona o Cálculo
Ao ganhar uma oportunidade, o sistema verifica:
1. Se o projeto é **Pontual** → aplica `commissionSalePercentage`
2. Se o projeto é **Mensal** → aplica `commissionProject{meses}` correspondente ao prazo do contrato

**Exemplo:** Oportunidade de R$ 50.000 com projeto de 36 meses e vendedor com `commissionProject36 = 3,6%` → comissão = R$ 1.800,00

### Status das Comissões
| Status | Significado | Transição |
|---|---|---|
| Pendente | Calculada, aguardando aprovação | → Aprovada ou Cancelada |
| Aprovada | Aprovada pelo gestor | → Paga ou Cancelada |
| Paga | Pagamento confirmado | (estado final) |
| Cancelada | Cancelada por qualquer motivo | (estado final) |

### Como Registrar uma Comissão Manualmente
1. Clique em **"Nova Comissão"**
2. Preencha:
   - **Oportunidade:** ID da oportunidade referente
   - **Vendedor:** responsável pela venda
   - **Tipo de Projeto:** Pontual (SINGLE) / Mensal (MONTHLY)
   - **Número de Meses** (se mensal)
   - **Percentual (%):** taxa de comissão aplicada
   - **Valor (R$):** valor calculado
3. Clique em **Salvar**

### Aprovando e Marcando como Pago
Na tabela de comissões:
- **Aprovar:** clique no botão de aprovação na linha (status Pendente → Aprovada)
- **Marcar como Pago:** clique no botão correspondente (status Aprovada → Paga)
- **Cancelar:** disponível em qualquer status não final

### Filtros
- **Vendedor:** filtra por membro da equipe
- **Status:** Pendente / Aprovada / Paga / Cancelada
- **Período:** mês e ano de referência

---

## 4. Metas & Performance

**Caminho:** Gestão → Metas & Performance

### O que é
Acompanhamento visual do desempenho individual e coletivo da equipe. Exibe o progresso de cada vendedor em relação às suas metas mensais com indicadores de % de atingimento.

---

## 5. Gestão de Kickoff

**Caminho:** Gestão → Gestão de Kickoff

### O que é
Controle de reuniões de kickoff de projetos. Registra participantes (internos e externos), plataforma da reunião, pauta, ações definidas e responsáveis por cada ação.

### Campos do Kickoff
- **Título** e **Descrição**
- **Data e Hora**
- **Plataforma:** Meet / Teams / Zoom / Presencial / Telefone / Outro
- **Projeto/Oportunidade** vinculada
- **Participantes:**
  - Internos: colaboradores da empresa
  - Externos: contatos do cliente
  - Papel: Organizador / Interno / Externo
  - Status: Convidado / Confirmado / Recusado / Presente
- **Ações pós-reunião:** tarefa, responsável, prazo, status

### Status das Ações
| Status | Significado |
|---|---|
| Pendente | Ação definida, aguardando início |
| Em Andamento | Em execução |
| Concluído | Finalizado |
| Cancelado | Não será executado |

---

## 6. Pós-Venda

**Caminho:** Gestão → Pós-Venda

### O que é
Registro e acompanhamento do relacionamento com clientes após a venda. Controla chamados, SLA, renovações e NPS (satisfação do cliente).

---

## 7. Relatórios

**Caminho:** Gestão → Relatórios

### O que é
Central de inteligência comercial com 7 tipos de relatório, filtros cruzados e exportação CSV. Todos os cálculos são feitos em tempo real a partir dos dados do sistema.

### Tipos de Relatório

#### 1. Relatório Executivo
Visão de alto nível para diretoria e gestão sênior.
- Receita fechada no período
- Forecast ponderado (probabilidade × valor)
- Taxa de conversão
- Ticket médio

#### 2. Relatório de Pipeline
Análise detalhada do funil de vendas.
- Pipeline total em aberto
- Distribuição por etapa
- Valor na etapa de maior concentração
- Propostas enviadas aguardando retorno

#### 3. Relatório de Vendedores
Performance individual da equipe.
- Líder em receita fechada
- Vendedores com oportunidades ativas
- Melhor taxa de conversão
- Forecast consolidado da equipe

#### 4. Relatório de Clientes
Análise da base de clientes e leads.
- Total de clientes no período filtrado
- Leads quentes (score 80+)
- Distribuição B2B vs B2G
- Novos clientes no período

#### 5. Relatório de Atividades
Produtividade da equipe comercial.
- Total de atividades no período
- Atividades atrasadas
- Taxa de atraso (%)
- Responsáveis com mais atividades

#### 6. Relatório de Contratos
Saúde da carteira de contratos.
- Contratos ativos
- Valor mensal recorrente
- Contratos vencendo em 90 dias (alerta)
- Total histórico

#### 7. Relatório de Perdas
Análise de oportunidades perdidas.
- Valor total perdido no período
- Quantidade de perdas
- Principal motivo de perda
- Canal/origem com maior taxa de perda

### Filtros Disponíveis
Todos os filtros aplicam-se simultaneamente a todos os tipos de relatório:

| Filtro | Opções |
|---|---|
| **Período** | 30 dias / 90 dias / 6 meses / 12 meses / Todo histórico |
| **Tipo de Negócio** | Todos / B2B / B2G / B2C |
| **Etapa** | Qualquer etapa do funil |
| **Responsável** | Dropdown com todos os usuários |
| **Origem** | Canal de geração da oportunidade |
| **Status** | Status de empresas/atividades/contratos |
| **Valor Mínimo (R$)** | Filtra oportunidades acima de um valor |
| **Busca Textual** | Título, empresa, responsável |

### Exportação CSV
Clique em **"Exportar CSV"** para baixar todas as oportunidades filtradas com os campos:
Número, Oportunidade, Cliente, Tipo, Etapa, Responsável, Origem, Valor, Probabilidade, Previsão de Fechamento, Última Atualização.

---

# Fluxos Integrados entre Módulos

## Fluxo Principal B2B

```
Lead captado (Leads)
    ↓
Score calculado automaticamente
    ↓
Lead distribuído para vendedor
    ↓
Empresa muda status: LEAD → PROSPECT
    ↓
Oportunidade criada no Pipeline (Oportunidades)
    ↓
Atividades de acompanhamento registradas
    ↓
Solicitação de Orçamento enviada para Pré-Vendas
    ↓
Pré-Vendas realiza cotação e precificação
    ↓
Proposta devolvida ao Comercial
    ↓
Oportunidade avança para PROPOSTA → NEGOCIAÇÃO → GANHOU
    ↓
Contrato gerado
    ↓
Comissão calculada e aprovada
    ↓
Relatórios atualizados
```

## Fluxo Principal B2G

```
Edital identificado (Portal de Busca ou manual)
    ↓
Análise com IA (Análise Editais/TR)
    ↓
Score de aderência calculado (GO / GO COM RESSALVAS / NO GO)
    ↓
Se GO: convertido em Oportunidade B2G
    ↓
Pipeline B2G: ANÁLISE → PROPOSTA ENVIADA → HABILITAÇÃO
    ↓
Documentação checada (Documentação B2G)
    ↓
Proposta enviada ao órgão
    ↓
HOMOLOGADO → CONCLUÍDO → GANHO
    ↓
Relatórios Estratégicos atualizados
```

## Fluxo Pré-Vendas

```
Solicitação recebida (via B2B/B2G ou criada diretamente)
    ↓
Fila ENTRADA → Equipe assume
    ↓
Fila COTAÇÃO → Cotações com distribuidores registradas
    ↓
Fila PRECIFICAÇÃO → Calculadora abre com custos importados
    ↓
Preço de venda calculado e aprovado internamente
    ↓
Fila REVISÃO → Proposta revisada
    ↓
DEVOLVIDA → Comercial recebe proposta
    ↓
Atividade original no B2B atualizada automaticamente
```

---

# Perfis de Acesso e Módulos Disponíveis

| Perfil | B2B | B2G | Pré-Vendas | Gestão | Administração |
|---|:---:|:---:|:---:|:---:|:---:|
| **MASTER** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **USER** | ✅* | ✅* | ❌ | ❌ | ❌ |
| **USER_B2B** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **USER_B2G** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **PRE_SALES** | ❌ | ❌ | ✅ | ❌ | ❌ |

*USER genérico: acesso B2B e/ou B2G depende da configuração individual do usuário (campos `accessB2B` e `accessB2G`).

---

*Documentação gerada automaticamente pelo sistema — CRM Nexos v2026.08*
