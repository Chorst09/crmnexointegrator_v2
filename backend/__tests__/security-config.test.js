const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const readRepoFile = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('security configuration smoke checks', () => {
  test('API auth does not use a public fallback JWT secret', () => {
    const publicFallback = ['process.env.JWT_SECRET', "'your-secret-key'"].join(' || ');

    expect(readRepoFile('apps/api/lib/auth.cjs')).not.toContain(publicFallback);
    expect(readRepoFile('apps/api/api/auth.cjs')).not.toContain(publicFallback);
  });

  test('production deploy scripts do not contain hardcoded server credentials', () => {
    const deployScript = readRepoFile('deploy-servidor.sh');

    expect(deployScript).not.toMatch(/sshpass -p\s+\S+/);
    expect(deployScript).not.toContain('<ADMIN_PASSWORD>');
  });

  test('production compose does not define default secrets', () => {
    const composeFile = readRepoFile('docker-compose.production.yml');

    expect(composeFile).not.toMatch(/\$\{DB_PASSWORD:-/);
    expect(composeFile).not.toMatch(/\$\{JWT_SECRET:-/);
  });
});
