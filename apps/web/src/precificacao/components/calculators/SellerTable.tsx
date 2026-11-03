import React from 'react';
import { getCRMAuthHeaders } from '@/config/api';

interface SellerTableProps {
  className?: string;
}

export const SellerTable: React.FC<SellerTableProps> = ({ className = '' }) => {
  const commissionData = [
    { period: '12 meses', commission: '1,2%' },
    { period: '24 meses', commission: '2,4%' },
    { period: '36 meses', commission: '3,6%' },
    { period: '48 meses', commission: '3,6%' },
    { period: '60 meses', commission: '3,6%' }
  ];

  return (
    <div className={`bg-[rgb(var(--crm-surface-2-rgb)_/_1)] rounded-lg p-4 ${className}`}>
      <h3 className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-lg font-semibold mb-4">Comissão Vendedor</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[rgb(var(--crm-ink-rgb)_/_1)]">
          <thead>
            <tr className="border-b border-[var(--crm-border)]">
              <th className="text-left py-2 px-3 font-medium">Período</th>
              <th className="text-left py-2 px-3 font-medium">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {commissionData.map((row, index) => (
              <tr key={index} className="border-b border-[var(--crm-border)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.5)]">
                <td className="py-2 px-3">{row.period}</td>
                <td className="py-2 px-3 font-mono">{row.commission}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SellerTable;