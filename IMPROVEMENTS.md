# Suggested Improvements and Bugfixes

## 🐛 Critical Bugfixes

### 1. **Memory Leaks - Missing Cleanup for Fetch Requests**
**Location:** `src/GovDataChart.js` (multiple useEffect hooks)
**Issue:** Fetch requests are not cancelled when component unmounts or dependencies change
**Fix:**
```javascript
useEffect(() => {
  const abortController = new AbortController();
  
  fetch(url, { signal: abortController.signal })
    .then(...)
    .catch(err => {
      if (err.name !== 'AbortError') {
        // Handle error
      }
    });
  
  return () => abortController.abort();
}, [dependencies]);
```

### 2. **Race Conditions in State Updates**
**Location:** `src/GovDataChart.js` - Multiple useEffect hooks updating state
**Issue:** When resourceID changes rapidly, multiple fetches can complete out of order
**Fix:** Add request tracking:
```javascript
useEffect(() => {
  if (!resourceID) return;
  
  let cancelled = false;
  setIsLoaded(false);
  
  fetch(url)
    .then(res => {
      if (cancelled) return;
      // Process data
    });
  
  return () => { cancelled = true; };
}, [resourceID, limit]);
```

### 3. **Potential Division by Zero in Domain Calculation**
**Location:** `src/utils.js` - `calculateDomain` function
**Issue:** If all values are the same, range is 0, which could cause issues
**Current:** Handled but could be more robust

### 4. **Date Parsing Edge Cases**
**Location:** `src/utils.js` - `parseDate` function
**Issue:** May fail with unexpected date formats or invalid dates
**Fix:** Add more validation and fallback handling

## ⚡ Performance Improvements

### 1. **Excessive Console Logging**
**Issue:** 131 console.log statements throughout codebase
**Impact:** Performance degradation, especially in production
**Fix:** 
- Remove or gate behind environment variable:
```javascript
const DEBUG = process.env.NODE_ENV === 'development';
const log = DEBUG ? console.log : () => {};
```

### 2. **No Memoization for Expensive Computations**
**Location:** `src/GovDataChart.js` - Dataset processing
**Issue:** Recomputes dataset on every render even when inputs haven't changed
**Fix:** Use `useMemo`:
```javascript
const processedDataset = useMemo(() => {
  // Expensive computation
  return processData(result, xKey, yKey, series);
}, [result, xKey, yKey, series, sumData]);
```

### 3. **Large Dataset Processing**
**Issue:** Processing all records at once can freeze UI
**Fix:** 
- Add pagination or chunking
- Use Web Workers for heavy computations
- Add progress indicators

### 4. **No Debouncing for Rapid Changes**
**Location:** `src/ChartSettings.js` - Form inputs
**Issue:** Changing limit slider rapidly triggers multiple fetches
**Fix:** Add debouncing:
```javascript
const debouncedLimit = useDebounce(limit, 500);
useEffect(() => {
  // Fetch with debouncedLimit
}, [debouncedLimit]);
```

## 🎨 UX Improvements

### 1. **Loading States**
**Issue:** No visual feedback when fetching datasets list
**Fix:** Add loading spinner for initial dataset list fetch

### 2. **Error Recovery**
**Issue:** No retry button for failed API calls
**Fix:** Add retry functionality to error messages

### 3. **Random Dataset Selection**
**Location:** `src/GovDataChart.js` line 411
**Issue:** Randomly selects dataset which might confuse users
**Fix:** Select first dataset or remember last selection:
```javascript
// Instead of random
let newResourceID = resourceIDs[0];
// Or use localStorage to remember last selection
```

### 4. **Chart Settings Reset**
**Issue:** No way to reset chart settings to defaults
**Fix:** Add "Reset to Defaults" button

### 5. **Empty State Handling**
**Issue:** Poor messaging when no data is available
**Fix:** Add helpful empty states with suggestions

### 6. **Legend Truncation**
**Issue:** Long series names can break layout
**Fix:** Already partially addressed, but could add tooltips for full names

## 🔧 Code Quality Improvements

### 1. **Extract Constants**
**Location:** Multiple files
**Issue:** Magic numbers and strings scattered throughout
**Fix:**
```javascript
// constants.js
export const API_BASE_URL = 'https://api-production.data.gov.sg/v2/public/api';
export const MAX_PAGES_TO_FETCH = 50;
export const DEFAULT_LIMIT = 2000;
export const LEGEND_MAX_HEIGHT = 100;
```

### 2. **Error Boundary Component**
**Issue:** No error boundaries to catch React errors
**Fix:** Add ErrorBoundary component:
```javascript
class ErrorBoundary extends React.Component {
  // Implementation
}
```

### 3. **Prop Validation**
**Issue:** No PropTypes or TypeScript for type checking
**Fix:** Add PropTypes or migrate to TypeScript

### 4. **Extract Custom Hooks**
**Location:** `src/GovDataChart.js`
**Issue:** Large component with multiple responsibilities
**Fix:** Extract hooks:
- `useDatasetFetch(resourceID, limit)`
- `useDatasetProcessing(result, xKey, yKey, series)`
- `useAutoChartConfig(fields, records)`

### 5. **Consistent Error Handling**
**Issue:** Inconsistent error handling patterns
**Fix:** Create error handling utility:
```javascript
// utils/errorHandler.js
export function handleApiError(error, context) {
  // Consistent error handling
}
```

## 🐛 Edge Cases & Validation

### 1. **Empty Fields Array**
**Location:** `src/GovDataChart.js` - Field inference
**Issue:** If API doesn't provide fields, inference might fail
**Current:** Handled but could be more robust

### 2. **Invalid Numeric Values**
**Location:** `src/utils.js` - `parseFloatOrText`
**Issue:** May not handle all edge cases (NaN, Infinity, etc.)
**Fix:** Add validation:
```javascript
export function parseFloatOrText(value) {
  if (value === null || value === undefined) return value;
  const num = parseFloat(value);
  if (isNaN(num) || !isFinite(num)) return value;
  return num;
}
```

### 3. **Very Large Datasets**
**Issue:** No limit on dataset size, could cause memory issues
**Fix:** Add maximum record limit and pagination

### 4. **Missing Data Points**
**Issue:** Charts might break with null/undefined values
**Fix:** Filter out invalid data points before rendering

### 5. **Date Range Validation**
**Location:** `src/utils.js` - `parseDate`
**Issue:** Doesn't validate date ranges (e.g., month > 12, day > 31)
**Current:** Partially handled but could be stricter

## 🚀 Feature Enhancements

### 1. **Export Functionality**
**Issue:** No way to export charts or data
**Fix:** Add export to PNG/PDF/CSV

### 2. **Chart Type Toggle**
**Issue:** Chart type is auto-selected, no manual override
**Fix:** Add manual chart type selector in settings

### 3. **Data Filtering**
**Issue:** No way to filter data before visualization
**Fix:** Add filter controls (date range, value range, etc.)

### 4. **Multiple Y-Axes**
**Issue:** Can only visualize one Y-axis at a time
**Fix:** Support multiple Y-axes for different series

### 5. **Chart Annotations**
**Issue:** No way to add notes or annotations
**Fix:** Add annotation tool

### 6. **Save/Load Chart Configurations**
**Issue:** Settings are lost on page refresh
**Fix:** Save to localStorage or allow sharing via URL params

### 7. **Keyboard Shortcuts**
**Issue:** No keyboard navigation
**Fix:** Add shortcuts for common actions

## 📊 Data Quality

### 1. **Data Validation**
**Issue:** No validation of data quality before rendering
**Fix:** Add data quality checks:
- Check for missing values
- Validate data types
- Detect outliers

### 2. **Data Sampling**
**Issue:** Large datasets might be too slow to render
**Fix:** Automatically sample large datasets with option to view full data

## 🔒 Security & Best Practices

### 1. **Input Sanitization**
**Location:** `src/ChartSettings.js` - User inputs
**Issue:** No sanitization of user inputs for domain values
**Fix:** Validate and sanitize all user inputs

### 2. **API Rate Limiting**
**Issue:** No rate limiting protection
**Fix:** Add request throttling and retry with exponential backoff

### 3. **Error Message Sanitization**
**Issue:** Error messages might expose sensitive information
**Fix:** Sanitize error messages before displaying

## 📱 Responsive Design

### 1. **Mobile Optimization**
**Issue:** Chart might not be optimal on mobile devices
**Fix:** 
- Improve touch interactions
- Optimize chart size for mobile
- Better legend layout on small screens

### 2. **Tablet Support**
**Issue:** Layout might not be optimal for tablets
**Fix:** Add tablet-specific breakpoints

## 🧪 Testing

### 1. **Unit Tests**
**Issue:** No unit tests
**Fix:** Add tests for utility functions

### 2. **Integration Tests**
**Issue:** No integration tests
**Fix:** Add tests for component interactions

### 3. **E2E Tests**
**Issue:** No end-to-end tests
**Fix:** Add tests for critical user flows

## 📝 Documentation

### 1. **Code Comments**
**Issue:** Some complex logic lacks comments
**Fix:** Add JSDoc comments for functions

### 2. **README Updates**
**Issue:** README might be outdated
**Fix:** Update with current features and setup instructions

## 🎯 Priority Recommendations

### High Priority (Do First):
1. ✅ Fix memory leaks (AbortController)
2. ✅ Add error boundaries
3. ✅ Remove/reduce console.logs
4. ✅ Add loading states
5. ✅ Fix race conditions

### Medium Priority:
1. Add memoization
2. Improve error handling
3. Add data validation
4. Extract custom hooks
5. Add retry functionality

### Low Priority (Nice to Have):
1. Export functionality
2. Save/load configurations
3. Additional chart types
4. Data filtering
5. Unit tests

