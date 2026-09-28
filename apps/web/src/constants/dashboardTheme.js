/**
 * Design System para Dashboards - Arquitetura Senior
 * Paleta de cores baseada em modern dark theme com gradientes e efeitos
 * Inspiração: prints fornecidos com cores vibrantes neon
 */

// ─── PALETA DE CORES PRIMÁRIA ───────────────────────────────────────────────
export const DASHBOARD_COLORS = {
  // Cores de fundo
  background: {
    primary: '#050914',
    secondary: '#070b16',
    tertiary: '#0d1423',
    card: 'rgba(17, 24, 39, 0.96)',
    overlay: 'rgba(5, 9, 20, 0.92)'
  },

  // Paleta market intelligence baseada no print de referência
  neon: {
    cyan: '#18c8df',
    magenta: '#c026d3',
    pink: '#ef4444',
    purple: '#7c3aed',
    blue: '#1f7fe5',
    green: '#22c55e',
    yellow: '#f6b40b',
    orange: '#ff7a00'
  },

  // Gradientes principais
  gradients: {
    // Fundo de cards
    cardGradient: 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%)',
    
    // Gradientes para charts
    chartGradients: {
      blue: 'linear-gradient(135deg, #1f7fe5 0%, #18c8df 100%)',
      pink: 'linear-gradient(135deg, #ef4444 0%, #c026d3 100%)',
      purple: 'linear-gradient(135deg, #7c3aed 0%, #1f7fe5 100%)',
      cyan: 'linear-gradient(135deg, #18c8df 0%, #22c55e 100%)',
      multi: 'linear-gradient(90deg, #ff7a00 0%, #1f7fe5 32%, #18c8df 62%, #22c55e 100%)'
    },

    // Fundo de temperatura
    temperatureGradient: 'conic-gradient(from 0deg, #22c55e 0deg, #18c8df 90deg, #f6b40b 180deg, #ff7a00 270deg, #22c55e 360deg)'
  },

  // Paleta de dados - 14 cores para múltiplas séries
  data: {
    product: [
      '#ff7a00', '#18c8df', '#1f7fe5', '#22c55e',
      '#f6b40b', '#7c3aed', '#ef4444', '#8f9caf'
    ],
    stage: {
      LEAD_GENERATION: '#18c8df',
      LEAD_QUALIFICATION: '#1f7fe5',
      PROBLEM_ASSESSMENT: '#f6b40b',
      SOLUTION: '#ff7a00',
      CONVERSION: '#22c55e',
      CLOSING: '#7c3aed'
    },
    status: {
      excellent: '#22c55e',
      good: '#18c8df',
      neutral: '#f6b40b',
      warning: '#ff7a00',
      critical: '#ef4444'
    },
    temperature: {
      0: '#22c55e',
      25: '#18c8df',
      50: '#f6b40b',
      75: '#ff7a00',
      100: '#ef4444'
    }
  },

  // Textos
  text: {
    primary: '#f4f7fb',
    secondary: '#cbd5e1',
    tertiary: '#8f9caf',
    muted: '#64748b'
  },

  // Bordas e divisores
  border: {
    light: 'rgba(55, 65, 81, 0.55)',
    medium: 'rgba(75, 85, 99, 0.75)',
    bright: 'rgba(24, 200, 223, 0.26)'
  }
};

// ─── EFEITOS E SOMBRAS ──────────────────────────────────────────────────────
export const DASHBOARD_EFFECTS = {
  shadows: {
    sm: '0 4px 12px rgba(0, 0, 0, 0.15)',
    md: '0 8px 24px rgba(0, 0, 0, 0.25)',
    lg: '0 16px 48px rgba(0, 0, 0, 0.35)',
    glow: '0 0 20px rgba(24, 200, 223, 0.22)',
    pink: '0 0 20px rgba(239, 68, 68, 0.22)',
    purple: '0 0 30px rgba(124, 58, 237, 0.18)'
  },

  // Backdrop blur para cards
  backdrop: {
    xs: 'backdrop-blur-sm',
    sm: 'backdrop-blur-md',
    md: 'backdrop-blur-lg',
    lg: 'backdrop-blur-xl'
  },

  // Animações CSS
  animations: {
    fadeInUp: 'animate-fade-in-up',
    slideInRight: 'animate-slide-in-right',
    pulse: 'animate-pulse',
    glow: 'animate-glow',
    float: 'animate-float'
  }
};

// ─── CONFIGURAÇÃO DE CHARTS ────────────────────────────────────────────────
export const CHART_CONFIG = {
  defaults: {
    responsive: true,
    maintainAspectRatio: false,
    tension: 0.4,
    backgroundColor: 'transparent'
  },

  options: {
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
          drawBorder: false
        },
        ticks: {
          color: '#b0b0c0',
          font: { size: 11, weight: '500' }
        }
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.02)',
          drawBorder: false
        },
        ticks: {
          color: '#b0b0c0',
          font: { size: 11, weight: '500' }
        }
      }
    },

    plugins: {
      legend: {
        labels: {
          color: '#b0b0c0',
          font: { size: 12, weight: '500' },
          padding: 15,
          usePointStyle: true
        }
      },

      tooltip: {
        backgroundColor: 'rgba(15, 15, 30, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#b0b0c0',
        borderColor: 'rgba(0, 217, 255, 0.3)',
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 11 },
        usePointStyle: true,
        boxPadding: 8,
        displayColors: true
      }
    }
  },

  // Templates para diferentes tipos de chart
  templates: {
    lineAreaChart: {
      fill: true,
      borderWidth: 2,
      borderJoinStyle: 'round',
      pointRadius: 4,
      pointBorderWidth: 2,
      pointBackgroundColor: '#050914',
      pointHoverRadius: 6
    },

    barChart: {
      borderRadius: 8,
      borderSkipped: false,
      shadowBlur: 15,
      shadowColor: 'rgba(0, 0, 0, 0.3)'
    },

    doughnutChart: {
      borderWidth: 2,
      borderColor: '#050914',
      cutout: '75%'
    }
  }
};

// ─── TAMANHO E ESPAÇAMENTO ─────────────────────────────────────────────────
export const LAYOUT = {
  cardRadius: '16px',
  containerPadding: '24px',
  gridGap: '16px',
  breakpoints: {
    xs: '320px',
    sm: '640px',
    md: '1024px',
    lg: '1280px',
    xl: '1536px'
  }
};

// ─── TRANSIÇÕES ────────────────────────────────────────────────────────────
export const TRANSITIONS = {
  fast: 'transition-all duration-200',
  normal: 'transition-all duration-300',
  slow: 'transition-all duration-500'
};
