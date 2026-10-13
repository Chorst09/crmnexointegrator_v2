# Diagnóstico B2G — Buscar Editais — 13/10/2026

As causas foram reproduzidas no código e corrigidas no workspace. A validação dos adaptadores locais contra fontes públicas encontrou 68 registros após os filtros de Paraná e publicação de 06 a 13/10/2026, incluindo 27 do DOU. A consulta usou as dez fontes; na captura enviada, uma fonte estava desativada. Esses números pertencem à implementação local corrigida; a versão publicada ainda apresenta o problema original confirmado abaixo. A disponibilidade das fontes pode variar.

As alterações ainda não foram publicadas. As modificações preexistentes em outros módulos foram preservadas.

**Validação autenticada em produção — 09:18 a 09:20 de 13/10/2026**

Após a autorização do usuário, foi realizado login na API de `nexosv2.chorstconsult.com.br` e foram consultados os endpoints de workers e busca. Não foram publicados arquivos nem alterados registros ou configurações do CRM. Credenciais e tokens não foram incluídos nos arquivos de evidência.

A consulta com as nove fontes da captura, PR e publicação de 06 a 13/10/2026 reproduziu exatamente os totais: 24 registros na API, dos quais 22 estavam sem UF — 19 do DOU e três atas. Somente os dois de Curitiba tinham UF PR e, por isso, passavam pelo filtro da tela.

Os campos municipais também reproduziram o erro: `status` continha os protocolos `01-283294/2025` e `01-298887/2025`; `protocolo` continha as datas `08/01/2026` e `09/01/2026`; abertura e publicação estavam nulas. Os valores recebidos foram zero e R$ 183.896,76, respectivamente.

Os nove workers acionados atualizaram seus horários de execução. O PNCP, desativado na captura, foi consultado separadamente e retornou 40 registros PR, sem erro de execução. Destes, 34 tinham publicação anterior a 06/10/2026, confirmando que o intervalo de publicação não estava sendo respeitado nesse fluxo. A consulta isolada não alterou a seleção de fontes do usuário.

Ao final, os dez workers tinham sido verificados: oito com execução concluída, um parcial (e-Compras bloqueado, usando fonte alternativa) e um com erro (Transparência Federal sem chave de API). Os status concluídos também incluem fontes com zero resultados; os erros de normalização e filtros permanecem na versão publicada.

As evidências dessas consultas estão em [B2G-PRODUCAO-2026-10-13.json](B2G-PRODUCAO-2026-10-13.json). A próxima etapa para corrigir o site é publicar o backend e o frontend preparados no workspace. A ausência da chave da Transparência Federal permanece uma pendência de configuração independente.

**Causas identificadas e correções**

- **DOU coletado, mas ausente na lista:** o adaptador preenchia UF e município com strings vazias. A tela descartava todos esses registros ao selecionar PR. Além disso, o portal combina palavras soltas por OU: consultar “licitação Paraná” também retornava licitações nacionais, que ocupavam a primeira página. A consulta passa a buscar a localização primeiro, percorrer a paginação oficial e confirmar a UF pelos metadados ou pela publicação original. Não atribui PR simplesmente porque PR foi solicitado. A regra distingue Ji-Paraná/RO de Paraná/PR.
- **Contagens divergentes:** o indicador por fonte exibia a coleta anterior à deduplicação e aos filtros; “Base com certames catalogados” representava apenas a resposta corrente. A tela agora distingue coletados de exibidos, informa as exclusões por UF, município, período e encerramento e preserva as origens dos registros compartilhados.
- **Curitiba com processos antigos apresentados como ativos:** a tabela oficial tem dez colunas; o scraper lia nove. A data de abertura era ignorada, o protocolo ocupava a posição de situação, e o número do processo não correspondia ao protocolo exibido. Foram corrigidos o mapeamento, os status concluídos, a sessão pública, o envio dos filtros ao formulário ASP.NET, os postbacks assíncronos e a paginação com atualização dos campos de estado. A consulta direta ainda apresenta timeout; o fallback oficial mantém os resultados e sinaliza execução parcial.
- **Valores zerados:** a tela convertia valores ausentes para zero. A extração agora aceita formatos numéricos e monetários brasileiros, recupera valores disponíveis em outra origem do mesmo identificador e mantém ausências como nulas. Cards e detalhes mostram “Não informado”; valores ausentes ficam no fim da ordenação. No exemplo da placa, o [portal oficial de Curitiba](https://www.transparencia.curitiba.pr.gov.br/sgp/licitacoes.aspx) também publica R$ 0,00 para o protocolo 01-283294/2025. O CRM não inventa um valor para esse caso.
- **Prazos incorretos:** uma data qualquer no texto do DOU podia ser usada como prazo. A extração passou a exigir contexto de abertura, sessão ou recebimento de propostas e evita tratar assinatura ou início do recebimento como encerramento. A sessão municipal vencida é excluída; o início do recebimento de propostas, sozinho, não elimina um edital. Datas sem horário de encerramento são consideradas até o fim do dia no horário de Brasília.
- **PNCP sem publicações da janela escolhida:** propostas publicadas fora do intervalo preenchiam o limite e impediam a consulta das publicações recentes. Esse preenchimento passou a respeitar o intervalo de publicação.
- **Atas sem UF:** a resposta oficial de ARP não fornece a UF no esquema básico. Quando necessário, o adaptador consulta o cadastro público da UASG gerenciadora. Não presume a UF solicitada. Os três registros da amostra pertenciam a outras UFs e ficaram fora do filtro PR. Referência: [manual oficial da API Compras.gov.br](https://www.gov.br/compras/pt-br/acesso-a-informacao/manuais/manual-dados-abertos/manual-api-compras.pdf).
- **Pool descartando trabalho já realizado:** uma etapa lenta podia fazer a execução retornar zero mesmo depois de coletar páginas válidas. O pool preserva esses registros e marca a execução como parcial. Buscas simultâneas também não sobrescrevem o status da busca mais recente com um resultado antigo.

**Funcionamento real do pool**

Os dez adaptadores executam em paralelo quando uma busca é solicitada, com limite de até 22 segundos por fonte. O endpoint de workers guarda a última execução em memória do processo da API; o estado não é persistente e pode diferir entre processos de um servidor com múltiplas instâncias.

A configuração não inicia um agendamento contínuo. A indicação anterior de worker “Ativo” representava a última consulta bem-sucedida. O monitor agora informa “Concluído”, mostra falhas na atualização e descreve a execução sob demanda. As referências a Playwright, OCR e Elasticsearch no fluxo visual foram substituídas pelo processamento efetivamente usado nesta busca.

**Consulta pública com os adaptadores locais, às 08:56 de 13/10/2026**

| Fonte | Coletados | Após filtros, incluindo origens compartilhadas | Execução |
| --- | ---: | ---: | --- |
| PNCP Oficial | 40 | 37 | Concluída |
| ComprasNet / Compras.gov.br | 0 | 0 | Concluída, sem registros |
| Imprensa Nacional — DOU | 40 | 27 | Concluída |
| Transparência Curitiba | 11 | 10 | Parcial; fallback PNCP |
| Transparência Federal | 0 | 0 | Chave de API ausente no diagnóstico |
| e-Compras Curitiba | 7 | 6 | Parcial; acesso programático bloqueado, fallback PNCP |
| Contratações Lei 14.133 | 0 | 0 | Concluída, sem registros |
| Atas de Registro de Preços | 3 | 0 | Concluída; registros de outras UFs |
| Pregões SIASG | 0 | 0 | Concluída, sem registros |
| Compras.gov Disputas | 0 | 0 | Concluída, sem registros |

Foram 101 registros coletados, 87 identificadores únicos e 68 registros após os filtros. Os totais por origem não devem ser somados, pois o mesmo registro pode ter mais de uma origem. Quatro publicações do DOU forneceram valores positivos na leitura do texto oficial; as restantes não receberam valores presumidos. Registros sem prazo verificável permanecem com “Prazo a confirmar”.

Uma consulta posterior somente à fonte Transparência Curitiba confirmou timeout no acesso direto e recuperação de dez registros pelo PNCP. A disponibilidade e os limites das fontes externas variam; os status parciais permanecem visíveis.

O resumo desta consulta, sem credenciais nem textos integrais das publicações, está em [B2G-EVIDENCIAS-2026-10-13.json](B2G-EVIDENCIAS-2026-10-13.json).

**Validação e pendências**

- 37 testes automatizados aprovados, sem falhas, cobrindo busca, documentos e cache: seleção de fontes, filtros, DOU regional, paginação, tabela municipal, postbacks ASP.NET, valores, prazos, deduplicação, recuperação de páginas após timeout e concorrência entre buscas. Comando: `node --test scripts/tests/b2g-multisource.test.cjs scripts/tests/b2g-document-download.test.cjs scripts/tests/b2g-file-cache.test.cjs`.
- Build do frontend concluído. Permanecem os avisos de tamanho de bundle e anotações de dependências, sem falha de compilação.
- Conferência visual em navegador local, com APIs simuladas: DOU visível no filtro PR, contagem após filtros, valores ausentes nos cards e detalhes e monitor dos workers. Nenhum erro JavaScript observado.
- A API pública de saúde de produção respondeu `ok` e `database: connected` às 08:27. Isso não comprova o funcionamento de cada worker em produção.
- A consulta autenticada em produção foi concluída após autorização explícita do usuário. Os segredos dos arquivos de configuração locais não validaram tokens no servidor publicado; a autenticação regular com o acesso documentado mais recentemente funcionou. Não foram alteradas credenciais.
- A chave da Transparência Federal precisa ser conferida no ambiente publicado. A captura já informa sua ausência; o diagnóstico local reproduziu o comportamento sem configurar uma chave. Nenhuma chave foi criada ou alterada.
