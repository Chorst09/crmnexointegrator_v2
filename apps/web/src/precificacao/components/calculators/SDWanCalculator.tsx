'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2, Calculator, Download, AlertCircle, Search, ArrowLeft, Save, Edit, X } from 'lucide-react'
import { generateNextProposalId, generateNewVersion } from '@/lib/proposal-id-generator'
import { ProposalApprovalRequestButton } from '@/components/proposals/ProposalApprovalRequestButton'
import { ProposalStatusBadge } from '@/components/proposals/ProposalStatusBadge'
import { ProposalApprovalInfo } from '@/components/proposals/ProposalApprovalInfo'
import { ConvertToB2BOpportunityButton } from '@/components/proposals/ConvertToB2BOpportunityButton'
import { useDeepLinkedProposal } from '@/hooks/use-deep-linked-proposal'
import { getCRMAuthHeaders } from '@/config/api';

// Tipos e Interfaces
interface ClientData {
  name: string
  contact: string
  projectName: string
  email: string
  phone: string
}

interface AccountManagerData {
  name: string
  email: string
  phone: string
}

interface SDWanRouter {
  model: string
  throughput: string
  quantity: number
  highAvailability: boolean
  unitPrice: number
}

interface Switch {
  model: string
  ports: number
  poe: boolean
  quantity: number
  unitPrice: number
}

interface AccessPoint {
  model: string
  standard: string
  quantity: number
  unitPrice: number
  cloudLicenseMonthly: number
}

interface UPS {
  capacity: string
  va: number
  quantity: number
  unitPrice: number
}

interface Site {
  id: string
  name: string
  routers: SDWanRouter[]
  switches: Switch[]
  accessPoints: AccessPoint[]
  ups: UPS[]
}

interface PricingConfig {
  acquisitionModel: 'CAPEX' | 'OPEX'
  subscriptionTerm: 12 | 36 | 60
  installationCost: number
  supportLevel: 'NBD' | '24x7'
  supportCostMonthly: number
  importTax: number
  profitMargin: number
  volumeDiscountThreshold: number
  volumeDiscountPercent: number
}

interface BOMItem {
  category: string
  description: string
  quantity: number
  unitPrice: number
  subtotal: number
  recurring: boolean
  monthlyRecurring?: number
}

interface CalculationResult {
  totalProjectValue: number
  monthlyRecurringRevenue: number
  sites: {
    siteName: string
    siteTotal: number
    siteMRR: number
  }[]
  bom: BOMItem[]
  summary: {
    hardwareTotal: number
    licensingTotal: number
    servicesTotal: number
    discountApplied: number
  }
}

interface Proposal {
  id: number
  base_id?: string
  title: string
  client?: any
  client_data?: any
  created_at: string
  total_monthly: number
  status?: string
  metadata?: any
}

// Catálogo de Produtos
const ROUTER_MODELS = [
  { model: 'SD-WAN Edge 100', throughput: '100 Mbps', price: 2500 },
  { model: 'SD-WAN Edge 500', throughput: '500 Mbps', price: 4500 },
  { model: 'SD-WAN Edge 1G', throughput: '1 Gbps', price: 7500 },
  { model: 'SD-WAN Edge 2G', throughput: '2 Gbps', price: 12000 },
  { model: 'SD-WAN Edge 5G', throughput: '5 Gbps', price: 18000 },
]

const SWITCH_MODELS = [
  { model: 'Switch 8P', ports: 8, poe: false, price: 800 },
  { model: 'Switch 8P PoE', ports: 8, poe: true, price: 1200 },
  { model: 'Switch 24P', ports: 24, poe: false, price: 1800 },
  { model: 'Switch 24P PoE', ports: 24, poe: true, price: 2800 },
  { model: 'Switch 48P', ports: 48, poe: false, price: 3200 },
  { model: 'Switch 48P PoE', ports: 48, poe: true, price: 4500 },
]

const AP_MODELS = [
  { model: 'AP Wi-Fi 6 Indoor', standard: 'Wi-Fi 6', price: 1200, cloudLicense: 50 },
  { model: 'AP Wi-Fi 6E Indoor', standard: 'Wi-Fi 6E', price: 1800, cloudLicense: 60 },
  { model: 'AP Wi-Fi 6 Outdoor', standard: 'Wi-Fi 6', price: 1500, cloudLicense: 50 },
  { model: 'AP Wi-Fi 6E Outdoor', standard: 'Wi-Fi 6E', price: 2200, cloudLicense: 60 },
]

const UPS_MODELS = [
  { capacity: '1kVA', va: 1000, price: 1500 },
  { capacity: '2kVA', va: 2000, price: 2500 },
  { capacity: '3kVA', va: 3000, price: 3500 },
  { capacity: '5kVA', va: 5000, price: 5500 },
]

interface SDWanCalculatorProps {
  onBackToDashboard: () => void
  initialProposalId?: string | null
}

export default function SDWanCalculator({ onBackToDashboard, initialProposalId }: SDWanCalculatorProps) {
  // Estados de navegação
  const [viewMode, setViewMode] = useState<'search' | 'client-form' | 'calculator' | 'view'>('search')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loadingProposals, setLoadingProposals] = useState(false)
  const [currentProposal, setCurrentProposal] = useState<Proposal | null>(null)

  // Estados do cliente
  const [clientData, setClientData] = useState<ClientData>({ 
    name: '', 
    contact: '', 
    projectName: '', 
    email: '', 
    phone: '' 
  })
  const [accountManagerData, setAccountManagerData] = useState<AccountManagerData>({ 
    name: '', 
    email: '', 
    phone: '' 
  })

  // Estados dos sites
  const [sites, setSites] = useState<Site[]>([
    {
      id: '1',
      name: 'Site Principal',
      routers: [],
      switches: [],
      accessPoints: [],
      ups: [],
    },
  ])

  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    acquisitionModel: 'CAPEX',
    subscriptionTerm: 36,
    installationCost: 5000,
    supportLevel: 'NBD',
    supportCostMonthly: 500,
    importTax: 0.15,
    profitMargin: 0.30,
    volumeDiscountThreshold: 5,
    volumeDiscountPercent: 0.10,
  })

  const [result, setResult] = useState<CalculationResult | null>(null)

  // Buscar propostas
  useEffect(() => {
    if (viewMode === 'search') {
      fetchProposals()
    }
  }, [viewMode])

  const fetchProposals = async () => {
    setLoadingProposals(true)
    try {
      console.log('🔍 Buscando propostas SD-WAN...')
      const response = await fetch('/api/simulator/proposals?type=SD_WAN&all=true', { headers: getCRMAuthHeaders() })
      if (response.ok) {
        const result = await response.json()
        console.log('📥 Resposta da API:', result)
        // A API retorna { success: true, data: { proposals: [...], pagination: {...} } }
        const data = result.data?.proposals || result.proposals || result.data || result
        console.log('📊 Propostas recebidas:', data)
        setProposals(Array.isArray(data?.data?.proposals) ? data.data.proposals : Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Erro ao buscar propostas:', error)
      setProposals([])
    } finally {
      setLoadingProposals(false)
    }
  }

  const filteredProposals = Array.isArray(proposals) ? proposals.filter(p => {
    const clientName = p.client?.name || p.client_data?.name || ''
    const projectName = p.client_data?.projectName || p.title || ''
    const searchLower = searchTerm.toLowerCase()
    
    return clientName.toLowerCase().includes(searchLower) ||
           projectName.toLowerCase().includes(searchLower) ||
           (p.base_id && p.base_id.toLowerCase().includes(searchLower)) ||
           p.id.toString().includes(searchTerm)
  }) : []

  // Adicionar novo site
  const addSite = () => {
    const newSite: Site = {
      id: Date.now().toString(),
      name: `Site ${sites.length + 1}`,
      routers: [],
      switches: [],
      accessPoints: [],
      ups: [],
    }
    setSites([...sites, newSite])
  }

  // Remover site
  const removeSite = (siteId: string) => {
    if (sites.length > 1) {
      setSites(sites.filter(s => s.id !== siteId))
    }
  }

  // Adicionar equipamento a um site
  const addEquipment = (siteId: string, type: 'router' | 'switch' | 'ap' | 'ups') => {
    setSites(sites.map(site => {
      if (site.id === siteId) {
        switch (type) {
          case 'router':
            return {
              ...site,
              routers: [...site.routers, {
                model: ROUTER_MODELS[0].model,
                throughput: ROUTER_MODELS[0].throughput,
                quantity: 1,
                highAvailability: false,
                unitPrice: ROUTER_MODELS[0].price,
              }],
            }
          case 'switch':
            return {
              ...site,
              switches: [...site.switches, {
                model: SWITCH_MODELS[0].model,
                ports: SWITCH_MODELS[0].ports,
                poe: SWITCH_MODELS[0].poe,
                quantity: 1,
                unitPrice: SWITCH_MODELS[0].price,
              }],
            }
          case 'ap':
            return {
              ...site,
              accessPoints: [...site.accessPoints, {
                model: AP_MODELS[0].model,
                standard: AP_MODELS[0].standard,
                quantity: 1,
                unitPrice: AP_MODELS[0].price,
                cloudLicenseMonthly: AP_MODELS[0].cloudLicense,
              }],
            }
          case 'ups':
            return {
              ...site,
              ups: [...site.ups, {
                capacity: UPS_MODELS[0].capacity,
                va: UPS_MODELS[0].va,
                quantity: 1,
                unitPrice: UPS_MODELS[0].price,
              }],
            }
        }
      }
      return site
    }))
  }

  // Remover equipamento
  const removeEquipment = (siteId: string, type: 'router' | 'switch' | 'ap' | 'ups', index: number) => {
    setSites(sites.map(site => {
      if (site.id === siteId) {
        switch (type) {
          case 'router':
            return { ...site, routers: site.routers.filter((_, i) => i !== index) }
          case 'switch':
            return { ...site, switches: site.switches.filter((_, i) => i !== index) }
          case 'ap':
            return { ...site, accessPoints: site.accessPoints.filter((_, i) => i !== index) }
          case 'ups':
            return { ...site, ups: site.ups.filter((_, i) => i !== index) }
        }
      }
      return site
    }))
  }

  // Atualizar equipamento
  const updateEquipment = (
    siteId: string,
    type: 'router' | 'switch' | 'ap' | 'ups',
    index: number,
    field: string,
    value: any
  ) => {
    setSites(sites.map(site => {
      if (site.id === siteId) {
        switch (type) {
          case 'router':
            const updatedRouters = [...site.routers]
            updatedRouters[index] = { ...updatedRouters[index], [field]: value }
            
            if (field === 'model') {
              const routerModel = ROUTER_MODELS.find(r => r.model === value)
              if (routerModel) {
                updatedRouters[index].throughput = routerModel.throughput
                updatedRouters[index].unitPrice = routerModel.price
              }
            }
            return { ...site, routers: updatedRouters }
            
          case 'switch':
            const updatedSwitches = [...site.switches]
            updatedSwitches[index] = { ...updatedSwitches[index], [field]: value }
            
            if (field === 'model') {
              const switchModel = SWITCH_MODELS.find(s => s.model === value)
              if (switchModel) {
                updatedSwitches[index].ports = switchModel.ports
                updatedSwitches[index].poe = switchModel.poe
                updatedSwitches[index].unitPrice = switchModel.price
              }
            }
            return { ...site, switches: updatedSwitches }
            
          case 'ap':
            const updatedAPs = [...site.accessPoints]
            updatedAPs[index] = { ...updatedAPs[index], [field]: value }
            
            if (field === 'model') {
              const apModel = AP_MODELS.find(a => a.model === value)
              if (apModel) {
                updatedAPs[index].standard = apModel.standard
                updatedAPs[index].unitPrice = apModel.price
                updatedAPs[index].cloudLicenseMonthly = apModel.cloudLicense
              }
            }
            return { ...site, accessPoints: updatedAPs }
            
          case 'ups':
            const updatedUPS = [...site.ups]
            updatedUPS[index] = { ...updatedUPS[index], [field]: value }
            
            if (field === 'capacity') {
              const upsModel = UPS_MODELS.find(u => u.capacity === value)
              if (upsModel) {
                updatedUPS[index].va = upsModel.va
                updatedUPS[index].unitPrice = upsModel.price
              }
            }
            return { ...site, ups: updatedUPS }
        }
      }
      return site
    }))
  }

  // Calcular precificação
  const calculatePricing = () => {
    const bom: BOMItem[] = []
    let totalHardware = 0
    let totalLicensing = 0
    let totalServices = 0
    let totalMRR = 0

    const siteResults = sites.map(site => {
      let siteHardware = 0
      let siteLicensing = 0
      let siteMRR = 0

      // Roteadores SD-WAN
      site.routers.forEach(router => {
        const qty = router.highAvailability ? router.quantity * 2 : router.quantity
        const priceWithTax = router.unitPrice * (1 + pricingConfig.importTax)
        const priceWithMargin = priceWithTax * (1 + pricingConfig.profitMargin)
        const subtotal = priceWithMargin * qty

        siteHardware += subtotal
        
        const licenseMonthly = (priceWithMargin * 0.05) * qty
        siteLicensing += licenseMonthly * pricingConfig.subscriptionTerm
        siteMRR += licenseMonthly

        bom.push({
          category: 'SD-WAN',
          description: `${router.model} ${router.highAvailability ? '(HA)' : ''}`,
          quantity: qty,
          unitPrice: priceWithMargin,
          subtotal,
          recurring: false,
        })

        bom.push({
          category: 'SD-WAN License',
          description: `Licença ${router.model} (${pricingConfig.subscriptionTerm} meses)`,
          quantity: qty,
          unitPrice: licenseMonthly,
          subtotal: licenseMonthly * pricingConfig.subscriptionTerm,
          recurring: true,
          monthlyRecurring: licenseMonthly,
        })
      })

      // Switches
      site.switches.forEach(sw => {
        const priceWithTax = sw.unitPrice * (1 + pricingConfig.importTax)
        const priceWithMargin = priceWithTax * (1 + pricingConfig.profitMargin)
        const subtotal = priceWithMargin * sw.quantity

        siteHardware += subtotal

        const licenseMonthly = 30 * sw.quantity
        siteLicensing += licenseMonthly * pricingConfig.subscriptionTerm
        siteMRR += licenseMonthly

        bom.push({
          category: 'LAN',
          description: sw.model,
          quantity: sw.quantity,
          unitPrice: priceWithMargin,
          subtotal,
          recurring: false,
        })

        bom.push({
          category: 'LAN License',
          description: `Licença Cloud ${sw.model} (${pricingConfig.subscriptionTerm} meses)`,
          quantity: sw.quantity,
          unitPrice: licenseMonthly,
          subtotal: licenseMonthly * pricingConfig.subscriptionTerm,
          recurring: true,
          monthlyRecurring: licenseMonthly,
        })
      })

      // Access Points
      site.accessPoints.forEach(ap => {
        const priceWithTax = ap.unitPrice * (1 + pricingConfig.importTax)
        const priceWithMargin = priceWithTax * (1 + pricingConfig.profitMargin)
        const subtotal = priceWithMargin * ap.quantity

        siteHardware += subtotal

        const licenseMonthly = ap.cloudLicenseMonthly * ap.quantity
        siteLicensing += licenseMonthly * pricingConfig.subscriptionTerm
        siteMRR += licenseMonthly

        bom.push({
          category: 'Wi-Fi',
          description: ap.model,
          quantity: ap.quantity,
          unitPrice: priceWithMargin,
          subtotal,
          recurring: false,
        })

        bom.push({
          category: 'Wi-Fi License',
          description: `Licença Cloud ${ap.model} (${pricingConfig.subscriptionTerm} meses)`,
          quantity: ap.quantity,
          unitPrice: licenseMonthly,
          subtotal: licenseMonthly * pricingConfig.subscriptionTerm,
          recurring: true,
          monthlyRecurring: licenseMonthly,
        })
      })

      // Nobreaks
      site.ups.forEach(ups => {
        const priceWithTax = ups.unitPrice * (1 + pricingConfig.importTax)
        const priceWithMargin = priceWithTax * (1 + pricingConfig.profitMargin)
        const subtotal = priceWithMargin * ups.quantity

        siteHardware += subtotal

        bom.push({
          category: 'Power',
          description: `Nobreak ${ups.capacity}`,
          quantity: ups.quantity,
          unitPrice: priceWithMargin,
          subtotal,
          recurring: false,
        })
      })

      const installationTotal = pricingConfig.installationCost
      totalServices += installationTotal

      bom.push({
        category: 'Services',
        description: `Instalação e Configuração - ${site.name}`,
        quantity: 1,
        unitPrice: installationTotal,
        subtotal: installationTotal,
        recurring: false,
      })

      const supportTotal = pricingConfig.supportCostMonthly * pricingConfig.subscriptionTerm
      totalServices += supportTotal
      siteMRR += pricingConfig.supportCostMonthly

      bom.push({
        category: 'Services',
        description: `Suporte ${pricingConfig.supportLevel} (${pricingConfig.subscriptionTerm} meses)`,
        quantity: 1,
        unitPrice: pricingConfig.supportCostMonthly,
        subtotal: supportTotal,
        recurring: true,
        monthlyRecurring: pricingConfig.supportCostMonthly,
      })

      totalHardware += siteHardware
      totalLicensing += siteLicensing
      totalMRR += siteMRR

      return {
        siteName: site.name,
        siteTotal: siteHardware + siteLicensing + installationTotal + supportTotal,
        siteMRR,
      }
    })

    let discountApplied = 0
    const totalEquipment = sites.reduce((sum, site) => 
      sum + site.routers.length + site.switches.length + site.accessPoints.length + site.ups.length, 0
    )

    if (sites.length >= pricingConfig.volumeDiscountThreshold || totalEquipment >= pricingConfig.volumeDiscountThreshold * 5) {
      discountApplied = (totalHardware + totalLicensing) * pricingConfig.volumeDiscountPercent
    }

    const totalProjectValue = totalHardware + totalLicensing + totalServices - discountApplied

    let monthlyRecurringRevenue = totalMRR
    if (pricingConfig.acquisitionModel === 'OPEX') {
      monthlyRecurringRevenue += totalHardware / pricingConfig.subscriptionTerm
    }

    setResult({
      totalProjectValue,
      monthlyRecurringRevenue,
      sites: siteResults,
      bom,
      summary: {
        hardwareTotal: totalHardware,
        licensingTotal: totalLicensing,
        servicesTotal: totalServices,
        discountApplied,
      },
    })
  }

  // Salvar proposta (nova, atualização ou nova versão)
  const handleSaveProposal = async (saveAsNewVersion: boolean = false) => {
    if (!result) {
      alert('Por favor, calcule a precificação antes de salvar.')
      return
    }

    if (!clientData.name || !clientData.email) {
      alert('Por favor, preencha os dados do cliente.')
      return
    }

    try {
      // Mapear propostas para o formato esperado pelo gerador
      const proposalsWithBaseId = Array.isArray(proposals)
        ? proposals.map((p) => ({
            base_id: p.base_id || (p as any).baseId || `Prop_Rede_SD-WAN_000_v1`,
          }))
        : []

      const statusToUse = currentProposal?.status || 'Aguardando Aprovação do Cliente'

      const basePayload = {
        title: `Proposta SD-WAN - ${clientData.name}`,
        type: 'SD_WAN',
        status: statusToUse,
        value: result.totalProjectValue,
        total_setup: 0,
        total_monthly: result.monthlyRecurringRevenue,
        contract_period: pricingConfig.subscriptionTerm,
        client: {
          name: clientData.name,
          email: clientData.email,
          phone: clientData.phone || '',
          contact: clientData.contact || '',
        },
        client_data: {
          name: clientData.name,
          email: clientData.email,
          phone: clientData.phone || '',
          contact: clientData.contact || '',
          projectName: clientData.projectName || 'Projeto SD-WAN',
        },
        account_manager: {
          name: accountManagerData.name,
          email: accountManagerData.email,
          phone: accountManagerData.phone || '',
        },
        metadata: {
          sites,
          pricingConfig,
          result,
          clientData,
          accountManagerData,
        },
      }

      if (saveAsNewVersion && currentProposal?.id) {
        const baseIdToUse = currentProposal.base_id || (currentProposal as any).baseId
        if (!baseIdToUse) {
          alert('Proposta atual não possui ID base válido')
          return
        }

        const newBaseId = generateNewVersion(baseIdToUse, proposalsWithBaseId)
        const proposalData = {
          ...basePayload,
          base_id: newBaseId,
          version: parseInt(newBaseId.match(/_v(\d+)$/)?.[1] || '1'),
        }

        console.log('📤 Enviando nova versão SD-WAN:', proposalData)

        const response = await fetch('/api/simulator/proposals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(proposalData),
        })

        if (response.ok) {
          const savedProposal = await response.json()
          console.log('✅ Nova versão salva:', savedProposal)
          alert(`Nova versão criada com sucesso! ID: ${proposalData.base_id}`)
          setCurrentProposal(savedProposal.data || savedProposal)
          await fetchProposals()
          setViewMode('search')
        } else {
          const errorText = await response.text()
          console.error('❌ Erro ao salvar nova versão:', errorText)
          throw new Error('Erro ao salvar proposta')
        }
      } else if (currentProposal?.id) {
        const proposalToUpdate = {
          ...basePayload,
        }

        console.log('📤 Atualizando proposta SD-WAN:', proposalToUpdate)

        const response = await fetch(`/api/simulator/proposals/${currentProposal.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(proposalToUpdate),
        })

        if (response.ok) {
          const updatedProposal = await response.json()
          console.log('✅ Proposta atualizada:', updatedProposal)
          alert('Proposta atualizada com sucesso!')
          setCurrentProposal(updatedProposal.data || updatedProposal)
          await fetchProposals()
          setViewMode('search')
        } else {
          const errorText = await response.text()
          console.error('❌ Erro ao atualizar proposta:', errorText)
          throw new Error('Erro ao atualizar proposta')
        }
      } else {
        // Nova proposta
        const baseId = generateNextProposalId(proposalsWithBaseId, 'SD_WAN', 1)
        console.log('🆔 ID gerado para nova proposta SD-WAN:', baseId)

        const proposalData = {
          ...basePayload,
          base_id: baseId,
          version: 1,
        }

        console.log('📤 Enviando proposta SD-WAN:', proposalData)

        const response = await fetch('/api/simulator/proposals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(proposalData),
        })

        if (response.ok) {
          const savedProposal = await response.json()
          console.log('✅ Proposta salva:', savedProposal)
          alert(`Proposta ${baseId} salva com sucesso!`)
          setCurrentProposal(savedProposal.data || savedProposal)
          await fetchProposals()
          setViewMode('search')
        } else {
          const errorText = await response.text()
          console.error('❌ Erro ao salvar proposta:', errorText)
          throw new Error('Erro ao salvar proposta')
        }
      }
    } catch (error) {
      console.error('Erro ao salvar proposta:', error)
      alert('Erro ao salvar proposta. Por favor, tente novamente.')
    }
  }

  // Excluir proposta
  const handleDeleteProposal = async (proposalId: number) => {
    if (!confirm('Tem certeza que deseja excluir esta proposta?')) {
      return
    }

    try {
      const response = await fetch(`/api/simulator/proposals/${proposalId}`, {
        method: 'DELETE',
        headers: getCRMAuthHeaders(),
      })

      if (response.ok) {
        alert('Proposta excluída com sucesso!')
        await fetchProposals()
      } else {
        throw new Error('Erro ao excluir proposta')
      }
    } catch (error) {
      console.error('Erro ao excluir proposta:', error)
      alert('Erro ao excluir proposta. Por favor, tente novamente.')
    }
  }

  // Visualizar proposta
  const handleViewProposal = (proposal: Proposal) => {
    console.log('👁️ Visualizando proposta:', proposal)
    setCurrentProposal(proposal)
    
    // Carregar dados da proposta
    if (proposal.metadata) {
      const metadata = proposal.metadata as any
      console.log('📦 Metadata da proposta:', metadata)
      
      if (metadata.clientData) {
        console.log('👤 Carregando clientData:', metadata.clientData)
        setClientData(metadata.clientData)
      }
      if (metadata.accountManagerData) {
        console.log('👔 Carregando accountManagerData:', metadata.accountManagerData)
        setAccountManagerData(metadata.accountManagerData)
      }
      if (metadata.sites) {
        console.log('🏢 Carregando sites:', metadata.sites)
        setSites(metadata.sites)
      }
      if (metadata.pricingConfig) {
        console.log('💰 Carregando pricingConfig:', metadata.pricingConfig)
        setPricingConfig(metadata.pricingConfig)
      }
      if (metadata.result) {
        console.log('📊 Carregando result:', metadata.result)
        setResult(metadata.result)
      } else {
        console.warn('⚠️ Metadata não contém result')
      }
    } else {
      console.warn('⚠️ Proposta não contém metadata')
    }
    
    setViewMode('view')
  }

  // Editar proposta
  const handleEditProposal = (proposal: Proposal) => {
    setCurrentProposal(proposal)
    // Carregar dados da proposta
    if (proposal.metadata) {
      const metadata = proposal.metadata as any
      if (metadata.clientData) setClientData(metadata.clientData)
      if (metadata.accountManagerData) setAccountManagerData(metadata.accountManagerData)
      if (metadata.sites) setSites(metadata.sites)
      if (metadata.pricingConfig) setPricingConfig(metadata.pricingConfig)
      if (metadata.result) setResult(metadata.result)
    }
    setViewMode('calculator')
  }

  useDeepLinkedProposal(initialProposalId, proposals, handleEditProposal, loadingProposals)

  // Exportar para JSON
  const exportToJSON = () => {
    if (!result) return

    const exportData = {
      project: {
        date: new Date().toISOString(),
        client: clientData,
        accountManager: accountManagerData,
        acquisitionModel: pricingConfig.acquisitionModel,
        subscriptionTerm: pricingConfig.subscriptionTerm,
      },
      totals: {
        totalContractValue: result.totalProjectValue,
        monthlyRecurringRevenue: result.monthlyRecurringRevenue,
      },
      sites: result.sites,
      billOfMaterials: result.bom,
      summary: result.summary,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sd-wan-proposal-${Date.now()}.json`
    a.click()
  }

  // Renderizar tela de busca
  const renderSearchView = () => (
    <Card>
      <CardHeader>
        <Button
          variant="ghost"
          onClick={onBackToDashboard}
          className="mb-4 w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <CardTitle>Buscar Propostas - Rede SD-WAN</CardTitle>
        <CardDescription>Encontre propostas existentes ou crie uma nova.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => {
            setCurrentProposal(null)
            setViewMode('client-form')
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Proposta
          </Button>
        </div>

        <div className="border rounded-lg">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Nome do Projeto</th>
                <th className="text-left p-3">Data</th>
                <th className="text-right p-3">Total Mensal</th>
                <th className="text-center p-3">Status</th>
                <th className="text-center p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingProposals ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-muted-foreground">
                    Carregando propostas...
                  </td>
                </tr>
              ) : filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-muted-foreground">
                    Nenhuma proposta encontrada
                  </td>
                </tr>
              ) : (
                filteredProposals.map((proposal) => (
                  <tr key={proposal.id} className="border-t hover:bg-muted/50">
                    <td className="p-3">{proposal.base_id || proposal.id}</td>
                    <td className="p-3">{proposal.client?.name || proposal.client_data?.name || '-'}</td>
                    <td className="p-3">{proposal.client_data?.projectName || proposal.title || '-'}</td>
                    <td className="p-3">{new Date(proposal.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="text-right p-3">
                      {proposal.total_monthly.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>
                    <td className="text-center p-3">
                      <ProposalStatusBadge status={proposal.status} />
                    </td>
                    <td className="text-center p-3">
                      <div className="flex gap-2 justify-center">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleViewProposal(proposal)}
                        >
                          Visualizar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEditProposal(proposal)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <ConvertToB2BOpportunityButton proposal={proposal} />
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleDeleteProposal(proposal.id)}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )

  // Renderizar formulário de cliente
  const renderClientForm = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados do Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome do Cliente *</Label>
              <Input
                placeholder="Nome completo do cliente"
                value={clientData.name}
                onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Contato do Cliente</Label>
              <Input
                placeholder="Contato do cliente"
                value={clientData.contact}
                onChange={(e) => setClientData({ ...clientData, contact: e.target.value })}
              />
            </div>
            <div>
              <Label>Nome do Projeto</Label>
              <Input
                placeholder="Nome do projeto"
                value={clientData.projectName}
                onChange={(e) => setClientData({ ...clientData, projectName: e.target.value })}
              />
            </div>
            <div>
              <Label>Email do Cliente *</Label>
              <Input
                type="email"
                placeholder="email@cliente.com"
                value={clientData.email}
                onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefone do Cliente</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={clientData.phone}
                onChange={(e) => setClientData({ ...clientData, phone: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados do Gerente de Contas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome do Gerente *</Label>
              <Input
                placeholder="Nome completo do gerente"
                value={accountManagerData.name}
                onChange={(e) => setAccountManagerData({ ...accountManagerData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email do Gerente *</Label>
              <Input
                type="email"
                placeholder="gerente@empresa.com"
                value={accountManagerData.email}
                onChange={(e) => setAccountManagerData({ ...accountManagerData, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefone do Gerente</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={accountManagerData.phone}
                onChange={(e) => setAccountManagerData({ ...accountManagerData, phone: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setViewMode('search')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button
          onClick={() => setViewMode('calculator')}
          disabled={!clientData.name || !clientData.email || !accountManagerData.name || !accountManagerData.email}
        >
          Continuar para Calculadora
          <Calculator className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )

  // Renderizar calculadora
  const renderCalculator = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Calculadora SD-WAN</h2>
          <p className="text-muted-foreground">
            Cliente: {clientData.name} | Projeto: {clientData.projectName || 'Sem nome'}
          </p>
        </div>
        <Button variant="outline" onClick={() => setViewMode('client-form')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
      </div>

      {/* Sites e Equipamentos */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Sites do Projeto</CardTitle>
            <Button onClick={addSite}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Site
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {sites.map((site, siteIndex) => (
            <Card key={site.id} className="border-2">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <Input
                    value={site.name}
                    onChange={(e) => {
                      const newSites = [...sites]
                      newSites[siteIndex].name = e.target.value
                      setSites(newSites)
                    }}
                    className="text-lg font-semibold max-w-md"
                  />
                  {sites.length > 1 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeSite(site.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Roteadores SD-WAN */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Roteadores SD-WAN</h3>
                    <Button size="sm" onClick={() => addEquipment(site.id, 'router')}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  {site.routers.map((router, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                      <div className="col-span-4">
                        <Label>Modelo</Label>
                        <Select
                          value={router.model}
                          onValueChange={(value) => updateEquipment(site.id, 'router', idx, 'model', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROUTER_MODELS.map(r => (
                              <SelectItem key={r.model} value={r.model}>
                                {r.model} ({r.throughput})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Qtd</Label>
                        <Input
                          type="number"
                          min="1"
                          value={router.quantity}
                          onChange={(e) => updateEquipment(site.id, 'router', idx, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label>High Availability</Label>
                        <Select
                          value={router.highAvailability ? 'yes' : 'no'}
                          onValueChange={(value) => updateEquipment(site.id, 'router', idx, 'highAvailability', value === 'yes')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">Não</SelectItem>
                            <SelectItem value="yes">Sim (2x)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Preço Unit.</Label>
                        <Input
                          type="number"
                          value={router.unitPrice}
                          onChange={(e) => updateEquipment(site.id, 'router', idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEquipment(site.id, 'router', idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Switches */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Switches LAN</h3>
                    <Button size="sm" onClick={() => addEquipment(site.id, 'switch')}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  {site.switches.map((sw, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                      <div className="col-span-5">
                        <Label>Modelo</Label>
                        <Select
                          value={sw.model}
                          onValueChange={(value) => updateEquipment(site.id, 'switch', idx, 'model', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SWITCH_MODELS.map(s => (
                              <SelectItem key={s.model} value={s.model}>
                                {s.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Qtd</Label>
                        <Input
                          type="number"
                          min="1"
                          value={sw.quantity}
                          onChange={(e) => updateEquipment(site.id, 'switch', idx, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Portas</Label>
                        <Input value={sw.ports} disabled />
                      </div>
                      <div className="col-span-2">
                        <Label>Preço Unit.</Label>
                        <Input
                          type="number"
                          value={sw.unitPrice}
                          onChange={(e) => updateEquipment(site.id, 'switch', idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEquipment(site.id, 'switch', idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Access Points */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Access Points Wi-Fi</h3>
                    <Button size="sm" onClick={() => addEquipment(site.id, 'ap')}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  {site.accessPoints.map((ap, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                      <div className="col-span-5">
                        <Label>Modelo</Label>
                        <Select
                          value={ap.model}
                          onValueChange={(value) => updateEquipment(site.id, 'ap', idx, 'model', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AP_MODELS.map(a => (
                              <SelectItem key={a.model} value={a.model}>
                                {a.model}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Qtd</Label>
                        <Input
                          type="number"
                          min="1"
                          value={ap.quantity}
                          onChange={(e) => updateEquipment(site.id, 'ap', idx, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Preço Unit.</Label>
                        <Input
                          type="number"
                          value={ap.unitPrice}
                          onChange={(e) => updateEquipment(site.id, 'ap', idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Lic. Mensal</Label>
                        <Input
                          type="number"
                          value={ap.cloudLicenseMonthly}
                          onChange={(e) => updateEquipment(site.id, 'ap', idx, 'cloudLicenseMonthly', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEquipment(site.id, 'ap', idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Nobreaks */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Nobreaks (UPS)</h3>
                    <Button size="sm" onClick={() => addEquipment(site.id, 'ups')}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  {site.ups.map((ups, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                      <div className="col-span-5">
                        <Label>Capacidade</Label>
                        <Select
                          value={ups.capacity}
                          onValueChange={(value) => updateEquipment(site.id, 'ups', idx, 'capacity', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UPS_MODELS.map(u => (
                              <SelectItem key={u.capacity} value={u.capacity}>
                                {u.capacity} ({u.va} VA)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label>Qtd</Label>
                        <Input
                          type="number"
                          min="1"
                          value={ups.quantity}
                          onChange={(e) => updateEquipment(site.id, 'ups', idx, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>VA</Label>
                        <Input value={ups.va} disabled />
                      </div>
                      <div className="col-span-2">
                        <Label>Preço Unit.</Label>
                        <Input
                          type="number"
                          value={ups.unitPrice}
                          onChange={(e) => updateEquipment(site.id, 'ups', idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEquipment(site.id, 'ups', idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Configuração de Preços */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Precificação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Modelo de Aquisição</Label>
              <Select
                value={pricingConfig.acquisitionModel}
                onValueChange={(value: 'CAPEX' | 'OPEX') =>
                  setPricingConfig({ ...pricingConfig, acquisitionModel: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAPEX">CAPEX (Compra + Manutenção)</SelectItem>
                  <SelectItem value="OPEX">OPEX (As-a-Service)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prazo de Assinatura (meses)</Label>
              <Select
                value={pricingConfig.subscriptionTerm.toString()}
                onValueChange={(value) =>
                  setPricingConfig({ ...pricingConfig, subscriptionTerm: parseInt(value) as 12 | 36 | 60 })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="36">36 meses</SelectItem>
                  <SelectItem value="60">60 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Custo de Instalação (R$)</Label>
              <Input
                type="number"
                value={pricingConfig.installationCost}
                onChange={(e) =>
                  setPricingConfig({ ...pricingConfig, installationCost: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <Label>Nível de Suporte</Label>
              <Select
                value={pricingConfig.supportLevel}
                onValueChange={(value: 'NBD' | '24x7') =>
                  setPricingConfig({ ...pricingConfig, supportLevel: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NBD">NBD (Next Business Day)</SelectItem>
                  <SelectItem value="24x7">24x7</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Custo de Suporte Mensal (R$)</Label>
              <Input
                type="number"
                value={pricingConfig.supportCostMonthly}
                onChange={(e) =>
                  setPricingConfig({ ...pricingConfig, supportCostMonthly: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <Label>Imposto de Importação (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={pricingConfig.importTax * 100}
                onChange={(e) =>
                  setPricingConfig({ ...pricingConfig, importTax: parseFloat(e.target.value) / 100 || 0 })
                }
              />
            </div>

            <div>
              <Label>Margem de Lucro (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={pricingConfig.profitMargin * 100}
                onChange={(e) =>
                  setPricingConfig({ ...pricingConfig, profitMargin: parseFloat(e.target.value) / 100 || 0 })
                }
              />
            </div>

            <div>
              <Label>Limite para Desconto por Volume (sites)</Label>
              <Input
                type="number"
                value={pricingConfig.volumeDiscountThreshold}
                onChange={(e) =>
                  setPricingConfig({ ...pricingConfig, volumeDiscountThreshold: parseInt(e.target.value) || 0 })
                }
              />
            </div>

            <div>
              <Label>Desconto por Volume (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={pricingConfig.volumeDiscountPercent * 100}
                onChange={(e) =>
                  setPricingConfig({ ...pricingConfig, volumeDiscountPercent: parseFloat(e.target.value) / 100 || 0 })
                }
              />
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Modelo {pricingConfig.acquisitionModel}:</strong>{' '}
              {pricingConfig.acquisitionModel === 'CAPEX'
                ? 'Cliente paga hardware à vista + licenças recorrentes'
                : 'Hardware diluído no período + licenças recorrentes (tudo mensal)'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" size="lg" onClick={() => setViewMode('search')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Busca
        </Button>
        <div className="flex gap-2">
              {result && (
            <>
              <ProposalApprovalRequestButton
                proposalId={currentProposal?.id}
                disabled={!currentProposal?.id}
                onApproved={() => {
                  if (currentProposal) {
                    setCurrentProposal({
                      ...currentProposal,
                      status: 'Aprovada',
                    })
                  }
                }}
              />
              {currentProposal?.id && (
                <Button size="lg" variant="outline" onClick={() => handleSaveProposal(true)}>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar como Nova Versão
                </Button>
              )}
              <Button size="lg" variant="default" onClick={() => handleSaveProposal(false)}>
                <Save className="w-4 h-4 mr-2" />
                Salvar Proposta
              </Button>
            </>
          )}
          <Button size="lg" onClick={calculatePricing}>
            <Calculator className="w-4 h-4 mr-2" />
            Calcular Precificação
          </Button>
        </div>
      </div>

      {/* Resultados */}
      {result && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Valor Total do Contrato (TCV)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">
                  {result.totalProjectValue.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Receita Recorrente Mensal (MRR)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-600">
                  {result.monthlyRecurringRevenue.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Resumo por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Hardware:</span>
                  <span className="font-semibold">
                    {result.summary.hardwareTotal.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Licenciamento:</span>
                  <span className="font-semibold">
                    {result.summary.licensingTotal.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Serviços:</span>
                  <span className="font-semibold">
                    {result.summary.servicesTotal.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </span>
                </div>
                {result.summary.discountApplied > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Desconto por Volume:</span>
                    <span className="font-semibold">
                      -{result.summary.discountApplied.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Bill of Materials (BOM)</CardTitle>
                <Button onClick={exportToJSON}>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Categoria</th>
                      <th className="text-left p-2">Descrição</th>
                      <th className="text-right p-2">Qtd</th>
                      <th className="text-right p-2">Preço Unit.</th>
                      <th className="text-right p-2">Subtotal</th>
                      <th className="text-center p-2">Recorrente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.bom.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="p-2">{item.category}</td>
                        <td className="p-2">{item.description}</td>
                        <td className="text-right p-2">{item.quantity}</td>
                        <td className="text-right p-2">
                          {item.unitPrice.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-right p-2 font-semibold">
                          {item.subtotal.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="text-center p-2">
                          {item.recurring ? '✓' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Valores por Site</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.sites.map((site, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-muted rounded">
                    <div>
                      <p className="font-semibold">{site.siteName}</p>
                      <p className="text-sm text-muted-foreground">
                        MRR: {site.siteMRR.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </p>
                    </div>
                    <p className="text-lg font-bold">
                      {site.siteTotal.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )

  // Renderizar visualização da proposta
  const renderViewProposal = () => {
    if (!currentProposal) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Nenhuma proposta selecionada</p>
            <Button onClick={() => setViewMode('search')} className="mt-4">
              Voltar para Busca
            </Button>
          </CardContent>
        </Card>
      )
    }

    if (!result) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <p className="text-muted-foreground mb-2">Dados da proposta não disponíveis</p>
            <p className="text-sm text-muted-foreground mb-4">
              Esta proposta pode ter sido criada em uma versão anterior ou os dados não foram salvos corretamente.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setViewMode('search')}>
                Voltar para Busca
              </Button>
              <Button onClick={() => handleEditProposal(currentProposal)}>
                Tentar Editar
              </Button>
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{currentProposal.base_id || currentProposal.id}</h2>
            <p className="text-muted-foreground">{currentProposal.title}</p>
            <ProposalApprovalInfo proposal={currentProposal} className="text-sm text-muted-foreground mt-1" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setViewMode('search')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={() => handleEditProposal(currentProposal)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </div>
        </div>

        {/* Informações do Cliente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-muted-foreground">Nome</Label>
                <p>{clientData.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p>{clientData.email}</p>
              </div>
              {clientData.phone && (
                <div>
                  <Label className="text-muted-foreground">Telefone</Label>
                  <p>{clientData.phone}</p>
                </div>
              )}
              {clientData.projectName && (
                <div>
                  <Label className="text-muted-foreground">Projeto</Label>
                  <p>{clientData.projectName}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gerente de Contas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-muted-foreground">Nome</Label>
                <p>{accountManagerData.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p>{accountManagerData.email}</p>
              </div>
              {accountManagerData.phone && (
                <div>
                  <Label className="text-muted-foreground">Telefone</Label>
                  <p>{accountManagerData.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Valor Total do Contrato (TCV)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {result.totalProjectValue.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receita Recorrente Mensal (MRR)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {result.monthlyRecurringRevenue.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sites */}
        <Card>
          <CardHeader>
            <CardTitle>Sites do Projeto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {sites.map((site, idx) => (
                <div key={site.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">{site.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Roteadores</Label>
                      <p>{site.routers.length}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Switches</Label>
                      <p>{site.switches.length}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Access Points</Label>
                      <p>{site.accessPoints.length}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Nobreaks</Label>
                      <p>{site.ups.length}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* BOM */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Bill of Materials (BOM)</CardTitle>
              <Button onClick={exportToJSON}>
                <Download className="w-4 h-4 mr-2" />
                Exportar JSON
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Categoria</th>
                    <th className="text-left p-2">Descrição</th>
                    <th className="text-right p-2">Qtd</th>
                    <th className="text-right p-2">Preço Unit.</th>
                    <th className="text-right p-2">Subtotal</th>
                    <th className="text-center p-2">Recorrente</th>
                  </tr>
                </thead>
                <tbody>
                  {result.bom.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="p-2">{item.category}</td>
                      <td className="p-2">{item.description}</td>
                      <td className="text-right p-2">{item.quantity}</td>
                      <td className="text-right p-2">
                        {item.unitPrice.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td className="text-right p-2 font-semibold">
                        {item.subtotal.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </td>
                      <td className="text-center p-2">
                        {item.recurring ? '✓' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Renderizar view principal
  return (
    <div className="container mx-auto p-4 space-y-6">
      {viewMode === 'search' && renderSearchView()}
      {viewMode === 'client-form' && renderClientForm()}
      {viewMode === 'calculator' && renderCalculator()}
      {viewMode === 'view' && renderViewProposal()}
    </div>
  )
}
