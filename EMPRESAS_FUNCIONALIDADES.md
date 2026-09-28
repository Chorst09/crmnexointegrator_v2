# Funcionalidades Adicionadas - Menu Empresas

## Resumo das Alterações

Adicionadas as funcionalidades de **visualizar**, **editar** e **excluir** empresas na Lista de Empresas, com modal de visualização em abas.

## Funcionalidades Implementadas

### 1. Visualizar Empresa (👁️ Ícone de Olho)
Modal completo com sistema de abas para organizar informações:

#### Aba Cadastro
- Informações principais: nome, status, porte, score
- Dados cadastrais: CNPJ/CPF, segmento, website
- Localização completa (endereço, cidade, estado)
- Estatísticas: número de oportunidades e data de cadastro

#### Aba Contatos
- Lista todos os contatos da empresa
- Mostra nome, cargo, email e telefone
- Identifica contato principal
- Links clicáveis para email (mailto:) e telefone (tel:)
- Estado vazio quando não há contatos

#### Aba Oportunidades
- Lista todas as oportunidades vinculadas à empresa
- Mostra título, valor e estágio (stage)
- Descrição da oportunidade
- Cores diferenciadas por status (ganho/perdido/em andamento)
- Estado vazio quando não há oportunidades

#### Aba Contratos
- Lista todos os contratos vinculados à empresa
- Mostra título, número do contrato e status
- Exibe valor do contrato formatado
- Datas: início, término e renovação
- Descrição completa do contrato
- Termos contratuais
- SLA (Service Level Agreement)
- Cores diferenciadas por status:
  - Verde: Ativo
  - Vermelho: Expirado
  - Cinza: Cancelado
  - Amarelo: Pendente
- Estado vazio quando não há contratos

#### Aba Atividades
- Lista todas as atividades relacionadas à empresa
- Mostra título, data de vencimento e status
- Descrição da atividade
- Cores diferenciadas por status (completo/cancelado/pendente)
- Estado vazio quando não há atividades

#### Aba Documentos
- Preparada para futura implementação
- Mensagem informativa sobre desenvolvimento

### 2. Editar Empresa (✏️ Ícone de Lápis)
- Abre modal com formulário preenchido
- Permite atualizar todos os dados da empresa
- Validação de campos obrigatórios
- Pode ser acessado também pelo botão dentro do modal de visualização

### 3. Excluir Empresa (🗑️ Ícone de Lixeira)
- Confirmação antes de excluir
- Mensagem personalizada com nome da empresa
- Atualização automática da lista após exclusão
- Tratamento de erros

## Componentes Modificados

### `apps/web/src/pages/Empresas.jsx`

**Novos imports:**
```javascript
import { Target, Calendar, Paperclip, User, FileSignature } from 'lucide-react';
```

**Novos estados:**
```javascript
const [activeTab, setActiveTab] = useState('cadastro');
const [companyDetails, setCompanyDetails] = useState(null);
```

**Funções modificadas:**
- `openView(company)` - Agora carrega detalhes completos da empresa via API
- `closeViewModal()` - Limpa também activeTab e companyDetails

**Props adicionadas ao ModernTable:**
```javascript
onView={openView}
onEdit={openEdit}
onDelete={handleDelete}
```

### `apps/web/src/components/Modal.jsx`

**Nova prop:**
```javascript
size = 'default' // 'default' | 'large'
```

**Comportamento:**
- `default`: max-width de 900px
- `large`: max-width de 1200px (usado no modal de visualização de empresas)

## Interface do Usuário

### Botões de Ação na Tabela
Cada linha da tabela possui 3 botões:

1. **Visualizar** (azul) - Ícone de olho
2. **Editar** (verde) - Ícone de lápis
3. **Excluir** (vermelho) - Ícone de lixeira

### Modal de Visualização com Abas
Sistema de navegação por abas:
- **Cadastro**: Informações básicas e localização
- **Contatos**: Lista de contatos com dados de comunicação
- **Oportunidades**: Oportunidades vinculadas
- **Contratos**: Contratos ativos, expirados e pendentes
- **Atividades**: Atividades relacionadas
- **Documentos**: Em desenvolvimento

### Estados Vazios
Cada aba possui um estado vazio elegante quando não há dados:
- Ícone grande e semi-transparente
- Mensagem informativa
- Design consistente com o tema

## Recursos Visuais

- Design consistente com o tema do CRM
- Abas com indicador visual de aba ativa
- Ícones intuitivos para cada seção
- Cores diferenciadas para status
- Hover effects nos botões e abas
- Modal responsivo e bem organizado
- Links clicáveis para email e telefone
- Badge "Principal" para contato principal
- Modal maior (1200px) para melhor visualização

## Integração com API

O modal de visualização faz uma chamada adicional à API para carregar:
- Oportunidades relacionadas
- Contratos vinculados
- Atividades relacionadas
- Dados completos da empresa

Endpoint usado:
```javascript
GET /api/companies?id={companyId}
```

A resposta deve incluir:
```javascript
{
  id: string,
  name: string,
  // ... outros campos da empresa
  opportunities: [...],
  contracts: [...],
  activities: [...],
  contacts: [...]
}
```

## Segurança

- Confirmação obrigatória antes de excluir
- Tratamento de erros em todas as operações
- Validação de dados antes de enviar ao backend
- Loading states durante carregamento de dados

## Próximos Passos Sugeridos

1. ✅ Implementar sistema de abas no modal de visualização
2. ✅ Adicionar aba de Contatos
3. ✅ Adicionar aba de Oportunidades
4. ✅ Adicionar aba de Contratos
5. ✅ Adicionar aba de Atividades
6. ⏳ Implementar upload e listagem de documentos
7. ⏳ Adicionar gráficos de evolução nas abas
8. ⏳ Implementar filtros avançados (por porte, score, etc.)
9. ⏳ Adicionar ações em lote (excluir múltiplas empresas)
10. ⏳ Adicionar histórico de interações na aba de atividades
11. ⏳ Implementar exportação de dados da empresa
12. ⏳ Adicionar anexos aos contratos na aba de Contratos

## Como Testar

1. Acesse http://crm.chorstconsult.com.br
2. Faça login com admin@crm.com / admin123
3. Vá para o menu "Empresas"
4. Clique no ícone de olho (👁️) em qualquer empresa
5. Navegue pelas abas: Cadastro, Contatos, Oportunidades, Contratos, Atividades, Documentos
6. Teste os botões de Editar e Excluir

## Informações Exibidas por Aba

### Cadastro
- Nome, status, porte, score
- CNPJ/CPF, segmento, website
- Endereço completo
- Estatísticas gerais

### Contatos
- Nome, cargo
- Email (clicável)
- Telefone (clicável)
- Indicador de contato principal

### Oportunidades
- Título e valor
- Estágio (stage)
- Descrição
- Status visual por cor

### Contratos
- Título e número
- Status (Ativo/Expirado/Cancelado/Pendente)
- Valor do contrato
- Datas (início, término, renovação)
- Descrição completa
- Termos contratuais
- SLA

### Atividades
- Título e data
- Status (Completo/Cancelado/Pendente)
- Descrição
- Status visual por cor

### Documentos
- Em desenvolvimento
