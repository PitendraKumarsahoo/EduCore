import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatUserFriendlyError(error: unknown, fallback = 'Operation could not be completed.'): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('permission-denied') || raw.includes('Missing or insufficient permissions')) {
    return 'You do not have permission to perform this action.';
  }
  if (raw.includes('Quota exceeded')) {
    return 'Database daily quota exceeded. Please try again later or upgrade your Firebase plan.';
  }
  if (raw.includes('offline') || raw.includes('network')) {
    return 'Network connection unavailable. Please check your internet connection.';
  }
  try {
    const parsed = JSON.parse(raw) as FirestoreErrorInfo;
    if (parsed.error) {
      if (parsed.error.includes('permission-denied') || parsed.error.includes('Missing or insufficient permissions')) {
        return 'Access denied: your account lacks permissions for this record.';
      }
      return parsed.error;
    }
  } catch {
    // non-JSON error
  }
  return raw || fallback;
}
