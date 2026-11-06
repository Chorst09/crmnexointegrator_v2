/**
 * Componente de Gráficos 3D com Plotly
 * Suporta gráficos de barras 3D, superfícies, scatter 3D, etc
 * Enhanced para suportar mais tipos e melhor compatibilidade
 */

import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';

const Chart3D = ({
  type = 'bar3d', // bar3d, surface, scatter3d, bubble3d, surface3d, cone
  data = {},
  title = '',
  subtitle = '',
  height = 400,
  colorScale = 'Viridis',
  showLegend = true,
  cameraAngle = { x: 45, y: 45, z: 45 },
  enableRotation = true
}) => {
  console.log('[Chart3D] Renderizando:', { type, title, hasData: !!data?.datasets });
  const plotData = useMemo(() => {
    const colors3D = [
      '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
      '#f59e0b', '#10b981', '#ef4444', '#6366f1'
    ];

    // Gráfico de barras 3D - versão melhorada
    if (type === 'bar3d' || type === 'bar') {
      const x = data.labels || [];
      const traces = [];
      
      if (data.datasets && Array.isArray(data.datasets)) {
        data.datasets.forEach((dataset, idx) => {
          traces.push({
            x: x,
            y: dataset.data || [],
            name: dataset.label || `Serie ${idx + 1}`,
            type: 'bar',
            marker: {
              color: dataset.backgroundColor || data.colors?.[idx] || colors3D[idx % colors3D.length],
              line: { color: 'rgba(255,255,255,0.3)', width: 1 }
            },
            hovertemplate: `<b>${dataset.label}</b><br>%{x}: %{y:,.0f}<extra></extra>`
          });
        });
      }
      return traces;
    }

    // Gráfico de superfície 3D
    if (type === 'surface' || type === 'surface3d') {
      const z = data.values || [];
      if (!Array.isArray(z) || z.length === 0) {
        // Gerar dados de exemplo se não houver dados
        const gridSize = 20;
        const zValues = [];
        for (let i = 0; i < gridSize; i++) {
          const row = [];
          for (let j = 0; j < gridSize; j++) {
            row.push(Math.sin(i / 5) * Math.cos(j / 5) * 10);
          }
          zValues.push(row);
        }
        return [{
          z: zValues,
          type: 'surface',
          colorscale: colorScale,
          hovertemplate: 'X: %{x:.1f}<br>Y: %{y:.1f}<br>Z: %{z:.2f}<extra></extra>'
        }];
      }
      
      return [{
        z: z,
        type: 'surface',
        colorscale: colorScale,
        hovertemplate: 'X: %{x:.1f}<br>Y: %{y:.1f}<br>Z: %{z:.2f}<extra></extra>',
        contours: {
          z: { show: true, usecolorscale: true, highlightcolor: 'limegreen', project: { z: true } }
        }
      }];
    }

    // Gráfico Scatter 3D
    if (type === 'scatter3d') {
      const xData = data.x || [];
      const yData = data.y || [];
      const zData = data.z || [];
      
      // Se não houver dados, gerar dados de exemplo
      if (!xData.length || !yData.length || !zData.length) {
        const nPoints = 50;
        const x = [], y = [], z = [];
        for (let i = 0; i < nPoints; i++) {
          x.push(Math.random() * 100);
          y.push(Math.random() * 100);
          z.push(Math.random() * 100);
        }
        return [{
          x: x,
          y: y,
          z: z,
          mode: 'markers',
          type: 'scatter3d',
          marker: {
            size: 5,
            color: data.colors || '#06b6d4',
            opacity: 0.8,
            line: { color: 'white', width: 0.5 }
          },
          hovertemplate: 'X: %{x:.1f}<br>Y: %{y:.1f}<br>Z: %{z:.1f}<extra></extra>'
        }];
      }

      return [{
        x: xData,
        y: yData,
        z: zData,
        mode: 'markers',
        type: 'scatter3d',
        marker: {
          size: data.size || 5,
          color: data.colors || colors3D[0],
          opacity: 0.8,
          line: { color: 'white', width: 0.5 }
        },
        text: data.labels || [],
        hovertemplate: '<b>%{text}</b><br>X: %{x:.1f}<br>Y: %{y:.1f}<br>Z: %{z:.1f}<extra></extra>'
      }];
    }

    // Gráfico Bubble 3D
    if (type === 'bubble3d') {
      const xData = data.x || [];
      const yData = data.y || [];
      const zData = data.z || [];
      const bubbleData = data.bubble || [];
      
      return [{
        x: xData,
        y: yData,
        z: zData,
        mode: 'markers',
        type: 'scatter3d',
        marker: {
          size: bubbleData.map(v => Math.max(Math.sqrt(v) / 2, 3)) || 5,
          color: data.colorZ || zData || [],
          colorscale: colorScale,
          showscale: true,
          colorbar: {
            title: 'Valor',
            thickness: 15,
            len: 0.7
          },
          opacity: 0.8,
          line: { color: 'rgba(255,255,255,0.5)', width: 1 }
        },
        text: data.labels || [],
        hovertemplate: '<b>%{text}</b><br>X: %{x:.1f}<br>Y: %{y:.1f}<br>Z: %{z:.1f}<extra></extra>'
      }];
    }

    // Gráfico Cone 3D
    if (type === 'cone') {
      const x = data.x || [];
      const y = data.y || [];
      const z = data.z || [];
      const u = data.u || [];
      const v = data.v || [];
      const w = data.w || [];

      return [{
        x: x,
        y: y,
        z: z,
        u: u,
        v: v,
        w: w,
        type: 'cone',
        colorscale: colorScale,
        showscale: true,
        colorbar: { title: 'Magnitude', thickness: 15, len: 0.7 }
      }];
    }

    return [];
  }, [type, data, colorScale]);

  const layout = useMemo(() => {
    const baseLayout = {
      title: {
        text: subtitle ? `<b>${title}</b><br><sub>${subtitle}</sub>` : title,
        font: { size: 14, color: '#f4f7fb' },
        x: 0.5,
        xanchor: 'center'
      },
      autosize: true,
      height: height,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#8f9caf', family: 'Inter, sans-serif', size: 11 },
      margin: { l: 0, r: 0, b: 0, t: 60 },
      hovermode: 'closest',
      showlegend: showLegend && (type === 'bar3d' || type === 'bar'),
      legend: {
        x: 1.02,
        y: 1,
        bgcolor: 'rgba(0,0,0,0.5)',
        bordercolor: 'rgba(143, 156, 175, 0.4)',
        borderwidth: 1,
        font: { size: 10 }
      }
    };

    // Configurações específicas para gráficos 3D
    if (['surface', 'surface3d', 'scatter3d', 'bubble3d', 'cone'].includes(type)) {
      return {
        ...baseLayout,
        scene: {
          xaxis: {
            backgroundcolor: 'rgba(0,0,0,0.2)',
            gridcolor: 'rgba(143, 156, 175, 0.1)',
            color: '#8f9caf',
            zeroline: false
          },
          yaxis: {
            backgroundcolor: 'rgba(0,0,0,0.2)',
            gridcolor: 'rgba(143, 156, 175, 0.1)',
            color: '#8f9caf',
            zeroline: false
          },
          zaxis: {
            backgroundcolor: 'rgba(0,0,0,0.2)',
            gridcolor: 'rgba(143, 156, 175, 0.1)',
            color: '#8f9caf',
            zeroline: false
          },
          camera: {
            eye: {
              x: 1.5 * Math.cos(cameraAngle.x * Math.PI / 180),
              y: 1.5 * Math.sin(cameraAngle.y * Math.PI / 180),
              z: Math.max(0.5, cameraAngle.z / 100)
            }
          },
          aspectmode: 'cube'
        }
      };
    }

    return baseLayout;
  }, [type, title, subtitle, height, showLegend, cameraAngle]);

  const config = useMemo(() => ({
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'resetCameraLastSave3d'],
    modeBarButtonsToAdd: enableRotation ? [] : ['resetCameraDefault3d', 'resetCameraLastSave3d'],
    toImageButtonOptions: {
      format: 'png',
      filename: `chart_${Date.now()}`,
      height: 600,
      width: 900
    }
  }), [enableRotation]);

  return (
    <div style={{ width: '100%', height: height, position: 'relative' }}>
      <Plot
        data={plotData}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default Chart3D;
