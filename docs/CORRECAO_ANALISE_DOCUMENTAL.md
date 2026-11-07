# Correção da análise de editais

O endpoint `/api/analise-tr/processar-arquivo` retornava um modelo fixo com
R$ 150 mil, datas de setembro de 2026 e exigências genéricas. O texto extraído
do PDF não participava da ficha. A interface ainda gerava e salvava outro
modelo fixo se a API falhasse. Ambos os comportamentos foram removidos.

A implementação lê todos os PDFs, DOCX e DOC enviados. A extração é textual e
conservadora: apenas campos identificados no conteúdo são preenchidos, com
trechos de evidência. Não depende de uma chave de IA. Valores divergentes ou
campos não identificados permanecem desconhecidos; itens só entram na matriz
quando uma linha completa permite extrair descrição, unidade, quantidade e
preços com segurança. Tabelas complexas podem exigir conferência manual.
PDFs sem texto devem receber OCR antes do envio. Um arquivo ilegível gera erro
422 e não uma análise bem-sucedida com conteúdo inventado.

Dependências do servidor: `pdftotext` (pacote `poppler-utils`), `antiword`,
Python 3 e `pdf-parse` (alternativa de extração de PDF se o utilitário não existir).
Originais ficam em `backend/private/edital-analysis`, com permissões restritas,
agrupados por tenant/usuário e identificados pelo SHA-256. Não são expostos como
uploads públicos. A rotina completa do Google Drive inclui essa pasta.

Fichas antigas reconhecidas pelo conteúdo do modelo são marcadas como
`requires_reanalysis`. Valores, datas, itens e exigências fictícios deixam de
aparecer no relatório. Elas não podem ser salvas como válidas nem convertidas
em oportunidades antes da reanálise. O usuário abre a ficha na bancada, anexa
os documentos originais e analisa novamente, preservando o identificador.
O sistema antigo não guardou os arquivos, portanto não é possível reconstruir
seu conteúdo a partir das fichas incorretas.

Antes da correção dos três registros no servidor, foi criado e verificado o
dump `/BACKUP/pre-correction-edital-analysis-20261022.dump`. O conteúdo anterior
permanece no backup; os registros foram sinalizados e os campos principais de
valor e data inventados foram anulados.

Validação: oito testes de regressão; envio real de dois PDFs de teste com órgãos,
datas e orçamentos diferentes; extração de DOCX; gravação de campos ausentes como
desconhecidos; bloqueio de arquivos inválidos e de fichas sintéticas antigas.

## Conversão e persistência

O adaptador legado do Prisma trocava o banco real por dados de demonstração em
memória após qualquer erro de SQL. Um `WHERE id = $1::uuid` aplicado a uma coluna
varchar ativou esse comportamento. As consultas agora comparam os identificadores
como texto, e uma conexão configurada exporta o cliente real, preservando erros e
transações. Produção sem DATABASE_URL válida não inicia esse módulo.

A conversão lê uma análise efetivamente salva, executa criação e vínculo em uma
transação e serializa a numeração e os cliques concorrentes. Uma nova tentativa
retorna a oportunidade já vinculada. O órgão existente pode ser identificado pelo
CNPJ extraído do contexto do contratante; usuários continuam sujeitos ao tenant,
e o MASTER também pode reutilizar órgãos globais.

A análise do Edital 002/2026 foi preservada de memória em arquivo protegido,
reprocessada a partir do PDF arquivado e recuperada no banco doublecrm para o
usuário real. O PARANACIDADE foi reconhecido no documento e associado ao cadastro
existente pelo CNPJ. A oportunidade B2G-2026-00010 foi criada, com orçamento de
R$ 7.990.800,00, e um segundo clique confirmou que não há duplicação.
