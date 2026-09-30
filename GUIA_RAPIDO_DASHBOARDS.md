# 🚀 Guia Rápido - Dashboards Modernizados v2.0

## Acesso Rápido

### Novo Dashboard Completo
```
URL: /dashboard-modernized
```

### Documentação Completa
- `ARCHITECTURE_DASHBOARDS.md` - Referência técnica
- `DASHBOARDS_UPGRADES.md` - Guia de uso

---

## 5 Minutos para Começar

### 1️⃣ Criar KPI Card

```jsx
import DashboardKPICard from '../components/DashboardKPICard';

<DashboardKPICard
  title="Pipeline de Vendas"
  value={250000}
  unit="R$"
  trend={5.2}
  trendLabel="vs último mês"
  status="positive"
  colorTheme="cyan"
/>
```

**Cores disponíveis:** `cyan` | `magenta` | `pink` | `purple` | `blue` | `green` | `yellow` | `orange`

**Status:** `positive` | `negative` | `warning` | `success` | `neutral`

---

### 2️⃣ Criar Gráfico

```jsx
import DashboardAdvancedChart from '../components/DashboardAdvancedChart';

<DashboardAdvancedChart
  type="bar"
  title="Receita por Produto"
  subtitle="Últimos 30 dias"
  height={350}
  colorTheme="warm"
  data={{
    labels: ['Produto A', 'Produto B', 'Produto C'],
    datasets: [{
      label: 'Receita',
      data: [45000, 38000, 52000]
    }]
  }}
/>
```

**Tipos:** `line` | `bar` | `doughnut` | `radar` | `polar`

**Temas:** `multi` | `blue` | `warm` | `cool` | `success` | `warning`

---

### 3️⃣ Grid Responsivo

```jsx
<div className="dashboard-grid">
  <DashboardKPICard ... />
  <DashboardKPICard ... />
  <DashboardKPICard className="grid-span-2" ... />  {/* 2 colunas */}
</div>
```

Automático: 1 col (mobile) → 2 cols (tablet) → 3 cols (desktop) → 4 cols (wide)

---

### 4️⃣ Adicionar Efeitos

```jsx
<div className="animate-fade-in-up">Conteúdo</div>
<div className="animate-glow">Título</div>
<div className="dashboard-card">Card com estilo</div>
```

**Disponíveis:**
- `animate-fade-in-up` - Aparece subindo
- `animate-slide-in-right` - Desliza da direita
- `animate-glow` - Brilho pulsante
- `animate-float` - Flutuação
- `animate-pulse-neon` - Pulsação neon
- `animate-shimmer` - Brilho corrido

---

### 5️⃣ Usar Cores do Design System

```jsx
import { DASHBOARD_COLORS } from '../constants/dashboardTheme';

const color = DASHBOARD_COLORS.neon.cyan;  // #00d9ff
const gradient = DASHBOARD_COLORS.gradients.chartGradients.multi;
```

---

## Exemplos Práticos

### Dashboard de Vendas Simples

```jsx
export default function SalesDashboard() {
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-3xl font-bold text-white mb-8 animate-slide-in-right">
        Dashboard de Vendas
      </h1>

      {/* KPIs */}
      <div className="dashboard-grid mb-8">
        <DashboardKPICard
          title="Pipeline"
          value={1250000}
          unit="R$"
          trend={12}
          colorTheme="cyan"
        />
        <DashboardKPICard
          title="Receita"
          value={650000}
          unit="R$"
          trend={8}
          colorTheme="green"
        />
        <DashboardKPICard
          title="Conversão"
          value={32}
          unit="%"
          trend={2}
          colorTheme="pink"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardAdvancedChart
          type="bar"
          title="Vendas por Produto"
          data={{
            labels: ['Produto A', 'Produto B', 'Produto C'],
            datasets: [{ label: 'Vendas', data: [45000, 38000, 52000] }]
          }}
          colorTheme="warm"
        />
        <DashboardAdvancedChart
          type="line"
          title="Evolução Mensal"
          data={{
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai'],
            datasets: [{ label: 'Receita', data: [100000, 120000, 110000, 150000, 165000] }]
          }}
          colorTheme="cool"
        />
      </div>
    </div>
  );
}
```

---

## Paleta de Cores Neon (dos prints)

```
Cyan      #00d9ff  ●●●  Informação, primária
Magenta   #ff00ff  ●●●  Secundária, destaques
Pink      #ff006e  ●●●  Alertas, variações
Purple    #b200ff  ●●●  Ternária, histórico
Blue      #0080ff  ●●●  Neutra, dados
Green     #00ff88  ●●●  Sucesso, crescimento
Yellow    #ffed00  ●●●  Aviso, atenção
Orange    #ff6600  ●●●  Crítico, alerta
```

---

## Tipos de Dados para Charts

### Line Chart (Linha)
```js
{
  labels: ['Semana 1', 'Semana 2', 'Semana 3'],
  datasets: [{
    label: 'Vendas',
    data: [100, 150, 120],
    borderColor: '#00d9ff'
  }]
}
```

### Bar Chart (Barras)
```js
{
  labels: ['Jan', 'Fev', 'Mar'],
  datasets: [{
    label: 'Receita',
    data: [45000, 38000, 52000]
  }]
}
```

### Doughnut Chart (Rosca)
```js
{
  labels: ['São Paulo', 'Rio de Janeiro', 'Minas Gerais'],
  datasets: [{
    label: 'Vendas',
    data: [35, 45, 20]
  }]
}
```

### Radar Chart (Radar)
```js
{
  labels: ['Geração', 'Qualificação', 'Proposta', 'Fechamento'],
  datasets: [{
    label: 'Taxa',
    data: [100, 85, 70, 50]
  }]
}
```

---

## Checklist para Novo Dashboard

- [ ] Importar componentes (`DashboardKPICard`, `DashboardAdvancedChart`)
- [ ] Importar CSS (`dashboardEffects.css` no main.jsx)
- [ ] Usar `dashboard-grid` para layout
- [ ] Definir `colorTheme` consistente
- [ ] Adicionar `animate-fade-in-up` no container principal
- [ ] Testar em 3 resoluções: 320px, 1024px, 1280px
- [ ] Verificar contraste de cores (mínimo 4.5:1)
- [ ] Testar acessibilidade com `prefers-reduced-motion`
- [ ] Implementar loading states
- [ ] Otimizar queries de API (pagination se necessário)

---

## Performance Tips

1. **Use `useMemo` para dados pesados:**
   ```jsx
   const processedData = useMemo(() => {
     return data.map(item => ({ ...item, processed: true }));
   }, [data]);
   ```

2. **Limpe intervalos:**
   ```jsx
   useEffect(() => {
     const interval = setInterval(...);
     return () => clearInterval(interval);
   }, []);
   ```

3. **Lazy load charts grandes:**
   ```jsx
   {showChart && <DashboardAdvancedChart ... />}
   ```

4. **Evite re-renders desnecessários:**
   ```jsx
   const [data, setData] = useState(initialData);
   // Só atualize quando dados realmente mudarem
   ```

---

## Troubleshooting

### ❌ Cores não aparecem
✅ Certifique-se de importar `dashboardTheme.js`
✅ Use nomes corretos: `cyan`, `magenta`, `pink`, etc
✅ Verifique se `dashboardEffects.css` está importado

### ❌ Animações não funcionam
✅ Confirme `dashboardEffects.css` importado em `main.jsx`
✅ Respeite `prefers-reduced-motion` do navegador
✅ Use classe completa: `animate-fade-in-up`

### ❌ Charts vazio
✅ Valide estrutura: `{labels: [], datasets: [{ data: [] }]}`
✅ Confirme que `datasets` é array
✅ Teste com dados de exemplo simples

### ❌ Performance lenta
✅ Reduza número de séries (máx 6-8 por chart)
✅ Use `useMemo` para cálculos
✅ Implemente paginação para muitos dados
✅ Use `animated={false}` se necessário

---

## Exportar para CSV

```jsx
const handleExport = () => {
  const csv = 'KPI,Valor\n' +
    'Pipeline,250000\n' +
    'Receita,150000\n';
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dashboard-${new Date().toISOString()}.csv`;
  a.click();
};
```

---

## Próximos Passos

1. ✅ Explore `DashboardModernized.jsx` como referência
2. ✅ Copie componentes para seu dashboard
3. ✅ Customize cores com `colorTheme`
4. ✅ Adicione suas métricas
5. ✅ Teste responsividade
6. ✅ Deploy com confiança!

---

## Documentação Completa

Para informações detalhadas:
- **Arquitetura:** `ARCHITECTURE_DASHBOARDS.md`
- **Upgrades:** `DASHBOARDS_UPGRADES.md`
- **Componentes:** Ver arquivos em `src/components/`
- **Tema:** Ver `src/constants/dashboardTheme.js`

---

## 📞 Precisa de Ajuda?

1. Revise `ARCHITECTURE_DASHBOARDS.md` (seção relevante)
2. Consulte exemplos em `DashboardModernized.jsx`
3. Verifique props dos componentes
4. Teste componentes isoladamente
5. Revise constantes em `dashboardTheme.js`

---

**Versão:** 2.0 - Senior Architecture  
**Status:** ✅ Production Ready  
**Data:** 21 de agosto de 2026

Boa sorte com seus dashboards modernos! 🚀
