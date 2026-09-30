import { useState } from 'react';
import { Calculator, Package, Home, Wrench, TrendingUp, Info, ArrowRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';

export default function Calculadoras() {
  const [showModal, setShowModal] = useState(false);
  const [calculadoraAtiva, setCalculadoraAtiva] = useState(null);
  const [currentTab, setCurrentTab] = useState('vendas');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <PageHeader
        title="Calculadoras de Precificação"
        subtitle="Ferramentas especializadas para diferentes modelos de negócio"
      />
      <div className="p-6">
        <p className="text-white">Calculadoras funcionando!</p>
      </div>
    </div>
  );
}