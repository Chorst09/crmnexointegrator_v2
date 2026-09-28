# Snippets de integracao

## Express

```js
const projetosRoutes = require('./api/projetos.cjs');

app.use('/api/projetos', projetosRoutes);
```

## React Router

```jsx
import { lazy, Suspense } from 'react';
import ProjetoDetalhe from './pages/ProjetoDetalhe';

const Projetos = lazy(() => import('./pages/Projetos'));

// Dentro das rotas:
{
  path: '/projetos',
  element: (
    <Suspense fallback={<div>Carregando gestao de projetos...</div>}>
      <Projetos />
    </Suspense>
  )
}

{
  path: '/projetos/:id',
  element: <ProjetoDetalhe />
}
```

## Prisma: relacoes necessarias em modelos existentes

Adicione estas relacoes ao modelo `User` do sistema de destino, ajustando nomes se necessario:

```prisma
managedProjects     Project[] @relation("ProjectManager")
createdProjects     Project[] @relation("ProjectCreator")
projectTasks        ProjectTask[]
projectTeams        ProjectTeam[]
projectTimelogs     ProjectTimelog[]
projectRisks        ProjectRisk[]
issueReported       ProjectIssue[] @relation("IssueReporter")
issueAssigned       ProjectIssue[] @relation("IssueAssignee")
crRequested         ProjectChangeRequest[] @relation("CRRequester")
crApproved          ProjectChangeRequest[] @relation("CRApprover")
acceptancesApproved ProjectAcceptance[] @relation("AcceptanceApprover")
```

Adicione esta relacao ao modelo `Company`:

```prisma
projects Project[]
```

Adicione uma relacao opcional ao modelo `Opportunity`, se o novo sistema tiver oportunidades:

```prisma
project Project?
```

O modulo tambem usa `Contract?` e o enum `Priority`. Se o destino nao tiver essas estruturas, remova/ajuste os campos `contractId`, `contract` e `priority`.

## Registro de estilos da versao embutida

```jsx
import ProjectManagementApp from '../project-management/App';
import '../project-management/index.css';
import './ProjetosWorkspace.css';
```
