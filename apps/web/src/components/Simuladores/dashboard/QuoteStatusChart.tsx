import { Pie3DShape } from '../../charts/Chart3DShapes';
"use client"
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PIE_COLORS } from '@/lib/data';

interface QuoteStatusChartProps {
    data: any[];
}

const QuoteStatusChart: React.FC<QuoteStatusChartProps> = ({ data }) => {
    return (
        <Card className="shadow-lg h-full">
            <CardHeader>
                <CardTitle>Status dos Orçamentos</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie activeIndex={-1} inactiveShape={<Pie3DShape />} activeShape={<Pie3DShape />} data={data} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                             contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                color: 'hsl(var(--foreground))',
                                borderRadius: 'var(--radius)'
                            }}
                        />
                        <Legend wrapperStyle={{fontSize: "14px"}}/>
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export default QuoteStatusChart;
