// Decodificar JWT para ver o role
const token = process.argv[2];

if (!token) {
  console.log('Uso: node decode_jwt.js <token>');
  process.exit(1);
}

// JWT tem 3 partes separadas por ponto
const parts = token.split('.');
if (parts.length !== 3) {
  console.log('Token inválido');
  process.exit(1);
}

// Decodificar a parte do payload (segunda parte)
const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
console.log('Payload do JWT:');
console.log(JSON.parse(payload));
