const ADMIN_ROLES = new Set(['MASTER','ADMIN','MANAGER','DIRECTOR']);

/** Query one commercial domain before aggregation. Never load the other domain. */
export async function buildMarketDashboardOverview({prisma,user={},market,tenantCompanyId=null}) {
  if(!['B2B','B2G'].includes(market)) throw Object.assign(new Error('Mercado inválido'),{status:400});
  const role=String(user.actualRole || user.role || '').toUpperCase();
  const allOwners=ADMIN_ROLES.has(role);
  const ownerId=allOwners ? null : (user.id || user.userId);
  if(!allOwners && !ownerId) throw Object.assign(new Error('Usuário sem identificação'),{status:403});
  if((role==='USER_B2B' && market==='B2G') || (role==='USER_B2G' && market==='B2B') || user[`access${market}`]===false) {
    throw Object.assign(new Error('Módulo não autorizado'),{status:403});
  }
  const tenant=tenantCompanyId ? {tenantCompanyId} : {};
  const classification=market==='B2B'
    ? {company:{clientType:'B2B',...tenant},b2gStage:null,OR:[{number:null},{NOT:{number:{startsWith:'B2G-'}}}]}
    : {OR:[{company:{clientType:'B2G',...tenant}},{b2gStage:{not:null}},{number:{startsWith:'B2G-'}}]};
  const opportunityWhere={...tenant,...(ownerId ? {ownerId} : {}),...classification};
  const companyWhere={...tenant,clientType:market,...(ownerId ? {opportunities:{some:opportunityWhere}} : {})};
  const companySelect={id:true,name:true,clientType:true,status:true,state:true,city:true,address:true,leadScore:true,createdAt:true,updatedAt:true};
  const opportunitySelect={id:true,title:true,number:true,value:true,stage:true,b2gStage:true,probability:true,description:true,companyId:true,ownerId:true,projectType:true,projectMonths:true,contractMonths:true,monthlyValue:true,installationFee:true,revenueType:true,contractPeriodMonths:true,monthlyRecurringValue:true,totalContractValue:true,totalProductsValue:true,setupValue:true,expectedCloseDate:true,actualCloseDate:true,createdAt:true,updatedAt:true,company:{select:companySelect},owner:{select:{id:true,name:true}}};
  const health=[];
  async function query(key,label,operation) {
    try {const rows=await operation();health.push({key,label,status:'ok',count:rows.length,enabled:true});return rows;}
    catch {health.push({key,label,status:'error',count:0,enabled:true,error:'Dados indisponíveis'});return [];}
  }
  const [opportunities,companies,activities,contracts,proposals]=await Promise.all([
    query(`opportunities${market}`,`Oportunidades ${market}`,()=>prisma.opportunity.findMany({where:opportunityWhere,select:opportunitySelect,orderBy:{updatedAt:'desc'}})),
    query(`companies${market}`,market==='B2G'?'Órgãos B2G':'Clientes B2B',()=>prisma.company.findMany({where:companyWhere,select:companySelect,orderBy:{name:'asc'}})),
    query('activities',`Agenda ${market}`,()=>prisma.activity.findMany({where:{...tenant,...(ownerId?{assignedToId:ownerId}:{}),OR:[{opportunity:opportunityWhere},{opportunityId:null,company:companyWhere}]},select:{id:true,subject:true,status:true,type:true,dueDate:true,createdAt:true,updatedAt:true,companyId:true,opportunityId:true},orderBy:{dueDate:'asc'}})),
    query('contracts',`Contratos ${market}`,()=>prisma.contract.findMany({where:{company:companyWhere,...(ownerId?{opportunity:opportunityWhere}:{OR:[{opportunity:opportunityWhere},{opportunityId:null}]})},select:{id:true,title:true,value:true,status:true,startDate:true,endDate:true,createdAt:true,updatedAt:true,companyId:true},orderBy:{updatedAt:'desc'}})),
    query('proposals',`Propostas ${market}`,()=>prisma.proposal.findMany({where:{opportunity:opportunityWhere},select:{id:true,title:true,status:true,totalValue:true,createdAt:true,updatedAt:true},orderBy:{updatedAt:'desc'}}))
  ]);
  return {market,data:{[`opportunities${market}`]:opportunities,[`companies${market}`]:companies,activities:activities.map(item=>({...item,clientType:market})),contracts,proposals},moduleHealth:health};
}
