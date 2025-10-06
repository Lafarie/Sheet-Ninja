/**
 * Logger utility for consistent logging across the application
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  info: (message, data = null) => {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, data ? data : '');
    }
  },
  
  warn: (message, data = null) => {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, data ? data : '');
    }
  },
  
  error: (message, error = null) => {
    console.error(`[ERROR] ${message}`, error ? error : '');
  },
  
  debug: (message, data = null) => {
    if (isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data ? data : '');
    }
  },
  
  success: (message, data = null) => {
    if (isDevelopment) {
      console.log(`[SUCCESS] ${message}`, data ? data : '');
    }
  }
};
