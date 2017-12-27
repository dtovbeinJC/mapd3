import * as d3 from "./helpers/d3-service"
import {keys} from "./helpers/constants"
import {override} from "./helpers/common"

export default function Sunburst(_container) {

  let config = {
    margin: {
      top: 400,
      right: 400,
      bottom: 40,
      left: 300
    },
    width: 800,
    height: 800,
    chartType: null,
  }

  let scales = {
    colorScale: null,
    xScale: null,
    yScale: null,
    yScale2: null
  }

  const cache = {
    container: _container,
    svg: null,
    chartHeight: null
  }

  let containers = {}

  let data = {}

  Object.assign(config, {
    radius: Math.min(config.width, config.height) / 2
  });

  let b = {
    w: 75,
    h: 30,
    s: 3,
    t: 10
  };

  let colors = {
    "(MK)": "#5687d1",
    "(JJ GO)": "#7b615c",
    "(CJ GO)": "#de783b",
    "(CHURN)": "#6ab975",
    "(OR)": "#a173d1",
    "(PP GO)": "#bbbbbb",
    "(GG GO)": "#a7bb7c",
    "(CJ IOS)": "#58bb66"
  };

  let totalSize = 10;

  const getColor = (d) => scales.colorScale(d[keys.ID]);

  const partition = d3.partition()
    .size([2 * Math.PI, config.radius * config.radius]);

  const arc = d3.arc()
    .startAngle(function (d) {
      return d.x0;
    })
    .endAngle(function (d) {
      return d.x1;
    })
    .innerRadius(function (d) {
      return Math.sqrt(d.y0);
    })
    .outerRadius(function (d) {
      return Math.sqrt(d.y1);
    })
  buildSVG();

  function buildSVG() {
    const w = config.width === "auto" ? cache.container.clientWidth : config.width
    const h = config.height === "auto" ? cache.container.clientHeight : config.height
    cache.chartWidth = Math.max(w - config.margin.left - config.margin.right, 0)
    cache.chartHeight = Math.max(h - config.margin.top - config.margin.bottom, 0)

    let template = null;

    if (!cache.svg) {
      template = `<div class="sunburst">
        <div class="sequence"></div>
        <div class="chart">
          <div class="explanation" style="visibility: hidden;">
            <span class="percentage"></span><br/>
            of visits begin with this sequence of pages
          </div>
        </div>
      </div>
      <div class="sidebar">
        <input type="checkbox" class="togglelegend"> Legend<br/>
        <div class="legend" style="visibility: hidden;"></div>
      </div>`;

      containers.base = d3.select(cache.container)
        .html(template)

      containers.vis = containers.base.select(".chart").append("svg:svg")
        .attr("width", config.width)
        .attr("height", config.height)
        .append("svg:g")
        .attr("id", "container")
        .attr("transform", "translate(" + config.width / 2 + "," + config.height / 2 + ")");

      const h = parseInt(containers.base.select(".explanation").style("height"));
      const w = parseInt(containers.base.select(".explanation").style("width"));

      containers.base.select(".explanation")
        .style("top", `${config.height / 2 - h / 2}px`)
        .style("left", `${config.width / 2 - w / 2}px`);
    }
    return this
  }

  function setConfig(_config) {
    config = override(config, _config)
    return this
  }

  function setScales(_scales) {
    scales = override(scales, _scales)
    return this
  }

  function setData(_data) {
    data = Object.assign({}, data, _data);
    render(data);
    return this
  }

  /**
   Main function to draw and set up the visualization, once we have the data.
   @param data: Parsed data
   **/
  function render(data) {
    initializeBreadcrumbTrail();
    drawLegend();

    containers.base.select(".togglelegend").on("click", toggleLegend);

    containers.vis.append("svg:circle")
      .attr("r", config.radius)
      .style("opacity", 0);

    let root = d3.hierarchy(data)
      .sum(function (d) {
        return d.size;
      })
      .sort(function (a, b) {
        return b.value - a.value;
      });

    let nodes = partition(root).descendants()
      .filter(function (d) {
        return (d.x1 - d.x0 > 0.005);
      });

    let path = containers.vis.data([data]).selectAll("path")
      .data(nodes)
      .enter()
      .append("svg:path")
      .attr("display", function (d) {
        return d.depth ? null : "none";
      })
      .attr("d", arc)
      .attr("fill-rule", "evenodd")
      .style("fill", function (d) {
        return colors[d.data.name];
      })
      .style("opacity", 1)
      .on("mouseover", mouseover);

    containers.base.select("#container").on("mouseleave", mouseleave);

    totalSize = path.datum().value;
  };

  function initializeBreadcrumbTrail() {
    let trail = containers.base.select(".sequence")
      .append("svg:svg")
      .attr("width", config.width)
      .attr("height", 50)
      .attr("id", "trail");

    trail.append("svg:text")
      .attr("id", "endlabel")
      .style("fill", "#000");
  }

  function breadcrumbPoints(d, i) {
    let points = [];
    points.push("0,0");
    points.push(b.w + ",0");
    points.push(b.w + b.t + "," + (b.h / 2));
    points.push(b.w + "," + b.h);
    points.push("0," + b.h);
    if (i > 0) {
      points.push(b.t + "," + (b.h / 2));
    }
    return points.join(" ");
  }

  /**
   * Update the breadcrumb trail to show the current sequence and percentage.
   * @param nodeArray
   * @param percentageString
   */
  function updateBreadcrumbs(nodeArray, percentageString) {
    let trail = d3.select("#trail")
      .selectAll("g")
      .data(nodeArray, function (d) {
        return d.data.name + d.depth;
      });

    trail.exit().remove();

    let entering = trail.enter().append("svg:g");

    entering.append("svg:polygon")
      .attr("points", breadcrumbPoints)
      .style("fill", function (d) {
        return colors[d.data.name];
      });

    entering.append("svg:text")
      .attr("x", (b.w + b.t) / 2)
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(function (d) {
        return d.data.name;
      });

    entering.merge(trail).attr("transform", function (d, i) {
      return "translate(" + i * (b.w + b.s) + ", 0)";
    });

    d3.select("#trail").select("#endlabel")
      .attr("x", (nodeArray.length + 0.5) * (b.w + b.s))
      .attr("y", b.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(percentageString);

    d3.select("#trail")
      .style("visibility", "visible");
  }

  function drawLegend() {
    const legend_item = {
      w: 75, h: 30, s: 3, r: 3
    };

    let legend = containers.base.select(".legend").append("svg:svg")
      .attr("width", legend_item.w)
      .attr("height", d3.keys(colors).length * (legend_item.h + legend_item.s));

    let g = legend.selectAll("g")
      .data(d3.entries(colors))
      .enter().append("svg:g")
      .attr("transform", function (d, i) {
        return "translate(0," + i * (legend_item.h + legend_item.s) + ")";
      });

    g.append("svg:rect")
      .attr("rx", legend_item.r)
      .attr("ry", legend_item.r)
      .attr("width", legend_item.w)
      .attr("height", legend_item.h)
      .style("fill", function (d) {
        return d.value;
      });

    g.append("svg:text")
      .attr("x", legend_item.w / 2)
      .attr("y", legend_item.h / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(function (d) {
        return d.key;
      });
  }

  function toggleLegend() {
    let legend = containers.base.select(".legend");
    if (legend.style("visibility") === "hidden") {
      legend.style("visibility", "visible");
    } else {
      legend.style("visibility", "hidden");
    }
  }

  function mouseover(d) {
    let percentage = (100 * d.value / totalSize).toPrecision(3);
    let percentageString = percentage + "%";
    if (percentage < 0.1) {
      percentageString = "< 0.1%";
    }

    containers.base.select(".percentage")
      .text(percentageString);

    containers.base.select(".explanation")
      .style("visibility", "visible");

    let sequenceArray = d.ancestors().reverse();
    sequenceArray.shift();
    updateBreadcrumbs(sequenceArray, percentageString);

    containers.vis.selectAll("path")
      .style("opacity", 0.3);

    containers.vis.selectAll("path")
      .filter(function (node) {
        return (sequenceArray.indexOf(node) >= 0);
      })
      .style("opacity", 1);
  }

  function mouseleave(d) {
    containers.vis.select("#trail")
      .style("visibility", "hidden");

    containers.base.select(".explanation")
      .style("visibility", "visible");

    containers.vis.selectAll("path").on("mouseover", null);

    containers.vis.selectAll("path")
      .transition()
      .duration(1000)
      .style("opacity", 1)
      .on("end", function () {
        d3.select(this).on("mouseover", mouseover);
      });

    containers.vis.select(".explanation")
      .style("visibility", "hidden");
  }

  function csvToJson(csv) {
    let json = {"name": "root", "children": []};
    for (let i = 0; i < csv.length; i++) {
      let sequence = csv[i][0];
      let size = +csv[i][1];
      if (isNaN(size)) {
        continue;
      }
      let parts = sequence.split("-");
      let currentNode = json;
      for (let j = 0; j < parts.length; j++) {
        let children = currentNode["children"];
        let nodeName = parts[j];
        let childNode;
        if (j + 1 < parts.length) {
          let foundChild = false;
          for (let k = 0; k < children.length; k++) {
            if (children[k]["name"] == nodeName) {
              childNode = children[k];
              foundChild = true;
              break;
            }
          }
          if (!foundChild) {
            childNode = {"name": nodeName, "series": []};
            children.push(childNode);
          }
          currentNode = childNode;
        } else {
          childNode = {"name": nodeName, "size": size};
          children.push(childNode);
        }
      }
    }
    return json;
  }

  return {
    setConfig,
    setScales,
    setData,
    csvToJson
  }
}
