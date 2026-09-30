import re

filepath = '/var/www/crm-integrator/src/app/opportunities/new/page.tsx'
content = open(filepath).read()

old = '        setLeadContext(lead)\n        const mappedSphere = mapLeadSegmentToSphere(lead.segment)\n        setFormData((prev) => ({\n          ...prev,\n          agency: prev.agency || lead.companyName,\n          projectName: prev.projectName || `Projeto ${lead.companyName}`,\n          sourcePortal: prev.sourcePortal || lead.source,\n          commercialLead: prev.commercialLead || (lead.contactName ?? ""),\n          sphere: mappedSphere ?? prev.sphere,\n          customerRelationship: prev.customerRelationship || "NOVO_CLIENTE"\n        }))'

new = '''        setLeadContext(lead)
        const mappedSphere = mapLeadSegmentToSphere(lead.segment)

        // Extrair dados do edital das notas do lead B2G
        const notes = lead.notes ?? ""
        const extractNote = (label) => {
          const match = notes.match(new RegExp(label + ":\\\\s*(.+)"))
          return match ? match[1].trim() : ""
        }
        const editalNum = extractNote("Edital")
        const editalObjeto = extractNote("Objeto")
        const editalOrigem = extractNote("Origem")
        const editalData = extractNote("Data da sess")
        const editalLocal = extractNote("Localiza")

        const parseLeadDate = (d) => {
          const parts = d.split("/")
          if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`
          return ""
        }

        setFormData((prev) => ({
          ...prev,
          agency: prev.agency || lead.companyName,
          projectName: prev.projectName || (editalNum ? `[B2G] ${editalNum} - ${lead.companyName}` : `Projeto ${lead.companyName}`),
          sourcePortal: prev.sourcePortal || editalOrigem || lead.source,
          commercialLead: prev.commercialLead || (lead.contactName ?? ""),
          sphere: mappedSphere ?? prev.sphere,
          customerRelationship: prev.customerRelationship || "NOVO_CLIENTE",
          processNumber: prev.processNumber || editalNum,
          objectSummary: prev.objectSummary || editalObjeto,
          detailedObjectDescription: prev.detailedObjectDescription || editalObjeto,
          location: prev.location || editalLocal,
          openingDate: prev.openingDate || parseLeadDate(editalData) || prev.openingDate,
        }))'''

if old in content:
    content = content.replace(old, new, 1)
    open(filepath, 'w').write(content)
    print('Updated successfully')
else:
    print('Pattern not found')
    idx = content.find('setLeadContext(lead)')
    print(repr(content[idx:idx+600]))
