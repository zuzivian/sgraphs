

// Helper function to detect if a field name suggests it's a time/date field
function isTimeField(fieldName) {
  const timeKeywords = [
    "year", "month", "date", "time", "timestamp", "day", "week",
    "quarter", "period", "datetime", "created", "updated", "when"
  ];
  const lowerName = fieldName.toLowerCase();
  return timeKeywords.some(keyword => lowerName.includes(keyword));
}

// Helper function to detect if a field name suggests it's a numeric value field
function isValueField(fieldName) {
  const valueKeywords = [
    "value", "amount", "count", "total", "sum", "number", "quantity",
    "population", "energy", "power", "consumption", "production",
    "revenue", "cost", "price", "rate", "percentage", "percent",
    "score", "rating", "index", "level", "volume", "capacity"
  ];
  const lowerName = fieldName.toLowerCase();
  return valueKeywords.some(keyword => lowerName.includes(keyword));
}

// Helper function to analyze field type and content
function analyzeField(field, records) {
  const fieldName = field.id;
  const samples = records.slice(0, Math.min(100, records.length)).map(r => r[fieldName]);
  const numericCount = samples.filter(v => isFloatOrInt(v)).length;
  const uniqueCount = new Set(samples).size;
  const isNumeric = numericCount / samples.length > 0.8; // 80% numeric
  const isTime = isTimeField(fieldName);
  const isValue = isValueField(fieldName);
  
  return {
    name: fieldName,
    isNumeric,
    isTime,
    isValue,
    uniqueCount,
    numericRatio: numericCount / samples.length,
    sample: samples[0]
  };
}

export function computeLabels(fields, records) {
  let temp_x,
    temp_y,
    temp_series = null;

  // Validate inputs
  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    console.error("computeLabels: fields is empty or invalid", fields);
    throw new Error("Fields array is empty or invalid");
  }
  if (!records || !Array.isArray(records) || records.length === 0) {
    console.error("computeLabels: records is empty or invalid", records);
    throw new Error("Records array is empty or invalid");
  }

  console.log("=== ANALYZING FIELDS FOR AUTO-SELECTION ===");
  
  // Analyze all fields
  const fieldAnalyses = fields
    .filter(f => f && f.id && records[0] && records[0][f.id] !== undefined)
    .map(f => analyzeField(f, records));
  
  console.log("Field analyses:", fieldAnalyses.map(f => ({
    name: f.name,
    isNumeric: f.isNumeric,
    isTime: f.isTime,
    isValue: f.isValue,
    uniqueCount: f.uniqueCount
  })));

  // Score all fields for their suitability as X-axis or Y-axis
  // X-axis: prefer time fields, fields with many unique values, categorical fields
  // Y-axis: prefer value fields, numeric fields, fields that represent measurable quantities
  const xScores = fieldAnalyses.map(f => {
    let score = 0;
    // Time fields are excellent for x-axis
    if (f.isTime) score += 150;
    // More unique values = better for x-axis (shows distribution)
    score += Math.min(f.uniqueCount / records.length * 60, 60);
    // Prefer fields with "year", "date", "time" in name
    const lowerName = f.name.toLowerCase();
    if (lowerName.includes("year") || lowerName.includes("date")) score += 40;
    if (lowerName.includes("time") || lowerName.includes("period")) score += 30;
    if (lowerName.includes("month") || lowerName.includes("day")) score += 25;
    // Numeric fields can be good for x-axis if they have many unique values
    if (f.isNumeric && f.uniqueCount > records.length * 0.5) score += 15;
    // Strongly penalize value fields for x-axis (they're much better for y-axis)
    if (f.isValue) score -= 80;
    // Prefer non-numeric or categorical fields for x-axis
    if (!f.isNumeric && f.uniqueCount > 1) score += 20;
    return { ...f, xScore: score };
  });

  const yScores = fieldAnalyses.map(f => {
    let score = 0;
    // Value fields are excellent for y-axis
    if (f.isValue) score += 150;
    // Numeric fields are essential for y-axis
    if (f.isNumeric) score += 80;
    // Higher numeric ratio = better
    score += f.numericRatio * 40;
    // Strongly penalize time fields for y-axis (they're much better for x-axis)
    if (f.isTime) score -= 100;
    // Prefer fields with moderate unique values for y-axis (measured values, not categories)
    // But not too few (avoid constant values) or too many (avoid categorical)
    if (f.uniqueCount > 1 && f.uniqueCount < records.length * 0.7) {
      score += 15;
    }
    // Penalize fields with too many unique values (likely categorical, better for x)
    if (f.uniqueCount > records.length * 0.9) {
      score -= 30;
    }
    // Prefer fields with value-related keywords
    const lowerName = f.name.toLowerCase();
    if (lowerName.includes("value") || lowerName.includes("amount") || 
        lowerName.includes("count") || lowerName.includes("total") ||
        lowerName.includes("number") || lowerName.includes("quantity")) {
      score += 30;
    }
    return { ...f, yScore: score };
  });

  // Step 1: Choose X-axis (highest xScore)
  const sortedByX = [...xScores].sort((a, b) => b.xScore - a.xScore);
  temp_x = sortedByX[0]?.name;

  // Step 2: Choose Y-axis (highest yScore, but MUST be different from x)
  // First, ensure we have at least 2 fields
  if (fieldAnalyses.length < 2) {
    console.warn("Only one field available, cannot set different x and y axes");
    temp_y = fieldAnalyses[0]?.name || temp_x;
  } else {
    // Get the x-axis field info to avoid selecting similar fields
    const xField = fieldAnalyses.find(f => f.name === temp_x);
    
    // Filter out the selected x-axis and find best y-axis
    // Also strongly prefer non-time fields for y-axis (time fields are better for x)
    console.log("Selecting Y-axis. temp_x:", temp_x, "xField.isTime:", xField?.isTime);
    const sortedByY = yScores
      .filter(f => {
        // CRITICAL: Must be different from x (use strict string comparison)
        const nameMatches = f.name === temp_x || String(f.name).trim() === String(temp_x).trim();
        if (nameMatches) {
          console.log(`Filtering out ${f.name} because it matches temp_x ${temp_x}`);
          return false;
        }
        // If x is a time field, strongly prefer non-time fields for y
        if (xField && xField.isTime && f.isTime) {
          // Only allow time field for y if there are no other options
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // If x is time, heavily penalize time fields for y
        if (xField && xField.isTime) {
          if (a.isTime !== b.isTime) {
            return a.isTime ? 1 : -1; // Non-time fields first
          }
        }
        return b.yScore - a.yScore;
      });
    
    console.log("Y-axis candidates after filtering:", sortedByY.map(f => f.name));
    
    if (sortedByY.length > 0) {
      temp_y = sortedByY[0].name;
      console.log("Selected temp_y:", temp_y, "temp_x:", temp_x, "areEqual:", temp_y === temp_x);
      // IMMEDIATE CHECK: Verify temp_y is different from temp_x
      if (temp_y === temp_x || String(temp_y).trim() === String(temp_x).trim()) {
        console.error("ERROR: sortedByY[0].name equals temp_x! This should not happen.");
        console.error("temp_x:", temp_x, "temp_y:", temp_y, "sortedByY:", sortedByY.map(f => f.name));
        // Force to next available field
        const nextField = sortedByY.length > 1 ? sortedByY[1].name : null;
        if (nextField && nextField !== temp_x) {
          temp_y = nextField;
        } else {
          // Find any field different from temp_x
          const differentField = fieldAnalyses.find(f => f.name !== temp_x);
          temp_y = differentField ? differentField.name : fieldAnalyses[1]?.name || fieldAnalyses[0]?.name;
        }
      }
    } else {
      // Fallback: pick any field different from x, prioritizing numeric non-time
      const otherFields = fieldAnalyses.filter(f => {
        if (f.name === temp_x) return false;
        // If x is time, avoid time fields for y
        if (xField && xField.isTime && f.isTime) return false;
        return true;
      });
      
      if (otherFields.length > 0) {
        // Prefer numeric non-time fields if available
        const numericNonTime = otherFields.filter(f => f.isNumeric && !f.isTime);
        if (numericNonTime.length > 0) {
          temp_y = numericNonTime[0].name;
        } else {
          // Prefer numeric fields
          const numericOther = otherFields.filter(f => f.isNumeric);
          if (numericOther.length > 0) {
            temp_y = numericOther[0].name;
          } else {
            // Any field different from x (and not time if x is time)
            temp_y = otherFields[0].name;
          }
        }
      } else {
        // Last resort: if x is time and all other fields are time, pick the first different one
        const anyDifferent = fieldAnalyses.find(f => f.name !== temp_x);
        temp_y = anyDifferent ? anyDifferent.name : fieldAnalyses[1]?.name || fieldAnalyses[0]?.name;
      }
      
      // VERIFY: Ensure temp_y is different from temp_x after fallback
      if (temp_y === temp_x && fieldAnalyses.length >= 2) {
        console.warn("temp_y equals temp_x after fallback! Forcing different value...");
        // Force to use first two different fields
        for (let i = 0; i < fieldAnalyses.length; i++) {
          if (fieldAnalyses[i].name !== temp_x) {
            temp_y = fieldAnalyses[i].name;
            console.warn(`Forced temp_y to ${temp_y}`);
            break;
          }
        }
      }
    }
    
    // FINAL VERIFICATION before moving on: x and y MUST be different
    if (temp_x === temp_y && fieldAnalyses.length >= 2) {
      console.error("CRITICAL ERROR: temp_x and temp_y are still the same after all y-axis selection logic!");
      console.error("temp_x:", temp_x, "temp_y:", temp_y);
      console.error("Available fields:", fieldAnalyses.map(f => f.name));
      // Force to first two fields - guaranteed to be different
      temp_x = fieldAnalyses[0].name;
      temp_y = fieldAnalyses[1].name;
      console.warn(`FORCED FIX: x=${temp_x}, y=${temp_y}`);
    }
    
    // Immediate validation: if somehow they're still the same, fix it now
    if (temp_x === temp_y && fieldAnalyses.length >= 2) {
      console.warn("X and Y are the same after selection, fixing immediately...");
      const xFieldInfo = fieldAnalyses.find(f => f.name === temp_x);
      // Find the best alternative
      const alternatives = fieldAnalyses.filter(f => f.name !== temp_x);
      if (alternatives.length > 0) {
        // If x is time, prefer non-time numeric for y
        if (xFieldInfo && xFieldInfo.isTime) {
          const nonTimeNumeric = alternatives.filter(f => !f.isTime && f.isNumeric);
          if (nonTimeNumeric.length > 0) {
            temp_y = nonTimeNumeric[0].name;
          } else {
            temp_y = alternatives[0].name;
          }
        } else {
          // If x is not time, prefer time field for x and keep current as y, or pick any different
          const timeFields = alternatives.filter(f => f.isTime);
          if (timeFields.length > 0) {
            temp_x = timeFields[0].name;
            // Now ensure y is different from new x
            const yAlternatives = fieldAnalyses.filter(f => f.name !== temp_x);
            temp_y = yAlternatives.length > 0 ? yAlternatives[0].name : alternatives[0].name;
          } else {
            temp_y = alternatives[0].name;
          }
        }
      }
    }
  }

  // Final safety check: ensure x and y are ALWAYS different
  // This check happens BEFORE the series selection to catch issues early
  if (temp_x === temp_y && fieldAnalyses.length >= 2) {
    console.warn("X and Y axes were the same after initial selection, attempting to fix...");
    console.warn("temp_x:", temp_x, "temp_y:", temp_y, "fields:", fieldAnalyses.map(f => f.name));
    // Strategy: Find the best complementary pair
    const xField = fieldAnalyses.find(f => f.name === temp_x);
    
    if (xField && xField.isTime) {
      // X is time, find best non-time numeric field for y
      const yCandidates = fieldAnalyses
        .filter(f => f.name !== temp_x && f.isNumeric && !f.isTime)
        .sort((a, b) => {
          // Prefer value fields
          if (a.isValue !== b.isValue) return b.isValue - a.isValue;
          return b.numericRatio - a.numericRatio;
        });
      if (yCandidates.length > 0) {
        temp_y = yCandidates[0].name;
      } else {
        // No numeric non-time fields, pick any different field
        const differentField = fieldAnalyses.find(f => f.name !== temp_x);
        if (differentField) temp_y = differentField.name;
      }
    } else if (xField && xField.isValue) {
      // X is a value field, find a time field for x and use current as y
      const timeCandidates = fieldAnalyses
        .filter(f => f.name !== temp_x && f.isTime)
        .sort((a, b) => b.uniqueCount - a.uniqueCount);
      if (timeCandidates.length > 0) {
        temp_x = timeCandidates[0].name;
        temp_y = xField.name; // Keep the value field as y
      } else {
        // No time fields, find any different field for y
        const differentField = fieldAnalyses.find(f => f.name !== temp_x);
        if (differentField) temp_y = differentField.name;
      }
    } else {
      // X is neither time nor value, try to optimize
      // Find best time field for x, or best value field for y
      const timeFields = fieldAnalyses.filter(f => f.isTime && f.name !== temp_x);
      const valueFields = fieldAnalyses.filter(f => f.isValue && f.name !== temp_x);
      
      if (timeFields.length > 0) {
        // Use time field for x, keep current for y if it's different
        temp_x = timeFields[0].name;
        if (temp_x === temp_y) {
          // Still same, pick any different field for y
          const differentField = fieldAnalyses.find(f => f.name !== temp_x);
          if (differentField) temp_y = differentField.name;
        }
      } else if (valueFields.length > 0) {
        // Use value field for y
        temp_y = valueFields[0].name;
      } else {
        // Last resort: just pick first two different fields
        temp_x = fieldAnalyses[0].name;
        temp_y = fieldAnalyses.length > 1 ? fieldAnalyses[1].name : fieldAnalyses[0].name;
      }
    }
  }

  // Step 3: Choose Series (categorical field with moderate number of unique values)
  // IMPORTANT: If there are only 2 fields total, don't use series (need both for x and y)
  if (fieldAnalyses.length <= 2) {
    // Only 2 fields available - use both for x and y, no series
    temp_series = null;
    console.log("Only 2 fields available - setting series to null (using both fields for x and y)");
  } else {
    // We have more than 2 fields, so we can select a series
    const candidateSeries = fieldAnalyses.filter(f => 
      f.name !== temp_x && 
      f.name !== temp_y &&
      f.name !== "_id" &&
      f.uniqueCount > 1 && 
      f.uniqueCount < Math.min(50, records.length * 0.5) && // Not too many unique values
      f.uniqueCount < records.length * 0.9 // Not too few (not almost all unique)
    );

    if (candidateSeries.length > 0) {
      // Prefer fields with 2-20 unique values (good for series)
      const idealSeries = candidateSeries.filter(f => f.uniqueCount >= 2 && f.uniqueCount <= 20);
      if (idealSeries.length > 0) {
        temp_series = idealSeries.sort((a, b) => {
          // Prefer fields closer to 5-10 unique values
          const aScore = Math.abs(a.uniqueCount - 7.5);
          const bScore = Math.abs(b.uniqueCount - 7.5);
          return aScore - bScore;
        })[0].name;
      } else {
        // Use best candidate
        temp_series = candidateSeries[0].name;
      }
    }
    // If no good series found, temp_series remains null
  }

  // Final validation: ensure x and y are ALWAYS different (absolute guarantee)
  if (temp_x === temp_y && fieldAnalyses.length >= 2) {
    console.error("ERROR: X and Y axes are still the same after all attempts to fix!");
    console.error("Available fields:", fieldAnalyses.map(f => f.name));
    console.error("Current temp_x:", temp_x, "temp_y:", temp_y);
    // Force different axes by using first two fields (guaranteed to be different)
    temp_x = fieldAnalyses[0].name;
    temp_y = fieldAnalyses[1].name;
    console.warn(`Forced different axes: x=${temp_x}, y=${temp_y}`);
  } else if (temp_x === temp_y) {
    console.error("Cannot set different axes - only one field available");
  }
  
  // One more check: if somehow they're still the same, swap with next available
  if (temp_x === temp_y && fieldAnalyses.length >= 2) {
    // This should never happen, but just in case
    for (let i = 0; i < fieldAnalyses.length; i++) {
      if (fieldAnalyses[i].name !== temp_x) {
        temp_y = fieldAnalyses[i].name;
        break;
      }
    }
  }

  // ABSOLUTE FINAL CHECK: Before returning, guarantee they're different
  // This is the last line of defense - if x and y are still the same, force them to be different
  if (temp_x === temp_y && fieldAnalyses.length >= 2) {
    console.error("CRITICAL: X and Y are STILL the same before return! Forcing different values...");
    console.error("temp_x:", temp_x, "temp_y:", temp_y);
    console.error("Available fields:", fieldAnalyses.map(f => f.name));
    
    // Use first two fields - guaranteed to be different if we have 2+ fields
    const firstField = fieldAnalyses[0].name;
    const secondField = fieldAnalyses.length > 1 ? fieldAnalyses[1].name : null;
    
    if (secondField && secondField !== firstField) {
      temp_x = firstField;
      temp_y = secondField;
      console.warn(`ABSOLUTE FIX: x=${temp_x}, y=${temp_y}`);
    } else {
      // Find any field that's different from first
      for (let i = 1; i < fieldAnalyses.length; i++) {
        if (fieldAnalyses[i].name !== firstField) {
          temp_x = firstField;
          temp_y = fieldAnalyses[i].name;
          console.warn(`ABSOLUTE FIX (loop): x=${temp_x}, y=${temp_y}`);
          break;
        }
      }
    }
  }

  // Verify one last time before returning
  if (temp_x === temp_y && fieldAnalyses.length >= 2) {
    console.error("FATAL: Unable to set different x and y axes. Available fields:", 
      fieldAnalyses.map(f => f.name));
    // Last resort: use first two fields
    temp_x = fieldAnalyses[0].name;
    temp_y = fieldAnalyses[1].name;
  }

  console.log("Auto-selected:", { 
    x: temp_x, 
    y: temp_y, 
    series: temp_series,
    xScore: xScores.find(f => f.name === temp_x)?.xScore,
    yScore: yScores.find(f => f.name === temp_y)?.yScore,
    fieldsAnalyzed: fieldAnalyses.length,
    areDifferent: temp_x !== temp_y
  });

  // Final assertion: if we have 2+ fields, x and y MUST be different
  // If they're still the same, throw an error to prevent bad data
  if (fieldAnalyses.length >= 2 && temp_x === temp_y) {
    const errorMsg = `CRITICAL BUG: Cannot set different axes: x=${temp_x}, y=${temp_y}, fields=${fieldAnalyses.map(f => f.name).join(', ')}`;
    console.error(errorMsg);
    // Instead of throwing, force to first two fields as absolute last resort
    temp_x = fieldAnalyses[0].name;
    temp_y = fieldAnalyses[1].name;
    console.error(`FORCED TO FIRST TWO: x=${temp_x}, y=${temp_y}`);
  }

  return [temp_x, temp_y, temp_series];
}

// Function to determine if bar chart is more appropriate than line chart
export function shouldUseBarChart(records, xKey, fields) {
  if (!records || !xKey || records.length === 0) {
    return false;
  }

  // Get x-axis field info
  const xField = fields.find(f => f.id === xKey);
  const xValues = records.map(r => r[xKey]).filter(v => v !== undefined && v !== null);
  
  if (xValues.length === 0) {
    return false;
  }

  // Check if x-axis is a time field (line charts are better for time series)
  if (xField && isTimeField(xField.id)) {
    return false;
  }

  // Count unique values
  const uniqueValues = new Set(xValues);
  const uniqueCount = uniqueValues.size;
  const totalCount = xValues.length;

  // Check if values are numeric
  const numericCount = xValues.filter(v => isFloatOrInt(v)).length;
  const isNumeric = numericCount / totalCount > 0.8; // 80% numeric

  // Bar charts are better for:
  // 1. Categorical data (non-numeric or low unique value count)
  // 2. Discrete values (few unique values relative to total)
  // 3. Non-time fields
  
  // Use bar chart if:
  // - Not numeric, OR
  // - Numeric but has few unique values (< 20) and unique ratio is low (< 50%)
  const shouldUseBar = !isNumeric || (uniqueCount < 20 && uniqueCount / totalCount < 0.5);

  console.log("Chart type decision:", {
    xKey,
    isNumeric,
    uniqueCount,
    totalCount,
    uniqueRatio: uniqueCount / totalCount,
    isTimeField: xField && isTimeField(xField.id),
    shouldUseBar
  });

  return shouldUseBar;
}

// Function to determine if summing is needed
export function shouldSumData(records, xKey, yKey) {
  if (!records || !xKey || !yKey || records.length === 0) {
    return false;
  }

  // Group records by xKey value
  const grouped = {};
  records.forEach(record => {
    const xValue = record[xKey];
    if (xValue !== undefined && xValue !== null) {
      if (!grouped[xValue]) {
        grouped[xValue] = [];
      }
      grouped[xValue].push(record);
    }
  });

  // Check if any xKey value has multiple records with numeric yKey values
  let hasMultipleNumericValues = false;
  for (const xValue in grouped) {
    const groupRecords = grouped[xValue];
    if (groupRecords.length > 1) {
      const numericValues = groupRecords
        .map(r => r[yKey])
        .filter(v => isFloatOrInt(v));
      if (numericValues.length > 1) {
        hasMultipleNumericValues = true;
        break;
      }
    }
  }

  console.log("Should sum data?", {
    xKey,
    yKey,
    hasMultipleNumericValues,
    sampleGroup: Object.keys(grouped).slice(0, 3).map(k => ({
      xValue: k,
      count: grouped[k].length
    }))
  });

  return hasMultipleNumericValues;
}

export function filterResourceIDs(pkgs, org) {
    return [...new Set(pkgs.filter(item => (item.organisation === org)).map(item => item.resource_id))];
}

export function getResourceNamefromID(packages, resID) {
    let resource = Object.values(packages.filter(item => item.resource_id === resID))[0];
    if (!resource) return '';
    return resource.resource_name;
}

export function isFloatOrInt(val) {
    return /^-?\d*(\.\d+)?$/.test(val);
}

export function parseFloatOrText(value) {
    let int = parseFloat(value);
    return isNaN(int) ? value : int;
}

// Check if a value looks like a date string
export function isDateString(value) {
  if (!value || typeof value !== 'string') return false;
  // Check for YYYY-MM, YYYY-MM-DD, YYYY/MM/DD patterns
  return /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$/.test(value) || !isNaN(Date.parse(value));
}

// Parse date strings in various formats (YYYY-MM, YYYY-MM-DD, YYYY/MM/DD, etc.)
export function parseDate(value) {
  if (!value) return null;
  
  // If already a number (timestamp), return it
  if (typeof value === 'number') return value;
  
  if (typeof value !== 'string') return null;
  
  // Try common date formats
  // YYYY-MM (e.g., "1974-03", "1991-10")
  const yearMonthMatch = value.match(/^(\d{4})[-/](\d{1,2})$/);
  if (yearMonthMatch) {
    const year = parseInt(yearMonthMatch[1], 10);
    const month = parseInt(yearMonthMatch[2], 10);
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      return new Date(year, month - 1, 1).getTime();
    }
  }
  
  // YYYY-MM-DD (e.g., "1974-03-15", "1991-10-01")
  const yearMonthDayMatch = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yearMonthDayMatch) {
    const year = parseInt(yearMonthDayMatch[1], 10);
    const month = parseInt(yearMonthDayMatch[2], 10);
    const day = parseInt(yearMonthDayMatch[3], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day).getTime();
    }
  }
  
  // Try standard Date parsing
  const parsed = Date.parse(value);
  if (!isNaN(parsed)) {
    return parsed;
  }
  
  return null;
}

// Compare two values, handling dates, numbers, and strings intelligently
export function compareValues(a, b) {
  // Handle null/undefined
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  
  // Handle numbers
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  
  // Try parsing as numbers
  const aNum = parseFloat(a);
  const bNum = parseFloat(b);
  if (!isNaN(aNum) && !isNaN(bNum) && isFloatOrInt(a) && isFloatOrInt(b)) {
    return aNum - bNum;
  }
  
  // Try parsing as dates
  const aDate = parseDate(String(a));
  const bDate = parseDate(String(b));
  if (aDate !== null && bDate !== null) {
    return aDate - bDate;
  }
  if (aDate !== null) return -1; // Dates come before non-dates
  if (bDate !== null) return 1;
  
  // Fall back to string comparison
  return String(a).localeCompare(String(b));
}

// Calculate intelligent domain ranges from dataset
export function calculateDomain(dataset, xKey, yKey) {
  if (!dataset || !xKey || !yKey || Object.keys(dataset).length === 0) {
    return { xMin: "auto", xMax: "auto", yMin: "auto", yMax: "auto" };
  }

  // Collect all x and y values from all series
  const allXValues = [];
  const allYValues = [];

  Object.keys(dataset).forEach(seriesKey => {
    const seriesData = dataset[seriesKey];
    if (Array.isArray(seriesData)) {
      seriesData.forEach(point => {
        if (point[xKey] !== undefined && point[xKey] !== null) {
          allXValues.push(point[xKey]);
        }
        if (point[yKey] !== undefined && point[yKey] !== null) {
          allYValues.push(point[yKey]);
        }
      });
    }
  });

  // Calculate ranges for X-axis
  let xMin = "auto";
  let xMax = "auto";
  if (allXValues.length > 0) {
    // Check if values are already timestamps (numbers) or need parsing
    const numericX = allXValues.filter(v => typeof v === 'number' || isFloatOrInt(v)).map(v => typeof v === 'number' ? v : parseFloat(v));
    
    // Try to parse as dates first (if not already numeric timestamps)
    const dateX = numericX.length < allXValues.length 
      ? allXValues.map(v => {
          if (typeof v === 'number') return v; // Already a timestamp
          return parseDate(String(v));
        }).filter(d => d !== null)
      : numericX;
    
    if (dateX.length === allXValues.length && dateX.length > 0) {
      // All values are dates/timestamps - use date range
      const xMinDate = Math.min(...dateX);
      const xMaxDate = Math.max(...dateX);
      const xRange = xMaxDate - xMinDate;
      
      if (xRange === 0) {
        xMin = "auto";
        xMax = "auto";
      } else {
        // Add 5% padding in milliseconds
        const xPadding = xRange * 0.05;
        xMin = xMinDate - xPadding;
        xMax = xMaxDate + xPadding;
      }
    } else {
      // Try numeric
      const numericX = allXValues.filter(v => isFloatOrInt(v)).map(v => parseFloat(v));
      if (numericX.length > 0) {
        const xMinVal = Math.min(...numericX);
        const xMaxVal = Math.max(...numericX);
        const xRange = xMaxVal - xMinVal;
        
        if (xRange === 0) {
          // All X values are the same - use auto to let Recharts handle it
          xMin = "auto";
          xMax = "auto";
        } else {
          // Add 5% padding on each side
          const xPadding = xRange * 0.05;
          xMin = xMinVal - xPadding;
          xMax = xMaxVal + xPadding;
        }
      } else {
        // Non-numeric X-axis, use auto
        xMin = "auto";
        xMax = "auto";
      }
    }
  }

  // Calculate ranges for Y-axis with better handling
  let yMin = "auto";
  let yMax = "auto";
  if (allYValues.length > 0) {
    const numericY = allYValues.filter(v => isFloatOrInt(v)).map(v => parseFloat(v));
    if (numericY.length > 0) {
      const yMinVal = Math.min(...numericY);
      const yMaxVal = Math.max(...numericY);
      const yRange = yMaxVal - yMinVal;
      
      if (yRange === 0) {
        // All Y values are the same
        if (yMinVal === 0) {
          // All zeros - show small range
          yMin = 0;
          yMax = 1;
        } else {
          // Constant non-zero value - show range around it
          const padding = Math.abs(yMinVal) * 0.2;
          yMin = yMinVal - padding;
          yMax = yMaxVal + padding;
        }
      } else {
        // Calculate padding based on range
        // Use 10% padding, but ensure minimum visibility
        let yPadding = yRange * 0.1;
        
        // For very small ranges, use absolute padding
        if (yRange < 1) {
          yPadding = Math.max(yRange * 0.2, 0.1);
        }
        
        // For large ranges, use percentage-based padding
        if (yRange > 1000) {
          yPadding = yRange * 0.05; // Smaller padding for large ranges
        }
        
        // Handle zero-crossing: if data spans zero, ensure zero is visible
        if (yMinVal < 0 && yMaxVal > 0) {
          // Data crosses zero - ensure zero is included with padding
          const maxAbs = Math.max(Math.abs(yMinVal), Math.abs(yMaxVal));
          yMin = -maxAbs * 1.1;
          yMax = maxAbs * 1.1;
        } else if (yMinVal >= 0) {
          // All positive values
          // Start from zero if minimum is close to zero, otherwise add padding
          if (yMinVal < yRange * 0.1) {
            yMin = 0;
          } else {
            yMin = Math.max(0, yMinVal - yPadding);
          }
          yMax = yMaxVal + yPadding;
        } else {
          // All negative values
          yMin = yMinVal - yPadding;
          yMax = Math.min(0, yMaxVal + yPadding);
        }
      }
    } else {
      // Non-numeric Y-axis, use auto
      yMin = "auto";
      yMax = "auto";
    }
  }

  console.log("Calculated domain:", { 
    xMin, 
    xMax, 
    yMin, 
    yMax,
    xValuesRange: allXValues.length > 0 ? `${Math.min(...allXValues.filter(v => isFloatOrInt(v)).map(v => parseFloat(v)))} to ${Math.max(...allXValues.filter(v => isFloatOrInt(v)).map(v => parseFloat(v)))}` : "N/A",
    yValuesRange: allYValues.length > 0 ? `${Math.min(...allYValues.filter(v => isFloatOrInt(v)).map(v => parseFloat(v)))} to ${Math.max(...allYValues.filter(v => isFloatOrInt(v)).map(v => parseFloat(v)))}` : "N/A"
  });

  return { xMin, xMax, yMin, yMax };
}