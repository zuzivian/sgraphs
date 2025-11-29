import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { parseFloatOrText } from "./utils.js";

function SimpleBarChart(props) {
  let [xMin, xMax, yMin, yMax] = props.domain;

  // Modern color palette for chart bars
  const colorPalette = [
    "#6366f1", // Indigo
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#3b82f6", // Blue
    "#ef4444", // Red
    "#06b6d4", // Cyan
    "#84cc16", // Lime
    "#f97316", // Orange
    "#14b8a6", // Teal
    "#a855f7", // Violet
  ];

  function isAxisNumerical(key) {
    if (!props.dataset || !Object.keys(props.dataset)[0]) return false;
    let first_series = Object.keys(props.dataset)[0];
    if (!props.dataset[first_series] || props.dataset[first_series].length === 0) return false;
    
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
    return totalChecked > 0 && numericCount / totalChecked >= 0.8;
  }

  if (props.error) {
    return (
      <div className="chart-container">
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
            <li>
              Look for logs starting with "===" to see the fetch process
            </li>
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
      </div>
    );
  }
  
  if (!props.isLoaded) {
    return (
      <div className="chart-container">
        <div className="loading-container">
          <div>
            <div className="spinner"></div>
            <div style={{ marginTop: "1rem", fontSize: "1.1em", color: "#64748b" }}>
              Loading chart data...
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  console.log("=== RENDERING BAR CHART ===");
  console.log("Dataset keys:", Object.keys(props.dataset));
  console.log("xKey:", props.xKey, "yKey:", props.yKey);
  console.log(
    "Sample series data:",
    Object.keys(props.dataset)[0]
      ? props.dataset[Object.keys(props.dataset)[0]].slice(0, 3)
      : null
  );

  // Transform dataset structure for Recharts BarChart
  // Recharts expects: data = [{x: 1, series1: 10, series2: 15}, {x: 2, series1: 20, series2: 25}]
  // Current structure: dataset = {series1: [{x: 1, y: 10}], series2: [{x: 1, y: 15}]}
  const seriesKeys = Object.keys(props.dataset);
  let transformedData = [];
  
  if (seriesKeys.length > 0) {
    // Get all unique x-values across all series
    const xValueSet = new Set();
    seriesKeys.forEach(seriesKey => {
      const seriesData = props.dataset[seriesKey];
      if (Array.isArray(seriesData)) {
        seriesData.forEach(point => {
          if (point[props.xKey] !== undefined && point[props.xKey] !== null) {
            xValueSet.add(point[props.xKey]);
          }
        });
      }
    });
    
    const xValues = Array.from(xValueSet).sort((a, b) => {
      // Use intelligent comparison for sorting
      if (typeof a === 'number' && typeof b === 'number') return a - b;
      if (typeof a === 'number') return -1;
      if (typeof b === 'number') return 1;
      return String(a).localeCompare(String(b));
    });
    
    // Create transformed data array
    transformedData = xValues.map(xValue => {
      const dataPoint = { [props.xKey]: xValue };
      
      // For each series, find the y-value for this x-value
      seriesKeys.forEach(seriesKey => {
        const seriesData = props.dataset[seriesKey];
        if (Array.isArray(seriesData)) {
          const matchingPoint = seriesData.find(point => point[props.xKey] === xValue);
          if (matchingPoint && matchingPoint[props.yKey] !== undefined) {
            // Use series key as the dataKey for this bar
            dataPoint[seriesKey] = matchingPoint[props.yKey];
          } else {
            // No data for this x-value in this series
            dataPoint[seriesKey] = null;
          }
        }
      });
      
      return dataPoint;
    });
  }
  
  console.log("Transformed data for bar chart:", transformedData.slice(0, 3));

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={600}>
        <BarChart 
          data={transformedData}
          margin={{ top: 20, right: 30, left: 50, bottom: 80 }}
        >
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
            if (typeof value === 'number' && value > 1000000000) {
              const date = new Date(value);
              // Format as YYYY-MM if it's the first of the month, otherwise YYYY-MM-DD
              if (date.getDate() === 1) {
                return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              }
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }
            return value;
          }}
          label={{ value: props.xKey || "X Axis", position: "bottom", offset: 10 }}
        >
        </XAxis>
        <YAxis
          type={isAxisNumerical(props.yKey) ? "number" : "category"}
          domain={
            yMin === "auto" || yMax === "auto"
              ? ["dataMin", "dataMax"]
              : [parseFloatOrText(yMin), parseFloatOrText(yMax)]
          }
          label={{ value: props.yKey || "Y Axis", angle: -90, position: "left", offset: 10 }}
        >
        </YAxis>
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
          iconSize={10}
          wrapperStyle={{
            fontSize: "0.75em",
            paddingTop: "10px",
            paddingBottom: "5px",
            maxHeight: "120px",
            overflowY: "auto",
            overflowX: "hidden",
          }}
          iconType="rect"
          layout="horizontal"
          verticalAlign="bottom"
          formatter={(value) => value.length > 30 ? value.substring(0, 30) + '...' : value}
        />
        {seriesKeys.map((seriesKey, index) => {
          const seriesData = props.dataset[seriesKey];
          if (!Array.isArray(seriesData) || seriesData.length === 0) {
            console.warn(`Series "${seriesKey}" has no data or is not an array`);
            return null;
          }
          const barColor = colorPalette[index % colorPalette.length];
          return (
            <Bar
              dataKey={seriesKey}
              name={seriesKey}
              key={seriesKey}
              fill={barColor}
              radius={[8, 8, 0, 0]}
              animationDuration={750}
            />
          );
        })}
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

export default SimpleBarChart;

