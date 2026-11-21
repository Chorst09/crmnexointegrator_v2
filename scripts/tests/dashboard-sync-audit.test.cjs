const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('project charts contain only dated entries and stay at zero with no records',async()=>{
  const {buildProjectEntrySeries:build}=await import('../../apps/web/src/project-management/dashboardMetrics.mjs');
  const now=new Date('2026-11-19T12:00:00');
  assert.equal(build([],now).reduce((sum,row)=>sum+row.total,0),0);
  const data=build([
    {createdAt:'2026-11-18T12:00:00',status:'CONCLUÍDO'},
    {createdAt:'2026-11-18T12:00:00',status:'EM PROGRESSO'},
    {createdAt:'2026-11-01T12:00:00',status:'PLANEJAMENTO'},
    {createdAt:'2020-01-01',status:'CONCLUÍDO'},
    {createdAt:'2027-01-01',status:'CONCLUÍDO'},
    {createdAt:'invalid',status:'CONCLUÍDO'}
  ],now);
  assert.equal(data.reduce((sum,row)=>sum+row.total,0),3);
  assert.equal(data.reduce((sum,row)=>sum+row.concluido,0),1);
  assert.equal(data.reduce((sum,row)=>sum+row.progresso,0),1);
});

test('project dashboards exhaust pages and reject incomplete or repeated pages',async()=>{
  const {loadDashboardPages:load}=await import('../../apps/web/src/utils/loadDashboardPages.mjs');
  const calls=[];
  const rows=await load(async page=>{calls.push(page);return {projects:[{id:String(page)}],total:3}},{limit:1});
  assert.deepEqual(calls,[1,2,3]);assert.equal(rows.length,3);
  await assert.rejects(load(async()=>({projects:[{id:'same'}],total:3}),{limit:1}));
  await assert.rejects(load(async()=>({projects:[],total:3}),{limit:1}));
});

function simulatorRoute(file,prisma){
  const routes={},router=Object.fromEntries(['get','post','put','delete'].map(method=>[method,(path,...handlers)=>{routes[method+' '+path]=handlers.at(-1)}]));
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{
    module:{exports:{}},console:{log(){},warn(){},error(){}},
    require:name=>name==='express'?{Router:()=>router}:name.includes('prisma')?{prisma}
      :name.includes('financial-dashboard-scope')?require('../../backend/lib/financial-dashboard-scope.cjs')
      :name.includes('chorst-privacy')?{canAccessChorstData:()=>false}
      :name.includes('simulator-proposal-owner')?require('../../backend/lib/simulator-proposal-owner.cjs'):{authenticateToken(){}}
  });return routes['get /'];
}
for(const file of ['apps/api/api/simulator-proposals.cjs','backend/api/simulator-proposals.js']){
  test(`${file}: no truncation or healthy empty result when the source fails`,async()=>{
    let args;const proposals=Array.from({length:1005},(_,id)=>({id:String(id),value:1}));
    const route=simulatorRoute(file,{simulatorProposal:{findMany:async query=>{args=query;return proposals}}});
    let result,status=200;const res={json:value=>{result=value;return value},status:code=>{status=code;return res}};
    const user={id:'owner',email:'owner@example.invalid',role:'SELLER'};
    await route({query:{dashboard:'true'},user},res);
    assert.equal(status,200);assert.equal(args.take,undefined);
    assert.equal(result.data.proposals.length,1005);
    const failed=simulatorRoute(file,{simulatorProposal:{findMany:async()=>{throw Error('offline')}}});
    await failed({query:{dashboard:'true'},user},res);
    assert.equal(status,500);assert.equal(result.success,false);
  });
  test(`${file}: tenant managers only aggregate proposals from their team`,async()=>{
    let args;const route=simulatorRoute(file,{user:{findMany:async()=>[{id:'team-id',email:'team@example.invalid'}]},simulatorProposal:{findMany:async query=>{args=query;return []}}});
    await route({query:{all:'true'},user:{id:'manager',role:'MANAGER',tenantCompanyId:'tenant'}},{json:value=>value,status(){return this}});
    assert.deepEqual(JSON.parse(JSON.stringify(args.where.AND[0].OR)),[{createdBy:'team-id'},{createdBy:{equals:'team@example.invalid',mode:'insensitive'}}]);
  });
}

for(const root of ['apps/api','backend']){
  test(`${root}: project totals and listing use the same actor and tenant scope`,()=>{
    const {projectDashboardWhere:scope}=require(`../../${root}/lib/project-dashboard-scope.cjs`);
    assert.deepEqual(scope({id:'actor',role:'SELLER',tenantCompanyId:'tenant'}),{
      company:{tenantCompanyId:'tenant'},OR:[{projectManagerId:'actor'},{createdBy:'actor'},{team:{some:{userId:'actor',isActive:true}}}]
    });
    assert.deepEqual(scope({id:'admin',role:'ADMIN',tenantCompanyId:'tenant'}),{company:{tenantCompanyId:'tenant'}});
    assert.deepEqual(scope({id:'master',role:'MASTER',tenantCompanyId:'tenant'}),{});
  });
  test(`${root}: targets preserve seller and region filters while enforcing actor and tenant`,async()=>{
    const tenant=await import(`../../${root}/lib/tenantScope.js`);let query;
    const source=fs.readFileSync(`${root}/api/sales-targets.js`,'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','async function handler');
    const prisma={salesTarget:{findMany:async args=>{query=args;return []}}};
    const handler=new Function('prisma','getTenantCompanyId','mergeRelationWhere',source+';return handler')(prisma,tenant.getTenantCompanyId,tenant.mergeRelationWhere);
    await handler({method:'GET',query:{sellerId:'foreign',regionId:'region'},user:{id:'actor',role:'SELLER',tenantCompanyId:'tenant'}});
    assert.equal(query.where.sellerId,'foreign');
    assert.deepEqual(query.where.seller,{regionId:'region',tenantCompanyId:'tenant',id:'actor'});
  });
  test(`${root}: target summary counts one sale once across overlapping target periods`,async()=>{
    const tenant=await import(`../../${root}/lib/tenantScope.js`);
    const targets=[1,2].map(id=>({id,sellerId:'actor',startDate:new Date('2026-11-01'),endDate:new Date('2026-11-30'),targetValue:1000}));
    const source=fs.readFileSync(`${root}/api/sales-targets.js`,'utf8').replace(/^import .*;\n/gm,'').replace('export default async function handler','async function handler');
    const prisma={salesTarget:{findMany:async()=>targets},opportunity:{findMany:async()=>[{id:'same-sale',value:500}]}};
    const handler=new Function('prisma','getTenantCompanyId','mergeRelationWhere',source+';return handler')(prisma,tenant.getTenantCompanyId,tenant.mergeRelationWhere);
    const response=await handler({method:'GET',query:{includeSummary:'true'},user:{id:'actor',role:'SELLER'}});
    const data=await response.json();
    assert.equal(data.targets.length,2);assert.equal(data.targets[0].realized,500);
    assert.equal(data.summary.realized,500);assert.equal(data.summary.realizedDeals,1);
  });
}
