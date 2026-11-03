import { useState } from 'react';
import { Calculator, Package, Home, Wrench, TrendingUp, Info, ArrowRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

export default function Calculadoras() {
  const [showModal, setShowModal] = useState(false);
  const [calculadoraAtiva, setCalculadoraAtiva] = useState(null);
  const [currentTab, setCurrentTab] = useState('vendas');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[rgb(var(--crm-surface-2-rgb)_/_1)] via-[rgb(var(--crm-surface-rgb)_/_1)] to-[rgb(var(--crm-surface-2-rgb)_/_1)]">
      <PageHeader
        title="Calculadoras de Precificação"
        subtitle="Ferramentas especializadas para diferentes modelos de negócio"
      />
      <div className="p-6">
        <p className="text-[rgb(var(--crm-ink-rgb)_/_1)]">Calculadoras funcionando!</p>
      </div>
    </div>
  );
}