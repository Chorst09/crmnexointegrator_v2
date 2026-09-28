const { prisma } = require('./lib/prisma.cjs');

async function run() {
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM gerenciadas_licitacao');
    console.log('ROWS IN gerenciadas_licitacao:', rows.length);
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}
run();


