import React from 'react';

interface ChannelIndicatorTableProps {
  className?: string;
}

export const ChannelIndicatorTable: React.FC<ChannelIndicatorTableProps> = ({ className = '' }) => {
  const commissionData = [
    {
      range: 'Até R$ 500,00',
      months12: '0,50%',
      months24: '0,67%',
      months36: '0,83%',
      months48: '0,83%',
      months60: '0,83%'
    },
    {
      range: 'R$ 500,01 a R$ 1.000,00',
      months12: '0,84%',
      months24: '1,08%',
      months36: '1,33%',
      months48: '1,33%',
      months60: '1,33%'
    },
    {
      range: 'R$ 1.000,01 a R$ 1.500,00',
      months12: '1,34%',
      months24: '1,50%',
      months36: '1,67%',
      months48: '1,67%',
      months60: '1,67%'
    },
    {
      range: 'R$ 1.500,01 a R$ 3.000,00',
      months12: '1,67%',
      months24: '1,83%',
      months36: '2,00%',
      months48: '2,00%',
      months60: '2,00%'
    },
    {
      range: 'R$ 3.000,01 a R$ 5.000,00',
      months12: '2,00%',
      months24: '2,17%',
      months36: '2,50%',
      months48: '2,50%',
      months60: '2,50%'
    },
    {
      range: 'Acima de R$ 5.000,01',
      months12: '2,34%',
      months24: '2,50%',
      months36: '3,00%',
      months48: '3,00%',
      months60: '3,00%'
    }
  ];

  return (
    <div className={`bg-slate-900 rounded-lg p-4 ${className}`}>
      <h3 className="text-white text-lg font-semibold mb-4">Comissão Canal Indicador</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-white text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-2 font-medium">Faixa de Receita Mensal</th>
              <th className="text-center py-2 px-2 font-medium">12 meses</th>
              <th className="text-center py-2 px-2 font-medium">24 meses</th>
              <th className="text-center py-2 px-2 font-medium">36 meses</th>
              <th className="text-center py-2 px-2 font-medium">48 meses</th>
              <th className="text-center py-2 px-2 font-medium">60 meses</th>
            </tr>
          </thead>
          <tbody>
            {commissionData.map((row, index) => (
              <tr key={index} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="py-2 px-2 text-xs">{row.range}</td>
                <td className="py-2 px-2 text-center font-mono">{row.months12}</td>
                <td className="py-2 px-2 text-center font-mono">{row.months24}</td>
                <td className="py-2 px-2 text-center font-mono">{row.months36}</td>
                <td className="py-2 px-2 text-center font-mono">{row.months48}</td>
                <td className="py-2 px-2 text-center font-mono">{row.months60}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ChannelIndicatorTable;