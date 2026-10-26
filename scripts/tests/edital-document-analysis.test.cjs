const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeText, extractDocument } = require('../../apps/api/lib/document-analysis.cjs');
const { normalizeFicha, hasSampleRequirement } = require('../../apps/api/lib/ficha-normalizer.cjs');

test('different documents produce their own agency, budget, object and opening date', () => {
  const a = analyzeText([{ name: 'a.pdf', text: 'Órgão: Prefeitura de Alfa\nPregão Eletrônico\nObjeto: Aquisição de notebooks\nValor total estimado: R$ 250.800,25\nData de abertura: 04/11/2026 às 09:30\nNão será exigida amostra.' }]);
  const b = analyzeText([{ name: 'b.pdf', text: 'Contratante: Universidade Beta\nConcorrência Eletrônica\nObjeto: Contratação de links dedicados\nValor global estimado: R$ 1.820.000,00\nData de abertura: 09/12/2026 às 14:00\nSerá exigida prova de conceito.' }]);
  assert.equal(a.orgao_comprador, 'Prefeitura de Alfa');
  assert.equal(a.valor_estimado_total, 250800.25);
  assert.equal(b.valor_estimado_total, 1820000);
  assert.equal(b.orgao_comprador, 'Universidade Beta');
  assert.notEqual(a.resumo_executivo, b.resumo_executivo);
  assert.notEqual(a.data_abertura, b.data_abertura);
  assert.equal(hasSampleRequirement(a), false);
  assert.equal(hasSampleRequirement(b), true);
});
test('missing values, dates, items and obligations stay unknown, including a legitimate zero', () => {
  const f = analyzeText([{ name: 'unknown.pdf', text: 'Objeto: Consultoria técnica para melhoria de processos\nO orçamento é sigiloso.' }]);
  assert.equal(f.valor_estimado_total, null);
  assert.equal(f.data_abertura, 'Não identificado');
  assert.deepEqual(f.matriz_itens, []);
  assert.deepEqual(f.requisitos_habilitacao.exigencias_contabeis, []);
  assert.equal(f.pontos_de_atencao_risco.regras_vistoria.obrigatoria, null);
  assert.equal(normalizeFicha({ valor_estimado_total: 0 }).valor_estimado_total, 0);
});
test('all attachments participate in extraction, with exact numeric item rows only', () => {
  const f = analyzeText([{ name: 'edital.pdf', text: 'Órgão: Prefeitura Alfa\n1. DO OBJETO\nContratação de switches\nData de abertura: 04/11/2026' }, { name: 'tr.docx', text: 'Valor estimado total: R$ 70.000,00\n1 | Switch de acesso | UN | 10 | R$ 7.000,00 | R$ 70.000,00' }]);
  assert.equal(f.valor_estimado_total, 70000);
  assert.equal(f.matriz_itens.length, 1);
  assert.equal(f.matriz_itens[0].quantitativo, 10);
  assert.match(f.resumo_executivo, /switches/);
});
test('conflicting document totals are flagged instead of silently choosing a value', () => {
  const f = analyzeText([{ name: 'a.pdf', text: 'Valor total estimado: R$ 10.000,00\nFim.' }, { name: 'b.pdf', text: 'Valor total estimado: R$ 20.000,00\nFim.' }]);
  assert.equal(f.valor_estimado_total, null);
  assert.ok(f.analysisWarnings.some(s => /divergentes/.test(s)));
});
test('Brazilian thousands separators and complete PDF table rows keep their real quantities and prices', () => {
  const f = analyzeText([{ name: 'table.pdf', text: 'Objeto: Licenças de software\nValor total estimado: R$ 1.234\nItem Descrição Unidade Quantidade Valor Unitário Valor Total\n1 Licença de software UN 1.000 1,23 1.230,00' }]);
  assert.equal(f.valor_estimado_total, 1234);
  assert.equal(f.matriz_itens[0].quantitativo, 1000);
  assert.equal(f.matriz_itens[0].valor_estimado_unitario, 1.23);
});
test('previous fixed templates are marked invalid rather than reused', () => {
  const f = normalizeFicha({ id_licitacao: 'DOC-OLD', valor_estimado_total: 150000, resumo_executivo: 'O certame destina-se à contratação conforme especificado no documento X. O objeto abrange a aquisição e fornecimento de materiais e serviços técnicos sob demanda.', matriz_itens: [{ item_numero: 1 }], documentos_origem: { edital: 'original.pdf' } });
  assert.equal(f.analysisStatus, 'requires_reanalysis');
  assert.equal(f.valor_estimado_total, null);
  assert.deepEqual(f.matriz_itens, []);
  assert.equal(f.documentos_origem.edital, 'original.pdf');
  assert.equal(f.id_licitacao, 'DOC-OLD');
});
test('invalid placeholder uploads fail rather than returning a successful template', async () => {
  await assert.rejects(extractDocument({ name: 'fake.pdf', base64: 'JVBERi0xLjQKJcTl8uXr...' }), /inválido/);
});
test('frontend and API normalizers agree on cached legacy reports and unknown fields', async () => {
  const web = await import('../../apps/web/src/pages/licitacoes_components/ficha-normalizer.mjs');
  const raw = { valor_estimado_total: null, requisitos_habilitacao: {}, pontos_de_atencao_risco: {} };
  assert.deepEqual(web.normalizeFicha(raw), normalizeFicha(raw));
});
test('cover-page agency and actual object take precedence over contents and CNPJ labels', () => {
  const f = analyzeText([{ name: 'edital.pdf', text: 'Serviço Social Autônomo\nPARANACIDADE\nÍNDICE\n2. OBJETO .................................... 4\n3. VALOR MÁXIMO .............................. 5\nContratante: CNPJ\n2. OBJETO\n2.1 Contratação de serviços de datacenter e cloud storage.\n3. ESPECIFICAÇÕES E VALOR MÁXIMO\n3.1 O valor total máximo estimado para a contratação, no período de 60 meses,\né de R$ 7.990.800,00.' }]);
  assert.equal(f.orgao_comprador, 'Serviço Social Autônomo PARANACIDADE');
  assert.match(f.resumo_executivo, /Contratação de serviços/);
  assert.ok(!f.resumo_executivo.includes('......'));
  assert.equal(f.valor_estimado_total, 7990800);
});

test('draft catalog tables retain quantities and wrapped descriptions without inventing prices', () => {
  const text = [
    'MINUTA DE TERMO DE REFERÊNCIA',
    'SECRETARIA MUNICIPAL DE ADMINISTRAÇÃO E TECNOLOGIA DA INFORMAÇÃO',
    '1. OBJETO', '1.1. Contratação de infraestrutura de rede.',
    '1.2. Tabela de quantitativo:',
    ' ITEM      CÓDIGO                  DESCRIÇÃO                                    QTDE',
    ' 1         86.01.04.89106-7        Firewall de borda - pequeno porte             183       R$xx,xx     R$xx,xx',
    '                                   Serviço de Instalação e Configuração de',
    ' 2         02.30.04.89107-5                                                      183       R$xx,xx     R$xx,xx',
    '                                   Infraestrutura de TIC - Firewall',
    '                                   Ponto de acesso à rede de dados sem fio',
    ' 3         86.03.04.89112-0                                                      1.190     R$xx,xx     R$xx,xx',
    '                                   (access point) - ambiente interno',
    '                                                                                  TOTAL',
    '                                                                                 GLOBAL',
    '1.3. O custo estimado total é de R$XXX,XX.',
    '1.34.4.3. Deve ter certificações conforme regulamento da entidade: a do cabo'
  ].join('\n');
  const f = analyzeText([{ name: 'draft.pdf', text }]);
  assert.equal(f.orgao_comprador, 'SECRETARIA MUNICIPAL DE ADMINISTRAÇÃO E TECNOLOGIA DA INFORMAÇÃO');
  assert.equal(f.matriz_itens.length, 3);
  assert.equal(f.matriz_itens[1].especificacao_sucinta, 'Serviço de Instalação e Configuração de Infraestrutura de TIC - Firewall');
  assert.equal(f.matriz_itens[2].quantitativo, 1190);
  assert.match(f.matriz_itens[2].especificacao_sucinta, /ambiente interno/);
  assert.equal(f.matriz_itens[0].codigo_catalogo, '86.01.04.89106-7');
  assert.equal(f.matriz_itens[0].valor_estimado_unitario, null);
  assert.equal(f.valor_estimado_total, null);
  assert.equal(f.pricesWithheld, true);
  assert.equal(f.documentType, 'minuta_tr');
  assert.ok(!f.resumo_executivo.includes('Tabela'));
});
