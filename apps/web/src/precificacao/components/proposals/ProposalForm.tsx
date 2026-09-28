
import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Proposal, Partner, ClientData, AccountManagerData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Paperclip, X } from 'lucide-react';

const formSchema = z.object({
  title: z.string().min(1, 'O título da proposta é obrigatório.'),
  client: z.string().min(1, 'O nome do cliente é obrigatório.'),
  clientProject: z.string().optional(),
  clientEmail: z.string().email('Email inválido.').optional().or(z.literal('')),
  clientPhone: z.string().optional(),
  clientContact: z.string().optional(),
  description: z.string().min(1, 'A descrição é obrigatória.'),
  value: z.coerce.number().min(0, 'O valor deve ser positivo.'),
  date: z.string().min(1, 'A data é obrigatória.'),
  expiryDate: z.string().min(1, 'A data de validade é obrigatória.'),
  status: z.enum(['Rascunho', 'Enviada', 'Em Análise', 'Aprovada', 'Rejeitada', 'Renovação']),
  accountManager: z.string().min(1, 'O gerente de conta é obrigatório.'),
  distributorId: z.string().min(1, 'Selecione um distribuidor.'),
  proposalFile: z.string().optional(),
  technicalSpecs: z.string().optional(),
  commercialTerms: z.string().optional(),
});

interface ProposalFormProps {
  proposal: Proposal | null;
  partners: Partner[];
  onSave: (data: Proposal) => void;
  onCancel: () => void;
}

const ProposalForm: React.FC<ProposalFormProps> = ({ proposal, partners, onSave, onCancel }) => {
  const [uploadedFiles, setUploadedFiles] = useState<{
    proposalFile?: string;
    technicalSpecs?: string;
    commercialTerms?: string;
  }>({
    proposalFile: '',
    technicalSpecs: '',
    commercialTerms: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  type FormData = z.infer<typeof formSchema>;
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: proposal?.title || '',
      client: typeof proposal?.client === 'string' ? proposal.client : proposal?.client?.name || '',
      clientProject: proposal?.clientData?.projectName || '',
      clientEmail: proposal?.clientData?.email || '',
      clientPhone: proposal?.clientData?.phone || '',
      clientContact: proposal?.clientData?.contact || '',
      description: '',
      value: proposal?.value || 0,
      date: proposal?.date || new Date().toISOString().split('T')[0],
      expiryDate: proposal?.expiryDate || '',
      status: (proposal?.status === 'Aguardando Aprovação' || 
               proposal?.status === 'Aguardando Aprovação Diretoria' || 
               proposal?.status === 'Aguardando aprovação desconto Diretoria' || 
               proposal?.status === 'Aguardando Aprovação do Cliente' || 
               proposal?.status === 'Fechado Ganho' || 
               proposal?.status === 'Perdido') ? 'Rascunho' : ((proposal?.status as FormData['status']) || 'Rascunho'),
      accountManager: typeof proposal?.accountManager === 'string' 
                          ? proposal.accountManager 
                          : proposal?.accountManager?.name || '',
      distributorId: proposal?.distributorId?.toString() || '',
      proposalFile: '',
      technicalSpecs: '',
      commercialTerms: '',
    },
  });

  const handleFileUpload = (field: keyof typeof uploadedFiles) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = '.pdf,.doc,.docx';
      fileInputRef.current.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          const fileName = target.files[0].name;
          setUploadedFiles(prev => ({ ...prev, [field]: fileName }));
          form.setValue(field as any, fileName);
        }
      };
      fileInputRef.current.click();
    }
  };

  const removeFile = (field: keyof typeof uploadedFiles) => {
    setUploadedFiles(prev => ({ ...prev, [field]: undefined }));
    form.setValue(field as any, '');
  };

  const onSubmit = (values: FormData) => {
    const clientData: ClientData = {
      name: values.client,
      projectName: values.clientProject || undefined,
      email: values.clientEmail || undefined,
      phone: values.clientPhone || undefined,
      contact: values.clientContact || undefined,
    };

    const accountManagerData: AccountManagerData = {
      name: values.accountManager,
      // Adicionar email e telefone do gerente de conta se estiverem disponíveis no formulário
      // email: values.accountManagerEmail, 
      // phone: values.accountManagerPhone,
    };

    const proposalData: Proposal = {
      id: proposal?.id || Date.now().toString(),
      baseId: proposal?.baseId || `Prop_${Date.now()}`,
      version: proposal?.version || 1,
      title: values.title,
      client: clientData,
      type: 'GENERAL',
      value: values.value,
      status: values.status,
      accountManager: accountManagerData,
      distributorId: values.distributorId,
      date: values.date,
      expiryDate: values.expiryDate,
      createdAt: proposal?.createdAt || new Date(),
    };
    onSave(proposalData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título da Proposta</FormLabel>
                <FormControl>
                  <Input placeholder="Digite o título da proposta" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="client"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cliente</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do cliente" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Campos de detalhes do cliente */}
          <FormField
            control={form.control}
            name="clientProject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Projeto do Cliente</FormLabel>
                <FormControl>
                  <Input placeholder="Projeto do cliente" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email do Cliente</FormLabel>
                <FormControl>
                  <Input placeholder="email@cliente.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone do Cliente</FormLabel>
                <FormControl>
                  <Input placeholder="(DD) 99999-9999" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientContact"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contato do Cliente</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do contato" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="accountManager"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gerente de Conta</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do gerente de conta" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="distributorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Distribuidor</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um distribuidor" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {partners
                      .filter(partner => partner.type === 'Distribuidor')
                      .map(partner => (
                        <SelectItem key={partner.id} value={partner.id.toString()}>
                          {partner.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor (R$)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="0,00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Rascunho">Rascunho</SelectItem>
                    <SelectItem value="Enviada">Enviada</SelectItem>
                    <SelectItem value="Em Análise">Em Análise</SelectItem>
                    <SelectItem value="Aprovada">Aprovada</SelectItem>
                    <SelectItem value="Rejeitada">Rejeitada</SelectItem>
                    <SelectItem value="Renovação">Renovação</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Criação</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="expiryDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data de Validade</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descreva os detalhes da proposta..."
                  className="min-h-[100px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Upload de Arquivos */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Arquivos</h3>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleFileUpload('proposalFile')}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Proposta
              </Button>
              {uploadedFiles.proposalFile && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <span>{uploadedFiles.proposalFile}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile('proposalFile')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleFileUpload('technicalSpecs')}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Especificações Técnicas
              </Button>
              {uploadedFiles.technicalSpecs && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <span>{uploadedFiles.technicalSpecs}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile('technicalSpecs')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleFileUpload('commercialTerms')}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Termos Comerciais
              </Button>
              {uploadedFiles.commercialTerms && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <span>{uploadedFiles.commercialTerms}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile('commercialTerms')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <input type="file" ref={fileInputRef} className="hidden" />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">
            {proposal ? 'Atualizar' : 'Criar'} Proposta
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ProposalForm; 
