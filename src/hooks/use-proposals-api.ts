import { useState, useEffect, useCallback } from 'react';
import { Proposal, ProposalApiError } from '@/lib/types';
import { useAuth } from './use-auth';
// Firebase imports removidos - não utilizados
// import { getAuth } from 'firebase/auth';
// import { app } from '@/lib/firebase';
import { withRetry, executeWithRecovery, RETRY_CONFIGS } from '@/lib/retry-utils';
import { detectFirestoreError } from '@/lib/error-utils';

interface ProposalType {
  id: string;
  name: string;
  description: string;
}

interface UseProposalsApiOptions {
  type?: string;
  autoFetch?: boolean;
  baseId?: string; // Add support for filtering by baseId
}

interface UseProposalsApiReturn {
  proposals: Proposal[];
  loading: boolean;
  error: string | null;
  apiError: ProposalApiError | null; // Enhanced error information
  fetchProposals: () => Promise<void>;
  createProposal: (proposal: Omit<Proposal, 'id' | 'createdAt' | 'baseId'>) => Promise<Proposal | null>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>; // Manual retry function
  clearError: () => void; // Clear error state
  userContext: AuthContext | null; // Current user context
  isAuthenticated: boolean; // Quick authentication check
  lastFetch: Date | null; // Last successful fetch timestamp
  usedFallback: boolean; // Whether last query used fallback strategy
}

// Helper function to get authentication headers with retry logic
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Firebase authentication temporarily disabled
  // if (!app) {
  //   throw new Error('Firebase app not initialized');
  // }

  // const auth = getAuth(app);
  // const user = auth.currentUser;

  // Firebase authentication temporarily disabled
  // if (!user) {
  //   throw new Error('User not authenticated');
  // }

  // // Use retry logic for token retrieval
  // const tokenResult = await withRetry(
  //   async () => {
  //     const token = await user.getIdToken(true); // Force refresh token
  //     return token;
  //   },
  //   RETRY_CONFIGS.READ,
  //   'get authentication token'
  // );

  // if (!tokenResult.success) {
  //   console.error('Failed to get authentication token after retries:', tokenResult.error);
  //   throw new Error('Authentication failed - unable to retrieve token');
  // }

  // Firebase authentication temporarily disabled
  // headers['Authorization'] = `Bearer ${tokenResult.result}`;
  // headers['X-User-ID'] = user.uid; // Add user ID for server-side filtering
  // headers['X-User-Email'] = user.email || ''; // Add user email for context

  return headers;
}

// Enhanced authentication context management
interface AuthContext {
  userId: string;
  email?: string;
  isAuthenticated: boolean;
  token?: string;
}

// Helper function to get comprehensive user context
async function getUserContext(): Promise<AuthContext | null> {
  // Firebase authentication temporarily disabled
  // if (!app) {
  //   console.warn('Firebase app not initialized');
  //   return null;
  // }

  // const auth = getAuth(app);
  // const user = auth.currentUser;

  // Firebase authentication temporarily disabled
  // if (!user) {
  //   return null;
  // }

  // try {
  //   const tokenResult = await withRetry(
  //     async () => {
  //       const token = await user.getIdToken(false); // Use cached token first
  //       return token;
  //     },
  //     RETRY_CONFIGS.READ,
  //     'get user context token'
  //   );

  //   if (!tokenResult.success) {
  //     console.error('Failed to get user context token:', tokenResult.error);
  //     return null;
  //   }

  // Firebase authentication temporarily disabled
  //   return {
  //     userId: user.uid,
  //     email: user.email || undefined,
  //     isAuthenticated: true,
  //     token: tokenResult.result
  //   };
  // } catch (error) {
  //   console.error('Error getting user context:', error);
  //   return null;
  // }
  
  return null;
}

// Helper function to get current user ID
function getCurrentUserId(): string | null {
  // Firebase authentication temporarily disabled
  // if (!app) return null;
  
  // const auth = getAuth(app);
  // return auth.currentUser?.uid || null;
  return null;
}

// Hook for managing proposal types with enhanced error handling
export function useProposalTypes() {
  const [types, setTypes] = useState<ProposalType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ProposalApiError | null>(null);
  const { user } = useAuth();

  const clearError = useCallback(() => {
    setError(null);
    setApiError(null);
  }, []);

  const fetchTypes = useCallback(async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    clearError();

    try {
      const result = await executeWithRecovery(
        async () => {
          const headers = await getAuthHeaders();
          const response = await fetch('/api/proposals/types', {
            headers,
          });

          if (!response.ok) {
            let errorData: ProposalApiError;
            try {
              errorData = await response.json();
            } catch {
              errorData = {
                error: 'Request Failed',
                message: `HTTP ${response.status}: ${response.statusText}`,
                code: 'UNKNOWN_ERROR',
                timestamp: new Date().toISOString()
              };
            }
            
            setApiError(errorData);
            throw new Error(errorData.message || `HTTP ${response.status}`);
          }

          const data = await response.json();
          return data.types;
        },
        'READ',
        'fetch proposal types'
      );

      setTypes(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch proposal types';
      setError(errorMessage);
      console.error('Error fetching proposal types:', err);
      
      if (!apiError) {
        const detectedError = detectFirestoreError(err);
        setApiError({
          error: detectedError.code,
          message: detectedError.message,
          code: detectedError.code,
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user, apiError, clearError]);

  const retry = useCallback(async () => {
    clearError();
    await fetchTypes();
  }, [fetchTypes, clearError]);

  useEffect(() => {
    if (user) {
      fetchTypes();
    }
  }, [user, fetchTypes]);

  return { 
    types, 
    loading, 
    error, 
    apiError,
    refresh: fetchTypes,
    retry,
    clearError
  };
}

export function useProposalsApi(options: UseProposalsApiOptions = {}): UseProposalsApiReturn {
  const { type, autoFetch = true, baseId } = options;
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ProposalApiError | null>(null);
  const [userContext, setUserContext] = useState<AuthContext | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const { user } = useAuth();

  // Update user context when auth state changes
  useEffect(() => {
    const updateUserContext = async () => {
      if (user) {
        const context = await getUserContext();
        setUserContext(context);
      } else {
        setUserContext(null);
      }
    };

    updateUserContext();
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
    setApiError(null);
  }, []);

  const fetchProposals = useCallback(async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    clearError();

    try {
      const result = await executeWithRecovery(
        async () => {
          const url = new URL('/api/proposals', window.location.origin);
          
          // Add query parameters for user-specific filtering
          if (type) {
            url.searchParams.set('type', type);
          }
          if (baseId) {
            url.searchParams.set('baseId', baseId);
          }
          
          // Add user ID for server-side filtering (redundant with auth header but explicit)
          const userId = getCurrentUserId();
          if (userId) {
            url.searchParams.set('userId', userId);
          }

          const headers = await getAuthHeaders();
          const response = await fetch(url.toString(), {
            headers,
          });

          // Log response headers for debugging and track fallback usage
          const requestId = response.headers.get('X-Request-ID');
          const responseTime = response.headers.get('X-Response-Time');
          const resultCount = response.headers.get('X-Result-Count');
          const fallbackUsed = response.headers.get('X-Fallback-Used') === 'true';
          const fallbackType = response.headers.get('X-Fallback-Type');
          const performanceImpact = response.headers.get('X-Performance-Impact');
          
          // Update fallback state
          setUsedFallback(fallbackUsed);
          
          if (requestId || responseTime) {
            console.log('[CLIENT] Proposals fetch response:', {
              requestId,
              responseTime: responseTime ? `${responseTime}ms` : undefined,
              resultCount,
              fallbackUsed,
              fallbackType,
              performanceImpact,
              status: response.status,
              timestamp: new Date().toISOString()
            });
          }

          if (!response.ok) {
            let errorData: ProposalApiError;
            try {
              errorData = await response.json();
            } catch {
              // Fallback for non-JSON error responses
              errorData = {
                error: 'Request Failed',
                message: `HTTP ${response.status}: ${response.statusText}`,
                code: 'UNKNOWN_ERROR',
                timestamp: new Date().toISOString()
              };
            }
            
            // Set structured error information
            setApiError(errorData);
            throw new Error(errorData.message || `HTTP ${response.status}`);
          }

          const data = await response.json();
          return data;
        },
        'query',
        'fetch proposals'
      );

      setProposals(result);
      setLastFetch(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch proposals';
      setError(errorMessage);
      console.error('Error fetching proposals:', err);
      
      // If we don't already have structured error info, create it
      if (!apiError) {
        const detectedError = detectFirestoreError(err);
        setApiError({
          error: detectedError.code,
          message: detectedError.message,
          code: detectedError.code,
          timestamp: new Date().toISOString()
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user, type, baseId, apiError, clearError]);

  const createProposal = useCallback(async (proposalData: Omit<Proposal, 'id' | 'createdAt' | 'baseId'>): Promise<Proposal | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setLoading(true);
    clearError();

    try {
      const result = await executeWithRecovery(
        async () => {
          const headers = await getAuthHeaders();
          
          // Ensure user ID is set correctly
          const userId = getCurrentUserId();
          const proposalWithUser = {
            ...proposalData,
            type: type || proposalData.type || 'GENERAL',
            createdBy: userId || proposalData.createdBy // Use current user ID
          };

          const response = await fetch('/api/proposals', {
            method: 'POST',
            headers,
            body: JSON.stringify(proposalWithUser),
          });

          // Log response headers for debugging
          const requestId = response.headers.get('X-Request-ID');
          const responseTime = response.headers.get('X-Response-Time');
          const documentId = response.headers.get('X-Document-ID');
          const baseId = response.headers.get('X-Base-ID');
          
          if (requestId || responseTime) {
            console.log('[CLIENT] Proposal creation response:', {
              requestId,
              responseTime: responseTime ? `${responseTime}ms` : undefined,
              documentId,
              baseId,
              status: response.status,
              timestamp: new Date().toISOString()
            });
          }

          if (!response.ok) {
            let errorData: ProposalApiError;
            try {
              errorData = await response.json();
            } catch {
              errorData = {
                error: 'Request Failed',
                message: `HTTP ${response.status}: ${response.statusText}`,
                code: 'UNKNOWN_ERROR',
                timestamp: new Date().toISOString()
              };
            }
            
            setApiError(errorData);
            throw new Error(errorData.message || `HTTP ${response.status}`);
          }

          const createdProposal = await response.json();
          return createdProposal;
        },
        'write',
        'create proposal'
      );

      // Add the new proposal to the current list
      setProposals(prev => [result, ...prev]);
      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create proposal';
      setError(errorMessage);
      console.error('Error creating proposal:', err);
      
      if (!apiError) {
        const detectedError = detectFirestoreError(err);
        setApiError({
          error: detectedError.code,
          message: detectedError.message,
          code: detectedError.code,
          timestamp: new Date().toISOString()
        });
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, type, apiError, clearError]);

  const refresh = useCallback(async () => {
    await fetchProposals();
  }, [fetchProposals]);

  const retry = useCallback(async () => {
    clearError();
    await fetchProposals();
  }, [fetchProposals, clearError]);

  useEffect(() => {
    if (autoFetch && user) {
      fetchProposals();
    }
  }, [autoFetch, user, fetchProposals]);

  return {
    proposals,
    loading,
    error,
    apiError,
    fetchProposals,
    createProposal,
    refresh,
    retry,
    clearError,
    userContext,
    isAuthenticated: !!userContext?.isAuthenticated,
    lastFetch,
    usedFallback,
  };
}

// Example usage in a component:
/*
function MyComponent() {
  const { 
    proposals, 
    loading, 
    error,
    apiError,
    createProposal,
    retry,
    clearError
  } = useProposalsApi({ 
    type: 'FIBER',
    baseId: 'Prop_MV_0001/2025' // Optional: filter by specific base proposal
  });

  const { 
    types, 
    loading: typesLoading,
    error: typesError,
    apiError: typesApiError,
    retry: retryTypes
  } = useProposalTypes();

  const handleCreateProposal = async () => {
    const newProposal = await createProposal({
      title: 'New Fiber Proposal',
      client: 'Client Name',
      // createdBy is automatically set to current user
      type: 'FIBER',
      value: 1000,
      status: 'Rascunho',
      accountManager: 'Manager Name',
      distributorId: 'dist-123',
      date: '2025-01-09',
      expiryDate: '2025-02-08',
      version: 1,
    });

    if (newProposal) {
      console.log('Proposal created:', newProposal);
    }
  };

  const handleRetry = () => {
    if (error || apiError) {
      retry();
    }
    if (typesError || typesApiError) {
      retryTypes();
    }
  };

  if (loading || typesLoading) return <div>Loading...</div>;
  
  // Enhanced error handling with retry options
  if (error || typesError) {
    return (
      <div>
        <div>Error: {error || typesError}</div>
        {(apiError?.code === 'INDEX_MISSING' || typesApiError?.code === 'INDEX_MISSING') && (
          <div>
            <p>Database index required. Please contact your administrator.</p>
            {(apiError?.details?.indexUrl || typesApiError?.details?.indexUrl) && (
              <a href={apiError?.details?.indexUrl || typesApiError?.details?.indexUrl} target="_blank">
                Create Index in Firebase Console
              </a>
            )}
          </div>
        )}
        <button onClick={handleRetry}>Retry</button>
        <button onClick={clearError}>Dismiss</button>
      </div>
    );
  }

  return (
    <div>
      <select>
        {types.map(type => (
          <option key={type.id} value={type.id}>
            {type.name} - {type.description}
          </option>
        ))}
      </select>
      <button onClick={handleCreateProposal}>Create Proposal</button>
      {proposals.map(proposal => (
        <div key={proposal.id}>
          {proposal.title} ({proposal.type}) - Created by: {proposal.createdBy}
        </div>
      ))}
    </div>
  );
}
*/