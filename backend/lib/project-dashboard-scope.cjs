function projectDashboardWhere(user = {}) {
  const role = String(user.actualRole || user.role || '').trim().toUpperCase();
  const privileged = ['MASTER','ADMIN','MANAGER','DIRECTOR'].includes(role);
  const tenant = role === 'MASTER' ? null : user.tenantCompanyId;
  const id = user.id || user.userId || '__missing_actor__';
  return {
    ...(tenant ? {company:{tenantCompanyId:tenant}} : {}),
    ...(!privileged ? {OR:[{projectManagerId:id},{createdBy:id},{team:{some:{userId:id,isActive:true}}}]} : {})
  };
}
module.exports = {projectDashboardWhere};
