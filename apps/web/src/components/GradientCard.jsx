import React from 'react';

const GradientCard = ({
  children,
  gradient = 'blue',
  className = '',
  hover = true,
  onClick = null
}) => {
  const gradients = {
    blue: 'border-cyan-200/50 bg-gradient-to-br from-cyan-50/95 via-white to-sky-100/90 dark:border-cyan-300/25 dark:from-[#132842] dark:via-[#10233a] dark:to-[#113050]',
    green: 'border-emerald-200/55 bg-gradient-to-br from-emerald-50/95 via-white to-cyan-50/90 dark:border-emerald-300/25 dark:from-[#10283f] dark:via-[#12263c] dark:to-[#14364c]',
    purple: 'border-indigo-200/55 bg-gradient-to-br from-indigo-50/95 via-white to-sky-50/90 dark:border-indigo-300/25 dark:from-[#162741] dark:via-[#12233d] dark:to-[#1d2f53]',
    orange: 'border-amber-200/55 bg-gradient-to-br from-amber-50/95 via-white to-orange-50/90 dark:border-amber-300/25 dark:from-[#182947] dark:via-[#132744] dark:to-[#223760]',
    red: 'border-rose-200/55 bg-gradient-to-br from-rose-50/95 via-white to-orange-50/85 dark:border-rose-300/25 dark:from-[#212c49] dark:via-[#172846] dark:to-[#22365c]',
    yellow: 'border-yellow-200/55 bg-gradient-to-br from-yellow-50/95 via-white to-amber-50/90 dark:border-yellow-300/25 dark:from-[#1b2a44] dark:via-[#162741] dark:to-[#23355c]',
    indigo: 'border-blue-200/55 bg-gradient-to-br from-blue-50/95 via-white to-indigo-50/90 dark:border-blue-300/25 dark:from-[#122945] dark:via-[#11253f] dark:to-[#1a345a]',
    pink: 'border-fuchsia-200/55 bg-gradient-to-br from-fuchsia-50/95 via-white to-pink-50/90 dark:border-fuchsia-300/25 dark:from-[#1e2746] dark:via-[#182541] dark:to-[#273a62]',
    gray: 'border-slate-200/65 bg-gradient-to-br from-slate-50/95 via-white to-slate-100/90 dark:border-cyan-300/20 dark:from-[#12263f] dark:via-[#13253c] dark:to-[#183452]'
  };

  return (
    <div
      className={[
        'group relative overflow-hidden rounded-3xl border shadow-soft-xl backdrop-blur-md',
        gradients[gradient] || gradients.blue,
        hover ? 'transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-2xl hover:border-cyan-300/45 dark:hover:border-cyan-200/35' : '',
        onClick ? 'cursor-pointer' : '',
        className
      ].join(' ')}
      onClick={onClick}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-300 group-hover:opacity-100 bg-gradient-to-br from-white/25 via-transparent to-cyan-300/10 dark:from-cyan-300/8 dark:to-cyan-200/12" />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
};

export default GradientCard;
