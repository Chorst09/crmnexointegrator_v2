import React from 'react';

/**
 * Simple placeholder funnel chart component.
 * The real implementation can be swapped with a charting library (e.g., recharts, chart.js).
 * For now it renders a styled container that mimics the visual style expected
 * by the design system (glassmorphism background, neon border).
 */
export default function FunnelChart({ title = 'Funnel', data = [] }) {
  // Minimal visual representation – a vertical list of bars proportional to value.
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="glass-card p-4 shadow-lg">
      <h3 className="text-lg font-semibold mb-2 text-white">{title}</h3>
      <div className="space-y-1">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center">
            <span className="w-24 text-sm text-gray-200">{item.label}</span>
            <div
              className="h-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
            <span className="ml-2 text-sm text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
