/**
 * Advanced Chart Component para Dashboards
 * Suporta múltiplos tipos com efeitos avançados
 */

import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut, Radar, PolarArea } from 'react-chartjs-2';
import { DASHBOARD_COLORS, CHART_CONFIG } from '../constants/dashboardTheme';
import '../styles/dashboardEffects.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DashboardAdvancedChart = ({
  type = 'line',
  data = {},
  title = '',
  subtitle = '',
  height = 300,
  colorTheme = 'multi',
  showLegend = true,
  animated = true,
  customOptions = {},
  isEmpty = false,
  icon = null
}) => {
  // Cores baseadas no tema
  const colorPalettes = {
    multi: [
      DASHBOARD_COLORS.neon.orange,
      DASHBOARD_COLORS.neon.cyan,
      DASHBOARD_COLORS.neon.blue,
      DASHBOARD_COLORS.neon.green
    ],
    blue: [DASHBOARD_COLORS.neon.cyan, DASHBOARD_COLORS.neon.blue],
    warm: [
      DASHBOARD_COLORS.neon.orange,
      DASHBOARD_COLORS.neon.yellow,
      DASHBOARD_COLORS.neon.green
    ],
    cool: [
      DASHBOARD_COLORS.neon.cyan,
      DASHBOARD_COLORS.neon.blue,
      DASHBOARD_COLORS.neon.green
    ],
    success: [DASHBOARD_COLORS.neon.green, DASHBOARD_COLORS.neon.cyan],
    warning: [
      DASHBOARD_COLORS.neon.yellow,
      DASHBOARD_COLORS.neon.orange,
      DASHBOARD_COLORS.neon.pink
    ]
  };

  const colors = colorPalettes[colorTheme] || colorPalettes.multi;

  // Processar dados
  const processedData = useMemo(() => {
    if (!data) {
      return { labels: [], datasets: [] };
    }

    // Suporte ao formato simplificado { labels, values, colors }
    if (Array.isArray(data.values)) {
      return {
        labels: data.labels || [],
        datasets: [{
          label: subtitle,
          data: data.values,
          backgroundColor: Array.isArray(data.colors)
            ? data.colors
            : (data.colors || colors[0]),
          borderColor: DASHBOARD_COLORS.background.primary,
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        }]
      };
    }

    const datasets = data.datasets || [];
    return {
      labels: data.labels || [],
      datasets: datasets.map((dataset, idx) => ({
        ...dataset,
        borderColor: dataset.borderColor || colors[idx % colors.length],
        backgroundColor:
          dataset.backgroundColor ||
          (type === 'line'
            ? colors[idx % colors.length] + '20'
            : colors[idx % colors.length]),
        fill: type === 'line',
        tension: 0.4,
        pointBackgroundColor: dataset.borderColor || colors[idx % colors.length],
        pointBorderColor: DASHBOARD_COLORS.background.primary,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        borderJoinStyle: 'round',
        borderCapStyle: 'round'
      }))
    };
  }, [data, type, colors, subtitle]);

  // Opções do chart
  const chartOptions = useMemo(() => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: animated ? { duration: 750 } : false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: showLegend
          ? {
              display: true,
              position: 'top',
              labels: {
                color: DASHBOARD_COLORS.text.secondary,
                font: { size: 12, weight: '500' },
                padding: 15,
                usePointStyle: true,
                pointStyle: 'circle'
              }
            }
          : { display: false },

        tooltip: {
          backgroundColor: DASHBOARD_COLORS.background.overlay,
          titleColor: DASHBOARD_COLORS.text.primary,
          bodyColor: DASHBOARD_COLORS.text.secondary,
          borderColor: DASHBOARD_COLORS.neon.cyan + '50',
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          displayColors: true,
          callbacks: {
            labelColor: (context) => ({
              borderColor: context.dataset.borderColor,
              backgroundColor: context.dataset.borderColor + '40'
            })
          }
        },

        filler: {
          propagate: true
        }
      },

      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: DASHBOARD_COLORS.border.light,
            drawBorder: false,
            drawTicks: false
          },
          ticks: {
            color: DASHBOARD_COLORS.text.tertiary,
            font: { size: 11, weight: '500' },
            padding: 8
          }
        },
        x: {
          grid: {
            color: DASHBOARD_COLORS.border.light,
            drawBorder: false,
            drawTicks: false
          },
          ticks: {
            color: DASHBOARD_COLORS.text.tertiary,
            font: { size: 11, weight: '500' }
          }
        }
      }
    };

    return { ...baseOptions, ...customOptions };
  }, [showLegend, animated, customOptions]);

  return (
    <div className="dashboard-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {title && (
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      {/* Empty State */}
      {isEmpty ? (
        <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-center">
            <p className="text-sm text-slate-500">Nenhum dado disponível</p>
          </div>
        </div>
      ) : (
        <>
          {/* Chart Container */}
          <div style={{ height, position: 'relative' }}>
            {type === 'line' && (
              <Line data={processedData} options={chartOptions} />
            )}
            {type === 'bar' && (
              <Bar
                data={processedData}
                options={{
                  ...chartOptions,
                  scales: {
                    ...chartOptions.scales,
                    y: {
                      ...chartOptions.scales.y,
                      stacked: false
                    }
                  }
                }}
              />
            )}
            {type === 'doughnut' && (
              <Doughnut
                data={processedData}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      ...chartOptions.plugins.legend,
                      position: 'right'
                    }
                  }
                }}
              />
            )}
            {type === 'radar' && (
              <Radar data={processedData} options={chartOptions} />
            )}
            {type === 'polar' && (
              <PolarArea data={processedData} options={chartOptions} />
            )}
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-500/20">
            <span className="text-xs text-slate-500">
              {new Date().toLocaleDateString('pt-BR')}
            </span>
            <span className="text-xs text-slate-600">
              {processedData.datasets.length} série{processedData.datasets.length !== 1 ? 's' : ''}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardAdvancedChart;
