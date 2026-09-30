// src/lib/env-check.ts
export function checkEnvironmentVariables() {
  const databaseUrl = process.env.DATABASE_URL;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;

  const issues: string[] = [];

  if (!databaseUrl) {
    issues.push('DATABASE_URL não está definida');
  } else if (!databaseUrl.startsWith('postgresql://')) {
    issues.push('DATABASE_URL deve começar com postgresql://');
  }

  if (!nextAuthSecret) {
    issues.push('NEXTAUTH_SECRET não está definida');
  } else if (nextAuthSecret.length < 32) {
    issues.push('NEXTAUTH_SECRET parece estar muito curta (mínimo 32 caracteres)');
  }

  return {
    isValid: issues.length === 0,
    issues,
    config: {
      databaseUrl: databaseUrl ? `${databaseUrl.substring(0, 30)}...` : 'não definida',
      nextAuthSecret: nextAuthSecret ? `${nextAuthSecret.substring(0, 10)}...` : 'não definida'
    }
  };
}

export function logEnvironmentStatus() {
  const check = checkEnvironmentVariables();
  
  if (check.isValid) {
    console.log('✅ Variáveis de ambiente do PostgreSQL configuradas corretamente');
    console.log('📍 Database URL:', check.config.databaseUrl);
    console.log('🔑 Auth Secret:', check.config.nextAuthSecret);
  } else {
    console.error('❌ Problemas com as variáveis de ambiente:');
    check.issues.forEach(issue => console.error(`  - ${issue}`));
    console.log('📋 Configuração atual:', check.config);
  }
  
  return check;
}
