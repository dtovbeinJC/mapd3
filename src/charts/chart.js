import * as d3 from "./helpers/d3-service";
import {colors} from "./helpers/colors";
import {keys} from "./helpers/constants";
import {cloneData, override, throttle, rebind} from "./helpers/common";
import Scale from "./scale";
import Line from "./line";
import Bar from "./bar";
import Sunburst from "./sunburst";
import Axis from "./axis";
import Tooltip from "./tooltip";
import Legend from "./legend";
import Brush from "./brush";
import Hover from "./hover";
import Binning from "./binning";
import DomainEditor from "./domain-editor";
import BrushRangeEditor from "./brush-range-editor";
import Label from "./label";
import DataManager from "./data-manager";

export default function Chart(_container) {

  let config = {
    // common
    margin: {
      top: 48,
      right: 32,
      bottom: 48,
      left: 32
    },
    width: 800,
    height: 500,
    keyType: "",
    chartType: "",
    ease: d3.easeLinear,

    // intro animation
    isAnimated: false,
    animationDuration: 1500,

    // scale
    colorSchema: colors.mapdColors.map((d) => ({value: d})),
    defaultColor: "skyblue",
    xDomain: "auto",
    yDomain: "auto",
    y2Domain: "auto",

    // axis
    tickPadding: 5,
    xAxisFormat: "auto",
    yAxisFormat: ".2f",
    y2AxisFormat: ".2f",
    tickSizes: 8,
    yTicks: "auto",
    y2Ticks: "auto",
    xTickSkip: 0,
    grid: null,
    axisTransitionDuration: 0,

    xTitle: "",
    yTitle: "",

    // hover
    dotRadius: 4,

    // tooltip
    mouseChaseDuration: 0,
    tooltipEase: d3.easeQuadInOut,
    tooltipHeight: 48,
    tooltipWidth: 160,
    seriesOrder: [],

    // format
    dateFormat: "%b %d, %Y",
    numberFormat: ".2f",

    // legend
    legendXPosition: "auto",
    legendYPosition: "auto",
    legendTitle: "",
    legendIsEnabled: true,

    // binning
    binningResolution: "1mo",
    binningIsAuto: true,
    binningToggles: ["10y", "1y", "1q", "1mo"],
    binningIsEnabled: true,

    // domain
    domainEditorIsEnabled: true,

    // brush range
    brushRangeMin: null,
    brushRangeMax: null,
    brushRangeIsEnabled: true,

    // brush
    brushIsEnabled: true,

    // label
    xLabel: "",
    yLabel: "",
    y2Label: "",
    fileData: null
  }

  let scales = {
    xScale: null,
    yScale: null,
    y2Scale: null,
    hasSecondAxis: null,
    colorScale: null
  }

  const cache = {
    container: _container,
    svg: null,
    panel: null,
    margin: null,
    maskingRectangle: null,
    chartWidth: null, chartHeight: null,
    xAxis: null, yAxis: null, yAxis2: null
  }

  const dataObject = {
    dataBySeries: null,
    dataByKey: null,
    data: null,
    groupKeys: {},
    hasSecondAxis: false,
    stackData: null,
    stack: null,
    flatDataSorted: null
  }

  const components = {}
  const eventCollector = {}

  // events
  const dispatcher = d3.dispatch("mouseOverPanel", "mouseOutPanel", "mouseMovePanel")
  const dataManager = DataManager();

  function render () {
    buildSVG();

    if (dataObject.dataBySeries) {
      buildChart()
    }

    return this
  }

  function buildSVG () {
    const w = config.width === "auto" ? cache.container.clientWidth : config.width
    const h = config.height === "auto" ? cache.container.clientHeight : config.height
    cache.chartWidth = Math.max(w - config.margin.left - config.margin.right, 0)
    cache.chartHeight = Math.max(h - config.margin.top - config.margin.bottom, 0)

    let template;

    if (!cache.svg) {
      template = `<div class="mapd3 mapd3-container">
          <div class="header-group" style="display: none;"></div>
            <svg class="chart">
              <g class="chart-group"></g>
              <g class="panel-group">
                <rect class="panel-background"></rect>
              </g>
              <rect class="masking-rectangle"></rect>
            </svg>
        </div>`

      const base = d3.select(cache.container)
        .html(template);

      cache.container = base.select(".mapd3-container")
        .style("position", "relative")

      cache.svg = base.select("svg")
      cache.headerGroup = base.select(".header-group")
        .style("position", "absolute")
      cache.panel = cache.svg.select(".panel-group")
      cache.chart = cache.svg.select(".chart-group")

      addEvents()

      Object.assign(components, {
        scale: Scale(),
        axis: getAxisChart(),
        line: getLineChart(),
        bar: (config.chartType === "bar") ? Bar(cache.panel) : null,
        sunburst: (config.chartType === "sunburst") ? Sunburst(cache.panel) : null,
        tooltip: Tooltip(cache.container),
        legend: Legend(cache.container),
        brush: Brush(cache.panel),
        hover: Hover(cache.panel),
        binning: Binning(cache.headerGroup),
        domainEditor: DomainEditor(cache.container),
        brushRangeEditor: BrushRangeEditor(cache.headerGroup),
        label: Label(cache.container)
      })

      Object.assign(eventCollector, {
        onBrush: rebind(components.brush),
        onHover: rebind(components.hover),
        onBinning: rebind(components.binning),
        onDomainEditor: rebind(components.domainEditor),
        onBrushRangeEditor: rebind(components.brushRangeEditor),
        onLabel: rebind(components.label),
        onPanel: rebind(dispatcher)
      });
    }

    cache.svg
      .attr("width", config.width)
      .attr("height", config.height)

    cache.headerGroup
      .style("width", `${cache.chartWidth}px`)
      .style("left", `${config.margin.left}px`)

    cache.panel
      .attr("transform", `translate(${config.margin.left},${config.margin.top})`)
      .select(".panel-background")
      .attr("width", cache.chartWidth)
      .attr("height", cache.chartHeight)
      .attr("fill", "transparent");

    return this;
  }

  function buildChart() {
    if (components.scale) {
      components.scale
        .setConfig(config)
        .setData(dataObject)
      scales = components.scale.getScales()
    }

    if (components.axis) {
      components.axis
        .setConfig(config)
        .setScales(scales)
        .drawAxis()
        .drawGridLines()
    }

    if (components.line) {
      components.line
        .setConfig(config)
        .setScales(scales)
        .setData(dataObject)
        .drawMarks()
    }

    if (components.bar) {
      components.bar
        .setConfig(config)
        .setScales(scales)
        .setData(dataObject)
        .drawMarks()
    }

    components.tooltip
      .setConfig(config)
      .setScales(scales)
      .bindEvents(dispatcher)
      .setVisibility(config.tooltipIsEnabled)

    const legendContent = dataObject.dataBySeries
      .map((d) => ({
        id: d.id,
        key: d.key,
        label: d.label
      }))

    components.legend
      .setConfig(config)
      .setScales(scales)
      .setTitle(config.legendTitle)
      .setContent(legendContent)
      .setXPosition(config.legendXPosition)
      .setYPosition(config.legendYPosition)
      .drawTooltip()
      .setVisibility(config.legendIsEnabled)

    components.brush
      .setConfig(config)
      .setScales(scales)
      .setData(dataObject)
      .setBrushExtent([config.brushRangeMin, config.brushRangeMax])
      .setVisibility(config.brushIsEnabled)
      .drawBrush()

    components.hover
      .setConfig(config)
      .setScales(scales)
      .setData(dataObject)
      .bindEvents(dispatcher)

    components.binning
      .setConfig(config)
      .setBinning(config.binningResolution)
      .setAuto(config.binningIsAuto)
      .drawBinning()
      .setVisibility(config.binningIsEnabled)

    components.domainEditor
      .setConfig(config)
      .setScales(scales)
      .drawDomainEditor()
      .setVisibility(config.domainEditorIsEnabled)

    components.brushRangeEditor
      .setConfig(config)
      .setScales(scales)
      .setRangeMin(config.brushRangeMin)
      .setRangeMax(config.brushRangeMax)
      .drawRangeEditor()
      .setVisibility(config.brushRangeIsEnabled)

    components.label
      .setConfig(config)
      .setXLabels(config.xLabel)
      .setYLabels(config.yLabel)
      .setY2Labels(config.y2Label)
      .drawLabels()

    triggerIntroAnimation()
    return this
  }

  function setData(_data) {
    dataObject.data = cloneData(_data[keys.SERIES]);
    const cleanedData = dataManager.cleanData(_data, config.keyType);
    Object.assign(dataObject, cleanedData);
    render();
    return this
  }

  function triggerIntroAnimation () {
    if (config.isAnimated) {
      cache.maskingRectangle = cache.svg.select(".masking-rectangle")
        .attr("width", cache.chartWidth - 2)
        .attr("height", cache.chartHeight)
        .attr("x", config.margin.left + 1)
        .attr("y", config.margin.top)

      cache.maskingRectangle.transition()
        .duration(config.animationDuration)
        .ease(config.ease)
        .attr("width", 0)
        .attr("x", config.width - config.margin.right)
        .on("end", () => cache.maskingRectangle.remove())
    }
  }

  function addEvents() {
    const THROTTLE_DELAY = 20
    const throttledDispatch = throttle((...args) => {
      dispatcher.call(...args)
    }, THROTTLE_DELAY)

    cache.panel
      .on("mouseover.dispatch", () => {
        dispatcher.call("mouseOverPanel", null, d3.mouse(cache.panel.node()))
      })
      .on("mouseout.dispatch", () => {
        dispatcher.call("mouseOutPanel", null, d3.mouse(cache.panel.node()))
      })
      .on("mousemove.dispatch", () => {
        const [mouseX, mouseY] = d3.mouse(cache.panel.node())
        if (!dataObject.data) {
          return
        }
        const xPosition = mouseX
        const dataPoint = dataManager.getNearestDataPoint(xPosition, dataObject, scales, config.keyType)

        if (dataPoint) {
          const dataPointXPosition = scales.xScale(dataPoint[keys.DATA])
          throttledDispatch("mouseMovePanel", null, dataPoint, dataPointXPosition, mouseY)
        }
      })
  }

  function getEvents () {
    if (!cache.svg) {
      render()
    }
    return eventCollector
  }

  function on (...args) {
    dispatcher.on(...args)
    return this
  }

  function setConfig (_config) {
    config = override(config, _config)
    return this
  }

  function destroy () {
    cache.svg.on(".", null).remove()
  }

  function getAxisChart () {
    const { chartType } = config;
    return (chartType === "line" || chartType === "area" || chartType === "stackedArea") ? Axis(cache.chart) : null;
  }

  function getLineChart () {
    const { chartType } = config;
    return (chartType === "line" || chartType === "area" || chartType === "stackedArea") ? Line(cache.panel) : null;
  }

  function csvToJson (csv) {
    //let json = {"series": []};
    let labels = [];
    let addLabel;

    csv.forEach((row, index) => {
      if (index === 0) {
        labels.push(getObjectToPush(row[0], index, 0, []));
      } else {
        addLabel = true;
        labels.forEach(label => {
          if (row[0] === label["label"]) {
            addLabel = false;
          }
        });
        if (addLabel) labels.push(getObjectToPush(row[0], index, 0, []));
      }
    });

    let __index__;
    labels.forEach((label, index) => {
      __index__ = 0;
      csv.forEach((key, value) => {
        if (label["label"] === key[0]) {
          label["values"].push({
            value: key[1],
            key: __index__
          });
          __index__++;
        }
      })
    });

    return { "series": [...labels] };
  }

  function getObjectToPush (label, id, group, values) {
    return {
      label,
      id,
      group,
      values
    };
  }

  return {
    render,
    setConfig,
    setData,
    on,
    getEvents,
    csvToJson,
    destroy
  }
}
