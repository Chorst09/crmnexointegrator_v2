import { Component } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Mantém o erro no console para depuração sem derrubar toda a aplicação.
    console.error('[ErrorBoundary] render error:', error, info);
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
      this.handleReset();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const scopeLabel = this.props.scopeLabel || 'módulo';
    const errorMessage =
      this.state.error && this.state.error.message
        ? this.state.error.message
        : 'Erro inesperado ao renderizar esta tela.';

    return (
      <div className="crm-panel mx-auto max-w-3xl p-8 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-500/15 text-amber-300">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-2xl font-black text-[var(--crm-ink)]">
          Ocorreu um erro no {scopeLabel}
        </h2>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          A tela foi isolada para evitar que o restante do sistema seja afetado.
        </p>
        <p className="mx-auto mt-3 max-w-2xl rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.55)] px-4 py-3 text-left text-xs text-[var(--crm-muted)]">
          {errorMessage}
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={this.handleReset}
            className="crm-btn crm-btn-primary h-10 px-4"
          >
            <RefreshCcw className="h-4 w-4" />
            Tentar novamente
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="crm-btn crm-btn-secondary h-10 px-4"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
