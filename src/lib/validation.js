/**
 * Input validation utilities
 */

export const validateRequest = (request, options = {}) => {
  const {
    maxSize = 1024 * 1024, // 1MB default
    requiredFields = [],
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE']
  } = options;

  // Check content length
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSize) {
    return {
      isValid: false,
      error: 'Request too large',
      status: 413
    };
  }

  // Check method
  if (!allowedMethods.includes(request.method)) {
    return {
      isValid: false,
      error: 'Method not allowed',
      status: 405
    };
  }

  return { isValid: true };
};

export const validateGitLabConfig = (config) => {
  const errors = [];
  
  if (!config.gitlabUrl) {
    errors.push('GitLab URL is required');
  } else if (!config.gitlabUrl.startsWith('http')) {
    errors.push('GitLab URL must be a valid URL');
  }
  
  if (!config.gitlabToken) {
    errors.push('GitLab token is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateSheetsConfig = (config) => {
  const errors = [];
  
  if (!config.spreadsheetId) {
    errors.push('Spreadsheet ID is required');
  }
  
  if (!config.worksheetName) {
    errors.push('Worksheet name is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateSyncConfig = (config, projectMappings = []) => {
  const errors = [];
  
  if (!config.gitlabToken) {
    errors.push('GitLab token is required');
  }
  
  if (!config.spreadsheetId) {
    errors.push('Spreadsheet ID is required');
  }
  
  if (!config.worksheetName) {
    errors.push('Worksheet name is required');
  }
  
  if (!config.projectId && (!projectMappings || projectMappings.length === 0)) {
    errors.push('Either Project ID or Project Mappings must be configured');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
