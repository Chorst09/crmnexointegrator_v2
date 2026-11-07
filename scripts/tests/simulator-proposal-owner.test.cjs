const {test}=require('node:test');
const assert=require('node:assert/strict');
for(const file of ['../../backend/lib/simulator-proposal-owner.cjs','../../apps/api/lib/simulator-proposal-owner.cjs']) {
 const {assignProposalOwner}=require(file);
 const seller='fabio.oliveira@doubletelecom.com.br';
 const original={id:'original',createdBy:seller};
 const prisma={simulatorProposal:{findFirst:async query=>{assert.equal(query.where.type,'RADIO');return original;}}};
 for(const role of ['ADMIN','MASTER'])test(`${file}: ${role} mantém Fabio na nova versão`,async()=>{
  const result=await assignProposalOwner(prisma,{baseId:'Prop_Inter_Radio_004_v2',version:2,type:'RADIO',client:'Intelle',createdBy:'admin@example.com',metadata:{products:['radio']}},{},{role,email:'admin@example.com'});
  assert.equal(result.createdBy,seller);assert.equal(result.metadata.sourceProposalId,'original');assert.equal(result.metadata.versionEditedBy,'admin@example.com');assert.deepEqual(result.metadata.products,['radio']);
 });
 test(`${file}: vendedor não pode herdar proposta alheia`,async()=>{
  await assert.rejects(assignProposalOwner(prisma,{baseId:'Prop_Inter_Radio_004_v2',type:'RADIO',client:'Intelle'},{},{role:'SELLER',email:'outro@example.com'}),{status:403});
 });
 test(`${file}: Fabio pode gerar a própria versão`,async()=>{
  const result=await assignProposalOwner(prisma,{baseId:'Prop_Inter_Radio_004_v2',type:'RADIO',client:'Intelle'},{},{role:'SELLER',email:seller});assert.equal(result.createdBy,seller);
 });
 test(`${file}: não inventa vendedor se original não existe`,async()=>{
  await assert.rejects(assignProposalOwner({simulatorProposal:{findFirst:async()=>null}},{baseId:'Prop_Inter_Radio_004_v2',type:'RADIO'},{},{role:'MASTER',email:'admin@example.com'}),{status:400});
 });
 test(`${file}: primeira versão usa usuário autenticado quando criador está ausente`,async()=>{
  const result=await assignProposalOwner(prisma,{baseId:'Prop_Inter_Radio_004_v1',type:'RADIO'},{},{email:seller});assert.equal(result.createdBy,seller);
 });
}
