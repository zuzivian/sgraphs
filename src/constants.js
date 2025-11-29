/**
 * Application-wide constants
 * Centralizes magic numbers and strings for better maintainability
 */

// API Configuration
export const API_BASE_URL = "https://api-production.data.gov.sg/v2/public/api";
export const API_DATASETS_ENDPOINT = `${API_BASE_URL}/datasets`;
export const API_LIST_ROWS_ENDPOINT = (datasetId) =>
  `${API_BASE_URL}/datasets/${datasetId}/list-rows`;

// Pagination & Data Limits
export const MAX_PAGES_TO_FETCH = 50;
export const DEFAULT_LIMIT = 2000;
export const MAX_DATASET_SIZE = 100000;
export const BATCH_SIZE = 10; // Pages to fetch in parallel

// Chart Configuration
export const CHART_HEIGHT = 600;
export const CHART_MARGINS = {
  top: 20,
  right: 30,
  left: 50,
  bottom: 80,
};
export const LEGEND_MAX_HEIGHT = 120;
export const LEGEND_ICON_SIZE = 10;
export const LEGEND_FONT_SIZE = "0.75em";

// Animation
export const ANIMATION_DURATION = 750;

// Debouncing
export const DEBOUNCE_DELAY = 500; // milliseconds

// Error Message Limits
export const ERROR_MESSAGE_MAX_LENGTH = 500;
export const ERROR_DETAILS_MAX_LENGTH = 2000;

// Timeout Values
export const FETCH_TIMEOUT = 30000; // 30 seconds
export const RETRY_DELAY_BASE = 1000; // Base delay for exponential backoff

// Domain Defaults
export const DOMAIN_AUTO = "auto";

// Field Analysis Thresholds
export const MAX_UNIQUE_VALUES_FOR_SERIES = 50;
export const SERIES_UNIQUE_RATIO_THRESHOLD = 0.5;
export const IDEAL_SERIES_UNIQUE_COUNT = 7.5;
export const MIN_SERIES_UNIQUE_COUNT = 2;
export const MAX_SERIES_UNIQUE_COUNT = 20;
export const NUMERIC_RATIO_THRESHOLD = 0.8; // 80% of values must be numeric

// Date Parsing
export const TIMESTAMP_THRESHOLD = 1000000000; // Values above this are likely timestamps

// Scoring Weights (for computeLabels)
export const SCORE_WEIGHTS = {
  TIME_FIELD_X: 150,
  VALUE_FIELD_Y: 150,
  NUMERIC_BONUS: 50,
  UNIQUE_COUNT_BONUS: 30,
  TIME_FIELD_Y_PENALTY: -100,
  VALUE_FIELD_X_PENALTY: -50,
};

// Color Palette
export const COLOR_PALETTE = [
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
