async function financialDashboardScope(prisma,user={}) {
  const role=String(user.actualRole || user.role || '').trim().toUpperCase();
  const privileged=['MASTER','ADMIN','MANAGER','DIRECTOR'].includes(role);
  const id=user.id || user.userId;
  if(!privileged && !id)throw Object.assign(new Error('Usuário sem identificação'),{status:403});
  const tenant=role==='MASTER'?null:user.tenantCompanyId;
  const opportunity={...(tenant?{tenantCompanyId:tenant}:{}),...(!privileged?{ownerId:id}:{})};
  const commission={...(tenant?{opportunity:{tenantCompanyId:tenant}}:{}),...(!privileged?{sellerId:id}:{})};
  let people=[];
  if(tenant && privileged)people=await prisma.user.findMany({where:{tenantCompanyId:tenant},select:{id:true,email:true}});
  else if(!privileged)people=[{id,email:user.email}];
  const identities=people.flatMap(person=>[person.id?{createdBy:person.id}:null,person.email?{createdBy:{equals:person.email.trim(),mode:'insensitive'}}:null].filter(Boolean));
  const simulator=tenant || !privileged ? identities.length ? {OR:identities} : {id:{in:[]}} : {};
  return {opportunity,commission,simulator};
}
module.exports={financialDashboardScope};
