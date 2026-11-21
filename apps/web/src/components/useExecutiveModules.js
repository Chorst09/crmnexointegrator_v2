import useDashboardSync from '../hooks/useDashboardSync';
import { useEffect, useMemo, useState } from 'react';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import { getUserAccess, normalizeRole } from '../utils/permissions';
import { buildGeneralDashboardMetrics, parseUserFromStorage } from './generalDashboardMetrics.mjs';

const EMPTY_DATA={};
export default function useExecutiveModules(market) {
  const [refreshKey,setRefreshKey] = useState(0);
  useEffect(()=>{
    const refresh=()=>setRefreshKey(value=>value+1);
    window.addEventListener('nexos-refresh-modules',refresh);
    return ()=>window.removeEventListener('nexos-refresh-modules',refresh);
  },[]);
  useDashboardSync(() => setRefreshKey(value => value + 1));
  const [state,setState] = useState({market,data:{},loading:true,error:''});
  const user = useMemo(()=>parseUserFromStorage(),[]);
  const access = getUserAccess(user);
  const adminLike = ['MASTER','ADMIN','DIRECTOR','MANAGER'].includes(normalizeRole(user?.role));
  useEffect(()=>{
    const controller=new AbortController();
    fetch(buildApiUrl(`/dashboard?type=module-overview&market=${market}`),{headers:getAuthHeaders(),signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error('modules');
        const payload=await response.json();
        if(!payload?.data || payload.market!==market)throw new Error('modules');
        if(!controller.signal.aborted)setState({market,data:payload.data,loading:false,error:payload.moduleHealth?.some(item=>item.status==='error') ? 'Alguns módulos estão temporariamente indisponíveis.' : ''});
      })
      .catch(error=>{if(error.name!=='AbortError')setState({market,data:{},loading:false,error:'Não foi possível carregar a visão dos módulos.'});});
    return ()=>controller.abort();
  },[refreshKey,market]);
  const data=state.market===market ? state.data : EMPTY_DATA;
  const computed=useMemo(()=>buildGeneralDashboardMetrics(data,'365000'),[data]);
  return {...state,data,loading:state.market!==market || state.loading,computed,access,adminLike};
}
