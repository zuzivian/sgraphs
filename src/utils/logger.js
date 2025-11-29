// Centralized logging utility
// Only logs in development mode or when DEBUG is enabled
const DEBUG = process.env.NODE_ENV === 'development' || 
              (typeof window !== 'undefined' && window.localStorage?.getItem('DEBUG') === 'true');

export const logger = {
  log: (...args) => {
    if (DEBUG) console.log(...args);
  },
  error: (...args) => {
    // Always log errors, even in production
    console.error(...args);
  },
  warn: (...args) => {
    if (DEBUG) console.warn(...args);
  },
  info: (...args) => {
    if (DEBUG) console.info(...args);
  },
  debug: (...args) => {
    if (DEBUG) console.debug(...args);
  },
};

// Helper for verbose logging (only in development)
export const verboseLog = (...args) => {
  if (DEBUG && (typeof window !== 'undefined' && window.localStorage?.getItem('VERBOSE') === 'true')) {
    console.log(...args);
  }
};

