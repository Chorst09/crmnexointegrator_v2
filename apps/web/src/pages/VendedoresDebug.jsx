import { useState, useEffect } from 'react';

export default function VendedoresDebug() {
  console.log('VendedoresDebug: Componente carregado');
  
  const [status, setStatus] = useState('Inicializando...');

  useEffect(() => {
    console.log('VendedoresDebug: useEffect executado');
    setStatus('Componente montado com sucesso!');
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Debug - Vendedores</h1>
      
      <div className="crm-card rounded-lg p-6">
        <p className="text-lg">Status: {status}</p>
        
        <div className="mt-4 space-y-2">
          <p>✅ Componente renderizado</p>
          <p>✅ React hooks funcionando</p>
          <p>✅ CSS classes aplicadas</p>
        </div>
        
        <div className="mt-6">
          <button 
            onClick={() => setStatus('Botão clicado!')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Testar Interação
          </button>
        </div>
      </div>
    </div>
  );
}
