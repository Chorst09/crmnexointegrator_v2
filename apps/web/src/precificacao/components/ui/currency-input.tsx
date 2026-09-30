import React, { forwardRef, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    // Formatar número para moeda brasileira (apenas quando não está focado)
    const formatCurrency = (num: number): string => {
      if (isNaN(num) || num === 0) return '';
      return num.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    // Converter string formatada para número
    const parseCurrency = (str: string): number => {
      if (!str) return 0;
      // Remove tudo exceto números e vírgula
      const cleaned = str.replace(/[^\d,]/g, '');
      // Substitui vírgula por ponto para conversão
      const withDot = cleaned.replace(',', '.');
      const parsed = parseFloat(withDot);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Atualizar display quando value externo mudar (apenas se não estiver focado)
    useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatCurrency(value));
      }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;
      
      // Se estiver vazio, limpar
      if (!input) {
        setDisplayValue('');
        onChange(0);
        return;
      }
      
      // Remove tudo exceto números e vírgula
      let cleaned = input.replace(/[^\d,]/g, '');
      
      // Se não tem nenhum número, limpar
      if (!cleaned || cleaned === ',') {
        setDisplayValue('');
        onChange(0);
        return;
      }
      
      // Contar quantas vírgulas existem
      const commaCount = (cleaned.match(/,/g) || []).length;
      
      // Se tem mais de uma vírgula, pegar apenas a última
      if (commaCount > 1) {
        const lastCommaIndex = cleaned.lastIndexOf(',');
        const beforeComma = cleaned.substring(0, lastCommaIndex).replace(/,/g, '');
        const afterComma = cleaned.substring(lastCommaIndex + 1);
        cleaned = beforeComma + ',' + afterComma;
      }
      
      // Separar parte inteira e decimal
      const parts = cleaned.split(',');
      let formatted = parts[0]; // Parte inteira (sem limite de dígitos)
      
      if (parts.length > 1) {
        // Limitar a 2 casas decimais
        const decimals = parts[1].substring(0, 2);
        formatted = `${parts[0]},${decimals}`;
      }
      
      setDisplayValue(formatted);
      
      // Converter para número e enviar
      const numericValue = parseCurrency(formatted);
      onChange(numericValue);
    };

    const handleFocus = () => {
      setIsFocused(true);
      // Quando focar, mostrar o valor sem formatação de milhares
      if (value > 0) {
        const valueStr = value.toFixed(2).replace('.', ',');
        setDisplayValue(valueStr);
      }
    };

    const handleBlur = () => {
      setIsFocused(false);
      // Formatar completamente ao sair do campo
      const numericValue = parseCurrency(displayValue);
      setDisplayValue(formatCurrency(numericValue));
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(className)}
        {...props}
      />
    );
  }
);

CurrencyInput.displayName = 'CurrencyInput';
