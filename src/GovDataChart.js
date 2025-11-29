import React, { useEffect, useState, useRef, useMemo } from "react";
import { Row, Col } from "react-bootstrap";
import _ from "underscore";

import ChartSettings from "./ChartSettings";
import SimpleLineChart from "./SimpleLineChart";
import SimpleBarChart from "./SimpleBarChart";
import {
  parseFloatOrText,
  computeLabels,
  filterResourceIDs,
  shouldSumData,
  shouldUseBarChart,
  calculateDomain,
  compareValues,
  parseDate,
  isDateString,
} from "./utils";
import { logger, verboseLog } from "./utils/logger";
import { useDebounce } from "./hooks/useDebounce";
import {
  API_DATASETS_ENDPOINT,
  API_LIST_ROWS_ENDPOINT,
  MAX_PAGES_TO_FETCH,
  DEFAULT_LIMIT,
  ERROR_MESSAGE_MAX_LENGTH,
  DEBOUNCE_DELAY,
  DOMAIN_AUTO,
} from "./constants";

function GovDataChart(props) {
  const [packages, setPackages] = useState([]);
  const [orgList, setOrgList] = useState([]);
  const [organisation, setOrganisation] = useState("");
  const [resourceID, setResourceID] = useState("");
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(true);
  const [result, setResult] = useState([]);
  const [sumData, setSumData] = useState(true);
  const [limit, setLimit] = useState(String(DEFAULT_LIMIT));
  const [xMin, setXMin] = useState(DOMAIN_AUTO);
  const [xMax, setXMax] = useState(DOMAIN_AUTO);
  const [yMin, setYMin] = useState(DOMAIN_AUTO);
  const [yMax, setYMax] = useState(DOMAIN_AUTO);

  // Debounce limit changes to prevent excessive API calls
  const debouncedLimit = useDebounce(limit, DEBOUNCE_DELAY);
  const [xKey, setXKey] = useState("");
  const [yKey, setYKey] = useState("");
  const [series, setSeries] = useState("");
  const [dataset, setDataset] = useState([]);
  const [useBarChart, setUseBarChart] = useState(false);

  // Refs to track and cancel fetch requests
  const fetchAbortControllerRef = useRef(null);
  const datasetFetchAbortControllerRef = useRef(null);
  const currentRequestIdRef = useRef(0);
  const hasUserSelectedOrgRef = useRef(false);

  // retrieve package list when page loads.
  useEffect(() => {
    setIsLoadingDatasets(true);
    setIsLoaded(false);

    // Cancel any previous fetch
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }

    // Create new AbortController for this fetch
    const abortController = new AbortController();
    fetchAbortControllerRef.current = abortController;

    // Use the new data.gov.sg v2 API endpoint with full URL
    // Documentation: https://guide.data.gov.sg/developer-guide/dataset-apis/list-all-datasets
    // Fetch first page to get total page count, then fetch all pages
    let baseUrl = API_DATASETS_ENDPOINT;

    logger.log("Fetching datasets list from:", baseUrl);

    // First, fetch the first page to get total page count
    fetch(baseUrl, {
      mode: "cors", // Need CORS for cross-origin request
      credentials: "omit",
      signal: abortController.signal,
      headers: {
        Accept: "application/json",
      },
    })
      .then((res) => {
        // Check if request was aborted
        if (abortController.signal.aborted) {
          return;
        }

        if (!res.ok) {
          logger.error("Response error:", res.status, res.statusText);
        }

        if (!res.ok) {
          logger.error("=== ERROR: Response not OK ===");
          logger.error("Status:", res.status);
          logger.error("Status Text:", res.statusText);
          logger.error("Requested URL:", baseUrl);
          logger.error("Response URL:", res.url);

          // Try to get error details from response
          return res.text().then((text) => {
            if (abortController.signal.aborted) return;

            logger.error("=== ERROR RESPONSE BODY ===");
            logger.error("Raw response text:", text);
            logger.error("Response text length:", text.length);

            // Try to parse as JSON if possible
            let errorDetails = text;
            let parsedError = null;
            try {
              parsedError = JSON.parse(text);
              errorDetails = JSON.stringify(parsedError, null, 2);
              logger.error("Parsed error JSON:", parsedError);
            } catch (e) {
              logger.error(
                "Response is not JSON, raw text:",
                text.substring(0, 1000)
              );
            }

            const errorMessage = `HTTP ${res.status} ${
              res.statusText
            } - ${errorDetails.substring(0, 500)}`;
            logger.error("=== THROWING ERROR ===");
            logger.error("Error message:", errorMessage);
            throw new Error(errorMessage);
          });
        }

        return res.json().catch((parseError) => {
          if (abortController.signal.aborted) return;
          logger.error("=== JSON PARSE ERROR ===");
          logger.error("Failed to parse JSON:", parseError);
          throw new Error(
            `Failed to parse JSON response: ${parseError.message}`
          );
        });
      })
      .then((apiData) => {
        setError(null);

        // Handle new v2 API response format
        // The v2 API returns: { code: 0, data: { datasets: [...], pages: N, totalRowCount: N } }
        // Reference: https://api-production.data.gov.sg/v2/public/api/datasets
        if (
          apiData &&
          apiData.code === 0 &&
          apiData.data &&
          apiData.data.datasets &&
          Array.isArray(apiData.data.datasets)
        ) {
          verboseLog("=== V2 API FORMAT DETECTED ===");
          const totalPages = apiData.data.pages || 1;
          const firstPageDatasets = apiData.data.datasets;
          logger.log(
            `Found ${firstPageDatasets.length} datasets on first page`
          );
          logger.log(`Total pages: ${totalPages}`);

          // If there are more pages, fetch them in batches for better performance
          // Limit to first N pages initially to improve load time
          const maxPagesToFetch = Math.min(totalPages, MAX_PAGES_TO_FETCH);
          if (maxPagesToFetch > 1) {
            logger.log(
              `Fetching remaining ${
                maxPagesToFetch - 1
              } pages (out of ${totalPages} total)...`
            );
            const pagePromises = [];

            // Fetch remaining pages (starting from page 2)
            for (let page = 2; page <= maxPagesToFetch; page++) {
              const pageUrl = `${baseUrl}?page=${page}`;
              pagePromises.push(
                fetch(pageUrl, {
                  mode: "cors",
                  credentials: "omit",
                  signal: abortController.signal,
                  headers: {
                    Accept: "application/json",
                  },
                })
                  .then((res) => {
                    if (abortController.signal.aborted) return null;
                    if (!res.ok) {
                      logger.warn(`Failed to fetch page ${page}:`, res.status);
                      return null;
                    }
                    return res.json();
                  })
                  .then((pageData) => {
                    if (abortController.signal.aborted) return [];
                    if (
                      pageData &&
                      pageData.code === 0 &&
                      pageData.data &&
                      pageData.data.datasets
                    ) {
                      verboseLog(
                        `Page ${page}: Found ${pageData.data.datasets.length} datasets`
                      );
                      return pageData.data.datasets;
                    }
                    return [];
                  })
                  .catch((error) => {
                    if (error.name === "AbortError") return [];
                    logger.warn(`Error fetching page ${page}:`, error);
                    return [];
                  })
              );
            }

            // Wait for all pages to load, then combine
            return Promise.all(pagePromises).then((allPages) => {
              const allDatasets = [...firstPageDatasets];
              allPages.forEach((pageDatasets) => {
                if (pageDatasets && Array.isArray(pageDatasets)) {
                  allDatasets.push(...pageDatasets);
                }
              });
              logger.log(`Total datasets fetched: ${allDatasets.length}`);
              return allDatasets;
            });
          } else {
            // Only one page, return first page datasets
            return Promise.resolve(firstPageDatasets);
          }
        } else {
          // Not v2 format, return empty array to trigger fallback
          return Promise.resolve([]);
        }
      })
      .then((allDatasets) => {
        if (allDatasets && allDatasets.length > 0) {
          logger.log(`=== PROCESSING ${allDatasets.length} DATASETS ===`);
          const allResources = [];

          allDatasets.forEach((dataset) => {
            // Check if dataset format is CSV
            if (dataset.format && dataset.format.toUpperCase() === "CSV") {
              allResources.push({
                resource_id: dataset.datasetId,
                resource_name: dataset.name,
                organisation: dataset.managedByAgencyName || "Unknown",
                resource_format: "CSV",
              });
            }
          });

          if (allResources.length > 0) {
            logger.log(
              `Found ${allResources.length} CSV resources from all pages`
            );
            setPackages(allResources);
            let newOrgList = [
              ...new Set(allResources.map((item) => item.organisation)),
            ].sort();
            setOrgList(newOrgList);
            // Only auto-select organization on initial load if user hasn't selected one
            if (
              newOrgList.length > 0 &&
              !organisation &&
              !hasUserSelectedOrgRef.current
            ) {
              let newOrg =
                newOrgList[Math.floor(Math.random() * newOrgList.length)];
              setOrganisation(newOrg);
            }
            setIsLoaded(true);
            setIsLoadingDatasets(false);
            return; // Exit early if v2 API worked
          } else {
            logger.warn("No CSV resources found in all fetched datasets");
          }
        }

        // If we reach here, v2 API didn't return datasets
        // Set error and mark as loaded
        setError({
          message:
            "No CSV datasets found in API response. Please check the API endpoint.",
        });
        setIsLoaded(true);
        setIsLoadingDatasets(false);
      })
      .catch((error) => {
        // Check if request was aborted
        if (abortController.signal.aborted || error.name === "AbortError") {
          return;
        }

        // Handle fetch errors - try CKAN fallback if v2 API completely fails
        logger.error("=== V2 API FETCH ERROR ===");
        logger.error("Error:", error);
        logger.warn("Trying CKAN API fallback...");

        return fetch("/api/action/package_search?rows=1000&fq=res_format:CSV", {
          mode: "cors",
          credentials: "omit",
          headers: {
            Accept: "application/json",
          },
        })
          .then((res) => {
            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }
            return res.json();
          })
          .then((ckanData) => {
            if (
              ckanData.success &&
              ckanData.result &&
              ckanData.result.results &&
              Array.isArray(ckanData.result.results)
            ) {
              verboseLog("=== CKAN API FORMAT DETECTED (FALLBACK) ===");
              const packages = ckanData.result.results;
              const allResources = [];

              packages.forEach((pkg) => {
                if (pkg.resources && Array.isArray(pkg.resources)) {
                  pkg.resources.forEach((resource) => {
                    if (
                      resource.format &&
                      resource.format.toUpperCase() === "CSV"
                    ) {
                      allResources.push({
                        resource_id: resource.id,
                        resource_name: resource.name || pkg.title,
                        organisation:
                          pkg.organization?.title ||
                          pkg.organization?.name ||
                          "Unknown",
                        resource_format: "CSV",
                      });
                    }
                  });
                }
              });

              if (allResources.length > 0) {
                setPackages(allResources);
                let newOrgList = [
                  ...new Set(allResources.map((item) => item.organisation)),
                ].sort();
                setOrgList(newOrgList);
                // Only auto-select organization on initial load if user hasn't selected one
                if (
                  newOrgList.length > 0 &&
                  !organisation &&
                  !hasUserSelectedOrgRef.current
                ) {
                  let newOrg =
                    newOrgList[Math.floor(Math.random() * newOrgList.length)];
                  setOrganisation(newOrg);
                }
                setIsLoaded(true);
                setIsLoadingDatasets(false);
                return;
              }
            }
            // If CKAN also fails, set error
            setError({
              message: `Failed to fetch datasets from both v2 and CKAN APIs: ${error.message}`,
            });
            setIsLoaded(true);
            setIsLoadingDatasets(false);
          })
          .catch((ckanError) => {
            if (abortController.signal.aborted) return;
            logger.error("CKAN fallback also failed:", ckanError);
            setError({
              message: `Failed to fetch datasets. V2 API error: ${error.message}. CKAN fallback error: ${ckanError.message}`,
            });
            setIsLoaded(true);
            setIsLoadingDatasets(false);
          });
      })
      .catch((error) => {
        // Check if request was aborted
        if (error.name === "AbortError") {
          return;
        }

        logger.error("=== FETCH ERROR CAUGHT ===");
        logger.error("Error name:", error.name);
        logger.error("Error message:", error.message);
        verboseLog("Error stack:", error.stack);
        verboseLog("Full error object:", error);
        verboseLog("Error type:", typeof error);
        verboseLog("Error constructor:", error.constructor?.name);

        // Log environment info
        verboseLog("=== ENVIRONMENT INFO ===");
        verboseLog("Window location:", window.location.href);
        verboseLog("Protocol:", window.location.protocol);
        verboseLog("Hostname:", window.location.hostname);
        verboseLog("Port:", window.location.port);
        verboseLog("Origin:", window.location.origin);

        let errorMessage = "Failed to fetch data from API. ";
        let errorDetails = "";

        // Check if it's a network/CORS error
        if (
          error.message &&
          (error.message.includes("Failed to fetch") ||
            error.message.includes("NetworkError") ||
            error.message.includes("Network request failed") ||
            error.name === "TypeError")
        ) {
          logger.error("=== NETWORK/CORS ERROR DETECTED ===");
          // Check if we're on localhost or a proper HTTP server
          const isLocalhost =
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1" ||
            window.location.protocol === "http:" ||
            window.location.protocol === "https:";

          verboseLog("Is localhost:", isLocalhost);
          verboseLog("Protocol check:", window.location.protocol);

          if (!isLocalhost && window.location.protocol === "file:") {
            errorMessage +=
              "You are opening the file directly. Please use 'npm start' or serve via HTTP server.";
            errorDetails = `Protocol: ${window.location.protocol}, Hostname: ${window.location.hostname}`;
          } else {
            errorMessage +=
              "Network error. This could be due to: 1) CORS restrictions, 2) Network connectivity, 3) API server issues, 4) Proxy configuration. ";
            errorDetails = `Requested: ${baseUrl}, Origin: ${window.location.origin}, Protocol: ${window.location.protocol}`;
          }
        } else if (error.message && error.message.includes("404")) {
          logger.error("=== 404 ERROR DETECTED ===");
          errorMessage += "The API resource returned 404 (Not Found). ";
          errorDetails = `URL: ${baseUrl}, Full error: ${error.message}`;
        } else if (error.message && error.message.includes("500")) {
          logger.error("=== 500 ERROR DETECTED ===");
          errorMessage += "The API server returned an internal error (500). ";
          errorDetails = `URL: ${baseUrl}, Error: ${error.message}`;
        } else {
          logger.error("=== OTHER ERROR ===");
          errorMessage += error.message || "Unknown error occurred.";
          errorDetails = `Error type: ${error.name}, Message: ${error.message}`;
        }

        const fullErrorMessage = `${errorMessage} [Details: ${errorDetails}]`;
        logger.error("=== FINAL ERROR MESSAGE ===");
        logger.error(fullErrorMessage);

        setError({
          message: fullErrorMessage,
          originalError: error,
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
        });
        setIsLoaded(true);
        setIsLoadingDatasets(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // update datasets whenever there is a change in organisation selection
  // Only auto-select a resourceID if none is currently selected for this organization
  useEffect(() => {
    if (!organisation || packages.length === 0) return;
    let resourceIDs = filterResourceIDs(packages, organisation);
    if (resourceIDs.length > 0) {
      // Only auto-select if current resourceID doesn't belong to this organization
      const currentResourceBelongsToOrg = resourceIDs.includes(resourceID);
      if (!currentResourceBelongsToOrg || !resourceID) {
        let newResourceID =
          resourceIDs[Math.floor(Math.random() * resourceIDs.length)];
        setResourceID(newResourceID);
      }
    }
  }, [packages, organisation, resourceID]);

  // retrieve dataset based on resourceID
  useEffect(() => {
    if (!resourceID) return;

    // Cancel any previous dataset fetch
    if (datasetFetchAbortControllerRef.current) {
      datasetFetchAbortControllerRef.current.abort();
    }

    // Create new AbortController for this fetch
    const abortController = new AbortController();
    datasetFetchAbortControllerRef.current = abortController;

    // Track this request to prevent race conditions
    const requestId = ++currentRequestIdRef.current;

    // Reset state when new dataset is selected
    setIsLoaded(false);
    setError(null);
    setResult([]);
    setDataset([]);
    setXKey("");
    setYKey("");
    setSeries("");
    setUseBarChart(false);
    setXMin(DOMAIN_AUTO);
    setXMax(DOMAIN_AUTO);
    setYMin(DOMAIN_AUTO);
    setYMax(DOMAIN_AUTO);

    // Use the new v2 API endpoint to fetch dataset rows
    let url = `${API_LIST_ROWS_ENDPOINT(resourceID)}?limit=${debouncedLimit}`;
    logger.log("=== FETCHING DATASET ROWS ===");
    logger.log("Fetching dataset from:", url);
    logger.log("Resource ID (datasetId):", resourceID);
    fetch(url, {
      mode: "cors", // Need CORS for cross-origin request
      credentials: "omit",
      signal: abortController.signal,
      headers: {
        Accept: "application/json",
      },
    })
      .then((res) => {
        // Check if request was aborted or if this is an old request
        if (
          abortController.signal.aborted ||
          requestId !== currentRequestIdRef.current
        ) {
          return;
        }

        verboseLog("=== DATASET RESPONSE RECEIVED ===");
        verboseLog("Dataset response status:", res.status, res.statusText);
        verboseLog("Response ok:", res.ok);
        if (!res.ok) {
          return res.text().then((text) => {
            if (
              abortController.signal.aborted ||
              requestId !== currentRequestIdRef.current
            ) {
              return;
            }

            logger.error("=== DATASET ERROR RESPONSE ===");
            logger.error("Error response body:", text);
            let errorDetails = text;
            try {
              const jsonError = JSON.parse(text);
              errorDetails = JSON.stringify(jsonError, null, 2);
              logger.error("Parsed error JSON:", jsonError);
            } catch (e) {
              logger.error(
                "Response is not JSON, raw text:",
                text.substring(0, 1000)
              );
            }
            throw new Error(
              `HTTP ${res.status} ${res.statusText} - ${errorDetails.substring(
                0,
                ERROR_MESSAGE_MAX_LENGTH
              )}`
            );
          });
        }
        return res.json();
      })
      .then((apiData) => {
        // Check if request was aborted or if this is an old request
        if (
          abortController.signal.aborted ||
          requestId !== currentRequestIdRef.current
        ) {
          return;
        }

        verboseLog("=== DATASET DATA RECEIVED ===");
        verboseLog("Dataset data:", apiData);

        // Handle v2 API response format
        // Expected: { code: 0, data: { rows: [...], fields: [...] } }
        if (apiData && apiData.code === 0 && apiData.data) {
          verboseLog("=== V2 DATASET FORMAT DETECTED ===");
          verboseLog(
            "Full API response structure:",
            JSON.stringify(apiData, null, 2).substring(0, 2000)
          );
          setError(null);

          // Transform v2 API format to match expected format
          const rows = apiData.data.rows || [];
          const fields = apiData.data.fields || [];

          logger.log(`Found ${rows.length} rows`);
          logger.log(`Found ${fields.length} fields`);
          verboseLog("Sample row:", rows[0]);
          verboseLog("Fields structure:", fields);

          // If fields array is empty or missing, infer from first row
          let processedFields = [];
          if (fields && fields.length > 0) {
            // Fields are provided by API
            processedFields = fields.map((field, index) => {
              // Handle different possible field structures
              const fieldId =
                field.id ||
                field.name ||
                field.field ||
                field.column ||
                `field_${index}`;
              const fieldType = field.type || "text";
              return {
                id: fieldId,
                type: fieldType,
                ...field,
              };
            });
          } else if (rows.length > 0) {
            // Infer fields from first row keys
            logger.log("No fields provided, inferring from row structure");
            const firstRow = rows[0];
            processedFields = Object.keys(firstRow).map((key, index) => ({
              id: key,
              type: typeof firstRow[key] === "number" ? "number" : "text",
            }));
            verboseLog("Inferred fields:", processedFields);
          }

          // Transform to match expected format
          const result = {
            records: rows,
            fields: processedFields,
          };

          verboseLog("Transformed result structure:", {
            recordsCount: result.records.length,
            fieldsCount: result.fields.length,
            fieldIds: result.fields.map((f) => f.id),
          });

          setResult(result);

          if (
            result.fields &&
            result.fields.length > 0 &&
            result.records &&
            result.records.length > 0
          ) {
            try {
              let [x, y, series] = computeLabels(result.fields, result.records);
              setXKey(x);
              setYKey(y);
              setSeries(series || ""); // Set to empty string if null

              // Automatically determine if summing is needed
              const shouldSum = shouldSumData(result.records, x, y);
              setSumData(shouldSum);

              // Automatically determine if bar chart is more appropriate
              const useBar = shouldUseBarChart(
                result.records,
                x,
                result.fields
              );
              setUseBarChart(useBar);

              logger.log(
                "Auto-computed labels - x:",
                x,
                "y:",
                y,
                "series:",
                series || "(none)",
                "sumData:",
                shouldSum,
                "useBarChart:",
                useBar
              );
            } catch (labelError) {
              logger.error("=== ERROR IN computeLabels ===");
              logger.error("Error:", labelError);
              verboseLog("Fields passed:", result.fields);
              verboseLog("Records sample:", result.records.slice(0, 2));
              setError({
                message: `Error processing labels: ${labelError.message}. Check console for details.`,
              });
            }
          } else {
            logger.warn("Cannot compute labels - missing fields or records");
            verboseLog("Fields:", result.fields);
            verboseLog(
              "Records count:",
              result.records ? result.records.length : 0
            );
          }
          setIsLoaded(true);
        } else if (apiData && apiData.success && apiData.result) {
          // Fallback: Handle old CKAN format
          verboseLog("=== CKAN DATASET FORMAT DETECTED ===");
          setError(null);
          setResult(apiData.result);
          if (
            apiData.result &&
            apiData.result.fields &&
            apiData.result.records
          ) {
            try {
              let [x, y, series] = computeLabels(
                apiData.result.fields,
                apiData.result.records
              );
              setXKey(x);
              setYKey(y);
              setSeries(series || "");

              // Automatically determine if summing is needed
              const shouldSum = shouldSumData(apiData.result.records, x, y);
              setSumData(shouldSum);

              // Automatically determine if bar chart is more appropriate
              const useBar = shouldUseBarChart(
                apiData.result.records,
                x,
                apiData.result.fields
              );
              setUseBarChart(useBar);

              logger.log(
                "Auto-computed labels (CKAN) - x:",
                x,
                "y:",
                y,
                "series:",
                series || "(none)",
                "sumData:",
                shouldSum,
                "useBarChart:",
                useBar
              );
            } catch (labelError) {
              logger.error("Error computing labels for CKAN data:", labelError);
            }
          }
          setIsLoaded(true);
        } else {
          logger.error("=== UNKNOWN DATASET FORMAT ===");
          logger.error("API data structure:", apiData);
          setError({
            message: "API error: Unknown response format from dataset endpoint",
          });
          setIsLoaded(true);
        }
      })
      .catch((error) => {
        // Check if request was aborted or if this is an old request
        if (
          abortController.signal.aborted ||
          error.name === "AbortError" ||
          requestId !== currentRequestIdRef.current
        ) {
          return;
        }

        let errorMessage = "Failed to fetch dataset. ";
        if (
          error.message &&
          (error.message.includes("Failed to fetch") ||
            error.message.includes("NetworkError"))
        ) {
          errorMessage +=
            "Network error - please check your connection or try again later.";
        } else {
          errorMessage += error.message || "Unknown error occurred.";
        }
        setError({ message: errorMessage, originalError: error });
        setIsLoaded(true);
      });
  }, [resourceID, debouncedLimit, organisation]);

  // error handling - only auto-select organization if none is selected and user hasn't selected one
  useEffect(() => {
    if (
      error &&
      !isLoaded &&
      !organisation &&
      !hasUserSelectedOrgRef.current &&
      orgList.length > 0
    ) {
      let newOrg = orgList[Math.floor(Math.random() * orgList.length)];
      setOrganisation(newOrg);
    }
  }, [error, isLoaded, orgList, organisation]);

  // Memoize expensive dataset processing computation
  const processedDataset = useMemo(() => {
    if (!result || !result.records || !xKey || !yKey) {
      verboseLog("Dataset processing skipped - missing data:", {
        hasResult: !!result,
        hasRecords: !!(result && result.records),
        xKey,
        yKey,
      });
      return {};
    }

    logger.log("=== PROCESSING DATASET ===");
    logger.log("Records count:", result.records.length);
    logger.log("xKey:", xKey, "yKey:", yKey, "series:", series);

    // Check if xKey contains date strings
    const sampleXValue = result.records[0]?.[xKey];
    const xKeyIsDate = sampleXValue && isDateString(String(sampleXValue));
    verboseLog("X-axis is date format?", xKeyIsDate, "Sample:", sampleXValue);

    let records = [...result.records].sort((a, b) => {
      const aVal = a[xKey];
      const bVal = b[xKey];
      // Use intelligent comparison that handles dates, numbers, and strings
      return compareValues(aVal, bVal);
    });

    // Convert date strings to timestamps for proper chart rendering
    if (xKeyIsDate) {
      records = records.map((record) => {
        const xValue = record[xKey];
        const xTimestamp = parseDate(String(xValue));
        if (xTimestamp !== null) {
          // Create a new record with timestamp for xKey
          return {
            ...record,
            [xKey]: xTimestamp, // Use timestamp for positioning
          };
        }
        return record;
      });
      verboseLog("Converted date strings to timestamps for x-axis");
    }

    let dataset = {};

    // if we aren't summing data, a GroupBy operation will suffice
    if (!sumData) {
      if (series && series.trim() !== "") {
        const grouped = _.groupBy(records, series);
        // Sort each group by xKey and ensure y-values are numeric
        Object.keys(grouped).forEach((key) => {
          grouped[key] = grouped[key]
            .sort((a, b) => compareValues(a[xKey], b[xKey]))
            .map((record) => {
              // Ensure y-value is numeric
              const yValue = record[yKey];
              const numericYValue =
                typeof yValue === "number" ? yValue : parseFloatOrText(yValue);
              return {
                ...record,
                [yKey]: numericYValue,
              };
            });
        });
        logger.log(
          "Grouped dataset (no sum):",
          Object.keys(grouped).length,
          "series"
        );
        return grouped;
      } else {
        // No series, just use all records as one series
        logger.log("No series specified, using all records as single series");
        // Records are already sorted by xKey, ensure y-values are numeric
        const processedRecords = records.map((record) => {
          const yValue = record[yKey];
          const numericYValue =
            typeof yValue === "number" ? yValue : parseFloatOrText(yValue);
          return {
            ...record,
            [yKey]: numericYValue,
          };
        });
        return { "All Data": processedRecords };
      }
    }

    // Note: records already have dates converted to timestamps if xKeyIsDate was true

    // If no series is specified, use a default series
    const seriesKey = series && series.trim() !== "" ? series : "default";

    // Optimize: Use Map for O(1) lookups instead of nested loops (O(n²))
    const seriesMap = new Map(); // Map<seriesID, Map<xValue, yValue>>

    for (let i = 0; i < records.length; i++) {
      let item = records[i];
      let seriesID = item[seriesKey] || "default";

      // Ensure seriesID is a valid string key
      if (seriesID === null || seriesID === undefined) {
        seriesID = "default";
      }
      seriesID = String(seriesID);

      const xValue = item[xKey];
      const yValue = parseFloatOrText(item[yKey]);

      if (!seriesMap.has(seriesID)) {
        seriesMap.set(seriesID, new Map());
      }

      const xMap = seriesMap.get(seriesID);
      if (xMap.has(xValue)) {
        // x-key exists, sum y values
        const existingY = xMap.get(xValue);
        // Check if both values are numbers (after parseFloatOrText conversion)
        if (typeof yValue === "number" && typeof existingY === "number") {
          xMap.set(xValue, existingY + yValue);
        } else if (typeof yValue === "number") {
          // If only new value is numeric, replace with it
          xMap.set(xValue, yValue);
        } else if (typeof existingY === "number") {
          // If only existing value is numeric, keep it
          // (don't replace with non-numeric value)
        }
        // If neither is numeric, keep existing value
      } else {
        // x-key doesn't exist, add it
        xMap.set(xValue, yValue);
      }
    }

    // Convert Map structure back to expected format
    seriesMap.forEach((xMap, seriesID) => {
      dataset[seriesID] = [];
      // Convert Map entries to array and sort by xValue to ensure proper ordering
      const entries = Array.from(xMap.entries()).map(([xValue, yValue]) => {
        // Ensure yValue is numeric if it should be (preserve original type)
        const finalYValue =
          typeof yValue === "number" ? yValue : parseFloatOrText(yValue);
        return {
          [xKey]: xValue,
          [yKey]: finalYValue,
        };
      });
      // Sort by xKey value ONLY (handles timestamps, numbers, and strings)
      // Y-values remain at their original numeric positions - NOT sorted
      // They will be plotted on a linear scale at their actual numeric values
      entries.sort((a, b) => compareValues(a[xKey], b[xKey]));
      dataset[seriesID] = entries;
    });

    logger.log("Processed dataset:", {
      seriesCount: Object.keys(dataset).length,
      seriesNames: Object.keys(dataset),
    });
    return dataset;
  }, [sumData, result, series, xKey, yKey]);

  // Update dataset state and calculate domain when processed dataset changes
  useEffect(() => {
    if (Object.keys(processedDataset).length > 0) {
      setDataset(processedDataset);
      const domain = calculateDomain(processedDataset, xKey, yKey);
      setXMin(domain.xMin);
      setXMax(domain.xMax);
      setYMin(domain.yMin);
      setYMax(domain.yMax);
    }
  }, [processedDataset, xKey, yKey]);

  // Show loading state for initial dataset list fetch
  if (isLoadingDatasets) {
    return (
      <Row>
        <Col xs={12}>
          <div className="chart-container">
            <div className="loading-container">
              <div>
                <div className="spinner"></div>
                <div
                  style={{
                    marginTop: "1rem",
                    fontSize: "1.1em",
                    color: "#64748b",
                  }}
                >
                  Loading datasets...
                </div>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    );
  }

  return (
    <Row>
      <Col xs={12} md={6} lg={8}>
        {useBarChart ? (
          <SimpleBarChart
            isLoaded={isLoaded}
            error={error}
            dataset={dataset}
            xKey={xKey}
            yKey={yKey}
            domain={[xMin, xMax, yMin, yMax]}
          />
        ) : (
          <SimpleLineChart
            isLoaded={isLoaded}
            error={error}
            dataset={dataset}
            xKey={xKey}
            yKey={yKey}
            domain={[xMin, xMax, yMin, yMax]}
          />
        )}
      </Col>
      <Col xs={12} md={6} lg={4}>
        <ChartSettings
          keys={[xKey, setXKey, yKey, setYKey, series, setSeries]}
          domain={[xMin, setXMin, xMax, setXMax, yMin, setYMin, yMax, setYMax]}
          resourceID={[resourceID, setResourceID]}
          fields={result ? result.fields : []}
          sumData={[sumData, setSumData]}
          limit={[limit, setLimit]}
          packages={packages}
          orgList={orgList}
          organisation={[
            organisation,
            (newOrg) => {
              hasUserSelectedOrgRef.current = true;
              setOrganisation(newOrg);
            },
          ]}
          filterResourceIDs={filterResourceIDs}
        />
      </Col>
    </Row>
  );
}

// PropTypes not needed for GovDataChart as it doesn't receive props

export default GovDataChart;
