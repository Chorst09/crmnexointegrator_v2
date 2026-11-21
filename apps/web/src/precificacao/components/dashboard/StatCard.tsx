import React from 'react';
import ExecutiveStatCard from '../../../components/ExecutiveStatCard';
interface StatCardProps { icon: React.ReactNode; title: string; value: string | number; subtext: string; }
export default function StatCard({icon,title,value,subtext}: StatCardProps) {
  return <ExecutiveStatCard icon={icon} title={title} value={value} subtitle={subtext}/>;
}
