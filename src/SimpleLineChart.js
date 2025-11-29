import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import PropTypes from "prop-types";

import { parseFloatOrText } from "./utils";
import {
  CHART_HEIGHT,
  CHART_MARGINS,
  LEGEND_MAX_HEIGHT,
  LEGEND_ICON_SIZE,
  LEGEND_FONT_SIZE,
  ANIMATION_DURATION,
  TIMESTAMP_THRESHOLD,
  COLOR_PALETTE,
} from "./constants";
import { logger } from "./utils/logger";

/**
 * Line chart component for displaying time series and continuous data
 * @param {Object} props - Component props
 * @param {boolean} props.isLoaded - Whether data has been loaded
 * @param {Object|null} props.error - Error object if an error occurred
 * @param {Object} props.dataset - Dataset object with series as keys
 * @param {string} props.xKey - Key for x-axis data
 * @param {string} props.yKey - Key for y-axis data
 * @param {Array} props.domain - Array of [xMin, xMax, yMin, yMax] domain values
 */
function SimpleLineChart(props) {
  // Safely destructure domain array with defaults
  const domain = Array.isArray(props.domain) && props.domain.length >= 4 
    ? props.domain 
    : ["auto", "auto", "auto", "auto"];
  let [xMin, xMax, yMin, yMax] = domain;

  // Use centralized color palette
  const colorPalette = COLOR_PALETTE;

  function isAxisNumerical(key) {
    if (!props.dataset || !Object.keys(props.dataset)[0]) return false;
    let first_series = Object.keys(props.dataset)[0];
    if (
      !props.dataset[first_series] ||
      props.dataset[first_series].length === 0
    )
      return false;

    // Check multiple values to be more robust
    const sampleSize = Math.min(10, props.dataset[first_series].length);
    let numericCount = 0;
    let totalChecked = 0;

    for (let i = 0; i < sampleSize; i++) {
      let val = props.dataset[first_series][i][key];
      if (val === null || val === undefined) continue;
      totalChecked++;

      // Check if it's a number
      if (typeof val === "number") {
        if (!isNaN(val)) {
          numericCount++;
        }
      } else {
        // For strings, check if they match numeric pattern
        const strVal = String(val).trim();
        if (strVal !== "" && /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(strVal)) {
          numericCount++;
        }
      }
    }

    // If at least 80% of checked values are numeric, treat as numerical axis
    const isNumerical = totalChecked > 0 && numericCount / totalChecked >= 0.8;
    if (key === props.yKey) {
      logger.log(`Y-axis numerical check for "${key}":`, {
        isNumerical,
        numericCount,
        totalChecked,
        ratio:
          totalChecked > 0 ? (numericCount / totalChecked).toFixed(2) : 0,
        sampleValues: props.dataset[first_series].slice(0, 5).map((r) => ({
          value: r[key],
          type: typeof r[key],
          isNumeric: typeof r[key] === "number" && !isNaN(r[key]),
        })),
      });
    }
    return isNumerical;
  }

  if (props.error) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "left",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            color: "#d32f2f",
            fontSize: "1.2em",
            marginBottom: "15px",
            fontWeight: "bold",
          }}
        >
          ⚠️ Error: {props.error.message || "An error occurred"}
        </div>

        {/* Show detailed error information if available */}
        {props.error.errorName && (
          <div
            style={{
              fontSize: "0.9em",
              color: "#666",
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#f5f5f5",
              borderRadius: "4px",
            }}
          >
            <strong>Error Details:</strong>
            <ul style={{ marginTop: "5px", paddingLeft: "20px" }}>
              <li>
                <strong>Error Type:</strong> {props.error.errorName}
              </li>
              {props.error.errorMessage && (
                <li>
                  <strong>Message:</strong> {props.error.errorMessage}
                </li>
              )}
              {props.error.originalError && (
                <li>
                  <strong>Original Error:</strong>{" "}
                  {JSON.stringify(props.error.originalError, null, 2).substring(
                    0,
                    200
                  )}
                  ...
                </li>
              )}
            </ul>
          </div>
        )}

        <div
          style={{
            fontSize: "0.9em",
            color: "#666",
            marginTop: "15px",
            padding: "10px",
            backgroundColor: "#fff3cd",
            borderRadius: "4px",
          }}
        >
          <strong>Debugging Steps:</strong>
          <ol style={{ marginTop: "5px", paddingLeft: "20px" }}>
            <li>Open browser console (F12) and check for detailed logs</li>
            <li>Look for logs starting with "===" to see the fetch process</li>
            <li>
              Check the Network tab to see the actual HTTP request/response
            </li>
            <li>
              Verify the development server is running: <code>npm start</code>
            </li>
            <li>
              Check that the proxy is configured correctly in{" "}
              <code>src/setupProxy.js</code>
            </li>
          </ol>
        </div>

        {props.error.message && props.error.message.includes("CORS") && (
          <div
            style={{
              fontSize: "0.9em",
              color: "#666",
              marginTop: "10px",
              padding: "10px",
              backgroundColor: "#e3f2fd",
              borderRadius: "4px",
            }}
          >
            <strong>CORS Issue Detected:</strong>
            <ul style={{ marginTop: "5px", paddingLeft: "20px" }}>
              <li>
                Use <code>npm start</code> to run the development server, or
              </li>
              <li>
                Serve the build folder using a web server (e.g.,{" "}
                <code>npx serve -s build</code>)
              </li>
              <li>Do not open the HTML file directly in the browser</li>
            </ul>
          </div>
        )}
      </div>
    );
  }
  if (!props.isLoaded) return <div>Loading Data...</div>;

  // Validate dataset structure
  if (
    !props.dataset ||
    typeof props.dataset !== "object" ||
    Object.keys(props.dataset).length === 0
  ) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div style={{ color: "#666", fontSize: "1em" }}>
          No data available to display.
        </div>
        <div style={{ fontSize: "0.8em", color: "#999", marginTop: "10px" }}>
          Dataset:{" "}
          {props.dataset
            ? JSON.stringify(props.dataset).substring(0, 100)
            : "null"}
        </div>
      </div>
    );
  }

  logger.log("=== RENDERING CHART ===");
  logger.log("Dataset keys:", Object.keys(props.dataset));
  logger.log("xKey:", props.xKey, "yKey:", props.yKey);
  const firstSeriesKey = Object.keys(props.dataset)[0];
  logger.log(
    "Sample series data:",
    firstSeriesKey && props.dataset[firstSeriesKey]
      ? props.dataset[firstSeriesKey].slice(0, 3)
      : null
  );

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart margin={CHART_MARGINS}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} />
          <XAxis
            type={isAxisNumerical(props.xKey) ? "number" : "category"}
            dataKey={props.xKey}
            domain={
              xMin === "auto" || xMax === "auto"
                ? ["dataMin", "dataMax"]
                : [parseFloatOrText(xMin), parseFloatOrText(xMax)]
            }
            tickFormatter={(value) => {
              // If value is a timestamp (large number), format as date
              if (typeof value === "number" && value > TIMESTAMP_THRESHOLD) {
                const date = new Date(value);
                // Format as YYYY-MM if it's the first of the month, otherwise YYYY-MM-DD
                if (date.getDate() === 1) {
                  return `${date.getFullYear()}-${String(
                    date.getMonth() + 1
                  ).padStart(2, "0")}`;
                }
                return `${date.getFullYear()}-${String(
                  date.getMonth() + 1
                ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              }
              return value;
            }}
            label={{
              value: props.xKey || "X Axis",
              position: "bottom",
              offset: 10,
            }}
          ></XAxis>
          <YAxis
            type={isAxisNumerical(props.yKey) ? "number" : "category"}
            domain={
              yMin === "auto" || yMax === "auto"
                ? ["dataMin", "dataMax"]
                : [parseFloatOrText(yMin), parseFloatOrText(yMax)]
            }
            label={{
              value: props.yKey || "Y Axis",
              angle: -90,
              position: "left",
              offset: 10,
            }}
          ></YAxis>
          <Tooltip
            filterNull="true"
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              padding: "12px",
            }}
            itemStyle={{ fontSize: "0.9em", padding: "4px 0" }}
            labelStyle={{ fontWeight: 600, marginBottom: "8px" }}
          />
          <Legend
            iconSize={LEGEND_ICON_SIZE}
            wrapperStyle={{
              fontSize: LEGEND_FONT_SIZE,
              paddingTop: "10px",
              paddingBottom: "5px",
              maxHeight: `${LEGEND_MAX_HEIGHT}px`,
              overflowY: "auto",
              overflowX: "hidden",
            }}
            iconType="line"
            layout="horizontal"
            verticalAlign="bottom"
          />
          {Object.keys(props.dataset).map((key, index) => {
            const seriesData = props.dataset[key];
            if (!Array.isArray(seriesData) || seriesData.length === 0) {
              logger.warn(`Series "${key}" has no data or is not an array`);
              return null;
            }
            const lineColor = colorPalette[index % colorPalette.length];
            return (
              <Line
                type="monotone"
                dataKey={props.yKey}
                data={seriesData}
                name={key}
                key={key}
                stroke={lineColor}
                strokeWidth={2.5}
                dot={{ fill: lineColor, r: 4, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 6, stroke: "#fff", strokeWidth: 2 }}
                animationDuration={ANIMATION_DURATION}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

SimpleLineChart.propTypes = {
  isLoaded: PropTypes.bool.isRequired,
  error: PropTypes.object,
  dataset: PropTypes.object.isRequired,
  xKey: PropTypes.string.isRequired,
  yKey: PropTypes.string.isRequired,
  domain: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  ).isRequired,
};

export default SimpleLineChart;
