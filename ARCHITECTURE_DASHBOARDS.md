# Arquitetura de Dashboards - NexosCRM
## Design System Senior - Padrões e Guia de Uso

---

## 🎨 Paleta de Cores Neon

### Cores Primárias
- **Cyan**: `#00d9ff` - Cor principal, informações primárias
- **Magenta**: `#ff00ff` - Secundária, destaques
- **Pink**: `#ff006e` - Alertas, variações
- **Purple**: `#b200ff` - Ternária, dados históricos

### Cores de Status
- **Green**: `#00ff88` - Sucesso, crescimento positivo
- **Yellow**: `#ffed00` - Aviso, atenção
- **Orange**: `#ff6600` - Crítico, alerta importante
- **Blue**: `#0080ff` - Informação, neutra

### Fundo
- **Primary**: `#0f0f1e` - Preto profundo
- **Secondary**: `#1a1a2e` - Preto com toque azul
- **Tertiary**: `#16213e` - Azul escuro
- **Card**: `rgba(26, 26, 46, 0.95)` - Transparência com backdrop blur

---

## 🧩 Componentes Disponíveis

### 1. **DashboardKPICard**
Card elegante com animações para exibir KPIs

**Props:**
```jsx
<DashboardKPICard
  title="Pipeline de Vendas"
  value={250000}
  unit="R$"
  trend={5.2}
  trendLabel="vs último mês"
  status="positive" // positive | negative | warning | success | neutral
  icon={DollarSign}
  colorTheme="cyan" // cyan | magenta | pink | purple | blue | green | yellow | orange
  showChart={true}
  sparklineData={[10, 20, 15, 30, 25]}
  isAnimated={true}
  subtitle="Oportunidades abertas"
  onClick={() => {}}
/>
```

**Recursos:**
- ✨ Animação de contagem de números
- 🎯 Indicador de tendência com ícone
- 📊 Sparkline opcional
- 🌈 14 temas de cor
- ✨ Efeito neon no hover

---

### 2. **DashboardAdvancedChart**
Charts com efeitos e tema consistente

**Props:**
```jsx
<DashboardAdvancedChart
  type="line" // line | bar | doughnut | radar | polar
  data={{
    labels: ['Jan', 'Fev', 'Mar'],
    datasets: [
      {
        label: 'Série 1',
        data: [10, 20, 15]
      }
    ]
  }}
  title="Receita Mensal"
  subtitle="Últimos 3 meses"
  height={350}
  colorTheme="warm" // multi | blue | warm | cool | success | warning
  showLegend={true}
  animated={true}
  customOptions={{}}
/>
```

**Temas de Cor:**
- `multi`: Gradiente completo (azul → roxo → rosa → amarelo → verde)
- `blue`: Azul e ciano
- `warm`: Laranja, amarelo, rosa
- `cool`: Azul, ciano, roxo
- `success`: Verde e ciano
- `warning`: Amarelo, laranja, rosa

---

### 3. **SalesFunnel** (Existente)
Funil de vendas com efeito 3D e gradientes

```jsx
<SalesFunnel 
  data={[
    { stage: 'LEAD_GENERATION', _count: { stage: 120 } },
    { stage: 'LEAD_QUALIFICATION', _count: { stage: 95 } },
    // ...
  ]}
/>
```

---

### 4. **TemperatureGauge** (Existente)
Medidor de temperatura do negócio

```jsx
<TemperatureGauge
  temperature={65} // 0-100
  size={200}
/>
```

---

## 🎯 Padrões de Layout

### Grid Responsivo
```jsx
<div className="dashboard-grid">
  {/* Componentes se adaptam automaticamente */}
</div>
```

**Comportamento:**
- **Mobile**: 1 coluna
- **Tablet**: 2 colunas (640px+)
- **Desktop**: 3 colunas (1024px+)
- **Wide**: 4 colunas (1280px+)

### Classe de Expansão
```jsx
<div className="dashboard-grid">
  <div className="grid-span-2">Ocupa 2 colunas</div>
  <div className="grid-span-full">Ocupa toda linha</div>
</div>
```

---

## ✨ Efeitos CSS Disponíveis

### Classes de Animação
```html
<!-- Fade in com movimento para cima -->
<div class="animate-fade-in-up">Conteúdo</div>

<!-- Slide in da direita -->
<div class="animate-slide-in-right">Conteúdo</div>

<!-- Glow de texto -->
<div class="animate-glow">Conteúdo</div>

<!-- Flutuação -->
<div class="animate-float">Conteúdo</div>

<!-- Brilho pulsante neon -->
<div class="animate-pulse-neon">Conteúdo</div>

<!-- Shimmer/loading -->
<div class="animate-shimmer">Conteúdo</div>

<!-- Rotação -->
<div class="animate-rotate">Conteúdo</div>

<!-- Onda -->
<div class="animate-wave">Conteúdo</div>
```

### Classe de Card
```html
<div class="dashboard-card">
  <!-- Automático: fundo gradiente, border neon, efeitos hover -->
</div>
```

---

## 📊 Exemplo Completo de Dashboard

```jsx
import DashboardKPICard from '../components/DashboardKPICard';
import DashboardAdvancedChart from '../components/DashboardAdvancedChart';
import { DASHBOARD_COLORS } from '../constants/dashboardTheme';

export default function MyDashboard() {
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-8 animate-slide-in-right">
        <h1 className="text-3xl font-bold text-white mb-2">
          Meu Dashboard
        </h1>
        <p className="text-slate-400">Visão consolidada de dados</p>
      </div>

      {/* KPIs */}
      <div className="dashboard-grid mb-8">
        <DashboardKPICard
          title="Total de Vendas"
          value={1250000}
          unit="R$"
          trend={12.5}
          status="positive"
          colorTheme="cyan"
        />
        {/* Mais cards... */}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardAdvancedChart
          type="bar"
          title="Vendas por Produto"
          data={{
            labels: ['Produto A', 'Produto B', 'Produto C'],
            datasets: [{
              label: 'Receita',
              data: [45000, 38000, 52000]
            }]
          }}
          colorTheme="warm"
        />
        {/* Mais charts... */}
      </div>
    </div>
  );
}
```

---

## 🎨 Importar CSS de Efeitos

**Em qualquer componente:**
```jsx
import '../styles/dashboardEffects.css';
```

**Ou no App.jsx/main.jsx (global):**
```jsx
import './styles/dashboardEffects.css';
```

---

## 🚀 Boas Práticas

### 1. **Consistência de Cores**
- Use os temas pré-definidos em `DASHBOARD_COLORS`
- Não defina cores inline se não necessário
- Mantenha um tema por dashboard

### 2. **Animações**
- Use `animated={true}` apenas em dados que mudam frequentemente
- Respeite `prefers-reduced-motion` para acessibilidade
- Animações máx 600ms para não parecer lenta

### 3. **Performance**
- Use `useMemo` para processar dados grandes
- Lazy load charts se houver muitos
- Limpar intervalos/timeouts em `useEffect`

### 4. **Responsividade**
- Sempre use `dashboard-grid` para layouts automáticos
- Teste em: 320px, 640px, 1024px, 1280px
- Use `grid-span-2` e `grid-span-full` com moderação

### 5. **Acessibilidade**
- Sempre inclua `title` descritivo em charts
- Use cores além de shades para status
- Certifique-se de contraste adequado

---

## 📈 Paleta Expandida para Dados

**Para 6+ séries de dados:**
```js
const colors = DASHBOARD_COLORS.data.product;
// [#0080ff, #00d9ff, #00ff88, #ffed00, #ff6600, #ff006e, #b200ff, #ff00ff]
```

**Para estágios de vendas:**
```js
const colors = DASHBOARD_COLORS.data.stage;
// LEAD_GENERATION: #65b4ff
// LEAD_QUALIFICATION: #69e2a8
// PROBLEM_ASSESSMENT: #ffd76b
// SOLUTION: #ffad65
// CONVERSION: #ff7c82
// CLOSING: #b184ff
```

---

## 🔧 Customização

### Mudar Tema de Cor Global
```js
// Em dashboardTheme.js
export const DASHBOARD_COLORS = {
  neon: {
    cyan: '#00d9ff', // ← Ajuste aqui
    // ...
  }
};
```

### Adicionar Nova Animação
```css
/* Em dashboardEffects.css */
@keyframes minha-animacao {
  from { ... }
  to { ... }
}

.animate-minha-animacao {
  animation: minha-animacao 0.5s ease-out;
}
```

---

## 📚 Referências de Componentes Existentes

- `TemperatureGauge.jsx`: Medidor de temperatura
- `SalesFunnel.jsx`: Funil de vendas 3D
- `PresentationControls.jsx`: Controles de apresentação

---

## ✅ Checklist para Novo Dashboard

- [ ] Importar `DashboardKPICard` e `DashboardAdvancedChart`
- [ ] Importar `dashboardEffects.css`
- [ ] Usar `dashboard-grid` para layout
- [ ] Aplicar tema de cor consistente
- [ ] Testar responsividade (3 breakpoints)
- [ ] Adicionar `animate-fade-in-up` ao container
- [ ] Testar em modo claro e escuro
- [ ] Verificar contraste de cores
- [ ] Otimizar queries de dados

---

## 🎓 Próximas Melhorias

- [ ] Adicionar exportação para PDF
- [ ] Implementar modo comparativo (2 períodos)
- [ ] Adicionar alertas inteligentes
- [ ] Dashboard de comparação regional
- [ ] Integração com IA para insights automáticos

---

**Última atualização:** 21 de agosto de 2026
**Versão:** 2.0 - Senior Architecture
**Autor:** Arquiteto de Software - NexosCRM
