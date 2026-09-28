# Modulo Gestao de Projetos

Pacote extraido do Nexos Integrator para reutilizacao em outro sistema.

## Conteudo

- `apps/web/src/project-management/`: aplicativo React/TypeScript embutido de gestao de projetos, com kanban, lista, calendario, gantt, workload, dashboard, equipe, tarefas e views globais. Esta parte usa `localStorage` e pode ser reaproveitada com menor acoplamento.
- `apps/web/src/pages/Projetos.jsx`: wrapper usado na rota `/projetos` para carregar o app embutido.
- `apps/web/src/pages/ProjetosWorkspace.css`: isolamento visual do app embutido.
- `apps/web/src/pages/ProjetosV2.jsx`: tela integrada com API para listar/criar projetos.
- `apps/web/src/pages/ProjetoDetalhe.jsx`: tela integrada com API para detalhes, tarefas, equipe, riscos, pendencias, faturamento, documentos e aceite.
- `apps/web/src/components/ProjectCard.jsx`: card usado pela listagem integrada.
- `apps/web/src/components/PhaseTimeline.jsx`: timeline/edicao de fases.
- `apps/web/src/components/PageHeader.jsx`: cabecalho reaproveitado pelas telas integradas.
- `apps/web/src/config/api.js`: helper original de base URL e headers de autenticacao.
- `apps/api/api/projetos.cjs`: rotas Express do modulo.
- `apps/api/lib/opportunityProject.js`: helpers para normalizacao de projeto vindo de oportunidade.
- `apps/api/prisma/migrations/20260819000000_add_project_module/migration.sql`: migracao SQL com tabelas/enums/indices/relacionamentos do modulo.
- `snippets/integracao.md`: trechos que precisam ser adicionados no servidor, rotas React e Prisma.

## Dependencias principais

Frontend:

- React
- React Router (`react-router-dom`)
- Lucide React (`lucide-react`)
- Tailwind CSS
- `clsx`
- `tailwind-merge`

Backend:

- Express
- Prisma Client
- Multer
- Autenticacao compatibilizada com `authenticateToken`
- Modelos existentes de `User`, `Company`, `Opportunity`, `Contract` e enum `Priority`

## Caminho rapido de integracao

1. Copie os arquivos de `apps/web/src/project-management` para o frontend do novo sistema.
2. Se quiser a versao embutida, registre a pagina `Projetos.jsx` na rota `/projetos` e importe `ProjetosWorkspace.css`.
3. Se quiser a versao conectada ao banco, copie tambem `ProjetosV2.jsx`, `ProjetoDetalhe.jsx`, `ProjectCard.jsx` e `PhaseTimeline.jsx`.
4. Copie `apps/api/api/projetos.cjs` para a API e registre com `app.use('/api/projetos', projetosRoutes)`.
5. Aplique a migracao Prisma/SQL do pacote ou transcreva os modelos/enums do modulo para o schema do novo sistema.
6. Ajuste imports especificos do sistema de destino, caso os caminhos sejam diferentes:
   - `../config/api`
   - `../components/PageHeader`
   - `../lib/prisma.cjs`
   - `../lib/auth.cjs`
7. Garanta endpoints auxiliares usados pelas telas integradas:
   - `GET /api/users`
   - `GET /api/companies`
   - `GET /api/opportunities?stage=WON`
   - `GET /api/projetos`
   - `GET /api/projetos/dashboard`

## Observacoes importantes

- A pasta `project-management` e mais portavel porque salva dados em `localStorage`.
- As telas `ProjetosV2.jsx` e `ProjetoDetalhe.jsx` dependem da API e do schema Prisma.
- A API espera que `req.user.id` e `req.user.role` existam depois do middleware de autenticacao.
- Uploads de anexos sao salvos em `apps/api/uploads/projects` no sistema original.
- O modulo integrado usa entidades compartilhadas do CRM: empresas, usuarios, oportunidades e contratos.
