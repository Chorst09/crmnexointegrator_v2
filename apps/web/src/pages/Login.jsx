import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, API_ENDPOINTS, getHeaders } from '../config/api';
import { CheckCircle2, Lock, Mail, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { getDefaultRouteForUser } from '../utils/permissions';

const resolvePublicUrl = (maybeRelativeUrl) => {
  if (!maybeRelativeUrl) return null;
  if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl;

  if (/^https?:\/\//i.test(API_BASE_URL)) {
    const base = API_BASE_URL.replace(/\/api\/?$/i, '');
    return `${base}${maybeRelativeUrl}`;
  }

  return maybeRelativeUrl;
};

const FORM_MODE = {
  LOGIN: 'login',
  FORGOT: 'forgot'
};

const Login = () => {
  const [mode, setMode] = useState(FORM_MODE.LOGIN);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [forgotData, setForgotData] = useState({
    email: '',
    newPassword: '',
    confirmPassword: '',
    recoveryCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [branding, setBranding] = useState({ appName: 'CRM NEXOS', logoUrl: null });
  const navigate = useNavigate();
  const { theme, resolvedTheme, toggleTheme } = useTheme();

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.settings);
        if (!res.ok) {
          // Se falhar, usa valores padrão
          return;
        }
        const data = await res.json();
        setBranding({
          appName: data?.appName || 'CRM NEXOS',
          logoUrl: data?.logoUrl || null
        });
      } catch (error) {
        // Silenciosamente usa valores padrão se houver erro
        console.log('Usando branding padrão');
      }
    };
    loadBranding();
  }, []);

  const setModeWithCleanup = (nextMode) => {
    setMode(nextMode);
    setFeedback({ type: '', message: '' });
  };

  const handleLoginChange = (e) => {
    setLoginData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleForgotChange = (e) => {
    setForgotData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch(API_ENDPOINTS.auth.login, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(loginData)
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        // Pequeno delay para permitir que extensões de navegador
        // (gerenciadores de senha, etc.) concluam operações assíncronas
        // antes da navegação. Isso evita erros como:
        // "A listener indicated an asynchronous response by returning true,
        //  but the message channel closed before a response was received"
        await new Promise((r) => setTimeout(r, 150));
        return navigate(getDefaultRouteForUser(data.user));
      } else {
        setFeedback({ type: 'error', message: data.error || 'Erro ao fazer login' });
      }
    } catch (error) {
      console.error('Erro no login:', error);
      setFeedback({ type: 'error', message: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const response = await fetch(API_ENDPOINTS.auth.forgotPassword, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(forgotData)
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        setFeedback({ type: 'success', message: 'Senha redefinida. Faça login com a nova senha.' });
        setLoginData((prev) => ({ ...prev, email: forgotData.email }));
        setMode(FORM_MODE.LOGIN);
      } else {
        setFeedback({ type: 'error', message: data.error || 'Não foi possível redefinir a senha' });
      }
    } catch (error) {
      console.error('Erro ao recuperar senha:', error);
      setFeedback({ type: 'error', message: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const modeTitle = mode === FORM_MODE.FORGOT ? 'Recuperar senha' : 'Entrar';
  const modeSubtitle =
    mode === FORM_MODE.FORGOT
      ? 'Defina uma nova senha com código de recuperação.'
      : 'Acesse sua conta para continuar.';

  return (
    <div className="min-h-screen">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 crm-dotgrid opacity-[0.07] dark:opacity-[0.05]" />

        <div className="relative grid min-h-screen lg:grid-cols-2">
          <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
            <div className="absolute -left-20 -top-28 h-80 w-80 rounded-full bg-[rgb(var(--crm-accent-rgb)_/_0.20)] blur-3xl motion-safe:animate-float" />
            <div className="absolute -right-24 -bottom-32 h-96 w-96 rounded-full bg-sky-500/[0.15] blur-3xl motion-safe:animate-float" />

            <div className="relative">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-3xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.70)] backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-soft-xl">
                  {resolvePublicUrl(branding.logoUrl) ? (
                    <img src={resolvePublicUrl(branding.logoUrl)} alt="Logo" className="h-9 w-9 object-contain" />
                  ) : (
                    <span className="text-lg font-bold text-[var(--crm-ink)]">CRM</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="text-3xl font-bold text-[var(--crm-ink)] truncate">{branding.appName}</h1>
                  <p className="mt-1 text-sm text-[var(--crm-muted)]">Conexões inteligentes para resultados extraordinários.</p>
                </div>
              </div>

              <div className="mt-10 crm-panel p-7">
                <div className="text-sm font-semibold text-[var(--crm-ink)]">O que voce ganha</div>
                <ul className="mt-4 space-y-3 text-sm text-[var(--crm-muted)]">
                  <li className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>Visao executiva com indicadores e funil de vendas.</span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>Kanban do pipeline com movimentacao rapida e historico.</span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>Organizacao por empresas, oportunidades e atividades.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="relative text-xs text-[var(--crm-muted)]">
              <div className="font-semibold text-[var(--crm-ink)]">Seguranca e consistencia</div>
              <div className="mt-1">Tema claro/escuro, sessao autenticada e perfis por permissao.</div>
            </div>
          </div>

          <div className="flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-md">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-[var(--crm-ink)]">{modeTitle}</h2>
                  <p className="mt-1 text-sm text-[var(--crm-muted)]">{modeSubtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="crm-btn crm-btn-secondary h-10 px-3"
                  title={`Tema: ${theme} (ativo: ${resolvedTheme})`}
                  aria-label="Alternar tema (claro/escuro/sistema)"
                >
                  {theme === 'system' ? (
                    <Monitor className="h-4 w-4" />
                  ) : resolvedTheme === 'dark' ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Sun className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="mt-6 crm-panel p-7 motion-safe:animate-scale-in">
                <div className="mb-4 grid grid-cols-2 rounded-xl border border-[color:var(--crm-border)] p-1">
                  <button
                    type="button"
                    onClick={() => setModeWithCleanup(FORM_MODE.LOGIN)}
                    className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${mode === FORM_MODE.LOGIN ? 'bg-[color:var(--crm-accent)] text-white' : 'text-[var(--crm-muted)]'}`}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setModeWithCleanup(FORM_MODE.FORGOT)}
                    className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${mode === FORM_MODE.FORGOT ? 'bg-[color:var(--crm-accent)] text-white' : 'text-[var(--crm-muted)]'}`}
                  >
                    Esqueci
                  </button>
                </div>

                {feedback.message && (
                  <div
                    className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
                      feedback.type === 'success'
                        ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                        : 'border border-red-500/25 bg-red-500/10 text-red-900 dark:text-red-100'
                    }`}
                  >
                    {feedback.message}
                  </div>
                )}

                {mode === FORM_MODE.LOGIN && (
                  <form className="space-y-4" onSubmit={handleLoginSubmit}>
                    <div>
                      <label htmlFor="login-email" className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--crm-muted)]" />
                        <input
                          id="login-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          placeholder="seuemail@empresa.com"
                          className="crm-input pl-10"
                          value={loginData.email}
                          onChange={handleLoginChange}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="login-password" className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">
                        Senha
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--crm-muted)]" />
                        <input
                          id="login-password"
                          name="password"
                          type="password"
                          autoComplete="current-password"
                          required
                          placeholder="Sua senha"
                          className="crm-input pl-10"
                          value={loginData.password}
                          onChange={handleLoginChange}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="crm-btn crm-btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                  </form>
                )}

                {mode === FORM_MODE.FORGOT && (
                  <form className="space-y-4" onSubmit={handleForgotSubmit}>
                    <div>
                      <label htmlFor="forgot-email" className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--crm-muted)]" />
                        <input
                          id="forgot-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          placeholder="seuemail@empresa.com"
                          className="crm-input pl-10"
                          value={forgotData.email}
                          onChange={handleForgotChange}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="forgot-new-password" className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">
                        Nova senha
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--crm-muted)]" />
                        <input
                          id="forgot-new-password"
                          name="newPassword"
                          type="password"
                          autoComplete="new-password"
                          minLength={6}
                          required
                          placeholder="Minimo de 6 caracteres"
                          className="crm-input pl-10"
                          value={forgotData.newPassword}
                          onChange={handleForgotChange}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="forgot-confirm-password" className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">
                        Confirmar nova senha
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--crm-muted)]" />
                        <input
                          id="forgot-confirm-password"
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          minLength={6}
                          required
                          placeholder="Repita a nova senha"
                          className="crm-input pl-10"
                          value={forgotData.confirmPassword}
                          onChange={handleForgotChange}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="forgot-recovery-code" className="block text-sm font-semibold text-[var(--crm-ink)] mb-2">
                        Codigo de recuperacao
                      </label>
                      <input
                        id="forgot-recovery-code"
                        name="recoveryCode"
                        type="password"
                        required
                        placeholder="Informe o codigo do administrador"
                        className="crm-input"
                        value={forgotData.recoveryCode}
                        onChange={handleForgotChange}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="crm-btn crm-btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Redefinindo...' : 'Redefinir senha'}
                    </button>
                  </form>
                )}

                {mode === FORM_MODE.LOGIN && (
                  <div className="mt-4 pt-4 border-t border-[color:var(--crm-border)]">
                    <div className="text-xs font-medium text-[var(--crm-muted)] mb-2">Acesso Rápido (Demonstração):</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginData({ email: 'admin@crm.com', password: 'admin123' });
                          setFeedback({ type: '', message: '' });
                        }}
                        className="rounded-lg border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] py-1.5 px-2 text-xs font-medium text-[var(--crm-ink)] hover:bg-[color:var(--crm-accent)] hover:text-white transition"
                      >
                        👑 Master (admin@crm.com)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoginData({ email: 'chorstconsult@gmail.com', password: 'Admin@2026' });
                          setFeedback({ type: '', message: '' });
                        }}
                        className="rounded-lg border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] py-1.5 px-2 text-xs font-medium text-[var(--crm-ink)] hover:bg-[color:var(--crm-accent)] hover:text-white transition"
                      >
                        👑 Master (chorstconsult)
                      </button>
                    </div>
                  </div>
                )}

                {mode === FORM_MODE.LOGIN && (
                  <div className="mt-5 flex items-center justify-end text-xs">
                    <button
                      type="button"
                      onClick={() => setModeWithCleanup(FORM_MODE.FORGOT)}
                      className="text-[var(--crm-accent)] hover:underline"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                {mode !== FORM_MODE.LOGIN && (
                  <div className="mt-5 text-xs">
                    <button
                      type="button"
                      onClick={() => setModeWithCleanup(FORM_MODE.LOGIN)}
                      className="text-[var(--crm-accent)] hover:underline"
                    >
                      Voltar para login
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 text-xs text-[var(--crm-muted)]">
                Dica: se estiver em modo privado, o armazenamento local pode ser limitado.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
