// Test script para validar b2bDashboardAnalytics localmente
import { buildB2BDashboardAnalytics } from './backend/lib/b2bDashboardAnalytics.js';

// Dados de exemplo simulando oportunidades reais
const mockOpportunities = [
  {
    id: '1',
    title: 'Oportunidade Teste 1',
    stage: 'LEAD',
    value: 10000,
    probability: 25,
    leadEntryDate: new Date('2026-01-15'),
    expectedCloseDate: new Date('2026-03-30'),
    actualCloseDate: null,
    exitDate: null,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-02-01'),
    leadSourceDetail: 'Indicação',
    source: 'INDICATION',
    projectTower: 'Security',
    projectClientType: 'NEW_CLIENT',
    company: { id: 'c1', name: 'Empresa A' },
    owner: { id: 'u1', name: 'Vendedor 1' }
  },
  {
    id: '2',
    title: 'Oportunidade Teste 2',
    stage: 'PROPOSAL',
    value: 25000,
    probability: 75,
    leadEntryDate: new Date('2026-02-10'),
    expectedCloseDate: new Date('2026-04-15'),
    actualCloseDate: null,
    exitDate: null,
    createdAt: new Date('2026-02-10'),
    updatedAt: new Date('2026-03-01'),
    leadSourceDetail: 'Website',
    source: 'WEBSITE',
    projectTower: 'Infrastructure',
    projectClientType: 'BASE_CLIENT',
    company: { id: 'c2', name: 'Empresa B' },
    owner: { id: 'u1', name: 'Vendedor 1' }
  },
  {
    id: '3',
    title: 'Oportunidade Teste 3',
    stage: 'WON',
    value: 50000,
    probability: 100,
    leadEntryDate: new Date('2026-03-05'),
    expectedCloseDate: new Date('2026-04-30'),
    actualCloseDate: new Date('2026-04-25'),
    exitDate: null,
    createdAt: new Date('2026-03-05'),
    updatedAt: new Date('2026-04-25'),
    leadSourceDetail: 'Campanha',
    source: 'MARKETING',
    projectTower: 'Security',
    projectClientType: 'NEW_CLIENT',
    company: { id: 'c3', name: 'Empresa C' },
    owner: { id: 'u2', name: 'Vendedor 2' }
  }
];

console.log('===== TESTE DA FUNÇÃO buildB2BDashboardAnalytics =====\n');
console.log(`Total de oportunidades mock: ${mockOpportunities.length}\n`);

const analytics = buildB2BDashboardAnalytics(mockOpportunities, { period: 'year' });

console.log('Estrutura do retorno:');
console.log('- kpis:', !!analytics.kpis ? 'OK' : 'MISSING');
console.log('- timeline:', !!analytics.timeline ? 'OK' : 'MISSING');
console.log('- insights:', !!analytics.insights ? 'OK' : 'MISSING');
console.log('- charts:', !!analytics.charts ? 'OK' : 'MISSING');
console.log();

console.log('KPIs:');
console.log(JSON.stringify(analytics.kpis, null, 2));
console.log();

console.log(`Timeline length: ${analytics.timeline?.length || 0}`);
if (analytics.timeline && analytics.timeline.length > 0) {
  console.log('Primeira entrada da timeline:');
  console.log(JSON.stringify(analytics.timeline[0], null, 2));
  console.log();
  console.log('Última entrada da timeline:');
  console.log(JSON.stringify(analytics.timeline[analytics.timeline.length - 1], null, 2));
}
console.log();

console.log('Charts disponíveis:', Object.keys(analytics.charts || {}));
console.log();

console.log('Insights disponíveis:', Object.keys(analytics.insights || {}));
console.log();

if (analytics.insights) {
  console.log('Insights.stageRows length:', analytics.insights.stageRows?.length || 0);
  console.log('Insights.temperatureRows length:', analytics.insights.temperatureRows?.length || 0);
  console.log('Insights.agingRows length:', analytics.insights.agingRows?.length || 0);
  console.log('Insights.riskRows length:', analytics.insights.riskRows?.length || 0);
  console.log('Insights.towerRows length:', analytics.insights.towerRows?.length || 0);
  console.log('Insights.clientTypeRows length:', analytics.insights.clientTypeRows?.length || 0);
}
console.log();

console.log('===== ESTRUTURA COMPLETA DE RETORNO =====');
console.log(JSON.stringify({
  period: analytics.period,
  kpis: analytics.kpis,
  'charts.keys': Object.keys(analytics.charts || {}),
  'insights.keys': Object.keys(analytics.insights || {})
}, null, 2));

console.log('===== FIM DO TESTE =====');
