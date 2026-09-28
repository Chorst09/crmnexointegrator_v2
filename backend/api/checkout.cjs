const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const MERCADO_PAGO_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || '';
const FORCE_SIMULATED_PAYMENT = process.env.FORCE_SIMULATED_PAYMENT === 'true';

const CHECKOUT_PLANS = {
  b2b: {
    id: 'b2b',
    name: 'B2B Privado',
    price: 98.00,
    description: 'Gestão de vendas B2B'
  },
  b2g: {
    id: 'b2g',
    name: 'B2G Governo',
    price: 110.90,
    description: 'Licitações e governo'
  },
  presales: {
    id: 'presales',
    name: 'Pré-Vendas',
    price: 105.90,
    description: 'Pré-vendas e POCs'
  },
  management: {
    id: 'management',
    name: 'Gestão',
    price: 129.90,
    description: 'Projetos, kickoff e operação'
  },
  automation: {
    id: 'automation',
    name: 'Automações',
    price: 149.90,
    description: 'Workflows e integrações'
  },
  completo: {
    id: 'completo',
    name: 'Plano Completo',
    price: 289.90,
    description: 'Todos os módulos do CRM'
  }
};

const normalizeString = (value, maxLen = 255) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
};

const buildCheckoutBaseUrl = (planId) => {
  const frontendUrl = String(process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || '').replace(/\/+$/, '');
  const baseUrl = frontendUrl || 'http://localhost:5173';
  return `${baseUrl}/checkout?plan=${encodeURIComponent(planId)}`;
};

router.post('/create-preference', async (req, res) => {
  try {
    const planId = normalizeString(req.body?.planId, 80).toLowerCase();
    const companyData = req.body?.companyData || {};
    const selectedPlan = CHECKOUT_PLANS[planId];

    if (!selectedPlan) {
      return res.status(400).json({ error: 'Plano inválido' });
    }

    const companyName = normalizeString(companyData.companyName, 220);
    const responsibleName = normalizeString(companyData.responsibleName, 180);
    const responsibleEmail = normalizeString(companyData.responsibleEmail, 220);
    const responsiblePhone = normalizeString(companyData.responsiblePhone, 40);

    if (!companyName || !responsibleName || !responsibleEmail) {
      return res.status(400).json({ error: 'Dados da empresa e responsável são obrigatórios' });
    }

    const subscriptionId = `checkout-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    if (FORCE_SIMULATED_PAYMENT || !String(MERCADO_PAGO_ACCESS_TOKEN || '').trim()) {
      return res.json({
        success: true,
        simulated: true,
        subscriptionId,
        preferenceId: `SIMULATED-${subscriptionId}`,
        paymentReference: `SIMULATED-${subscriptionId}`,
        message: 'Pagamento simulado aprovado'
      });
    }

    const checkoutBaseUrl = buildCheckoutBaseUrl(selectedPlan.id);
    const isTestMode = String(MERCADO_PAGO_ACCESS_TOKEN || '').trim().toUpperCase().startsWith('TEST-');
    const apiBaseUrl = String(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');

    const preference = {
      items: [
        {
          title: selectedPlan.name,
          description: selectedPlan.description,
          quantity: 1,
          unit_price: selectedPlan.price,
          currency_id: 'BRL'
        }
      ],
      payer: {
        name: responsibleName,
        email: responsibleEmail,
        phone: { number: responsiblePhone }
      },
      back_urls: {
        success: `${checkoutBaseUrl}&status=success&subscription=${encodeURIComponent(subscriptionId)}`,
        failure: `${checkoutBaseUrl}&status=failure&subscription=${encodeURIComponent(subscriptionId)}`,
        pending: `${checkoutBaseUrl}&status=pending&subscription=${encodeURIComponent(subscriptionId)}`
      },
      external_reference: subscriptionId
    };

    if (apiBaseUrl) {
      preference.notification_url = `${apiBaseUrl}/api/checkout/webhook`;
    }

    if (isTestMode) {
      preference.payment_methods = {
        excluded_payment_methods: [{ id: 'consumer_credits' }],
        excluded_payment_types: [
          { id: 'ticket' },
          { id: 'bank_transfer' },
          { id: 'atm' },
          { id: 'debit_card' }
        ]
      };
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });

    const mpData = await mpResponse.json().catch(() => ({}));
    if (!mpResponse.ok) {
      console.error('Erro do Mercado Pago ao criar preferência:', mpResponse.status, mpData);
      return res.status(502).json({ error: 'Erro ao criar preferência no Mercado Pago' });
    }

    const paymentUrl = mpData.init_point || mpData.sandbox_init_point || null;
    return res.json({
      success: true,
      subscriptionId,
      preferenceId: mpData.id,
      paymentUrl,
      initPoint: paymentUrl,
      sandboxInitPoint: mpData.sandbox_init_point || null,
      testMode: isTestMode
    });
  } catch (error) {
    console.error('Erro ao processar checkout:', error);
    return res.status(500).json({ error: 'Erro ao processar checkout' });
  }
});

router.post('/webhook', async (_req, res) => {
  res.status(200).json({ received: true });
});

module.exports = router;
