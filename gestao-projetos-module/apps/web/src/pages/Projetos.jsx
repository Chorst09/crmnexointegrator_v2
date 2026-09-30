import { useNavigate } from 'react-router-dom';
import ProjectManagementApp from '../project-management/App';
import '../project-management/index.css';
import './ProjetosWorkspace.css';

export default function Projetos() {
  const navigate = useNavigate();

  return (
    <section className="project-management-embed" aria-label="Gestao de Projetos">
      <ProjectManagementApp onBack={() => navigate('/dashboard-geral')} />
    </section>
  );
}
