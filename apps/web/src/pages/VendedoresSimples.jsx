import { useState, useEffect } from 'react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

export default function VendedoresSimples() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Carregando dados...');
        setLoading(true);
        
        const response = await fetch(buildApiUrl('/users?role=SELLER'), {
          headers: getAuthHeaders()
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
          const result = await response.json();
          console.log('Dados carregados:', result);
          setData(Array.isArray(result) ? result : []);
        } else {
          setError('Erro ao carregar dados');
        }
      } catch (err) {
        console.error('Erro:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Vendedores (Teste)</h1>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Carregando...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Vendedores (Teste)</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Erro: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Vendedores (Teste)</h1>
      
      <div className="crm-card rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Dados Carregados:</h2>
        
        {data && data.length > 0 ? (
          <div className="space-y-4">
            {data.map((seller) => (
              <div key={seller.id} className="border rounded p-4">
                <h3 className="font-medium">{seller.name}</h3>
                <p className="text-sm text-gray-600 dark:text-slate-200">{seller.email}</p>
                <p className="text-sm">Função: {seller.role}</p>
                <p className="text-sm">Região: {seller.region?.name || 'Não definida'}</p>
                <p className="text-sm">Cota: R$ {seller.quota?.toLocaleString('pt-BR') || '0'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>Nenhum vendedor encontrado.</p>
        )}
      </div>
    </div>
  );
}
