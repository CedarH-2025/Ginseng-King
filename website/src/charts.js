import * as echarts from 'echarts/core';
import { BarChart, HeatmapChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GeoComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  AriaComponent,
  BarChart,
  CanvasRenderer,
  DataZoomComponent,
  GeoComponent,
  GridComponent,
  HeatmapChart,
  LegendComponent,
  LineChart,
  MarkAreaComponent,
  MarkLineComponent,
  ScatterChart,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
]);

export const STATION_COLORS = ['#286f6c', '#d47b45', '#4f74a6', '#9a6aa0', '#6f8738'];
export const CHART_TEXT = '#243a35';
export const CHART_MUTED = '#687a75';
export const CHART_GRID = '#dce5df';

const instances = new Map();

export function chartToolbox(filename) {
  return {
    right: 12,
    top: 8,
    feature: {
      saveAsImage: {
        name: filename,
        title: 'Download chart as PNG',
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      },
    },
    iconStyle: {
      borderColor: '#506a62',
    },
    emphasis: {
      iconStyle: {
        borderColor: '#173f35',
      },
    },
  };
}

export function baseChartOption({ title, subtitle, filename, grid = {} }) {
  return {
    animationDuration: 300,
    animationDurationUpdate: 220,
    color: STATION_COLORS,
    textStyle: {
      color: CHART_TEXT,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 13,
    },
    title: {
      text: title,
      subtext: subtitle,
      left: 12,
      top: 4,
      textStyle: { color: CHART_TEXT, fontSize: 16, fontWeight: 650 },
      subtextStyle: { color: CHART_MUTED, fontSize: 12, lineHeight: 17 },
    },
    toolbox: chartToolbox(filename),
    grid: {
      top: subtitle ? 83 : 66,
      right: 30,
      bottom: 52,
      left: 72,
      containLabel: false,
      ...grid,
    },
    aria: {
      enabled: true,
      decal: { show: false },
    },
  };
}

export function registerMap(name, geoJson) {
  echarts.registerMap(name, geoJson);
}

export function renderChart(elementId, option) {
  const element = document.getElementById(elementId);
  if (!element) return null;
  let chart = echarts.getInstanceByDom(element);
  if (!chart) {
    chart = echarts.init(element, null, { renderer: 'canvas' });
    instances.set(elementId, chart);
  }
  chart.setOption(option, { notMerge: true, lazyUpdate: false });
  requestAnimationFrame(() => chart.resize());
  return chart;
}

export function renderEmptyChart(elementId, title, message) {
  return renderChart(elementId, {
    ...baseChartOption({ title, subtitle: '', filename: 'ginseng-king-chart' }),
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: message,
          fill: CHART_MUTED,
          font: '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          textAlign: 'center',
        },
      },
    ],
    xAxis: { show: false },
    yAxis: { show: false },
    series: [],
  });
}

export function exportChart(elementId, filename) {
  const chart = instances.get(elementId) ?? echarts.getInstanceByDom(document.getElementById(elementId));
  if (!chart) throw new Error('The chart is not ready to export.');
  const link = document.createElement('a');
  link.href = chart.getDataURL({
    type: 'png',
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  });
  link.download = `${filename}.png`;
  link.click();
}

export function resizeCharts() {
  for (const chart of instances.values()) chart.resize();
}

window.addEventListener('resize', () => resizeCharts(), { passive: true });
