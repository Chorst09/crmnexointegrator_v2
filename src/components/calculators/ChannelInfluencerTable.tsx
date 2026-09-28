import React from 'react';

interface ChannelInfluencerTableProps {
  className?: string;
}

export const ChannelInfluencerTable: React.FC<ChannelInfluencerTableProps> = ({ className = '' }) => {
  const commissionData = [
    {
      range: 'Até R$ 500,00',
      months12: '1,50%',
      months24: '2,00%',
      months36: '2,50%',
      months48: '2,50%',
      months60: '2,50%'
    },
    {
      range: 'R$ 500,01 a R$ 1.000,00',
      months12: '2,51%',
      months24: '3,25%',
      months36: '4,00%',
      months48: '4,00%',
      months60: '4,00%'
    },
    {
      range: 'R$ 1.000,01 a R$ 1.500,00',
      months12: '4,01%',
      months24: '4,50%',
      months36: '5,00%',
      months48: '5,00%',
      months60: '5,00%'
    },
    {
      range: 'R$ 1.500,01 a R$ 3.000,00',
      months12: '5,01%',
      months24: '5,50%',
      months36: '6,00%',
      months48: '6,00%',
      months60: '6,00%'
    },
    {
      range: 'R$ 3.000,01 a R$ 5.000,00',
      months12: '6,01%',
      months24: '6,50%',
      months36: '7,00%',
      months48: '7,00%',
      months60: '7,00%'
    },
    {
      range: 'Acima de R$ 5.000,01',
      months12: '7,01%',
      months24: '7,50%',
      months36: '8,00%',
      months48: '8,00%',
      months60: '8,00%'
    }
  ];

  return (
    <div className={`bg-slate-900 rounded-lg p-4 ${className}`}>
      <h3 className="text-white text-lg font-semibold mb-4">Comissão Canal Influenciador</h3>
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

export default ChannelInfluencerTable;