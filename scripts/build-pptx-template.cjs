const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function buildTemplate() {
  const zip = new JSZip();

  const baseDir = path.resolve(__dirname, '..');
  const webpCover = fs.readFileSync(path.join(baseDir, 'apps/web/public/proposal-templates/double/cover.webp'));
  const webpWho = fs.readFileSync(path.join(baseDir, 'apps/web/public/proposal-templates/double/who.webp'));
  const webpHero = fs.readFileSync(path.join(baseDir, 'apps/web/public/proposal-templates/double/hero.webp'));
  const webpLetterhead = fs.readFileSync(path.join(baseDir, 'apps/web/public/proposal-templates/double/letterhead.webp'));
  const webpPage = fs.readFileSync(path.join(baseDir, 'apps/web/public/proposal-templates/double/page.webp'));
  const webpClosing = fs.readFileSync(path.join(baseDir, 'apps/web/public/proposal-templates/double/closing.webp'));

  // Media files
  zip.file('ppt/media/cover.webp', webpCover);
  zip.file('ppt/media/who.webp', webpWho);
  zip.file('ppt/media/hero.webp', webpHero);
  zip.file('ppt/media/letterhead.webp', webpLetterhead);
  zip.file('ppt/media/page.webp', webpPage);
  zip.file('ppt/media/closing.webp', webpClosing);

  // Content types
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="webp" ContentType="image/webp"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide5.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide6.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide7.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide8.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide9.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide10.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;
  zip.file('[Content_Types].xml', contentTypesXml);

  // _rels/.rels
  const packageRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
  zip.file('_rels/.rels', packageRelsXml);

  // ppt/presentation.xml
  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst/>
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
    <p:sldId id="258" r:id="rId3"/>
    <p:sldId id="259" r:id="rId4"/>
    <p:sldId id="260" r:id="rId5"/>
    <p:sldId id="261" r:id="rId6"/>
    <p:sldId id="262" r:id="rId7"/>
    <p:sldId id="263" r:id="rId8"/>
    <p:sldId id="264" r:id="rId9"/>
    <p:sldId id="265" r:id="rId10"/>
  </p:sldIdLst>
  <p:sldSz cx="7559675" cy="10691800"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
  zip.file('ppt/presentation.xml', presentationXml);

  // ppt/_rels/presentation.xml.rels
  let presRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
`;
  for (let i = 1; i <= 10; i++) {
    presRelsXml += `  <Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>\n`;
  }
  presRelsXml += `</Relationships>`;
  zip.file('ppt/_rels/presentation.xml.rels', presRelsXml);

  // Helper to make slide relationships
  const makeSlideRels = (bgMediaTarget) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${bgMediaTarget}"/>
</Relationships>`;

  // Helper to wrap slide content
  const wrapSlide = (spContent) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </a:blipFill>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${spContent}
    </p:spTree>
  </p:cSld>
</p:sld>`;

  // Helper to make a text shape
  const makeShape = (id, name, x, y, cx, cy, text, opts = {}) => {
    const sz = opts.sz || 1400;
    const b = opts.b ? '1' : '0';
    const color = opts.color || 'FFFFFF';
    const algn = opts.algn || 'l';
    const anchor = opts.anchor || 't';
    const paragraphs = String(text).split('\n').map(p => `
        <a:p>
          <a:pPr algn="${algn}"/>
          <a:r>
            <a:rPr sz="${sz}" b="${b}">
              <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
              <a:latin typeface="Poppins"/>
            </a:rPr>
            <a:t>${p}</a:t>
          </a:r>
        </a:p>`).join('');

    return `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${id}" name="${name}"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${x}" y="${y}"/>
            <a:ext cx="${cx}" cy="${cy}"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="${anchor}"/>
          ${paragraphs}
        </p:txBody>
      </p:sp>`;
  };

  // --- SLIDE 1 (Capa) ---
  // Background cover.webp has "Proposta Comercial" already embedded.
  // Placeholders: 'Nome do Cliente', 'Data DD/MM/AAAA', 'Datacenter', 'Firewall'
  const slide1Sp = [
    makeShape('13', 'Client', 1100000, 5000000, 3600000, 420000, 'Nome do Cliente', { sz: 1800, b: true, color: 'FFFFFF' }),
    makeShape('14', 'Date', 1100000, 5450000, 3600000, 380000, 'Data DD/MM/AAAA', { sz: 1450, b: false, color: 'C3D4E4' }),
    makeShape('11', 'Product1', 1700000, 6500000, 2600000, 380000, 'Datacenter', { sz: 1600, b: true, color: 'FFFFFF' }),
    makeShape('12', 'Product2', 1700000, 6950000, 2600000, 380000, 'Firewall', { sz: 1600, b: true, color: 'FFFFFF' }),
  ].join('');
  zip.file('ppt/slides/slide1.xml', wrapSlide(slide1Sp));
  zip.file('ppt/slides/_rels/slide1.xml.rels', makeSlideRels('../media/cover.webp'));

  // --- SLIDE 2 (Quem Somos) ---
  // Background who.webp has "Quem Somos" tab already embedded in the cyber frame.
  // Meeting room photo is on the left.
  // Callouts are on the right: +30 Anos, +500 Clientes, +5000 Projetos.
  const slide2Sp = [
    makeShape('31', 'AboutText', 950000, 2050000, 5660000, 2500000,
      'Com três décadas de história no mercado, a Double TI + Telecom se destaca pela experiência consolidada de sua equipe e pela confiança conquistada junto aos clientes. Nossa jornada é guiada pela tradição que nos conecta às nossas raízes e pela inovação, que nos impulsionam a evoluir continuamente, sempre mirando um futuro promissor e cheio de oportunidades. Somos uma parceira estratégica, capaz de entregar soluções completas que colaboram com o sucesso de nossos clientes.',
      { sz: 1350, b: false, color: 'FFFFFF', algn: 'ctr', anchor: 'ctr' }
    ),
    makeShape('33', 'Callout1', 4900000, 5600000, 1850000, 850000, '+30\nAnos', { sz: 2600, b: true, color: 'FFFFFF', algn: 'ctr', anchor: 'ctr' }),
    makeShape('34', 'Callout2', 4900000, 6900000, 1850000, 850000, '+500\nClientes', { sz: 2600, b: true, color: 'FFFFFF', algn: 'ctr', anchor: 'ctr' }),
    makeShape('35', 'Callout3', 4900000, 8200000, 1850000, 850000, '+5000\nProjetos', { sz: 2600, b: true, color: 'FFFFFF', algn: 'ctr', anchor: 'ctr' }),
  ].join('');
  zip.file('ppt/slides/slide2.xml', wrapSlide(slide2Sp));
  zip.file('ppt/slides/_rels/slide2.xml.rels', makeSlideRels('../media/who.webp'));

  // --- SLIDE 3 (Nossos Clientes) ---
  // Background hero.webp has "Nossos Clientes" tab at top and 24 client logos in the card at bottom.
  const slide3Sp = [
    makeShape('41', 'ClientsIntro', 950000, 2050000, 5660000, 2500000,
      'Acreditamos que o sucesso do nosso negócio está diretamente ligado ao sucesso dos nossos clientes. Por isso, investimos continuamente em infraestrutura, robustez, segurança, inovação e atendimento personalizado, garantindo que cada cliente (independentemente do porte ou segmento) tenha sempre a melhor experiência possível com nossos serviços.',
      { sz: 1350, b: false, color: 'FFFFFF', algn: 'ctr', anchor: 'ctr' }
    ),
  ].join('');
  zip.file('ppt/slides/slide3.xml', wrapSlide(slide3Sp));
  zip.file('ppt/slides/_rels/slide3.xml.rels', makeSlideRels('../media/hero.webp'));

  // --- SLIDE 4 (Descritivo do Produto - letterhead.webp) ---
  // EDITÁVEL: shape 97 e 102
  const slide4Sp = [
    makeShape('95', 'Catchphrase', 800000, 1400000, 5960000, 550000,
      'A solução que consideramos mais adequada para o seu momento atual',
      { sz: 1600, b: true, color: '34526B', algn: 'ctr' }
    ),
    makeShape('96', 'SectionTitle', 850000, 2050000, 5860000, 450000, '» Descritivo do Produto', { sz: 2000, b: true, color: '34526B', algn: 'l' }),
    makeShape('97', 'Descritivo', 850000, 2600000, 5860000, 3100000,
      'O FIREWALL VIRTUAL DOUBLE é a solução ideal para empresas que buscam proteger seus ambientes digitais com alta disponibilidade, flexibilidade e segurança, sem os custos e limitações de equipamentos físicos.\n\nHospedado em nossos data centers com infraestrutura segura, o serviço oferece proteção contra ameaças, controle de tráfego, VPN, balanceamento de carga e gestão de regras de segurança de forma centralizada e escalável.\n\nCom implantação rápida e configuração personalizada, o FIREWALL VIRTUAL DOUBLE garante segurança perimetral robusta, filtragem avançada e alta performance, protegendo suas conexões, servidores, redes e aplicações.\n\nTudo isso com suporte especializado e gestão completa pela DOUBLE, eliminando a necessidade de investimentos em hardware, manutenção e múltiplos fornecedores. Uma solução eficiente, segura e alinhada às demandas de segurança das empresas modernas.',
      { sz: 1200, b: false, color: '4C6584', algn: 'l' }
    ),
    makeShape('101', 'CaracteristicasTitle', 850000, 5850000, 5860000, 350000, 'CARACTERÍSTICAS:', { sz: 1300, b: true, color: '34526B', algn: 'l' }),
    makeShape('102', 'Caracteristicas', 850000, 6250000, 5860000, 2850000,
      '● Firewall de próxima geração (NGFW) com funcionalidades de segurança avançadas;\n● Recursos escaláveis sob demanda (CPU, memória, throughput e conexões simultâneas);\n● Políticas de firewall, regras de filtragem, NAT, controle de acesso e segmentação de rede;\n● Relatórios de tráfego, uso, tentativas de acesso e eventos de segurança;\n● Monitoramento ativo e suporte especializado 24x7;\n● Integração com redes locais, ambientes na nuvem, PABX, servidores e sistemas corporativos;\n● Proteção contra ameaças, ataques DDoS, invasões, malware e tráfego malicioso.',
      { sz: 1150, b: false, color: '4C6584', algn: 'l' }
    ),
  ].join('');
  zip.file('ppt/slides/slide4.xml', wrapSlide(slide4Sp));
  zip.file('ppt/slides/_rels/slide4.xml.rels', makeSlideRels('../media/letterhead.webp'));

  // --- SLIDE 5 (Escopo Técnico - letterhead.webp) ---
  // EDITÁVEL: shape 107
  const slide5Sp = [
    makeShape('105', 'Title', 800000, 1400000, 5960000, 550000, 'Escopo Técnico', { sz: 2400, b: true, color: '34526B', algn: 'ctr' }),
    makeShape('106', 'SectionProjeto', 850000, 2050000, 5860000, 450000, '» Projeto', { sz: 2000, b: true, color: '34526B', algn: 'l' }),
    makeShape('107', 'EscopoTecnico', 850000, 2600000, 5860000, 3200000,
      'O projeto prevê a implantação da solução FIREWALL VIRTUAL DOUBLE (FORTNET OU CHECKPOINT), que oferece segurança perimetral em nuvem para ambientes corporativos.\n\nO serviço contempla o provisionamento de um ambiente virtualizado, com recursos dedicados de processamento, memória, throughput e IP fixo, hospedado em Data Center de alta disponibilidade.\n\nA solução é entregue com configuração personalizada, incluindo regras de firewall, VPN, NAT, filtros de conteúdo, segmentação de redes e proteção contra ameaças, além de relatórios e monitoramento contínuo.\n\nO FIREWALL VIRTUAL DOUBLE proporciona proteção robusta para servidores, redes, aplicações e conexões da empresa, eliminando a necessidade de equipamentos físicos, licenças avulsas e manutenções locais.',
      { sz: 1200, b: false, color: '4C6584', algn: 'l' }
    ),
    makeShape('108', 'SectionDiferenciais', 850000, 5950000, 5860000, 450000, '» Diferenciais', { sz: 2000, b: true, color: '34526B', algn: 'l' }),
    makeShape('109', 'Diferenciais', 850000, 6500000, 5860000, 2600000,
      '● Plataforma 100% gerenciada pela equipe técnica própria da DOUBLE, sem terceiros;\n● Suporte técnico especializado 24x7, com atendimento ágil e humanizado;\n● Monitoramento proativo, com alertas de segurança, disponibilidade e desempenho;\n● Infraestrutura em Data Center nacional, com baixa latência e alta segurança;\n● Facilidade de gestão, escalabilidade sob demanda e atualizações constantes;\n● Serviço que elimina custos com hardware físico, licenciamento e manutenções locais.',
      { sz: 1150, b: false, color: '4C6584', algn: 'l' }
    ),
  ].join('');
  zip.file('ppt/slides/slide5.xml', wrapSlide(slide5Sp));
  zip.file('ppt/slides/_rels/slide5.xml.rels', makeSlideRels('../media/letterhead.webp'));

  // --- SLIDE 6 (Premissas - letterhead.webp) ---
  // EDITÁVEL: shape 121
  const slide6Sp = [
    makeShape('120', 'Title', 800000, 1400000, 5960000, 500000, 'Premissas', { sz: 2400, b: true, color: '34526B', algn: 'ctr' }),
    makeShape('122', 'Intro', 850000, 1950000, 5860000, 500000,
      'Para a correta utilização do FIREWALL VIRTUAL DOUBLE, o cliente deverá observar as seguintes premissas e assumir integralmente as responsabilidades abaixo:',
      { sz: 1100, b: false, color: '4C6584', algn: 'l' }
    ),
    `<p:sp>
      <p:nvSpPr>
        <p:cNvPr id="121" name="Premissas"/>
        <p:cNvSpPr/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm>
          <a:off x="850000" y="2500000"/>
          <a:ext cx="5860000" cy="6600000"/>
        </a:xfrm>
      </p:spPr>
      <p:txBody>
        <a:bodyPr anchor="t"/>
        <a:p>
          <a:pPr lvl="0" marL="400000" indent="-400000" algn="l">
            <a:buAutoNum type="romanUcPeriod"/>
          </a:pPr>
          <a:r>
            <a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="34526B"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t>Responsabilidade sobre Uso e Conteúdo:</a:t>
          </a:r>
          <a:r>
            <a:rPr sz="1050" b="0"><a:solidFill><a:srgbClr val="4C6584"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t> O cliente é o único e exclusivo responsável pela finalidade de uso do FIREWALL VIRTUAL DOUBLE, bem como pelo conteúdo, dados e tráfego que trafeguem através do ambiente.</a:t>
          </a:r>
        </a:p>
        <a:p>
          <a:pPr lvl="0" marL="400000" indent="-400000" algn="l">
            <a:buAutoNum type="romanUcPeriod"/>
          </a:pPr>
          <a:r>
            <a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="34526B"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t>Proibição de Atividades Ilícitas ou Abusivas:</a:t>
          </a:r>
          <a:r>
            <a:rPr sz="1050" b="0"><a:solidFill><a:srgbClr val="4C6584"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t> É expressamente proibida a utilização do serviço para práticas ilícitas, fraudulentas ou abusivas, incluindo ataques cibernéticos, disseminação de malware e spam.</a:t>
          </a:r>
        </a:p>
        <a:p>
          <a:pPr lvl="0" marL="400000" indent="-400000" algn="l">
            <a:buAutoNum type="romanUcPeriod"/>
          </a:pPr>
          <a:r>
            <a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="34526B"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t>Licenciamento de Software e Recursos Externos:</a:t>
          </a:r>
          <a:r>
            <a:rPr sz="1050" b="0"><a:solidFill><a:srgbClr val="4C6584"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t> Salvo quando expressamente contratado junto à DOUBLE, o cliente é responsável pelo licenciamento de quaisquer aplicações e sistemas integrados ao ambiente.</a:t>
          </a:r>
        </a:p>
        <a:p>
          <a:pPr lvl="0" marL="400000" indent="-400000" algn="l">
            <a:buAutoNum type="romanUcPeriod"/>
          </a:pPr>
          <a:r>
            <a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="34526B"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t>Gestão e Configuração:</a:t>
          </a:r>
          <a:r>
            <a:rPr sz="1050" b="0"><a:solidFill><a:srgbClr val="4C6584"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t> A gestão do ambiente, das regras de firewall e políticas de segurança é de responsabilidade do cliente, exceto na contratação do serviço gerenciado pela DOUBLE.</a:t>
          </a:r>
        </a:p>
        <a:p>
          <a:pPr lvl="0" marL="400000" indent="-400000" algn="l">
            <a:buAutoNum type="romanUcPeriod"/>
          </a:pPr>
          <a:r>
            <a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="34526B"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t>Segurança da Informação e Conformidade:</a:t>
          </a:r>
          <a:r>
            <a:rPr sz="1050" b="0"><a:solidFill><a:srgbClr val="4C6584"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t> O cliente compromete-se a adotar boas práticas de segurança cibernética e a cumprir a legislação vigente, em especial a LGPD (Lei 13.709/2018).</a:t>
          </a:r>
        </a:p>
        <a:p>
          <a:pPr lvl="0" marL="400000" indent="-400000" algn="l">
            <a:buAutoNum type="romanUcPeriod"/>
          </a:pPr>
          <a:r>
            <a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="34526B"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t>Escalabilidade e Limitações:</a:t>
          </a:r>
          <a:r>
            <a:rPr sz="1050" b="0"><a:solidFill><a:srgbClr val="4C6584"/></a:solidFill><a:latin typeface="Poppins"/></a:rPr>
            <a:t> A solução possui limites de processamento, memória e throughput contratados. A necessidade de expansão deverá ser solicitada previamente.</a:t>
          </a:r>
        </a:p>
      </p:txBody>
    </p:sp>`
  ].join('');
  zip.file('ppt/slides/slide6.xml', wrapSlide(slide6Sp));
  zip.file('ppt/slides/_rels/slide6.xml.rels', makeSlideRels('../media/letterhead.webp'));

  // --- SLIDE 7 (Investimento - letterhead.webp) ---
  // EDITÁVEL: shapes 127, 128, 129, 130 + Tabela
  const makeCell = (text, opts = {}) => {
    const sz = opts.sz || 1100;
    const b = opts.b ? '1' : '0';
    const color = opts.color || '4C6584';
    const bg = opts.bg ? `<a:solidFill><a:srgbClr val="${opts.bg}"/></a:solidFill>` : '';
    const align = opts.align || 'l';
    const gridSpan = opts.gridSpan ? ` gridSpan="${opts.gridSpan}"` : '';
    const hMerge = opts.hMerge ? ` hMerge="1"` : '';

    return `
      <a:tc${gridSpan}${hMerge}>
        <a:txBody>
          <a:bodyPr anchor="ctr"/>
          <a:p>
            <a:pPr algn="${align}"/>
            <a:r>
              <a:rPr sz="${sz}" b="${b}">
                <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
                <a:latin typeface="Poppins"/>
              </a:rPr>
              <a:t>${text}</a:t>
            </a:r>
          </a:p>
        </a:txBody>
        <a:tcPr>${bg}</a:tcPr>
      </a:tc>`;
  };

  const tableXml = `
    <p:graphicFrame>
      <p:nvGraphicFramePr>
        <p:cNvPr id="131" name="TabelaInvestimento"/>
        <p:cNvGraphicFramePr/>
        <p:nvPr/>
      </p:nvGraphicFramePr>
      <p:xfrm>
        <a:off x="850000" y="2800000"/>
        <a:ext cx="5860000" cy="3800000"/>
      </p:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
          <a:tbl>
            <a:tblPr/>
            <a:tblGrid>
              <a:gridCol w="1800000"/>
              <a:gridCol w="2260000"/>
              <a:gridCol w="900000"/>
              <a:gridCol w="900000"/>
            </a:tblGrid>
            <a:tr h="500000">
              ${makeCell('Serviço', { b: true, bg: '3A597D', color: 'FFFFFF', align: 'ctr', sz: 1200 })}
              ${makeCell('Descrição', { b: true, bg: '3A597D', color: 'FFFFFF', align: 'ctr', sz: 1200 })}
              ${makeCell('Valor Mensal', { b: true, bg: '3A597D', color: 'FFFFFF', align: 'ctr', sz: 1200 })}
              ${makeCell('Valor Contrato', { b: true, bg: '3A597D', color: 'FFFFFF', align: 'ctr', sz: 1200 })}
            </a:tr>
            <a:tr h="450000">
              ${makeCell('Internet 100Mbps rádio', { color: '4C6584', sz: 1100 })}
              ${makeCell('Link de internet dedicada via rádio', { color: '4C6584', sz: 1100 })}
              ${makeCell('R$500,00', { align: 'r', color: '4C6584', sz: 1100 })}
              ${makeCell('R$500,00', { align: 'r', color: '4C6584', sz: 1100 })}
            </a:tr>
            <a:tr h="450000">
              ${makeCell('Rede MAN 50Mbps', { color: '4C6584', sz: 1100 })}
              ${makeCell('Link L2L MAN via rádio', { color: '4C6584', sz: 1100 })}
              ${makeCell('R$1000,00', { align: 'r', color: '4C6584', sz: 1100 })}
              ${makeCell('R$500,00', { align: 'r', color: '4C6584', sz: 1100 })}
            </a:tr>
            <a:tr h="450000">
              ${makeCell('Link Double 100Mbps', { color: '4C6584', sz: 1100 })}
              ${makeCell('Link internet redundante Rádio + Fibra Óptica', { color: '4C6584', sz: 1100 })}
              ${makeCell('R$2000,00', { align: 'r', color: '4C6584', sz: 1100 })}
              ${makeCell('R$500,00', { align: 'r', color: '4C6584', sz: 1100 })}
            </a:tr>
            <a:tr h="500000">
              ${makeCell('Total:', { b: true, bg: '3A597D', color: 'FFFFFF', align: 'r', sz: 1200 })}
              ${makeCell('', { hMerge: true, bg: '3A597D' })}
              ${makeCell('R$3500,00', { b: true, bg: '3A597D', color: 'FFFFFF', align: 'r', sz: 1200 })}
              ${makeCell('R$1500,00', { b: true, bg: '3A597D', color: 'FFFFFF', align: 'r', sz: 1200 })}
            </a:tr>
            <a:tr h="500000">
              ${makeCell('Taxa de Instalação', { b: true, bg: '3A597D', color: 'FFFFFF', align: 'r', sz: 1200 })}
              ${makeCell('', { hMerge: true, bg: '3A597D' })}
              ${makeCell('R$ 1500,00', { b: true, bg: '3A597D', color: 'FFFFFF', align: 'r', sz: 1200 })}
              ${makeCell('', { hMerge: true, bg: '3A597D' })}
            </a:tr>
          </a:tbl>
        </a:graphicData>
      </a:graphic>
    </p:graphicFrame>`;

  const slide7Sp = [
    makeShape('125', 'Title', 800000, 1300000, 5960000, 450000, 'Investimento', { sz: 2400, b: true, color: '34526B', algn: 'ctr' }),
    makeShape('123', 'DoubleInfo', 850000, 1800000, 2600000, 900000,
      'Double TI + Telecom\nNome do Vendedor\ne-mail@doubletelecom.com.br\nwww.doubletelecom.com.br\n(41) 3312-6500',
      { sz: 1000, b: false, color: '4C6584', algn: 'l' }
    ),
    makeShape('124', 'ProposalDate', 2800000, 1800000, 2000000, 400000, 'Data: DD/MM/YYYY', { sz: 1100, b: true, color: '34526B', algn: 'ctr' }),
    makeShape('126', 'ClientInfo', 4300000, 1800000, 2410000, 900000,
      'Empresa Cliente\nNome da Empresa\ne-mail@empresacliente.com.br\nwww.empresacliente.com.br\n(41) XXXX-XXXXX',
      { sz: 1000, b: false, color: '4C6584', algn: 'r' }
    ),
    makeShape('127', 'ValorDoProjeto', 850000, 2600000, 100000, 100000, '', { sz: 1000 }),
    makeShape('128', 'Empty1', 850000, 2600000, 100000, 100000, '', { sz: 1000 }),
    makeShape('129', 'Empty2', 850000, 2600000, 100000, 100000, '', { sz: 1000 }),
    tableXml,
    makeShape('130', 'VigenciaPrazo', 850000, 7000000, 5860000, 1900000,
      'VIGÊNCIA DE CONTRATO\nX Meses\n\nPRAZO DE ENTREGA\n4 a 8 Semanas\n\nTERMOS E CONDIÇÕES\nEste orçamento é válido por 15 dias.',
      { sz: 1100, b: true, color: '34526B', algn: 'l' }
    ),
  ].join('');
  zip.file('ppt/slides/slide7.xml', wrapSlide(slide7Sp));
  zip.file('ppt/slides/_rels/slide7.xml.rels', makeSlideRels('../media/letterhead.webp'));

  // --- SLIDE 8 (Informações para contratação - letterhead.webp) ---
  // EDITÁVEL: shapes 137, 138, 139, 140
  const slide8Sp = [
    makeShape('135', 'Title', 800000, 1350000, 5960000, 500000, 'Informações para contratação', { sz: 2400, b: true, color: '34526B', algn: 'ctr' }),
    makeShape('139', 'SubDoc', 850000, 1950000, 5860000, 450000, '» Documentação', { sz: 2000, b: true, color: '34526B', algn: 'l' }),
    makeShape('137', 'PessoaJuridica', 850000, 2500000, 5860000, 3400000,
      'Pessoa jurídica:\nCNPJ, Inscrição Estadual, contrato social ou última alteração, dados do(s) representante(s) legal(is), informações da testemunha (nome, e-mail e CPF), e endereço de faturamento, se diferente do CNPJ.\n\nContato financeiro:\nDados do setor financeiro (nome, telefone, celular, e-mail).\n\nContato técnico:\nDados do setor técnico da área de TI (nome, telefone, celular, e-mail).\n\nData de vencimento da mensalidade para escolha:\nDias 5, 10, 25 ou 30 de cada mês.',
      { sz: 1150, b: false, color: '4C6584', algn: 'l' }
    ),
    makeShape('140', 'SubTermo', 850000, 6050000, 5860000, 450000, '» Termo de Contratação', { sz: 2000, b: true, color: '34526B', algn: 'l' }),
    makeShape('138', 'TextoFinal', 850000, 6550000, 5860000, 2500000,
      'Após o recebimento das informações acima, será emitido o Termo de Contratação da Locação de Equipamentos (TCS) nos termos desta proposta e de acordo com a Lei Geral de Proteção de Dados Pessoais, Lei n° 13.709/2018.\n\nO prazo de ativação é iniciado a partir do recebimento do Termo de Contratação da Locação de Equipamentos (TCS) assinado, preferencialmente pela plataforma de assinatura digital Click Sign.\n\nAguardamos sua aprovação para continuidade do processo.',
      { sz: 1150, b: false, color: '4C6584', algn: 'l' }
    ),
  ].join('');
  zip.file('ppt/slides/slide8.xml', wrapSlide(slide8Sp));
  zip.file('ppt/slides/_rels/slide8.xml.rels', makeSlideRels('../media/letterhead.webp'));

  // --- SLIDE 9 (Segurança da Informação e LGPD - page.webp) ---
  const slide9Sp = [
    makeShape('145', 'Title', 800000, 950000, 5960000, 800000,
      'Segurança da informação,\nprivacidade e proteção de dados',
      { sz: 2100, b: true, color: '34526B', algn: 'ctr' }
    ),
    makeShape('146', 'Body', 950000, 2050000, 5660000, 6600000,
      'A Double TI+Telecom se compromete a cumprir toda a legislação aplicável sobre segurança da informação, privacidade e proteção de dados, inclusive (sempre e quando aplicáveis) a Constituição Federal, o Código Civil, o Marco Civil da Internet (Lei Federal n. 12.965/2014), seu decreto regulamentador (Decreto 8.771/2016), a Lei Geral de Proteção de Dados (Lei Federal n. 13.709/2018), e demais normas setoriais ou gerais sobre o tema, se comprometendo, ainda, a zelar pela conformidade da contratante, na medida de seu alcance durante o cumprimento das atividades propostas, não o colocando em situações de violação a tais regulações.\n\nA Double TI + Telecom somente tratará dados pessoais, entendidos como qualquer informação relacionada a pessoa natural identificada ou identificável, caso expressamente instruído e autorizado pela contratante, para finalidades estritamente necessárias para o cumprimento das atividades propostas e jamais para outros fins. A Double TI + Telecom não transferirá, compartilhará ou disponibilizará dados pessoais a quaisquer terceiros sem a expressa autorização e instrução da contratante.\n\nCaso um titular de dados pessoais, autoridade responsável pela proteção de dados pessoais, ou qualquer terceiro requisitar à Double TI + Telecom qualquer informação ou a tomada de providências a respeito do tratamento de dados pessoais relacionado às atividades propostas ou às atividades da contratante, a Double TI + Telecom deverá imediatamente comunicar à contratante, e, sob suas instruções, auxiliá-la a cumprir com a requisição, sempre que aplicável.\n\nPara os fins desta proposta, são considerados DADOS PESSOAIS qualquer informação relativa a uma pessoa singular identificada ou identificável (“Titular”). É considerada identificável uma pessoa singular que possa ser identificada, direta ou indiretamente, em especial por referência a um identificador, como por exemplo um nome, um número de identificação, dados de localização, identificadores por via eletrônica ou a um ou mais elementos específicos da identidade física, fisiológica, genética, mental, econômica, cultural ou social dessa pessoa singular.',
      { sz: 1050, b: false, color: '4C6584', algn: 'just' }
    ),
  ].join('');
  zip.file('ppt/slides/slide9.xml', wrapSlide(slide9Sp));
  zip.file('ppt/slides/_rels/slide9.xml.rels', makeSlideRels('../media/page.webp'));

  // --- SLIDE 10 (Contracapa / Encerramento - closing.webp - Print 2 Oficial) ---
  const slide10Sp = '';
  zip.file('ppt/slides/slide10.xml', wrapSlide(slide10Sp));
  zip.file('ppt/slides/_rels/slide10.xml.rels', makeSlideRels('../media/closing.webp'));

  // Generate buffer
  console.log('Generating PPTX buffer...');
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const destPath = path.join(baseDir, 'apps/web/public/proposta-comercial-double.pptx');
  fs.writeFileSync(destPath, buffer);
  console.log('Saved to', destPath, 'Bytes:', buffer.length);

  const apiPublic = path.join(baseDir, 'apps/api/public');
  if (!fs.existsSync(apiPublic)) fs.mkdirSync(apiPublic, { recursive: true });
  fs.writeFileSync(path.join(apiPublic, 'proposta-comercial-double.pptx'), buffer);
  console.log('Saved copy to apps/api/public/proposta-comercial-double.pptx');
}

buildTemplate()
  .then(() => console.log('PPTX Template generated successfully!'))
  .catch(err => {
    console.error('Error vertical building template:', err);
    process.exit(1);
  });
