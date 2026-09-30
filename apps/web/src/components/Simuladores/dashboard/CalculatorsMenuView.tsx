"use client";

import React from 'react';
import { Phone, Server, Wifi, Radio, Calculator, ChevronRight, Network, Calendar } from 'lucide-react';

interface CalculatorCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  calculatorId: string;
  color: string;
  onNavigate: (calculatorId: string) => void;
}

interface CalculatorsMenuViewProps {
  onNavigateToCalculator: (calculatorId: string) => void;
}

const CalculatorCard = ({ title, description, icon, calculatorId, color, onNavigate }: CalculatorCardProps) => {
  const gradientMap: { [key: string]: string } = {
    'border-l-blue-500': 'from-blue-600 to-blue-800',
    'border-l-purple-500': 'from-purple-600 to-purple-800',
    'border-l-green-500': 'from-green-600 to-green-800',
    'border-l-teal-500': 'from-teal-600 to-teal-800',
    'border-l-cyan-500': 'from-cyan-600 to-cyan-800',
    'border-l-system-gradient': 'from-cyan-400/70 via-teal-400/50 to-emerald-500/60',
  };

  const hoverShadowMap: { [key: string]: string } = {
    'border-l-blue-500': 'hover:shadow-blue-500/25',
    'border-l-purple-500': 'hover:shadow-purple-500/25',
    'border-l-green-500': 'hover:shadow-green-500/25',
    'border-l-teal-500': 'hover:shadow-teal-500/25',
    'border-l-cyan-500': 'hover:shadow-cyan-500/25',
    'border-l-system-gradient': 'hover:shadow-cyan-500/25',
  };

  const gradient = gradientMap[color] || 'from-blue-600 to-blue-800';
  const hoverShadow = hoverShadowMap[color] || 'hover:shadow-blue-500/25';

  return (
    <div
      className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl ${hoverShadow} hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-slate-700/50 h-full cursor-pointer group overflow-hidden relative`}
      onClick={() => onNavigate(calculatorId)}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10 group-hover:opacity-20 transition-opacity duration-300`} />
      <div className="relative p-6">
        <div className="flex items-center mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg mr-4`}>
            <div className="text-white">{icon}</div>
          </div>
          <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">{title}</h3>
        </div>
        <p className="text-slate-300 mb-6 leading-relaxed">{description}</p>
        <div className="flex items-center text-cyan-400 font-semibold group-hover:text-cyan-300 transition-colors">
          Acessar calculadora
          <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-white/5 to-transparent rounded-tr-full" />
    </div>
  );
};

const CalculatorsMenuView = ({ onNavigateToCalculator }: CalculatorsMenuViewProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 space-y-8">
      <div data-section="calculadoras">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-3 shadow-lg">
              <Calculator className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white">Calculadoras</h2>
              <p className="text-slate-400">Acesse rapidamente cada simulador</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <CalculatorCard
            title="PABX/SIP"
            description="Calcule orçamentos para soluções de telefonia IP"
            icon={<Phone className="w-5 h-5 text-blue-500" />}
            calculatorId="calculator-pabx-sip"
            color="border-l-blue-500"
            onNavigate={onNavigateToCalculator}
          />
          <CalculatorCard
            title="Máquinas Virtuais"
            description="Calcule recursos e custos de máquinas virtuais"
            icon={<Server className="w-5 h-5 text-purple-500" />}
            calculatorId="calculator-maquinas-virtuais"
            color="border-l-purple-500"
            onNavigate={onNavigateToCalculator}
          />
          <CalculatorCard
            title="Internet Fibra"
            description="Calcule valores para planos de internet fibra"
            icon={<Wifi className="w-5 h-5 text-green-500" />}
            calculatorId="calculator-internet-fibra"
            color="border-l-green-500"
            onNavigate={onNavigateToCalculator}
          />
          <CalculatorCard
            title="Internet Radio"
            description="Calcule valores para planos de internet via rádio"
            icon={<Radio className="w-5 h-5 text-blue-500" />}
            calculatorId="calculator-internet-radio"
            color="border-l-blue-500"
            onNavigate={onNavigateToCalculator}
          />
          <CalculatorCard
            title="Double-Fibra/Radio"
            description="Calcule valores para planos de internet Double-Fibra/Radio"
            icon={<Wifi className="w-5 h-5 text-teal-500" />}
            calculatorId="calculator-internet-ok-v2"
            color="border-l-teal-500"
            onNavigate={onNavigateToCalculator}
          />
          <CalculatorCard
            title="Rede Man/MPLS Fibra"
            description="Calcule valores para redes metropolitanas"
            icon={<Wifi className="w-5 h-5 text-cyan-500" />}
            calculatorId="calculator-internet-man"
            color="border-l-cyan-500"
            onNavigate={onNavigateToCalculator}
          />
          <CalculatorCard
            title="Rede Man/MPLS Radio"
            description="Calcule valores para internet via rádio"
            icon={<Wifi className="w-5 h-5 text-cyan-200" />}
            calculatorId="calculator-internet-man-radio"
            color="border-l-system-gradient"
            onNavigate={onNavigateToCalculator}
          />
          <CalculatorCard
            title="Rede SD-WAN"
            description="Precificação SD-Branch (SD-WAN + LAN + Wi-Fi)"
            icon={<Network className="w-5 h-5 text-purple-500" />}
            calculatorId="calculator-sd-wan"
            color="border-l-purple-500"
            onNavigate={onNavigateToCalculator}
          />
          <CalculatorCard
            title="Eventos TI (Link & Wi-Fi)"
            description="Precificação de TI para Eventos Temporários"
            icon={<Calendar className="w-5 h-5 text-pink-500" />}
            calculatorId="calculator-eventos-ti"
            color="border-l-pink-500"
            onNavigate={onNavigateToCalculator}
          />
        </div>
      </div>
    </div>
  );
};

export default CalculatorsMenuView;
