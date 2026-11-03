import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useCommissions } from '@/hooks/use-commissions';
import { useCommissionsEditor } from '@/hooks/use-commissions-editor';
import { EditableCell } from '@/components/ui/editable-cell';
import { formatBrazilianNumber, formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Edit, Save, X } from 'lucide-react';
import { getCRMAuthHeaders } from '@/config/api';

interface CommissionTablesUnifiedProps {
  className?: string;
  editable?: boolean;
}

export default function CommissionTablesUnified({ className, editable: initialEditable = false }: CommissionTablesUnifiedProps) {
  const [isEditing, setIsEditing] = useState(initialEditable);
  const { 
    channelSeller, 
    channelDirector, 
    seller, 
    channelInfluencer, 
    channelIndicator, 
    isLoading, 
    error,
    refreshData,
  } = useCommissions();
  
  const { updateCommission } = useCommissionsEditor({ onUpdated: refreshData });

  // Só mostrar loading se realmente estiver carregando e não tiver dados
  if (isLoading && !channelSeller && !seller && !channelInfluencer && !channelIndicator) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-[rgb(var(--crm-ink-rgb)_/_1)]">Carregando tabelas de comissões...</div>
      </div>
    );
  }

  // Mostrar erro apenas se não tiver dados de fallback
  if (error && !channelSeller && !seller && !channelInfluencer && !channelIndicator) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-red-700 dark:text-red-400">Erro ao carregar tabelas de comissões: {error}</div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Botões de Editar/Salvar */}
      <div className="flex gap-2 mb-4">
        {!isEditing ? (
          <Button
            onClick={() => setIsEditing(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Editar Comissões
          </Button>
        ) : (
          <>
            <Button
              onClick={() => setIsEditing(false)}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Salvo
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              variant="outline"
              className="text-[rgb(var(--crm-ink-rgb)_/_1)] border-[var(--crm-border)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          </>
        )}
      </div>

      {/* First Row: Canal/Vendedor table at top */}
      <div className="w-full">
        <Card className="bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)]">
          <CardHeader>
            <CardTitle>Comissão Canal/Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[rgb(var(--crm-ink-rgb)_/_1)]">Prazo (meses)</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelSeller && (
                    <>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">12 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={channelSeller.months_12}
                              onSave={(value) => updateCommission({
                                table: 'channel_seller',
                                id: channelSeller.id,
                                field: 'months_12',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(channelSeller.months_12)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">24 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={channelSeller.months_24}
                              onSave={(value) => updateCommission({
                                table: 'channel_seller',
                                id: channelSeller.id,
                                field: 'months_24',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(channelSeller.months_24)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">36 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={channelSeller.months_36}
                              onSave={(value) => updateCommission({
                                table: 'channel_seller',
                                id: channelSeller.id,
                                field: 'months_36',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(channelSeller.months_36)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">48 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={channelSeller.months_48}
                              onSave={(value) => updateCommission({
                                table: 'channel_seller',
                                id: channelSeller.id,
                                field: 'months_48',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(channelSeller.months_48)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">60 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={channelSeller.months_60}
                              onSave={(value) => updateCommission({
                                table: 'channel_seller',
                                id: channelSeller.id,
                                field: 'months_60',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(channelSeller.months_60)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Influencer and Indicator tables side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Canal Influenciador Table */}
        <Card className="bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)]">
          <CardHeader>
            <CardTitle>Comissão Canal Influenciador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[rgb(var(--crm-ink-rgb)_/_1)]">Receita Mensal</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">12m</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">24m</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">36m</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">48m</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">60m</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelInfluencer && channelInfluencer.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{commission.revenue_range}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <EditableCell
                            value={commission.months_12}
                            onSave={(value) => updateCommission({
                              table: 'channel_influencer',
                              id: commission.id,
                              field: 'months_12',
                              value
                            })}
                          />
                        ) : (
                          <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(commission.months_12)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <EditableCell
                            value={commission.months_24}
                            onSave={(value) => updateCommission({
                              table: 'channel_influencer',
                              id: commission.id,
                              field: 'months_24',
                              value
                            })}
                          />
                        ) : (
                          <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(commission.months_24)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <EditableCell
                            value={commission.months_36}
                            onSave={(value) => updateCommission({
                              table: 'channel_influencer',
                              id: commission.id,
                              field: 'months_36',
                              value
                            })}
                          />
                        ) : (
                          <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(commission.months_36)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <EditableCell
                            value={commission.months_48}
                            onSave={(value) => updateCommission({
                              table: 'channel_influencer',
                              id: commission.id,
                              field: 'months_48',
                              value
                            })}
                          />
                        ) : (
                          <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(commission.months_48)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <EditableCell
                            value={commission.months_60}
                            onSave={(value) => updateCommission({
                              table: 'channel_influencer',
                              id: commission.id,
                              field: 'months_60',
                              value
                            })}
                          />
                        ) : (
                          <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(commission.months_60)}%</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Canal Indicador Table */}
        <Card className="bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)]">
          <CardHeader>
            <CardTitle>Comissão Canal Indicador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[rgb(var(--crm-ink-rgb)_/_1)]">Receita Mensal</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">12m</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">24m</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">36m</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">48m</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">60m</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelIndicator && channelIndicator.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{commission.revenue_range}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <EditableCell
                            value={commission.months_12}
                            onSave={(value) => updateCommission({
                              table: 'channel_indicator',
                              id: commission.id,
                              field: 'months_12',
                              value
                            })}
                          />
                        ) : (
                          <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(commission.months_12)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <EditableCell
                            value={commission.months_24}
                            onSave={(value) => updateCommission({
                              table: 'channel_indicator',
                              id: commission.id,
                              field: 'months_24',
                              value
                            })}
                          />
                        ) : (
                          <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(commission.months_24)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <EditableCell
                            value={commission.months_36}
                            onSave={(value) => updateCommission({
                              table: 'channel_indicator',
                              id: commission.id,
                              field: 'months_36',
                              value
                            })}
                          />
                        ) : (
                          <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(commission.months_36)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <EditableCell
                            value={commission.months_48}
                            onSave={(value) => updateCommission({
                              table: 'channel_indicator',
                              id: commission.id,
                              field: 'months_48',
                              value
                            })}
                          />
                        ) : (
                          <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(commission.months_48)}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <EditableCell
                            value={commission.months_60}
                            onSave={(value) => updateCommission({
                              table: 'channel_indicator',
                              id: commission.id,
                              field: 'months_60',
                              value
                            })}
                          />
                        ) : (
                          <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(commission.months_60)}%</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Third Row: Seller and Director tables side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendedor Table */}
        <Card className="bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)]">
          <CardHeader>
            <CardTitle>Comissão Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[rgb(var(--crm-ink-rgb)_/_1)]">Prazo (meses)</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seller && (
                    <>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">12 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={seller.months_12}
                              onSave={(value) => updateCommission({
                                table: 'seller',
                                id: seller.id,
                                field: 'months_12',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(seller.months_12)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">24 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={seller.months_24}
                              onSave={(value) => updateCommission({
                                table: 'seller',
                                id: seller.id,
                                field: 'months_24',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(seller.months_24)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">36 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={seller.months_36}
                              onSave={(value) => updateCommission({
                                table: 'seller',
                                id: seller.id,
                                field: 'months_36',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(seller.months_36)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">48 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={seller.months_48}
                              onSave={(value) => updateCommission({
                                table: 'seller',
                                id: seller.id,
                                field: 'months_48',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(seller.months_48)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">60 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={seller.months_60}
                              onSave={(value) => updateCommission({
                                table: 'seller',
                                id: seller.id,
                                field: 'months_60',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(seller.months_60)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Diretor Table */}
        <Card className="bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)]">
          <CardHeader>
            <CardTitle>Comissão Diretor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[rgb(var(--crm-ink-rgb)_/_1)]">Prazo (meses)</TableHead>
                    <TableHead className="text-right text-[rgb(var(--crm-ink-rgb)_/_1)]">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelDirector && (
                    <>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">12 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={channelDirector.months_12}
                              onSave={(value) => updateCommission({
                                table: 'channel_director',
                                id: channelDirector.id,
                                field: 'months_12',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(channelDirector.months_12)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">24 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={channelDirector.months_24}
                              onSave={(value) => updateCommission({
                                table: 'channel_director',
                                id: channelDirector.id,
                                field: 'months_24',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(channelDirector.months_24)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">36 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={channelDirector.months_36}
                              onSave={(value) => updateCommission({
                                table: 'channel_director',
                                id: channelDirector.id,
                                field: 'months_36',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(channelDirector.months_36)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">48 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={channelDirector.months_48}
                              onSave={(value) => updateCommission({
                                table: 'channel_director',
                                id: channelDirector.id,
                                field: 'months_48',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(channelDirector.months_48)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-[rgb(var(--crm-ink-rgb)_/_1)]">60 meses</TableCell>
                        <TableCell className="text-right">
                          {isEditing ? (
                            <EditableCell
                              value={channelDirector.months_60}
                              onSave={(value) => updateCommission({
                                table: 'channel_director',
                                id: channelDirector.id,
                                field: 'months_60',
                                value
                              })}
                            />
                          ) : (
                            <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm">{formatBrazilianNumber(channelDirector.months_60)}%</span>
                          )}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
