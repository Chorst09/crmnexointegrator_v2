# Carregamento nexosv2 — 13/10/2026

A lentidão inicial foi reproduzida e reduzida em produção no commit `209d191`. Quase todos os módulos do CRM eram importados na inicialização, mesmo no login; o SDK Mercado Pago também bloqueava o HTML em todas as páginas. As páginas e o layout passam a carregar sob demanda, e o SDK apenas quando o checkout precisa renderizar a carteira de pagamento.

## Medições em produção

| Medida | Antes | Depois |
| --- | ---: | ---: |
| JavaScript inicial descomprimido | 3.280.276 bytes | 221.914 bytes |
| JavaScript inicial transferido | 973.958 bytes | 82.151 bytes |
| Login utilizável, condição controlada | 6.840 ms | 1.986 ms |
| Login utilizável, sem limitação simulada | 1.929 ms | 1.087 ms |

O teste controlado usa Chromium com perfil novo, 150 ms adicionais de latência, download 1,6 Mbps, upload 750 kbps e CPU 4x mais lenta. O JavaScript inicial caiu aproximadamente 93% em tamanho, e o tempo do login controlado caiu 71%. Medições pontuais variam com rede e dispositivo; não são garantia de tempo para todos os usuários. Não houve falha de recurso no teste final, nem carregamento do SDK de pagamento no login.

## Verificação e limites

Build concluído. Login, B2G, modal com valor/anexo e checkout foram verificados no navegador. O carregador do SDK foi validado com resposta simulada e duas chamadas simultâneas, gerando apenas uma requisição e sem iniciar pagamentos. A API permaneceu saudável e conectada ao banco; o processo nexosv2 da porta 3025 não precisou reiniciar para esta mudança de frontend.

A busca B2G consulta portais governamentais em tempo real. O tempo dessas consultas é separado da abertura do CRM. A busca DOU isolada de Office365 respondeu em 6,1 segundos na confirmação em produção; os dois PDFs oficiais dos prints foram baixados pelo endpoint autenticado do CRM e validados como PDF completo. CRF-SP: R$ 2.982.984,84; Eletronuclear: orçamento declarado totalmente sigiloso pelo PNCP.

O servidor apresentou carga média 0,67 e cerca de 4 GB de memória disponível na coleta, sem evidência de esgotamento de RAM. Foi identificado outro processo, `crmnexointegrator_3026`, com contador de reinícios aumentando de 7.338 para 7.363 durante a análise. A configuração e o estado desse outro serviço não foram alterados.

[Dados das medições e downloads DOU](NEXOSV2-DESEMPENHO-2026-10-13.json).
