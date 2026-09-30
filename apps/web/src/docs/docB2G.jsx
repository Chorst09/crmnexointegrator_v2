// Conteúdo de documentação do Módulo B2G

export const docB2GContent = [
  {
    title: '📋 O que é este módulo?',
    content: `O módulo B2G gerencia o relacionamento com órgãos governamentais e o acompanhamento de licitações públicas. Possui pipeline próprio com etapas específicas do processo licitatório e integração com IA para análise de editais e Termos de Referência.`
  },
  {
    title: '🏛️ Cadastro de Órgãos',
    content: `Acesse: B2G Governo → Órgãos.

Como cadastrar:
1. Clique em "Novo Órgão".
2. Preencha: Nome do Órgão (obrigatório), CNPJ/Código, Esfera/Área (Federal, Estadual, Municipal, Saúde, Educação, etc.).
3. Selecione Porte e Status (Lead / Prospect / Ativo / Inativo).
4. Informe o Contato do órgão: Nome, Email, Telefone, Cargo.
5. Informe o Contato Administrativo (responsável por processos/contratos).
6. Clique em Salvar.`
  },
  {
    title: '🔍 Portal de Busca de Editais',
    content: `Acesse: B2G Governo → Portal de Busca.

Use para encontrar licitações no PNCP (Portal Nacional de Contratações Públicas) e outras fontes públicas.

Como usar:
1. Digite palavras-chave do seu produto ou serviço.
2. Filtre por UF, período e modalidade.
3. Clique em um edital para ver os detalhes.
4. Clique em "Adicionar ao Pipeline" para criar uma oportunidade B2G.`
  },
  {
    title: '📋 Pipeline de Oportunidades B2G',
    content: `Etapas do funil licitatório:
ANÁLISE → PROPOSTA ENVIADA → HABILITAÇÃO → RECURSO → SUSPENSO → HOMOLOGADO → CONCLUÍDO → GANHO / NO GO / PERDIDO

Status dos editais:
• Monitorando — em observação.
• Análise em Andamento — sendo avaliado.
• Análise Concluída — GO/NO GO definido.
• Proposta em Preparação — equipe preparando proposta.
• Enviada — proposta enviada ao órgão.
• Suspensa — licitação suspensa pelo órgão.
• Encerrada — processo encerrado.`
  },
  {
    title: '📁 Documentação B2G',
    content: `Acesse: B2G Governo → Documentação.

Controla a validade dos documentos de habilitação:

Categorias:
• Jurídico — Contrato Social, atos constitutivos.
• Fiscal — Certidões negativas (Federal, Estadual, Municipal, FGTS, Trabalhista).
• Técnico — Atestados de capacidade, certificações.
• Habilitação — documentos específicos do edital.
• Financeiro — Balanço patrimonial, demonstrações contábeis.

Status de validade:
• ✅ Válido — dentro do prazo.
• ⚠️ Vencendo — vence em até 30 dias (alerta automático).
• ❌ Expirado — fora do prazo, precisa renovar.`
  },
  {
    title: '⚡ Provedores de IA (Fallback Automático)',
    content: `A análise tenta os provedores em sequência, usando o próximo se o anterior falhar:

1. Gemini (Google — gemini-2.5-flash)
2. Groq (llama-3.3-70b-versatile)
3. Mistral (mistral-large-latest)

Isso garante que a análise seja concluída mesmo que um provedor esteja indisponível.`
  }
];
