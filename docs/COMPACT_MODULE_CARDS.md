# Cabeçalhos e indicadores compactos

Os cabeçalhos e cards operacionais usam o mesmo padrão de densidade nos modos claro e escuro.

- `PageHeader`: título em fonte sem serifa, breadcrumb discreto, ícone de 20px, ações menores e quebra de linha responsiva.
- `AnimatedStats`: ícone lateral de 36px, título, valor e descrição agrupados; sem altura mínima artificial e sem ocultar títulos ou valores longos.
- `StatsCard`, `Card` e `DashboardKPICard`: menos preenchimento e espaçamento vertical, mantendo tendência, unidade e descrição.
- `compact-layout.css`: regras comuns de tipografia, grade de indicadores e movimento reduzido. As cores continuam sob controle dos temas.
- Cards próprios de Pré-vendas, propostas, calculadoras, projetos, simuladores e dashboards também foram compactados.
- Os componentes duplicados em `components/Simuladores` e `precificacao/components` recebem o mesmo ajuste.

Validação local com APIs simuladas: capturas dos dois temas, medição de altura dos cards, verificação de títulos e valores em celular/tablet/desktop, build e verificações existentes. Não altera dados de negócio nem publica automaticamente em produção.
