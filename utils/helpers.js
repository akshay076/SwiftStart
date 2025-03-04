// utils/helpers.js

/**
 * Generate a unique ID
 * @returns {string} - A unique ID
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }
  
  /**
   * Delay execution for a specified time
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Format a date to a human-readable string
   * @param {Date|string|number} date - The date to format
   * @param {string} format - The format to use (default, short, long)
   * @returns {string} - Formatted date string
   */
  function formatDate(date, format = 'default') {
    const d = new Date(date);
    
    // Return empty string for invalid dates
    if (isNaN(d.getTime())) {
      return '';
    }
    
    switch (format) {
      case 'short':
        return d.toLocaleDateString();
      case 'long':
        return d.toLocaleDateString(undefined, { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'time':
        return d.toLocaleTimeString();
      case 'datetime':
        return d.toLocaleString();
      default:
        return d.toLocaleDateString();
    }
  }
  
  /**
   * Safely parse JSON
   * @param {string} str - The string to parse
   * @param {*} fallback - Value to return if parsing fails
   * @returns {*} - Parsed object or fallback value
   */
  function safeJsonParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch (error) {
      console.error('JSON parse error:', error.message);
      return fallback;
    }
  }
  
  /**
   * Truncate a string to a maximum length
   * @param {string} str - The string to truncate
   * @param {number} maxLength - Maximum length
   * @param {string} suffix - Suffix to add when truncated
   * @returns {string} - Truncated string
   */
  function truncateString(str, maxLength = 100, suffix = '...') {
    if (!str || str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength - suffix.length) + suffix;
  }
  
  /**
   * Check if a value is empty (null, undefined, empty string, empty array, empty object)
   * @param {*} value - Value to check
   * @returns {boolean} - True if empty, false otherwise
   */
  function isEmpty(value) {
    if (value === null || value === undefined) {
      return true;
    }
    
    if (typeof value === 'string' && value.trim() === '') {
      return true;
    }
    
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
    
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Remove HTML tags from a string
   * @param {string} html - String containing HTML
   * @returns {string} - String with HTML tags removed
   */
  function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '');
  }
  
  module.exports = {
    generateUniqueId,
    delay,
    formatDate,
    safeJsonParse,
    truncateString,
    isEmpty,
    stripHtml
  };