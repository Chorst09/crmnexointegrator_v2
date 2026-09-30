import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  CreditCard, 
  Building2, 
  Mail, 
  Phone, 
  User, 
  FileText,
  CheckCircle2,
  ArrowLeft,
  Shield,
  Lock
} from 'lucide-react';
import { API_ENDPOINTS, getHeaders } from '../config/api';

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');
  const checkoutStatus = String(searchParams.get('status') || '').toLowerCase();
  const queryPaymentId =
    searchParams.get('payment_id') ||
    searchParams.get('collection_id') ||
    searchParams.get('paymentId') ||
    '';
  
  const [step, setStep] = useState(1); // 1: Dados + Admin, 2: Pagamento
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmingReturn, setConfirmingReturn] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [preferenceId, setPreferenceId] = useState(null);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [formData, setFormData] = useState({
    // Dados da empresa
    companyName: '',
    document: '',
    email: '',
    phone: '',
    
    // Dados do responsável
    responsibleName: '',
    responsibleEmail: '',
    responsiblePhone: '',
    
    // Endereço
    zipCode: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });

  const plans = {
    b2b: {
      id: 'b2b',
      name: 'B2B Privado',
      price: 98.00,
      priceFormatted: 'R$ 98,00',
      description: 'Gestão de vendas B2B',
      features: ['Até 5 usuários', 'Gestão de oportunidades', 'Funil de vendas', 'Relatórios']
    },
    b2g: {
      id: 'b2g',
      name: 'B2G Governo',
      price: 110.90,
      priceFormatted: 'R$ 110,90',
      description: 'Licitações e governo',
      features: ['Até 5 usuários', 'Licitações eletrônicas', 'Documentação', 'RDC Eletrônico']
    },
    presales: {
      id: 'presales',
      name: 'Pré-Vendas',
      price: 105.90,
      priceFormatted: 'R$ 105,90',
      description: 'Pré-vendas e POCs',
      features: ['Até 5 usuários', 'POCs técnicas', 'Pré-vendas', 'Propostas técnicas']
    },
    management: {
      id: 'management',
      name: 'Gestão',
      price: 129.90,
      priceFormatted: 'R$ 129,90',
      description: 'Projetos, kickoff e operação',
      features: ['Até 5 usuários', 'Gestão de projetos', 'Kickoff interno e externo', 'Painéis executivos']
    },
    automation: {
      id: 'automation',
      name: 'Automações',
      price: 149.90,
      priceFormatted: 'R$ 149,90',
      description: 'Workflows e integrações',
      features: ['Até 5 usuários', 'Workflows visuais', 'Gatilhos e ações', 'Integrações']
    },
    completo: {
      id: 'completo',
      name: 'Plano Completo',
      price: 289.90,
      priceFormatted: 'R$ 289,90',
      description: 'Todos os módulos do CRM',
      features: ['Usuários ilimitados', 'Todos os módulos', 'Suporte prioritário', 'API completa']
    }
  };

  const selectedPlan = plans[planId] || plans.completo;
  const CHECKOUT_STORAGE_KEY = 'crm_checkout_pending_v1';

  const unwrapPayload = (raw) => {
    if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object') {
      return raw.data;
    }
    return raw;
  };

  const resolveLicensingPlan = (checkoutPlanId) => {
    return { planId: null, planCode: 'MENSAL' };
  };

  const resolveModuleAccess = (checkoutPlanId) => {
    const defaults = {
      accessB2B: false,
      accessB2G: false,
      accessPreSales: false,
      accessManagement: false,
      accessAutomation: false
    };
    const planKey = String(checkoutPlanId || '').trim().toLowerCase();
    if (planKey === 'b2b') return { ...defaults, accessB2B: true };
    if (planKey === 'b2g') return { ...defaults, accessB2G: true };
    if (planKey === 'presales') return { ...defaults, accessPreSales: true };
    if (planKey === 'management') return { ...defaults, accessManagement: true };
    if (planKey === 'automation') return { ...defaults, accessAutomation: true };
    return {
      accessB2B: true,
      accessB2G: true,
      accessPreSales: true,
      accessManagement: true,
      accessAutomation: true
    };
  };

  const loadPendingCheckout = () => {
    try {
      const raw = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const clearPendingCheckout = () => {
    localStorage.removeItem(CHECKOUT_STORAGE_KEY);
  };

  useEffect(() => {
    if (!planId || !plans[planId]) {
      navigate('/?error=plano-invalido');
    }
  }, [planId, navigate]);

  // Renderizar Wallet Brick do Mercado Pago quando a preferência for criada
  useEffect(() => {
    if (!preferenceId) return;

    const timer = setTimeout(() => {
      const container = document.getElementById('wallet_container');
      if (!container) return;
      container.innerHTML = '';

      try {
        const mpPublicKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY || 'TEST-ea423066-0567-48a7-800c-f1a39833ce5e';
        if (typeof window.MercadoPago === 'undefined') {
          setError('SDK do Mercado Pago não carregado. Atualize a página.');
          return;
        }
        const mp = new window.MercadoPago(mpPublicKey, { locale: 'pt-BR' });

        if (typeof mp.bricks === 'function') {
          mp.bricks().create('wallet', 'wallet_container', {
            initialization: { preferenceId }
          });
        } else {
          // Fallback: redirect
          window.location.href = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${preferenceId}`;
        }
      } catch (err) {
        console.error('Erro ao renderizar Wallet Brick:', err);
        window.location.href = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${preferenceId}`;
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [preferenceId]);

  useEffect(() => {
    if (!checkoutStatus) return;

    if (checkoutStatus === 'failure') {
      setStep(2);
      setError('Pagamento não aprovado. Tente novamente.');
      return;
    }

    if (checkoutStatus === 'pending') {
      setStep(2);
      setError('Pagamento pendente. Aguarde a confirmação do Mercado Pago.');
      return;
    }

    if (checkoutStatus !== 'success') return;

    if (!queryPaymentId) {
      setStep(2);
      setError('Não foi possível identificar o pagamento retornado pelo Mercado Pago.');
      return;
    }

    const pending = loadPendingCheckout();
    if (!pending?.companyData) {
      setStep(2);
      setError('Sessão de checkout expirada. Refaça o cadastro e pagamento.');
      return;
    }

    const pendingAdmin = pending?.adminUser || null;
    if (!pendingAdmin?.name || !pendingAdmin?.email || !pendingAdmin?.password) {
      setStep(2);
      setError('Dados do usuário admin não encontrados. Refaça o cadastro e pagamento.');
      return;
    }

    const runAutoConfirm = async () => {
      setStep(2);
      setLoading(true);
      setConfirmingReturn(true);
      setError('');
      setFormData(pending.companyData);
      setAdminForm({
        name: pendingAdmin.name,
        email: pendingAdmin.email,
        password: pendingAdmin.password,
        confirmPassword: pendingAdmin.password
      });

      try {
        const checkoutPlanId = pending.planId || planId || selectedPlan.id;
        const { planId: licensingPlanId, planCode } = resolveLicensingPlan(checkoutPlanId);
        const moduleAccess = resolveModuleAccess(checkoutPlanId);
        const confirmResponse = await fetch(`${API_ENDPOINTS.licensing.publicCheckoutConfirm}`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            paymentId: String(queryPaymentId),
            planId: licensingPlanId || undefined,
            planCode,
            company: {
              name: pending.companyData.companyName,
              email: pending.companyData.email,
              cnpj: pending.companyData.document,
              phone: pending.companyData.phone,
              ...moduleAccess
            },
            adminUser: {
              name: pendingAdmin.name,
              email: pendingAdmin.email,
              password: pendingAdmin.password
            }
          })
        });

        if (!confirmResponse.ok) {
          const confirmError = await confirmResponse.json().catch(() => ({}));
          throw new Error(confirmError.error || 'Falha ao confirmar pagamento e criar conta');
        }

        clearPendingCheckout();
        setAwaitingApproval(true);
      } catch (err) {
        setError(err.message || 'Erro ao confirmar pagamento');
      } finally {
        setLoading(false);
        setConfirmingReturn(false);
      }
    };

    void runAutoConfirm();

    // Limpa query string para evitar reprocessamento em refresh.
    window.history.replaceState(
      {},
      document.title,
      `/checkout?plan=${encodeURIComponent(planId || pending.planId || 'starter')}`
    );
  }, [checkoutStatus, queryPaymentId, planId, navigate, selectedPlan.id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmitStep1 = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (
        !formData.companyName ||
        !formData.document ||
        !formData.email ||
        !formData.phone ||
        !formData.responsibleName ||
        !formData.responsibleEmail ||
        !formData.responsiblePhone
      ) {
        throw new Error('Preencha todos os campos obrigatórios da empresa e responsável');
      }
      if (!adminForm.name || !adminForm.email || !adminForm.password || !adminForm.confirmPassword) {
        throw new Error('Preencha todos os campos do usuário administrador');
      }
      if (adminForm.password.length < 6) {
        throw new Error('A senha do administrador deve ter no mínimo 6 caracteres');
      }
      if (adminForm.password !== adminForm.confirmPassword) {
        throw new Error('As senhas do administrador não conferem');
      }

      // Ir para o pagamento
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🔵 Iniciando pagamento...');
      console.log('   Plano:', selectedPlan.id);
      console.log('   Endpoint:', API_ENDPOINTS.licensing.publicCreatePreference);
      
      // Criar preferência de pagamento no Mercado Pago
      const response = await fetch(`${API_ENDPOINTS.licensing.publicCreatePreference}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          planId: selectedPlan.id,
          companyData: formData
        })
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erro da API:', errorData);
        throw new Error(errorData.error || `Erro ao processar pagamento (${response.status})`);
      }

      const raw = await response.json();
      console.log('📦 Resposta bruta:', raw);
      
      const data = unwrapPayload(raw);
      console.log('📦 Dados processados:', data);
      
      // Salvar dados no localStorage
      localStorage.setItem(
        CHECKOUT_STORAGE_KEY,
        JSON.stringify({
          planId: selectedPlan.id,
          companyData: formData,
          adminUser: {
            name: String(adminForm.name || '').trim(),
            email: String(adminForm.email || '').trim().toLowerCase(),
            password: adminForm.password
          },
          subscriptionId: data?.subscriptionId || null,
          preferenceId: data?.preferenceId || null,
          savedAt: Date.now()
        })
      );

      // Se for modo simulado (desenvolvimento sem MP configurado)
      if (data?.simulated) {
        console.log('✅ Modo simulado - Criando conta diretamente...');
        
        // Criar conta diretamente via API de confirmação
        try {
          const { planId: licensingPlanId, planCode } = resolveLicensingPlan(selectedPlan.id);
          const moduleAccess = resolveModuleAccess(selectedPlan.id);
          
          console.log('📤 Chamando API de confirmação...');
          console.log('   Endpoint:', API_ENDPOINTS.licensing.publicCheckoutConfirm);
          console.log('   Plan ID:', licensingPlanId);
          console.log('   Plan Code:', planCode);
          
          const confirmPayload = {
            paymentId: 'SIMULATED',
            paymentReference: 'SIMULATED-' + Date.now(),
            paymentStatus: 'CONFIRMED',
            planId: licensingPlanId || undefined,
            planCode, // Enviar apenas o código, a API vai buscar o plano
            company: {
              name: formData.companyName,
              email: formData.email,
              cnpj: formData.document,
              phone: formData.phone,
              ...moduleAccess
            },
            adminUser: {
              name: String(adminForm.name || '').trim(),
              email: String(adminForm.email || '').trim().toLowerCase(),
              password: adminForm.password
            }
          };
          
          console.log('📦 Payload:', JSON.stringify(confirmPayload, null, 2));
          
          const confirmResponse = await fetch(`${API_ENDPOINTS.licensing.publicCheckoutConfirm}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(confirmPayload)
          });

          console.log('📡 Confirm response status:', confirmResponse.status);

          if (!confirmResponse.ok) {
            const confirmError = await confirmResponse.json().catch(() => ({}));
            console.error('❌ Erro da API de confirmação:', confirmError);
            
            // Mostrar erro mais detalhado
            const errorMsg = confirmError.error || confirmError.message || 'Falha ao criar conta';
            throw new Error(`${errorMsg} (Status: ${confirmResponse.status})`);
          }

          const confirmData = await confirmResponse.json();
          console.log('✅ Resposta da confirmação:', confirmData);
          console.log('✅ Conta criada com sucesso!');
          
          clearPendingCheckout();
          
          // Mostrar mensagem de sucesso antes de redirecionar
          setError('');
          setLoading(false);
          setAwaitingApproval(true);
          return;
          
        } catch (simError) {
          console.error('❌ Erro ao criar conta no modo simulado:', simError);
          setError('Erro ao criar conta: ' + simError.message);
          setLoading(false);
          return;
        }
      }

      const paymentUrl = data?.paymentUrl || data?.initPoint || data?.init_point;
      const preferenceId = data?.preferenceId;
      
      console.log('💳 Payment URL:', paymentUrl);
      console.log('💳 Preference ID:', preferenceId);

      if (!preferenceId) {
        throw new Error('ID da preferência de pagamento não recebido');
      }

      // Renderizar Wallet Brick na tela com o botão "Pagar"
      setPreferenceId(preferenceId);
      setLoading(false);

    } catch (err) {
      console.error('❌ Erro no pagamento:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      {/* Header */}
      <header className="border-b border-[var(--crm-border)] bg-white/80 backdrop-blur-lg dark:bg-slate-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => step === 1 ? navigate('/') : setStep(1)}
            className="flex items-center gap-2 text-[var(--crm-muted)] hover:text-[var(--crm-ink)]"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold flex items-center justify-center">
              CRM
            </div>
            <div className="text-lg font-bold text-[var(--crm-ink)]">CRM NEXOS</div>
          </div>
          
          <div className="w-20" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Resumo do Pedido */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 bg-white dark:bg-slate-900 rounded-2xl border border-[var(--crm-border)] p-6">
              <h3 className="text-lg font-bold text-[var(--crm-ink)]">Resumo do Pedido</h3>
              
              <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-xl">
                <div className="text-sm text-[var(--crm-muted)]">Plano</div>
                <div className="text-xl font-bold text-[var(--crm-ink)]">{selectedPlan.name}</div>
                <div className="mt-1 text-sm text-[var(--crm-muted)]">{selectedPlan.description}</div>
              </div>
              
              <ul className="mt-4 space-y-2">
                {selectedPlan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-[var(--crm-ink)]">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              
              <div className="mt-6 pt-6 border-t border-[var(--crm-border)]">
                <div className="flex items-baseline justify-between">
                  <span className="text-[var(--crm-muted)]">Total mensal</span>
                  <span className="text-2xl font-bold text-[var(--crm-ink)]">{selectedPlan.priceFormatted}</span>
                </div>
              </div>
              
              <div className="mt-6 flex items-center gap-2 text-xs text-[var(--crm-muted)]">
                <Shield className="w-4 h-4" />
                Pagamento seguro via Mercado Pago
              </div>
            </div>
          </div>

          {/* Formulário */}
          <div className="lg:col-span-2">
            {awaitingApproval && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[var(--crm-border)] p-8">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-300" />
                </div>
                <h2 className="mt-6 text-2xl font-bold text-[var(--crm-ink)]">Cadastro recebido</h2>
                <p className="mt-2 text-[var(--crm-muted)]">
                  Seu pagamento foi confirmado e a empresa foi enviada para revisão. O acesso será liberado após o usuário MASTER conferir os módulos e aprovar a empresa.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="mt-8 crm-btn crm-btn-secondary"
                >
                  Ir para login
                </button>
              </div>
            )}

            {!awaitingApproval && step === 1 && (
              <form onSubmit={handleSubmitStep1} className="bg-white dark:bg-slate-900 rounded-2xl border border-[var(--crm-border)] p-8">
                <h2 className="text-2xl font-bold text-[var(--crm-ink)]">Dados da Empresa</h2>
                <p className="mt-2 text-[var(--crm-muted)]">Preencha os dados para continuar</p>
                
                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}
                
                <div className="mt-6 space-y-6">
                  {/* Dados da Empresa */}
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--crm-ink)] mb-4">Informações da Empresa</h3>
                    <div className="grid gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                          Nome da Empresa *
                        </label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                          <input
                            type="text"
                            name="companyName"
                            required
                            value={formData.companyName}
                            onChange={handleChange}
                            className="crm-input pl-10"
                            placeholder="Sua Empresa Ltda"
                          />
                        </div>
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                            CNPJ *
                          </label>
                          <div className="relative">
                            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                            <input
                              type="text"
                              name="document"
                              required
                              value={formData.document}
                              onChange={handleChange}
                              className="crm-input pl-10"
                              placeholder="00.000.000/0000-00"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                            Telefone *
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                            <input
                              type="tel"
                              name="phone"
                              required
                              value={formData.phone}
                              onChange={handleChange}
                              className="crm-input pl-10"
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                          Email da Empresa *
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                          <input
                            type="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            className="crm-input pl-10"
                            placeholder="contato@empresa.com"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Dados do Responsável */}
                  <div className="pt-6 border-t border-[var(--crm-border)]">
                    <h3 className="text-sm font-semibold text-[var(--crm-ink)] mb-4">Responsável pela Conta</h3>
                    <div className="grid gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                          Nome Completo *
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                          <input
                            type="text"
                            name="responsibleName"
                            required
                            value={formData.responsibleName}
                            onChange={handleChange}
                            className="crm-input pl-10"
                            placeholder="João Silva"
                          />
                        </div>
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                            Email *
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                            <input
                              type="email"
                              name="responsibleEmail"
                              required
                              value={formData.responsibleEmail}
                              onChange={handleChange}
                              className="crm-input pl-10"
                              placeholder="joao@empresa.com"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                            Telefone *
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                            <input
                              type="tel"
                              name="responsiblePhone"
                              required
                              value={formData.responsiblePhone}
                              onChange={handleChange}
                              className="crm-input pl-10"
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-[var(--crm-border)]">
                    <h3 className="text-sm font-semibold text-[var(--crm-ink)] mb-4">Usuário Administrador</h3>
                    <p className="mb-4 text-sm text-[var(--crm-muted)]">
                      Este usuário será criado automaticamente após a confirmação do pagamento.
                    </p>
                    <div className="grid gap-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                          Nome do Admin *
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                          <input
                            type="text"
                            required
                            value={adminForm.name}
                            onChange={(e) => setAdminForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="crm-input pl-10"
                            placeholder="Nome completo"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                          Email do Admin *
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                          <input
                            type="email"
                            required
                            value={adminForm.email}
                            onChange={(e) => setAdminForm((prev) => ({ ...prev, email: e.target.value }))}
                            className="crm-input pl-10"
                            placeholder="admin@empresa.com"
                          />
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                            Senha *
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                            <input
                              type="password"
                              required
                              minLength={6}
                              value={adminForm.password}
                              onChange={(e) => setAdminForm((prev) => ({ ...prev, password: e.target.value }))}
                              className="crm-input pl-10"
                              placeholder="Mínimo 6 caracteres"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                            Confirmar senha *
                          </label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                            <input
                              type="password"
                              required
                              minLength={6}
                              value={adminForm.confirmPassword}
                              onChange={(e) => setAdminForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                              className="crm-input pl-10"
                              placeholder="Repita a senha"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-8 w-full crm-btn crm-btn-primary disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Continuar para Pagamento'}
                </button>
              </form>
            )}

            {!awaitingApproval && step === 2 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[var(--crm-border)] p-8">
                <h2 className="text-2xl font-bold text-[var(--crm-ink)]">Pagamento</h2>
                <p className="mt-2 text-[var(--crm-muted)]">
                  {confirmingReturn ? 'Pagamento aprovado. Enviando cadastro para aprovação...' : 'Finalize sua assinatura'}
                </p>
                
                {error && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                    {error}
                  </div>
                )}
                
                <div className="mt-6 p-6 bg-blue-50 dark:bg-blue-950 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <div>
                      <div className="font-semibold text-[var(--crm-ink)]">Pagamento Seguro</div>
                      <div className="text-sm text-[var(--crm-muted)]">Processado pelo Mercado Pago</div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 space-y-4">
                  <div className="p-4 border border-[var(--crm-border)] rounded-xl">
                    <div className="text-sm text-[var(--crm-muted)]">Empresa</div>
                    <div className="font-semibold text-[var(--crm-ink)]">{formData.companyName}</div>
                  </div>
                  
                  <div className="p-4 border border-[var(--crm-border)] rounded-xl">
                    <div className="text-sm text-[var(--crm-muted)]">Responsável</div>
                    <div className="font-semibold text-[var(--crm-ink)]">{formData.responsibleName}</div>
                    <div className="text-sm text-[var(--crm-muted)]">{formData.responsibleEmail}</div>
                  </div>
                </div>
                
                {!preferenceId ? (
                  <button
                    onClick={handlePayment}
                    disabled={loading || confirmingReturn}
                    className="mt-8 w-full crm-btn crm-btn-primary disabled:opacity-50"
                  >
                    {confirmingReturn ? 'Confirmando pagamento...' : loading ? 'Processando...' : `Pagar ${selectedPlan.priceFormatted}`}
                  </button>
                ) : (
                  <div className="mt-8">
                    <div id="wallet_container"></div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
