import { useEffect, useState } from 'react';
import ExecutiveStatCard from './ExecutiveStatCard';

export default function AnimatedStats({ value, animate = true, ...props }) {
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => {
    if (!animate || typeof value !== 'number' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      return undefined;
    }
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      setDisplayValue(step >= 24 ? value : Math.round(value * step / 24));
      if (step >= 24) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [value, animate]);
  return <ExecutiveStatCard {...props} value={displayValue}/>;
}
