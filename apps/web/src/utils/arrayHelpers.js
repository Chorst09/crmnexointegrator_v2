/**
 * Safe array filter utility
 * Returns empty array if input is not an array
 */
export const safeFilter = (arr, predicate) => {
  if (!Array.isArray(arr)) {
    console.warn('safeFilter: Expected array but got', typeof arr, arr);
    return [];
  }
  return arr.filter(predicate);
};

/**
 * Safe array map utility
 * Returns empty array if input is not an array
 */
export const safeMap = (arr, mapper) => {
  if (!Array.isArray(arr)) {
    console.warn('safeMap: Expected array but got', typeof arr, arr);
    return [];
  }
  return arr.map(mapper);
};

/**
 * Safe array reduce utility
 * Returns initial value if input is not an array
 */
export const safeReduce = (arr, reducer, initialValue) => {
  if (!Array.isArray(arr)) {
    console.warn('safeReduce: Expected array but got', typeof arr, arr);
    return initialValue;
  }
  return arr.reduce(reducer, initialValue);
};

/**
 * Safe array length check
 */
export const safeLength = (arr) => {
  return Array.isArray(arr) ? arr.length : 0;
};

/**
 * Safe array includes check
 */
export const safeIncludes = (arr, item) => {
  return Array.isArray(arr) && arr.includes(item);
};
