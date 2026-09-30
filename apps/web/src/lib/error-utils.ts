import { NextResponse } from 'next/server';
import { ProposalApiError, ProposalApiErrorCode, ProposalApiErrorDetails, IndexErrorInfo } from './types';
import { logError, type LogContext } from './logging-utils';

/**
 * Enhanced error response utility for Proposals API
 * Provides comprehensive error handling with actionable information
 */

// Generate unique request ID for error tracking
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get project-specific documentation URLs
function getDocumentationUrls() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.com';
  return {
    indexCreation: `${baseUrl}/docs/firestore-indexes`,
    troubleshooting: `${baseUrl}/docs/troubleshooting`,
    apiDocs: `${baseUrl}/docs/api`,
    support: `${baseUrl}/support`
  };
}

// Get Firestore console URL for index creation
function getFirestoreConsoleUrl(collection?: string): string {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const baseUrl = projectId 
    ? `https://console.firebase.google.com/project/${projectId}/firestore/indexes`
    : 'https://console.firebase.google.com/firestore/indexes';
  
  return collection ? `${baseUrl}?collection=${collection}` : baseUrl;
}

// Create standardized error response
export function createProposalApiError(
  status: number,
  code: ProposalApiErrorCode,
  message: string,
  details?: ProposalApiErrorDetails,
  requestId?: string,
  logContext?: LogContext
): NextResponse {
  const error: ProposalApiError = {
    error: getErrorTitle(code),
    message,
    code,
    timestamp: new Date().toISOString(),
    requestId: requestId || generateRequestId(),
    details: enhanceErrorDetails(code, details)
  };

  // Enhanced logging with context
  if (logContext) {
    logError(`API Error: ${code}`, new Error(message), logContext, {
      severity: getSeverityForErrorCode(code),
      suggestedActions: details?.supportContact ? ['Contact support'] : []
    });
  } else {
    // Fallback to console logging
    console.error(`[${error.requestId}] ${code}: ${message}`, details);
  }

  return NextResponse.json(error, { 
    status,
    headers: {
      'X-Request-ID': error.requestId || '',
      'X-Error-Code': code
    }
  });
}

// Get human-readable error title
function getErrorTitle(code: ProposalApiErrorCode): string {
  const titles: Record<ProposalApiErrorCode, string> = {
    INDEX_MISSING: 'Database Index Required',
    PERMISSION_DENIED: 'Access Denied',
    QUOTA_EXCEEDED: 'Service Limit Exceeded',
    VALIDATION_ERROR: 'Invalid Request Data',
    DATABASE_CONNECTION_ERROR: 'Database Unavailable',
    AUTHENTICATION_REQUIRED: 'Authentication Required',
    UNKNOWN_ERROR: 'Internal Server Error'
  };
  
  return titles[code] || 'Unknown Error';
}

// Enhance error details with actionable information
function enhanceErrorDetails(
  code: ProposalApiErrorCode, 
  details?: ProposalApiErrorDetails
): ProposalApiErrorDetails {
  const docs = getDocumentationUrls();
  const enhanced: ProposalApiErrorDetails = { ...details };

  switch (code) {
    case 'INDEX_MISSING':
      enhanced.documentationUrl = docs.indexCreation;
      enhanced.supportContact = docs.support;
      if (!enhanced.indexUrl && details?.requiredFields) {
        enhanced.indexUrl = getFirestoreConsoleUrl('proposals');
      }
      break;

    case 'PERMISSION_DENIED':
      enhanced.documentationUrl = docs.apiDocs;
      enhanced.supportContact = docs.support;
      break;

    case 'QUOTA_EXCEEDED':
      enhanced.retryAfter = enhanced.retryAfter || 300; // 5 minutes default
      enhanced.documentationUrl = docs.troubleshooting;
      break;

    case 'VALIDATION_ERROR':
      enhanced.documentationUrl = docs.apiDocs;
      break;

    case 'DATABASE_CONNECTION_ERROR':
      enhanced.retryAfter = enhanced.retryAfter || 60; // 1 minute default
      enhanced.documentationUrl = docs.troubleshooting;
      enhanced.supportContact = docs.support;
      break;

    case 'AUTHENTICATION_REQUIRED':
      enhanced.documentationUrl = docs.apiDocs;
      break;

    default:
      enhanced.documentationUrl = docs.troubleshooting;
      enhanced.supportContact = docs.support;
  }

  return enhanced;
}

// Create index-specific error response
export function createIndexErrorResponse(
  indexErrorInfo: IndexErrorInfo, 
  originalError: any,
  requestId?: string,
  logContext?: LogContext
): NextResponse {
  const message = createIndexErrorMessage(indexErrorInfo);
  
  const details: ProposalApiErrorDetails = {
    indexUrl: indexErrorInfo.indexUrl,
    requiredFields: indexErrorInfo.missingFields,
    fallbackAvailable: indexErrorInfo.fallbackStrategy !== 'NONE',
    requiredIndexDefinition: generateIndexDefinition(indexErrorInfo)
  };

  return createProposalApiError(500, 'INDEX_MISSING', message, details, requestId, logContext);
}

// Generate user-friendly index error message
function createIndexErrorMessage(indexErrorInfo: IndexErrorInfo): string {
  const { collection = 'proposals', missingFields = [], fallbackStrategy } = indexErrorInfo;
  
  let message = `A database index is required for queries on the '${collection}' collection`;
  
  if (missingFields.length > 0) {
    message += ` involving fields: ${missingFields.join(', ')}`;
  }
  
  message += '. ';
  
  if (fallbackStrategy !== 'NONE') {
    message += 'The system will attempt to use a fallback query, but performance may be reduced. ';
  }
  
  message += 'Please create the required index in the Firestore console or contact your administrator.';
  
  return message;
}

// Generate index definition for documentation
function generateIndexDefinition(indexErrorInfo: IndexErrorInfo): string {
  const { collection = 'proposals', missingFields = [] } = indexErrorInfo;
  
  if (missingFields.length === 0) {
    return 'Index definition could not be determined from error information.';
  }
  
  const fields = missingFields.map(field => {
    // Determine field order based on common patterns
    if (field === 'createdAt' || field.includes('Date')) {
      return `{ "fieldPath": "${field}", "order": "DESCENDING" }`;
    }
    return `{ "fieldPath": "${field}", "order": "ASCENDING" }`;
  }).join(',\n    ');
  
  return `{
  "collectionGroup": "${collection}",
  "queryScope": "COLLECTION",
  "fields": [
    ${fields}
  ]
}`;
}

// Create validation error response
export function createValidationErrorResponse(
  validationErrors: string[],
  requestId?: string,
  logContext?: LogContext
): NextResponse {
  const message = `Request validation failed: ${validationErrors.length} error(s) found`;
  
  const details: ProposalApiErrorDetails = {
    validationErrors
  };

  return createProposalApiError(400, 'VALIDATION_ERROR', message, details, requestId, logContext);
}

// Create authentication error response
export function createAuthenticationErrorResponse(
  message: string = 'Authentication required to access this resource',
  requestId?: string,
  logContext?: LogContext
): NextResponse {
  return createProposalApiError(401, 'AUTHENTICATION_REQUIRED', message, undefined, requestId, logContext);
}

// Create permission denied error response
export function createPermissionDeniedResponse(
  message: string = 'Insufficient permissions to perform this operation',
  requestId?: string,
  logContext?: LogContext
): NextResponse {
  return createProposalApiError(403, 'PERMISSION_DENIED', message, undefined, requestId, logContext);
}

// Create quota exceeded error response
export function createQuotaExceededResponse(
  message: string = 'Service quota exceeded. Please try again later.',
  retryAfter: number = 300,
  requestId?: string,
  logContext?: LogContext
): NextResponse {
  const details: ProposalApiErrorDetails = {
    retryAfter
  };

  return createProposalApiError(429, 'QUOTA_EXCEEDED', message, details, requestId, logContext);
}

// Create database connection error response
export function createDatabaseConnectionErrorResponse(
  message: string = 'Unable to connect to database. Please try again later.',
  requestId?: string,
  logContext?: LogContext
): NextResponse {
  const details: ProposalApiErrorDetails = {
    retryAfter: 60
  };

  return createProposalApiError(500, 'DATABASE_CONNECTION_ERROR', message, details, requestId, logContext);
}

// Create generic internal server error response
export function createInternalServerErrorResponse(
  message: string = 'An unexpected error occurred. Please try again later.',
  originalError?: any,
  requestId?: string,
  logContext?: LogContext
): NextResponse {
  // Enhanced logging with context
  if (logContext && originalError) {
    logError('Internal server error', originalError, logContext, {
      severity: 'HIGH',
      suggestedActions: ['Check error logs', 'Contact support if issue persists']
    });
  } else if (originalError) {
    // Fallback to console logging
    console.error(`[${requestId || 'unknown'}] Internal server error:`, originalError);
  }

  return createProposalApiError(500, 'UNKNOWN_ERROR', message, undefined, requestId, logContext);
}

// Detect and classify Firestore errors
export function detectFirestoreError(error: any): {
  code: ProposalApiErrorCode;
  message: string;
  isRetryable: boolean;
} {
  const errorMessage = error?.message || error?.toString() || '';
  const errorCode = error?.code || '';

  // Index-related errors
  if (isIndexError(error)) {
    return {
      code: 'INDEX_MISSING',
      message: 'Database index required for this query',
      isRetryable: false
    };
  }

  // Permission errors
  if (errorMessage.includes('permission') || errorCode === 'PERMISSION_DENIED') {
    return {
      code: 'PERMISSION_DENIED',
      message: 'Insufficient permissions to access this resource',
      isRetryable: false
    };
  }

  // Quota errors
  if (errorMessage.includes('quota') || errorCode === 'RESOURCE_EXHAUSTED') {
    return {
      code: 'QUOTA_EXCEEDED',
      message: 'Service quota exceeded',
      isRetryable: true
    };
  }

  // Connection errors
  if (errorMessage.includes('connection') || errorMessage.includes('network') || errorCode === 'UNAVAILABLE') {
    return {
      code: 'DATABASE_CONNECTION_ERROR',
      message: 'Database connection failed',
      isRetryable: true
    };
  }

  // Default to unknown error
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    isRetryable: true
  };
}

// Check if error is index-related
function isIndexError(error: any): boolean {
  const errorMessage = error?.message || error?.toString() || '';
  const errorCode = error?.code || '';
  
  const indexErrorPatterns = [
    /requires an index/i,
    /composite index/i,
    /index.*not found/i,
    /missing.*index/i,
    /FAILED_PRECONDITION.*index/i,
    /inequality filter.*requires.*composite index/i
  ];
  
  return indexErrorPatterns.some(pattern => pattern.test(errorMessage)) ||
         errorCode === 'FAILED_PRECONDITION';
}

// Get severity level for error codes
function getSeverityForErrorCode(code: ProposalApiErrorCode): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (code) {
    case 'INDEX_MISSING':
      return 'HIGH';
    case 'PERMISSION_DENIED':
    case 'AUTHENTICATION_REQUIRED':
      return 'MEDIUM';
    case 'QUOTA_EXCEEDED':
      return 'CRITICAL';
    case 'DATABASE_CONNECTION_ERROR':
      return 'HIGH';
    case 'VALIDATION_ERROR':
      return 'LOW';
    case 'UNKNOWN_ERROR':
    default:
      return 'MEDIUM';
  }
}