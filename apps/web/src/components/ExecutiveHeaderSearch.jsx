import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMarketSearchGroups } from '../utils/dashboardMarket.mjs';
import { buildApiUrl, getAuthHeaders } from '../config/api';
export default function ExecutiveHeaderSearch({market=null}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const cache = useRef(null);
  const input = useRef(null);
  const requestId = useRef(0);
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
      if (event.key === 'Escape') {
        requestId.current += 1;
        setResults(null);
        setLoading(false);
      }
    };
    const invalidate=()=>{cache.current=null;requestId.current+=1;setResults(null);setLoading(false);};
    window.addEventListener('keydown', onKey);
    window.addEventListener('nexos-refresh-modules',invalidate);
    return () => {window.removeEventListener('keydown', onKey);window.removeEventListener('nexos-refresh-modules',invalidate);};
  }, []);
  const search = async event => {
    event.preventDefault();
    if (!query.trim()) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    setResults([]);
    try {
      if (!cache.current) {
        const response = await fetch(buildApiUrl(market ? `/dashboard?type=module-overview&market=${market}` : '/dashboard?type=general'), {
          headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('search');
        cache.current = (await response.json()).data;
      }
      const data = cache.current || {};
      const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const groups = getMarketSearchGroups(market);
      const matches = groups.flatMap(([key, type, route]) => (Array.isArray(data[key]) ? data[key] : []).map(row => ({
        id: row.id,
        title: row.name || row.title || row.object || row.numeroEdital || row.id,
        type,
        route
      }))).filter(row => normalize(row.title).includes(normalize(query))).slice(0, 20);
      if (id === requestId.current) setResults(matches);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };
  return <div className="nex-header-search"><form onSubmit={search}><Search size={20} /><input ref={input} aria-label={market==='B2B'?'Buscar clientes e oportunidades B2B':market==='B2G'?'Buscar órgãos e oportunidades B2G':'Buscar clientes, oportunidades e editais'} placeholder={market==='B2B'?'Buscar clientes e oportunidades B2B...':market==='B2G'?'Buscar órgãos e oportunidades B2G...':'Buscar clientes, oportunidades, editais...'} value={query} onChange={event => {
        requestId.current += 1;
        setQuery(event.target.value);
        setResults(null);
        setLoading(false);
      }} /><kbd className="hidden xl:inline text-[10px] whitespace-nowrap">Ctrl + K</kbd></form>{results != null && <div className="nex-header-results" role="region" aria-label="Resultados da busca"><button aria-label="Fechar resultados" onClick={() => {
        requestId.current += 1;
        setResults(null);
        setLoading(false);
      }}><span>Resultados</span><X size={14} /></button>{loading ? <p role="status">Buscando...</p> : error ? <p role="alert">Não foi possível buscar. Tente novamente.</p> : results.length ? results.map((row, i) => <button key={`${row.id}-${i}`} onClick={() => {
        setResults(null);
        navigate(`${row.route}?search=${encodeURIComponent(row.title)}`);
      }}><span>{row.title}</span><small>{row.type}</small></button>) : <p>Nenhum registro encontrado.</p>}</div>}</div>;
}
