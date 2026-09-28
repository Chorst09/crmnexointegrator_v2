'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Trash2, Calculator, Download, AlertCircle, Search, ArrowLeft, Save, Edit, X, Calendar } from 'lucide-react'
import { generateNextProposalId, generateNewVersion } from '@/lib/proposal-id-generator'
import { ProposalApprovalRequestButton } from '@/components/proposals/ProposalApprovalRequestButton'
import { ProposalStatusBadge } from '@/components/proposals/ProposalStatusBadge'
import { ProposalApprovalInfo } from '@/components/proposals/ProposalApprovalInfo'
import { useDeepLinkedProposal } from '@/hooks/use-deep-linked-proposal'
import { getCRMAuthHeaders } from '@/config/api';

// Tipos e Interfaces
interface ClientData {
  name: string
  contact: string
  email: string
  phone: string
}

interface AccountManagerData {
  name: string
  email: string
  phone: string
}

interface EventData {
  name: string
  location: string
  startDate: string
  endDate: string
  durationDays: number
  durationHours: number
  expectedUsers: number
}

interface LinkConfig {
  type: 'fibra_propria' | 'burst_terceiros'
  bandwidth: number
  bandwidthUnit: 'Mbps' | 'Gbps'
  monthlyCost: number
  installationCost: number
}

interface Equipment {
  type: 'router' | 'switch' | 'ap' | 'ups'
  model: string
  quantity: number
  dailyDepreciation: number
  venalValue: number
}

interface HumanResources {
  setupHours: number
  setupTechnicians: number
  onsiteHours: number
  onsiteTechnicians: number
  teardownHours: number
  teardownTechnicians: number
  hourlyRate: number
}

interface LogisticsCosts {
  transportKm: number
  transportCostPerKm: number
  accommodationDays: number
  accommodationCostPerDay: number
  mealsDays: number
  mealsCostPerDay: number
}

interface PricingConfig {
  opportunityCostRate: number // Taxa sobre valor venal (%)
  urgencyMultiplier: number // 1.0 = normal, 1.2 = 20% acréscimo
  issRate: number // ISS (%)
  profitMargin: number // Margem de lucro (%)
}

interface CalculationResult {
  linkCost: number
  equipmentCost: number
  humanResourcesCost: number
  logisticsCost: number
  opportunityCost: number
  subtotal: number
  urgencyAdjustment: number
  issValue: number
  totalCost: number
  salePrice: number
  grossMargin: number
  grossMarginPercent: number
}

interface Proposal {
  id: number
  base_id?: string
  title: string
  client?: any
  client_data?: any
  created_at: string
  total_monthly: number
  value: number
  status?: string
  metadata?: any
}

// Catálogo de Equipamentos
const EQUIPMENT_CATALOG = {
  router: [
    { model: 'Router Edge 1G', dailyDepreciation: 50, venalValue: 7500 },
    { model: 'Router Edge 2G', dailyDepreciation: 80, venalValue: 12000 },
    { model: 'Router Edge 5G', dailyDepreciation: 120, venalValue: 18000 },
  ],
  switch: [
    { model: 'Switch 24P PoE', dailyDepreciation: 40, venalValue: 2800 },
    { model: 'Switch 48P PoE', dailyDepreciation: 60, venalValue: 4500 },
  ],
  ap: [
    { model: 'AP Wi-Fi 6 Indoor', dailyDepreciation: 20, venalValue: 1200 },
    { model: 'AP Wi-Fi 6E Indoor', dailyDepreciation: 30, venalValue: 1800 },
    { model: 'AP Wi-Fi 6 Outdoor', dailyDepreciation: 25, venalValue: 1500 },
  ],
  ups: [
    { model: 'Nobreak 1kVA', dailyDepreciation: 15, venalValue: 1500 },
    { model: 'Nobreak 2kVA', dailyDepreciation: 25, venalValue: 2500 },
    { model: 'Nobreak 3kVA', dailyDepreciation: 35, venalValue: 3500 },
  ],
}

interface EventosTICalculatorProps {
  onBackToDashboard: () => void
  initialProposalId?: string | null
}

export default function EventosTICalculator({ onBackToDashboard, initialProposalId }: EventosTICalculatorProps) {
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
    email: '', 
    phone: '' 
  })
  const [accountManagerData, setAccountManagerData] = useState<AccountManagerData>({ 
    name: '', 
    email: '', 
    phone: '' 
  })

  // Estados do evento
  const [eventData, setEventData] = useState<EventData>({
    name: '',
    location: '',
    startDate: '',
    endDate: '',
    durationDays: 1,
    durationHours: 24,
    expectedUsers: 100,
  })

  // Estados de infraestrutura
  const [linkConfig, setLinkConfig] = useState<LinkConfig>({
    type: 'fibra_propria',
    bandwidth: 1000,
    bandwidthUnit: 'Mbps',
    monthlyCost: 5000,
    installationCost: 2000,
  })

  const [equipment, setEquipment] = useState<Equipment[]>([])

  const [humanResources, setHumanResources] = useState<HumanResources>({
    setupHours: 8,
    setupTechnicians: 2,
    onsiteHours: 24,
    onsiteTechnicians: 2,
    teardownHours: 4,
    teardownTechnicians: 2,
    hourlyRate: 150,
  })

  const [logisticsCosts, setLogisticsCosts] = useState<LogisticsCosts>({
    transportKm: 0,
    transportCostPerKm: 2,
    accommodationDays: 0,
    accommodationCostPerDay: 300,
    mealsDays: 0,
    mealsCostPerDay: 100,
  })

  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    opportunityCostRate: 0.05, // 5% do valor venal por evento
    urgencyMultiplier: 1.0,
    issRate: 0.05, // 5%
    profitMargin: 0.30, // 30%
  })

  const [result, setResult] = useState<CalculationResult | null>(null)

  // Buscar propostas
  useEffect(() => {
    if (viewMode === 'search') {
      fetchProposals()
    }
  }, [viewMode])

  // Calcular duração quando datas mudam
  useEffect(() => {
    if (eventData.startDate && eventData.endDate) {
      const start = new Date(eventData.startDate)
      const end = new Date(eventData.endDate)
      const diffTime = Math.abs(end.getTime() - start.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 para incluir o dia final
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60))
      
      setEventData(prev => ({
        ...prev,
        durationDays: diffDays,
        durationHours: diffHours,
      }))
    }
  }, [eventData.startDate, eventData.endDate])

  const fetchProposals = async () => {
    setLoadingProposals(true)
    try {
      console.log('🔍 Buscando propostas de Eventos TI...')
      const response = await fetch('/api/simulator/proposals?type=EVENTOS_TI&all=true')
      if (response.ok) {
        const result = await response.json()
        console.log('📥 Resposta da API:', result)
        const data = result.data?.proposals || result.proposals || result.data || result
        console.log('📊 Propostas recebidas:', data)
        console.log('📊 Tipo de data:', typeof data, 'É array?', Array.isArray(data))
        setProposals(Array.isArray(data) ? data : [])
      } else {
        console.error('❌ Erro na resposta:', response.status, response.statusText)
        setProposals([])
      }
    } catch (error) {
      console.error('❌ Erro ao buscar propostas:', error)
      setProposals([])
    } finally {
      setLoadingProposals(false)
    }
  }

  const filteredProposals = Array.isArray(proposals) ? proposals.filter(p => {
    const clientName = p.client?.name || p.client_data?.name || ''
    const eventName = p.client_data?.eventName || p.title || ''
    const searchLower = searchTerm.toLowerCase()
    
    return clientName.toLowerCase().includes(searchLower) ||
           eventName.toLowerCase().includes(searchLower) ||
           (p.base_id && p.base_id.toLowerCase().includes(searchLower)) ||
           p.id.toString().includes(searchTerm)
  }) : []

  // Adicionar equipamento
  const addEquipment = (type: 'router' | 'switch' | 'ap' | 'ups') => {
    const catalog = EQUIPMENT_CATALOG[type]
    const defaultItem = catalog[0]
    
    setEquipment([...equipment, {
      type,
      model: defaultItem.model,
      quantity: 1,
      dailyDepreciation: defaultItem.dailyDepreciation,
      venalValue: defaultItem.venalValue,
    }])
  }

  // Remover equipamento
  const removeEquipment = (index: number) => {
    setEquipment(equipment.filter((_, i) => i !== index))
  }

  // Atualizar equipamento
  const updateEquipment = (index: number, field: string, value: any) => {
    const updated = [...equipment]
    updated[index] = { ...updated[index], [field]: value }
    
    // Atualizar valores se modelo mudou
    if (field === 'model') {
      const catalog = EQUIPMENT_CATALOG[updated[index].type]
      const item = catalog.find(c => c.model === value)
      if (item) {
        updated[index].dailyDepreciation = item.dailyDepreciation
        updated[index].venalValue = item.venalValue
      }
    }
    
    setEquipment(updated)
  }

  // Calcular precificação
  const calculatePricing = () => {
    // 1. Custo de Link
    const linkDailyCost = linkConfig.monthlyCost / 30
    const linkCost = (linkDailyCost * eventData.durationDays) + linkConfig.installationCost

    // 2. Custo de Equipamentos (Depreciação + Custo de Oportunidade)
    let equipmentDepreciation = 0
    let equipmentOpportunityCost = 0
    
    equipment.forEach(eq => {
      equipmentDepreciation += eq.dailyDepreciation * eq.quantity * eventData.durationDays
      equipmentOpportunityCost += eq.venalValue * eq.quantity * pricingConfig.opportunityCostRate
    })
    
    const equipmentCost = equipmentDepreciation + equipmentOpportunityCost

    // 3. Custo de Recursos Humanos
    const setupCost = humanResources.setupHours * humanResources.setupTechnicians * humanResources.hourlyRate
    const onsiteCost = humanResources.onsiteHours * humanResources.onsiteTechnicians * humanResources.hourlyRate
    const teardownCost = humanResources.teardownHours * humanResources.teardownTechnicians * humanResources.hourlyRate
    const humanResourcesCost = setupCost + onsiteCost + teardownCost

    // 4. Custo de Logística
    const transportCost = logisticsCosts.transportKm * logisticsCosts.transportCostPerKm
    const accommodationCost = logisticsCosts.accommodationDays * logisticsCosts.accommodationCostPerDay
    const mealsCost = logisticsCosts.mealsDays * logisticsCosts.mealsCostPerDay
    const logisticsCost = transportCost + accommodationCost + mealsCost

    // 5. Subtotal antes de ajustes
    const subtotal = linkCost + equipmentCost + humanResourcesCost + logisticsCost

    // 6. Ajuste de Urgência
    const urgencyAdjustment = subtotal * (pricingConfig.urgencyMultiplier - 1)

    // 7. Total de Custos
    const totalCost = subtotal + urgencyAdjustment

    // 8. ISS (sobre serviços)
    const issValue = (humanResourcesCost + logisticsCost) * pricingConfig.issRate

    // 9. Preço de Venda (Custo + Margem)
    const salePrice = (totalCost + issValue) * (1 + pricingConfig.profitMargin)

    // 10. Margem Bruta
    const grossMargin = salePrice - totalCost - issValue
    const grossMarginPercent = (grossMargin / salePrice) * 100

    setResult({
      linkCost,
      equipmentCost,
      humanResourcesCost,
      logisticsCost,
      opportunityCost: equipmentOpportunityCost,
      subtotal,
      urgencyAdjustment,
      issValue,
      totalCost,
      salePrice,
      grossMargin,
      grossMarginPercent,
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

    if (!eventData.name || !eventData.startDate || !eventData.endDate) {
      alert('Por favor, preencha os dados do evento.')
      return
    }

    try {
      const proposalsWithBaseId = Array.isArray(proposals)
        ? proposals.map((p) => ({
            base_id: p.base_id || (p as any).baseId || `Prop_Eventos_TI_000_v1`,
          }))
        : []

      const statusToUse = currentProposal?.status || 'Aguardando Aprovação do Cliente'

      const basePayload = {
        title: `Proposta Eventos TI - ${eventData.name}`,
        type: 'EVENTOS_TI',
        status: statusToUse,
        value: result.salePrice,
        total_setup: linkConfig.installationCost,
        total_monthly: 0, // Eventos não têm recorrência
        contract_period: eventData.durationDays,
        date: new Date(eventData.startDate).toISOString(),
        expiry_date: new Date(eventData.endDate).toISOString(),
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
          eventName: eventData.name,
          eventLocation: eventData.location,
          eventStartDate: eventData.startDate,
          eventEndDate: eventData.endDate,
        },
        account_manager: {
          name: accountManagerData.name,
          email: accountManagerData.email,
          phone: accountManagerData.phone || '',
        },
        metadata: {
          eventData,
          linkConfig,
          equipment,
          humanResources,
          logisticsCosts,
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

        console.log('📤 Enviando nova versão Eventos TI:', proposalData)

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
          const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
          console.error('❌ Erro ao salvar nova versão:', errorData)
          alert(`Erro ao salvar proposta: ${errorData.error || 'Erro desconhecido'}`)
        }
      } else if (currentProposal?.id) {
        const proposalToUpdate = {
          ...basePayload,
        }

        console.log('📤 Atualizando proposta Eventos TI:', proposalToUpdate)

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
          const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
          console.error('❌ Erro ao atualizar proposta:', errorData)
          alert(`Erro ao atualizar proposta: ${errorData.error || 'Erro desconhecido'}`)
        }
      } else {
        const baseId = generateNextProposalId(proposalsWithBaseId, 'EVENTOS_TI', 1)
        console.log('🆔 ID gerado para nova proposta Eventos TI:', baseId)

        const proposalData = {
          ...basePayload,
          base_id: baseId,
          version: 1,
        }

        console.log('📤 Enviando proposta Eventos TI:', proposalData)

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
          const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
          console.error('❌ Erro ao salvar proposta:', errorData)
          alert(`Erro ao salvar proposta: ${errorData.error || 'Erro desconhecido'}`)
        }
      }
    } catch (error) {
      console.error('❌ Erro ao salvar proposta:', error)
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
    
    if (proposal.metadata) {
      const metadata = proposal.metadata as any
      console.log('📦 Metadata da proposta:', metadata)
      
      if (metadata.clientData) setClientData(metadata.clientData)
      if (metadata.accountManagerData) setAccountManagerData(metadata.accountManagerData)
      if (metadata.eventData) setEventData(metadata.eventData)
      if (metadata.linkConfig) setLinkConfig(metadata.linkConfig)
      if (metadata.equipment) setEquipment(metadata.equipment)
      if (metadata.humanResources) setHumanResources(metadata.humanResources)
      if (metadata.logisticsCosts) setLogisticsCosts(metadata.logisticsCosts)
      if (metadata.pricingConfig) setPricingConfig(metadata.pricingConfig)
      if (metadata.result) setResult(metadata.result)
    }
    
    setViewMode('view')
  }

  // Editar proposta
  const handleEditProposal = (proposal: Proposal) => {
    setCurrentProposal(proposal)
    
    if (proposal.metadata) {
      const metadata = proposal.metadata as any
      if (metadata.clientData) setClientData(metadata.clientData)
      if (metadata.accountManagerData) setAccountManagerData(metadata.accountManagerData)
      if (metadata.eventData) setEventData(metadata.eventData)
      if (metadata.linkConfig) setLinkConfig(metadata.linkConfig)
      if (metadata.equipment) setEquipment(metadata.equipment)
      if (metadata.humanResources) setHumanResources(metadata.humanResources)
      if (metadata.logisticsCosts) setLogisticsCosts(metadata.logisticsCosts)
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
        event: eventData,
      },
      infrastructure: {
        link: linkConfig,
        equipment,
      },
      services: {
        humanResources,
        logistics: logisticsCosts,
      },
      pricing: pricingConfig,
      calculation: result,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `eventos-ti-proposal-${Date.now()}.json`
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
        <CardTitle>Buscar Propostas - Eventos TI</CardTitle>
        <CardDescription>Encontre propostas existentes ou crie uma nova.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, evento ou ID..."
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
                <th className="text-left p-3">Evento</th>
                <th className="text-left p-3">Data Início</th>
                <th className="text-right p-3">Valor Total</th>
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
                    <td className="p-3">{proposal.client_data?.eventName || proposal.title || '-'}</td>
                    <td className="p-3">
                      {proposal.client_data?.eventStartDate 
                        ? new Date(proposal.client_data.eventStartDate).toLocaleDateString('pt-BR')
                        : new Date(proposal.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="text-right p-3">
                      {proposal.value.toLocaleString('pt-BR', {
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

  return (
    <div className="container mx-auto p-4 space-y-6">
      {viewMode === 'search' && renderSearchView()}
      {viewMode === 'client-form' && renderClientForm()}
      {viewMode === 'calculator' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Calculadora Eventos TI</h2>
              <p className="text-muted-foreground">
                Cliente: {clientData.name}
              </p>
            </div>
            <Button variant="outline" onClick={() => setViewMode('client-form')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>

          {/* Dados do Evento */}
          <Card>
            <CardHeader>
              <CardTitle>Dados do Evento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome do Evento *</Label>
                  <Input
                    placeholder="Nome do evento"
                    value={eventData.name}
                    onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Local do Evento *</Label>
                  <Input
                    placeholder="Local/endereço"
                    value={eventData.location}
                    onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data de Início *</Label>
                  <Input
                    type="date"
                    value={eventData.startDate}
                    onChange={(e) => setEventData({ ...eventData, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data de Término *</Label>
                  <Input
                    type="date"
                    value={eventData.endDate}
                    onChange={(e) => setEventData({ ...eventData, endDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Duração (dias)</Label>
                  <Input
                    type="number"
                    value={eventData.durationDays}
                    disabled
                  />
                </div>
                <div>
                  <Label>Usuários Esperados</Label>
                  <Input
                    type="number"
                    value={eventData.expectedUsers}
                    onChange={(e) => setEventData({ ...eventData, expectedUsers: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuração de Link */}
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Link</Label>
                  <Select
                    value={linkConfig.type}
                    onValueChange={(value: 'fibra_propria' | 'burst_terceiros') =>
                      setLinkConfig({ ...linkConfig, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fibra_propria">Fibra Dedicada Própria</SelectItem>
                      <SelectItem value="burst_terceiros">Burst de Terceiros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Banda Contratada</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={linkConfig.bandwidth}
                      onChange={(e) => setLinkConfig({ ...linkConfig, bandwidth: parseFloat(e.target.value) || 0 })}
                      className="flex-1"
                    />
                    <Select
                      value={linkConfig.bandwidthUnit}
                      onValueChange={(value: 'Mbps' | 'Gbps') =>
                        setLinkConfig({ ...linkConfig, bandwidthUnit: value })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                        <SelectItem value="Gbps">Gbps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Custo Mensal (R$)</Label>
                  <Input
                    type="number"
                    value={linkConfig.monthlyCost}
                    onChange={(e) => setLinkConfig({ ...linkConfig, monthlyCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Custo de Instalação (R$)</Label>
                  <Input
                    type="number"
                    value={linkConfig.installationCost}
                    onChange={(e) => setLinkConfig({ ...linkConfig, installationCost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Equipamentos */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Equipamentos (Locação)</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => addEquipment('router')}>
                    <Plus className="w-4 h-4 mr-1" />
                    Roteador
                  </Button>
                  <Button size="sm" onClick={() => addEquipment('switch')}>
                    <Plus className="w-4 h-4 mr-1" />
                    Switch
                  </Button>
                  <Button size="sm" onClick={() => addEquipment('ap')}>
                    <Plus className="w-4 h-4 mr-1" />
                    AP
                  </Button>
                  <Button size="sm" onClick={() => addEquipment('ups')}>
                    <Plus className="w-4 h-4 mr-1" />
                    Nobreak
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {equipment.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum equipamento adicionado
                </p>
              ) : (
                <div className="space-y-2">
                  {equipment.map((eq, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b pb-2">
                      <div className="col-span-4">
                        <Label>Modelo</Label>
                        <Select
                          value={eq.model}
                          onValueChange={(value) => updateEquipment(idx, 'model', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EQUIPMENT_CATALOG[eq.type].map(item => (
                              <SelectItem key={item.model} value={item.model}>
                                {item.model}
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
                          value={eq.quantity}
                          onChange={(e) => updateEquipment(idx, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label>Deprec./Dia</Label>
                        <Input
                          type="number"
                          value={eq.dailyDepreciation}
                          onChange={(e) => updateEquipment(idx, 'dailyDepreciation', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label>Valor Venal</Label>
                        <Input
                          type="number"
                          value={eq.venalValue}
                          onChange={(e) => updateEquipment(idx, 'venalValue', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEquipment(idx)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recursos Humanos */}
          <Card>
            <CardHeader>
              <CardTitle>Recursos Humanos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Setup (Instalação)</h4>
                  <div>
                    <Label>Horas</Label>
                    <Input
                      type="number"
                      value={humanResources.setupHours}
                      onChange={(e) => setHumanResources({ ...humanResources, setupHours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Técnicos</Label>
                    <Input
                      type="number"
                      value={humanResources.setupTechnicians}
                      onChange={(e) => setHumanResources({ ...humanResources, setupTechnicians: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">On-site (Plantão)</h4>
                  <div>
                    <Label>Horas</Label>
                    <Input
                      type="number"
                      value={humanResources.onsiteHours}
                      onChange={(e) => setHumanResources({ ...humanResources, onsiteHours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Técnicos</Label>
                    <Input
                      type="number"
                      value={humanResources.onsiteTechnicians}
                      onChange={(e) => setHumanResources({ ...humanResources, onsiteTechnicians: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Teardown (Desmontagem)</h4>
                  <div>
                    <Label>Horas</Label>
                    <Input
                      type="number"
                      value={humanResources.teardownHours}
                      onChange={(e) => setHumanResources({ ...humanResources, teardownHours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label>Técnicos</Label>
                    <Input
                      type="number"
                      value={humanResources.teardownTechnicians}
                      onChange={(e) => setHumanResources({ ...humanResources, teardownTechnicians: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label>Valor Hora Técnica (R$)</Label>
                <Input
                  type="number"
                  value={humanResources.hourlyRate}
                  onChange={(e) => setHumanResources({ ...humanResources, hourlyRate: parseFloat(e.target.value) || 0 })}
                  className="max-w-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Custos Logísticos */}
          <Card>
            <CardHeader>
              <CardTitle>Custos Logísticos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Distância (KM)</Label>
                  <Input
                    type="number"
                    value={logisticsCosts.transportKm}
                    onChange={(e) => setLogisticsCosts({ ...logisticsCosts, transportKm: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Custo por KM (R$)</Label>
                  <Input
                    type="number"
                    value={logisticsCosts.transportCostPerKm}
                    onChange={(e) => setLogisticsCosts({ ...logisticsCosts, transportCostPerKm: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Dias de Hospedagem</Label>
                  <Input
                    type="number"
                    value={logisticsCosts.accommodationDays}
                    onChange={(e) => setLogisticsCosts({ ...logisticsCosts, accommodationDays: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Custo Hospedagem/Dia (R$)</Label>
                  <Input
                    type="number"
                    value={logisticsCosts.accommodationCostPerDay}
                    onChange={(e) => setLogisticsCosts({ ...logisticsCosts, accommodationCostPerDay: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Dias de Refeições</Label>
                  <Input
                    type="number"
                    value={logisticsCosts.mealsDays}
                    onChange={(e) => setLogisticsCosts({ ...logisticsCosts, mealsDays: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Custo Refeição/Dia (R$)</Label>
                  <Input
                    type="number"
                    value={logisticsCosts.mealsCostPerDay}
                    onChange={(e) => setLogisticsCosts({ ...logisticsCosts, mealsCostPerDay: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuração de Precificação */}
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Precificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Taxa de Custo de Oportunidade (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pricingConfig.opportunityCostRate * 100}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, opportunityCostRate: parseFloat(e.target.value) / 100 || 0 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Percentual sobre valor venal dos equipamentos
                  </p>
                </div>
                <div>
                  <Label>Multiplicador de Urgência</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={pricingConfig.urgencyMultiplier}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, urgencyMultiplier: parseFloat(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    1.0 = normal, 1.2 = 20% acréscimo
                  </p>
                </div>
                <div>
                  <Label>ISS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pricingConfig.issRate * 100}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, issRate: parseFloat(e.target.value) / 100 || 0 })}
                  />
                </div>
                <div>
                  <Label>Margem de Lucro (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pricingConfig.profitMargin * 100}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, profitMargin: parseFloat(e.target.value) / 100 || 0 })}
                  />
                </div>
              </div>
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
                    <CardTitle>Preço de Venda</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">
                      {result.salePrice.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Margem Bruta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-blue-600">
                      {result.grossMargin.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {result.grossMarginPercent.toFixed(2)}% de margem
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento de Custos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Link:</span>
                      <span className="font-semibold">
                        {result.linkCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Equipamentos (Depreciação):</span>
                      <span className="font-semibold">
                        {(result.equipmentCost - result.opportunityCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Custo de Oportunidade:</span>
                      <span className="font-semibold">
                        {result.opportunityCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recursos Humanos:</span>
                      <span className="font-semibold">
                        {result.humanResourcesCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Logística:</span>
                      <span className="font-semibold">
                        {result.logisticsCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    {result.urgencyAdjustment > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Ajuste de Urgência:</span>
                        <span className="font-semibold">
                          +{result.urgencyAdjustment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>ISS:</span>
                      <span className="font-semibold">
                        {result.issValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-lg">
                      <span className="font-bold">Total de Custos:</span>
                      <span className="font-bold">
                        {result.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
      {viewMode === 'view' && (
        <div className="space-y-6">
          {!currentProposal ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Nenhuma proposta selecionada</p>
                <Button onClick={() => setViewMode('search')} className="mt-4">
                  Voltar para Busca
                </Button>
              </CardContent>
            </Card>
          ) : !result ? (
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
          ) : (
            <>
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
                  <Button onClick={exportToJSON}>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar
                  </Button>
                </div>
              </div>

              {/* Informações do Cliente e Gerente */}
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
                    {clientData.contact && (
                      <div>
                        <Label className="text-muted-foreground">Contato</Label>
                        <p>{clientData.contact}</p>
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

              {/* Dados do Evento */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <Calendar className="w-5 h-5 inline mr-2" />
                    Informações do Evento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Nome do Evento</Label>
                      <p className="font-semibold">{eventData.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Local</Label>
                      <p>{eventData.location}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Data de Início</Label>
                      <p>{new Date(eventData.startDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Data de Término</Label>
                      <p>{new Date(eventData.endDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Duração</Label>
                      <p>{eventData.durationDays} dias ({eventData.durationHours} horas)</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Usuários Esperados</Label>
                      <p>{eventData.expectedUsers}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumo Financeiro */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Preço de Venda</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-green-600">
                      {result.salePrice.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Margem Bruta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-blue-600">
                      {result.grossMargin.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {result.grossMarginPercent.toFixed(2)}% de margem
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Infraestrutura */}
              <Card>
                <CardHeader>
                  <CardTitle>Infraestrutura de Link</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Tipo de Link</Label>
                      <p>{linkConfig.type === 'fibra_propria' ? 'Fibra Dedicada Própria' : 'Burst de Terceiros'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Banda Contratada</Label>
                      <p>{linkConfig.bandwidth} {linkConfig.bandwidthUnit}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Custo Mensal</Label>
                      <p>{linkConfig.monthlyCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Custo de Instalação</Label>
                      <p>{linkConfig.installationCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Equipamentos */}
              <Card>
                <CardHeader>
                  <CardTitle>Equipamentos Locados</CardTitle>
                </CardHeader>
                <CardContent>
                  {equipment.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhum equipamento
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Tipo</th>
                            <th className="text-left p-2">Modelo</th>
                            <th className="text-right p-2">Qtd</th>
                            <th className="text-right p-2">Deprec./Dia</th>
                            <th className="text-right p-2">Valor Venal</th>
                            <th className="text-right p-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {equipment.map((eq, idx) => (
                            <tr key={idx} className="border-b hover:bg-muted/50">
                              <td className="p-2 capitalize">{eq.type}</td>
                              <td className="p-2">{eq.model}</td>
                              <td className="text-right p-2">{eq.quantity}</td>
                              <td className="text-right p-2">
                                {eq.dailyDepreciation.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td className="text-right p-2">
                                {eq.venalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td className="text-right p-2 font-semibold">
                                {(eq.dailyDepreciation * eq.quantity * eventData.durationDays).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recursos Humanos */}
              <Card>
                <CardHeader>
                  <CardTitle>Recursos Humanos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Setup (Instalação)</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Horas:</span> {humanResources.setupHours}h</p>
                        <p><span className="text-muted-foreground">Técnicos:</span> {humanResources.setupTechnicians}</p>
                        <p className="font-semibold">
                          {(humanResources.setupHours * humanResources.setupTechnicians * humanResources.hourlyRate).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">On-site (Plantão)</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Horas:</span> {humanResources.onsiteHours}h</p>
                        <p><span className="text-muted-foreground">Técnicos:</span> {humanResources.onsiteTechnicians}</p>
                        <p className="font-semibold">
                          {(humanResources.onsiteHours * humanResources.onsiteTechnicians * humanResources.hourlyRate).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Teardown (Desmontagem)</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Horas:</span> {humanResources.teardownHours}h</p>
                        <p><span className="text-muted-foreground">Técnicos:</span> {humanResources.teardownTechnicians}</p>
                        <p className="font-semibold">
                          {(humanResources.teardownHours * humanResources.teardownTechnicians * humanResources.hourlyRate).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm">
                    <p><span className="text-muted-foreground">Valor Hora Técnica:</span> {humanResources.hourlyRate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Detalhamento de Custos */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento de Custos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Link:</span>
                      <span className="font-semibold">
                        {result.linkCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Equipamentos (Depreciação):</span>
                      <span className="font-semibold">
                        {(result.equipmentCost - result.opportunityCost).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Custo de Oportunidade ({(pricingConfig.opportunityCostRate * 100).toFixed(1)}%):</span>
                      <span className="font-semibold">
                        {result.opportunityCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Recursos Humanos:</span>
                      <span className="font-semibold">
                        {result.humanResourcesCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Logística:</span>
                      <span className="font-semibold">
                        {result.logisticsCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    {result.urgencyAdjustment > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Ajuste de Urgência ({((pricingConfig.urgencyMultiplier - 1) * 100).toFixed(0)}%):</span>
                        <span className="font-semibold">
                          +{result.urgencyAdjustment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>ISS ({(pricingConfig.issRate * 100).toFixed(1)}%):</span>
                      <span className="font-semibold">
                        {result.issValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-bold">Total de Custos:</span>
                      <span className="font-bold">
                        {result.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg border-t pt-2">
                      <span className="font-bold">Preço de Venda (+ {(pricingConfig.profitMargin * 100).toFixed(0)}% margem):</span>
                      <span className="font-bold text-green-600">
                        {result.salePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}
