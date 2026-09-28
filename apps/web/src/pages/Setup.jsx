import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE_URL, getHeaders } from '../config/api';

export default function Setup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (!token) {
      setError('Token inválido');
      setLoading(false);
      return;
    }

    // Verificar token e carregar dados
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/checkout/verify-token/${token}`, {
        headers: getHeaders()
      });

      if (!response.ok) {
        throw new Error('Token inválido ou expirado');
      }

      const data = await response.json();
      setSubscriptionData(data);
      setFormData(prev => ({
        ...prev,
        email: data.responsibleEmail,
        name: data.responsibleName
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validar senhas
      if (formData.password !== formData.confirmPassword) {
        throw new Error('As senhas não coincidem');
      }

      if (formData.password.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres');
      }

      // Criar usuário admin
      const response = await fetch(`${API_BASE_URL}/checkout/setup-admin`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          token,
          name: formData.name,
          email: formData.email,
          password: formData.password
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao criar conta');
      }

      setSuccess(true);
      
      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !subscriptionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-[var(--crm-muted)]">Verificando...</p>
        </div>
      </div>
    );
  }

  if (error && !subscriptionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-slate-950 dark:to-red-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-[var(--crm-border)] p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          
          <h2 className="mt-6 text-2xl font-bold text-[var(--crm-ink)]">
            Link Inválido
          </h2>
          <p className="mt-2 text-[var(--crm-muted)]">
            {error}
          </p>
          
          <button
            onClick={() => navigate('/')}
            className="mt-6 w-full crm-btn crm-btn-primary"
          >
            Voltar para Início
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-slate-950 dark:to-green-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-[var(--crm-border)] p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          
          <h2 className="mt-6 text-2xl font-bold text-[var(--crm-ink)]">
            Conta Criada com Sucesso!
          </h2>
          <p className="mt-2 text-[var(--crm-muted)]">
            Sua conta de administrador foi criada. Redirecionando para o login...
          </p>
          
          <div className="mt-6 animate-pulse">
            <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 dark:bg-blue-400 animate-progress"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      <header className="border-b border-[var(--crm-border)] bg-white/80 backdrop-blur-lg dark:bg-slate-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold flex items-center justify-center">
              CRM
            </div>
            <div className="text-lg font-bold text-[var(--crm-ink)]">CRM NEXOS</div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-[var(--crm-border)] p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            
            <h1 className="mt-6 text-2xl font-bold text-[var(--crm-ink)]">
              Configure sua Conta
            </h1>
            <p className="mt-2 text-[var(--crm-muted)]">
              Crie sua conta de administrador para acessar o CRM NEXOS
            </p>
          </div>

          {subscriptionData && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-xl">
              <div className="text-sm text-[var(--crm-muted)]">Empresa</div>
              <div className="font-semibold text-[var(--crm-ink)]">{subscriptionData.companyName}</div>
              <div className="mt-2 text-sm text-[var(--crm-muted)]">Plano</div>
              <div className="font-semibold text-[var(--crm-ink)]">{subscriptionData.planName}</div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                Nome Completo
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="crm-input pl-10"
                  placeholder="Seu nome"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                Email
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
                  placeholder="seu@email.com"
                  readOnly
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange}
                  className="crm-input pl-10"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--crm-ink)] mb-2">
                Confirmar Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-muted)]" />
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  minLength={6}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="crm-input pl-10"
                  placeholder="Repita a senha"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full crm-btn crm-btn-primary disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Criar Conta de Administrador'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
