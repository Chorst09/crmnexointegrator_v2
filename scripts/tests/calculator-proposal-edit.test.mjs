import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { summarizeCalculatorSnapshot } from '../../apps/web/src/utils/calculator-proposal.mjs';
const source = await readFile(new URL('../../apps/web/src/pages/Calculadoras.jsx', import.meta.url), 'utf8');
const build = source.slice(source.indexOf('  const buildCurrentProposalPayload'), source.indexOf('  const saveCurrentProposal'));
const save = source.slice(source.indexOf('  const saveCurrentProposal'), source.indexOf('  const sendProposalToPreSalesReview'));
const persist = source.slice(source.indexOf('  const persistSavedProposals'), source.indexOf('  const createBlankProposal'));
const proposal = {
  id: 'existing', number: 'ORC-0002-2026', calculatorType: 'mixed', calculatorLabel: 'Proposta Mista',
  pricing: { regimeId: 'regime', desiredMargin: 20, rentalPeriod: 36 },
  preSales: { requestId: 'request-123' },
  snapshot: {
    saleItems: [{ id: 'sale', quantity: 1, unitCost: 10, calculation: { rbUnitario: 200 } }],
    rentalItems: [{ id: 'rent', quantity: 3, calculation: { rbUnitario: 100 }, pricing: { rentalPeriod: 36 } }],
    serviceItems: [{ id: 'service', estimatedHours: 12, billingType: 'PONTUAL', calculation: { totalSellPrice: 50, totalCost: 20 } }]
  }
};
const clone = (v) => JSON.parse(JSON.stringify(v));
function harness() {
  const store = new Map();
  const context = {
    Date, JSON, Map, console, summarizeCalculatorSnapshot, deepClone: clone,
    toNumber: (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback,
    proposalForm: { number: proposal.number, clientCompany: 'Cliente', clientContact: '', clientPhone: '', clientEmail: '', managerName: '', managerEmail: '', managerPhone: '' },
    opportunities: [], currentTab: 'servicos', operationType: 'servicos', vendasData: { regimeTributario: 'regime' }, desiredMargin: 20, destinationUF: 'SP', rentalPeriod: 36, isIcmsContributor: false,
    proposalCart: { sales: [], rentals: [], services: [] },
    saleItems: clone(proposal.snapshot.saleItems), rentalItems: clone(proposal.snapshot.rentalItems), serviceItems: clone(proposal.snapshot.serviceItems),
    DEFAULT_SALE_ITEM: {}, DEFAULT_RENTAL_ITEM: {}, DEFAULT_SERVICE_ITEM: {},
    editingProposalRef: { current: clone(proposal) }, activeProposalId: proposal.id, savedProposals: [clone(proposal)],
    calculationPreview: { calculationResults: { itemCalculations: {}, finalPrice: 50 } },
    calculatorSettings: { regimesTributarios: [], custosDespesas: {}, maoDeObra: {} }, ICMS_PR_ALIQUOTAS: {},
    distributorCosts: [], preSalesSource: null,
    calculateOperation: () => ({ calculationResults: { itemCalculations: { service: { totalSellPrice: 50, totalCost: 20 } } } }),
    CALCULATOR_PROPOSALS_STORAGE_KEY: 'local', CALCULATOR_PROPOSALS_SESSION_KEY: 'session',
    localStorage: { setItem: (key, value) => store.set(key, value) }, sessionStorage: { removeItem: (key) => store.delete(key), setItem: (key, value) => store.set(key, value) },
    setSavedProposals: (value) => { context.savedProposals = value; }, setActiveProposalId: () => {}, setProposalForm: () => {}, setProposalSearchNumber: () => {}, setProposalFeedback: (value) => { context.feedback = value; }, createItemId: () => 'new'
  };
  vm.createContext(context);
  vm.runInContext(persist + build + save + '\nthis.save = saveCurrentProposal;', context);
  return { context, store };
}
test('editing a mixed proposal persists monthly service and preserves sale, rental, identity and request link', () => {
  const { context, store } = harness();
  context.serviceItems[0].billingType = 'MENSAL';
  context.serviceItems[0].servicePeriod = 36;
  const saved = context.save();
  const reloaded = JSON.parse(store.get('local'))[0];
  assert.equal(reloaded.id, proposal.id);
  assert.equal(reloaded.snapshot.serviceItems[0].billingType, 'MENSAL');
  assert.deepEqual(reloaded.snapshot.saleItems, proposal.snapshot.saleItems);
  assert.deepEqual(reloaded.snapshot.rentalItems, proposal.snapshot.rentalItems);
  assert.equal(reloaded.result.monthlyPrice, 350);
  assert.equal(reloaded.result.finalPrice, 12800);
  assert.equal(reloaded.preSales.requestId, 'request-123');
  assert.equal(saved.calculatorType, 'mixed');
  assert.equal(context.savedProposals.length, 1);
});
test('storage failure never reports a successful save', () => {
  const { context } = harness();
  context.localStorage.setItem = () => { throw new Error('quota'); };
  context.sessionStorage.setItem = () => { throw new Error('quota'); };
  context.console = { error: () => {} };
  assert.equal(context.save(), null);
  assert.equal(context.feedback.type, 'error');
});
