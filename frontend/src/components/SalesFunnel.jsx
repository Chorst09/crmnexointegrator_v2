import React from 'react';

const SalesFunnel = ({ data }) => {
  const stages = [
    { 
      key: 'LEAD_GENERATION', 
      label: 'Geração de Leads', 
      color: '#dc2626', // Vermelho
      bgColor: 'rgba(220, 38, 38, 0.9)',
      shadowColor: 'rgba(220, 38, 38, 0.3)'
    },
    { 
      key: 'LEAD_QUALIFICATION', 
      label: 'Qualificar Leads', 
      color: '#d97706', // Laranja/Dourado
      bgColor: 'rgba(217, 119, 6, 0.9)',
      shadowColor: 'rgba(217, 119, 6, 0.3)'
    },
    { 
      key: 'PROBLEM_ASSESSMENT', 
      label: 'Avaliar Desafios / Problemas', 
      color: '#16a34a', // Verde
      bgColor: 'rgba(22, 163, 74, 0.9)',
      shadowColor: 'rgba(22, 163, 74, 0.3)'
    },
    { 
      key: 'SOLUTION', 
      label: 'Solucionar Problemas', 
      color: '#0891b2', // Ciano
      bgColor: 'rgba(8, 145, 178, 0.9)',
      shadowColor: 'rgba(8, 145, 178, 0.3)'
    },
    { 
      key: 'CONVERSION', 
      label: 'Converter', 
      color: '#2563eb', // Azul
      bgColor: 'rgba(37, 99, 235, 0.9)',
      shadowColor: 'rgba(37, 99, 235, 0.3)'
    },
    { 
      key: 'CLOSING', 
      label: 'Fechar', 
      color: '#7c3aed', // Roxo
      bgColor: 'rgba(124, 58, 237, 0.9)',
      shadowColor: 'rgba(124, 58, 237, 0.3)'
    }
  ];

  const maxValue = Math.max(...data.map(item => item._count.stage));

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Funil */}
      <div className="flex-1 flex flex-col items-center justify-start py-2">
        <div className="relative w-full max-w-xs">
          {stages.map((stage, index) => {
            const dataItem = data.find(item => item.stage === stage.key);
            const value = dataItem ? dataItem._count.stage : 0;
            
            // Calcular largura baseada na posição no funil (mais largo no topo)
            const baseWidth = 100 - (index * 11); // Diminui 11% a cada nível
            const width = Math.max(baseWidth, 35); // Mínimo de 35%
            
            return (
              <div
                key={stage.key}
                className="relative mb-1 mx-auto transition-all duration-300 hover:scale-105"
                style={{ 
                  width: `${width}%`,
                  height: '36px'
                }}
              >
                {/* Sombra 3D */}
                <div
                  className="absolute inset-0 rounded-lg transform translate-y-1 translate-x-1"
                  style={{
                    background: stage.shadowColor,
                    filter: 'blur(1px)'
                  }}
                />
                
                {/* Barra principal do funil */}
                <div
                  className="relative h-full rounded-lg flex items-center justify-between px-3 text-white font-semibold shadow-lg transform hover:translate-y-[-1px] transition-all duration-200"
                  style={{
                    background: `linear-gradient(135deg, ${stage.bgColor} 0%, ${stage.color} 100%)`,
                    boxShadow: `0 3px 12px ${stage.shadowColor}`
                  }}
                >
                  {/* Texto da etapa */}
                  <span className="text-xs font-bold text-white drop-shadow-sm truncate flex-1">
                    {stage.label}
                  </span>
                  
                  {/* Valor */}
                  <span className="text-base font-bold text-white drop-shadow-sm ml-2 flex-shrink-0">
                    {value}
                  </span>
                </div>
                
                {/* Brilho superior para efeito 3D */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-lg opacity-40"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), transparent)'
                  }}
                />
              </div>
            );
          })}
        </div>
        
        {/* Base do funil (alvo) */}
        <div className="mt-2 relative">
          <div className="w-16 h-16 rounded-full border-3 border-gray-300 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg">
            <div className="w-10 h-10 rounded-full border-2 border-gray-400 flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
              <div className="w-5 h-5 rounded-full border border-gray-500 bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 shadow-inner"></div>
              </div>
            </div>
          </div>
          
          {/* Seta apontando para o alvo */}
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
            <div className="w-0 h-0 border-l-2 border-r-2 border-b-3 border-l-transparent border-r-transparent border-b-purple-600"></div>
          </div>
        </div>
      </div>
      
      {/* Estatísticas do funil - Dentro do card */}
      <div className="mt-2 pt-3 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-2 border border-blue-200">
            <div className="text-lg font-bold text-gray-900">{data[0]?._count.stage || 0}</div>
            <div className="text-xs text-gray-600 font-medium">Leads Iniciais</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-2 border border-purple-200">
            <div className="text-lg font-bold text-purple-600">{data[data.length - 1]?._count.stage || 0}</div>
            <div className="text-xs text-gray-600 font-medium">Vendas Fechadas</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-2 border border-green-200">
            <div className="text-lg font-bold text-green-600">
              {data.length > 0 ? ((data[data.length - 1]?._count.stage / data[0]?._count.stage) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-xs text-gray-600 font-medium">Taxa Conversão</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesFunnel;