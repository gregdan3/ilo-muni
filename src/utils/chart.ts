import { htmlLegendPlugin, crossHairPlugin } from "@utils/plugins";
import { FORMATTERS } from "@utils/ui.ts";
import { FIELDS } from "@utils/constants.ts";
import type { ScaleData, FormatterFn, Field, Result, Row } from "@utils/types";
import type { ChartTypeRegistry, TooltipItem } from "chart.js/auto";
import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";

let existingChart: Chart<keyof ChartTypeRegistry, Row[], unknown> | null = null;

async function initUsageChart(
  canvas: HTMLCanvasElement,
  data: Result[],
  scale: ScaleData,
  field: Field,
) {
  const chart = new Chart(canvas, {
    type: "line",
    data: {
      datasets: data.map((result: Result) => ({
        label: result.term,
        data: result.data,
      })),
    },
    plugins: [htmlLegendPlugin, crossHairPlugin],
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
          axis: "x",
          time: {
            unit: "month",
            round: "month",
            tooltipFormat: "MMM yyyy",
          },
          grid: {
            drawOnChartArea: true,
            color: "#EAEAEA",
            tickColor: "#9e9e9e",
            lineWidth: 2,
          },
          ticks: {
            major: { enabled: true },
            padding: 1,
            callback: function (value, index, ticks) {
              const tick = ticks[index];
              const date = new Date(tick.value);

              // const last = ticks.length - 1;
              // if (index == 0 || index == last) {
              //   return `${date.toLocaleString("default", { month: "short" })} ${date.getFullYear()}`;
              // }

              // null ticks aren't drawn at all; empty string draws a tick and grid line
              return tick.major ? date.getFullYear() : null; // : date.toLocaleString("default", { month: "short" });
            },
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
          type: scale.axis,
          axis: "y",
          suggestedMin: 0,
          grid: {
            color: "#EAEAEA",
            lineWidth: 2,
            tickColor: "#9e9e9e",
            tickLength: 6,
          },
          border: {
            display: false,
          },
          ticks: {
            // @ts-expect-error: value can apparently be string but it never is
            callback: FORMATTERS[scale.axisNums],
          },
        },
      },
      elements: {
        point: { radius: 1, hoverRadius: 5 },
        line: { tension: 0.4 },
      },
      parsing: {
        xAxisKey: "day",
        yAxisKey: field,
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
        //       xValue: "50%",
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
            // @ts-expect-error: why let me reference the config then
            const key = a.chart.config._config!.options.parsing.yAxisKey;

            // @ts-expect-error: it doesn't know about `raw`
            return b.raw[key] - a.raw[key];
            // TODO: order by shown field
          },
          callbacks: {
            label: (ctx: TooltipItem<keyof ChartTypeRegistry>) =>
              formatLabel(ctx, FORMATTERS[scale.tooltipNums]),
          },
        },
      },
    },
  });
  return chart;
}

function formatLabel(
  ctx: TooltipItem<keyof ChartTypeRegistry>,
  format: FormatterFn,
): string {
  // @ts-expect-error: why let me reference the config then
  const key: Field = ctx.chart.config._config!.options.parsing.yAxisKey;
  const field: string = FIELDS[key]["label"].toLowerCase();
  // @ts-expect-error: it doesn't know about `raw`
  const formattedData = format(ctx.raw[key]);
  const label = `${ctx.dataset.label}: ${formattedData} ${field}`;
  return label;
}

export async function reloadUsageChart(
  canvas: HTMLCanvasElement,
  data: Result[],
  scale: ScaleData,
  field: Field,
) {
  if (!existingChart) {
    existingChart = await initUsageChart(canvas, data, scale, field);
  } else {
    existingChart.data.datasets = data.map((result: Result) => ({
      label: result.term,
      data: result.data,
    }));
    // @ts-expect-error: value can apparently be `false` but it never is
    existingChart.options.parsing!.yAxisKey! = field;
    existingChart.options.scales!.y!.type = scale.axis;
    // @ts-expect-error: value can apparently be string but it never is
    existingChart.options.scales!.y!.ticks!.callback =
      FORMATTERS[scale.axisNums];
    existingChart.options.plugins!.tooltip!.callbacks!.label = (
      ctx: TooltipItem<keyof ChartTypeRegistry>,
    ) => formatLabel(ctx, FORMATTERS[scale.tooltipNums]);
    existingChart.update();
  }
}
