import Chart from "chart.js/auto";

const getOrCreateLegendList = (chart: Chart, id: string) => {
  const legendContainer = document.getElementById(id)!;
  let listContainer = legendContainer.querySelector("ul");

  if (!listContainer) {
    listContainer = document.createElement("ul");
    listContainer.style.display = "flex";
    listContainer.style.flexDirection = "row";
    listContainer.style.margin = "0";
    listContainer.style.padding = "0";

    legendContainer.appendChild(listContainer);
  }

  return listContainer;
};

// i slapped a bunch of ignores in here because it's chart.js's code
export const htmlLegendPlugin = {
  id: "htmlLegend",
  afterUpdate(chart: Chart, args: any, options: any) {
    const ul = getOrCreateLegendList(chart, options.containerID);

    // Remove old legend items
    while (ul.firstChild) {
      ul.firstChild.remove();
    }

    // Reuse the built-in legendItems generator
    // @ts-ignore
    const items = chart.options.plugins.legend.labels.generateLabels(chart);

    items.forEach((item) => {
      const li = document.createElement("li");
      li.style.alignItems = "center";
      li.style.cursor = "pointer";
      li.style.display = "flex";
      li.style.flexDirection = "row";
      li.style.marginLeft = "10px";

      li.onclick = () => {
        // @ts-ignore
        const { type } = chart.config;
        if (type === "pie" || type === "doughnut") {
          // Pie and doughnut charts only have a single dataset and visibility is per item
          chart.toggleDataVisibility(item.index!);
        } else {
          chart.setDatasetVisibility(
            item.datasetIndex!,
            !chart.isDatasetVisible(item.datasetIndex!),
          );
        }
        chart.update();
      };

      // Color box
      const boxSpan = document.createElement("span");
      boxSpan.style.background = item.fillStyle?.toString()!;
      boxSpan.style.borderColor = item.strokeStyle?.toString()!;
      boxSpan.style.borderWidth = item.lineWidth + "px";
      boxSpan.style.display = "inline-block";
      boxSpan.style.flexShrink = "0";
      boxSpan.style.height = "20px";
      boxSpan.style.marginRight = "10px";
      boxSpan.style.width = "20px";

      // Text
      const textContainer = document.createElement("p");
      textContainer.style.color = item.fontColor?.toString()!;
      textContainer.style.margin = "0";
      textContainer.style.padding = "0";
      textContainer.style.textDecoration = item.hidden ? "line-through" : "";

      const text = document.createTextNode(item.text);
      textContainer.appendChild(text);

      li.appendChild(boxSpan);
      li.appendChild(textContainer);
      ul.appendChild(li);
    });
  },
};
