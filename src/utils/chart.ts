import { htmlLegendPlugin, verticalLinePlugin } from "@utils/plugins";
import type { Result, Row } from "@utils/sqlite";
import type { ChartTypeRegistry, TooltipItem } from "chart.js/auto";
import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";

let existingChart: Chart<keyof ChartTypeRegistry, Row[], unknown> | null = null;

function roundForGraph(num: number): number {
  if (num >= 1) {
    return num;
  }
  if (num === 0) {
    return num;
  }
  const exponent = Math.floor(Math.log10(Math.abs(num))) + 1;
  const multiplier = Math.pow(10, 5 - exponent);
  return Math.floor(num * multiplier) / multiplier;
}

async function initUsageChart(canvas: HTMLCanvasElement, data: Result[]) {
  const chart = new Chart(canvas, {
    type: "line",
    data: {
      datasets: data.map((result: Result) => ({
        label: result.term,
        data: result.data,
      })),
    },
    plugins: [htmlLegendPlugin, verticalLinePlugin],
    options: {
      responsive: true,
      animation: false,
      // animation: { duration: 200, easing: "easeInOutCubic" },
      line: {
        datasets: { normalized: true },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "month",
            round: "month",
            tooltipFormat: "MMM yyyy",
          },
          grid: {
            drawOnChartArea: false,
            lineWidth: 2,
            color: "#9e9e9e",
          },
          ticks: {
            padding: 2,
          },
          border: {
            width: 2,
            color: "#9e9e9e",
          },
          // beforeFit: function (axis) {
          //   // @ts-expect-error
          //   let lbs: string[] = axis.chart.config.data.labels!;
          //   let len = lbs.length - 1;
          //   axis.ticks.push({ value: len, label: lbs[len] });
          // },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "#EAEAEA",
            lineWidth: 2,
          },
          border: {
            display: false,
          },
        },
      },
      elements: {
        point: { radius: 1, hoverRadius: 5 },
        line: { tension: 0.4 },
      },
      parsing: {
        xAxisKey: "day",
        yAxisKey: "occurrences",
      },
      hover: {
        mode: "nearest",
        axis: "x",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        // @ts-expect-error: registration can't fix inline config
        htmlLegend: {
          containerID: "usageLegend",
        },
        // annotation: {
        //   annotations: {
        //     label1: {
        //       type: "label",
        //       xValue: 1675256400,
        //       yValue: "50%",
        //       backgroundColor: "rgba(245,245,245)",
        //       content: ["This is my text", "This is my text, second line"],
        //       font: {
        //         size: 18,
        //       },
        //     },
        //   },
        // },
        tooltip: {
          mode: "nearest",
          axis: "x",
          intersect: false,
          position: "cursor",
          animation: false,
          yAlign: "center",
          itemSort: function (
            a: TooltipItem<keyof ChartTypeRegistry>,
            b: TooltipItem<keyof ChartTypeRegistry>,
          ): number {
            // @ts-expect-error: it doesn't know about `raw`
            return b.raw.occurrences - a.raw.occurrences;
          },
          callbacks: {
            label: (ctx: TooltipItem<keyof ChartTypeRegistry>) => {
              // @ts-expect-error: it doesn't know about `raw`
              const occurrences = roundForGraph(ctx.raw.occurrences);
              return `${ctx.dataset.label}: ${occurrences}`;
            },
          },
        },
      },
    },
  });
  return chart;
}

export async function reloadUsageChart(
  canvas: HTMLCanvasElement,
  data: Result[],
) {
  if (!existingChart) {
    existingChart = await initUsageChart(canvas, data);
  } else {
    existingChart.data.datasets = data.map((result: Result) => ({
      label: result.term,
      data: result.data,
    }));
    existingChart.update();
  }
}
