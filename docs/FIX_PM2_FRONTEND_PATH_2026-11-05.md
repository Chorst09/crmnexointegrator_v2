# Fix PM2 Frontend Path - 2026-11-05

## Problema Identificado

O toggle "Gerar Alerta" e o resumo de produtos não apareciam nos cards de contratos na página de Empresas, apesar do código estar correto e o deploy ter sido feito com sucesso.

## Causa Raiz

O processo PM2 `nexoscrm-frontend` estava configurado para servir de um diretório fixo:
```
/var/www/nexoscrm/frontend/dist
```

Mas o sistema de deploy usa releases com symlink:
```
/var/www/nexoscrm/frontend/releases/release-YYYYMMDD-HHMMSS/
/var/www/nexoscrm/frontend/current -> releases/release-YYYYMMDD-HHMMSS/
```

## Solução Aplicada

Reconfigurado o processo PM2 para servir do symlink `current`:

```bash
pm2 delete nexoscrm-frontend
pm2 start serve --name nexoscrm-frontend -- -s /var/www/nexoscrm/frontend/current -l 3027
pm2 save
```

## Resultado

✅ Frontend agora serve automaticamente do release mais recente via symlink
✅ Toggle "Gerar Alerta" visível e funcional
✅ Resumo/produtos aparecendo nos cards de contrato
✅ Deploys futuros funcionarão corretamente (basta atualizar o symlink)

## Arquivos no Release

- Release ativo: `release-20261105-163837`
- Bundle Empresas: `Empresas-rl4feOqe.js` (45KB)
- Ícone Bell: compartilhado via chunk `BuscarEditais-BruQy6Ju.js` (Vite code splitting)

## Configuração PM2

```
┌───┬───────────────────┬────────────────────────────────────────────────┐
│ id│ name              │ script                                         │
├───┼───────────────────┼────────────────────────────────────────────────┤
│ 5 │ nexoscrm-frontend │ serve -s /var/www/nexoscrm/frontend/current -l │
│   │                   │ 3027                                           │
└───┴───────────────────┴────────────────────────────────────────────────┘
```

## Comandos de Deploy (Futuro)

Para futuros deploys:
```bash
# 1. Criar novo release
RELEASE_NAME="release-$(date +%Y%m%d-%H%M%S)"
scp -r apps/web/dist/* root@200.142.149.2:/var/www/nexoscrm/frontend/releases/$RELEASE_NAME/

# 2. Atualizar symlink
ssh root@200.142.149.2 "ln -snf releases/$RELEASE_NAME /var/www/nexoscrm/frontend/current"

# 3. Frontend recarrega automaticamente (serve detecta mudança)
# Não é necessário reiniciar PM2!
```
