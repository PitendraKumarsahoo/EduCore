import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { handleFirestoreError, OperationType } from './firestore-error';
import { generateId, nowIso, sanitizeEmailKey } from '../utils/format';
import type {
  AcademicClass,
  AcademicYear,
  AccountingEntry,
  Admission,
  Assignment,
  AssignmentSubmission,
  AttendanceRecord,
  AuditLog,
  CalendarEvent,
  Department,
  DocumentRecord,
  Employee,
  ExamMark,
  Examination,
  FeeCategory,
  FeeStructure,
  Hostel,
  HostelAllocation,
  Institution,
  InstitutionMember,
  LeaveRequest,
  LibraryBook,
  LibraryTransaction,
  MessageItem,
  Notice,
  NotificationItem,
  PaymentRecord,
  Program,
  RoleKey,
  RolePermissionMatrix,
  Section,
  Student,
  StudentFee,
  Subject,
  TimetableSlot,
  TransportRoute,
  UserAccount,
  UserInvite,
} from '../types';

export function cleanPayload<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

export async function getUserAccount(uid: string): Promise<UserAccount | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data() as UserAccount) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function upsertUserAccount(account: UserAccount): Promise<void> {
  const path = `users/${account.uid}`;
  try {
    await setDoc(doc(db, 'users', account.uid), cleanPayload(account as unknown as Record<string, unknown>), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserAccountFields(uid: string, patch: Partial<UserAccount>): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), cleanPayload({ ...patch, updatedAt: nowIso() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function findPendingInvitesForEmail(email: string): Promise<UserInvite[]> {
  const path = 'user_invites';
  try {
    const q = query(
      collection(db, 'user_invites'),
      where('email', '==', email.trim().toLowerCase()),
      where('status', '==', 'pending'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<UserInvite, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function listOwnedOrAllInstitutions(uid: string, isSuperAdmin: boolean): Promise<Institution[]> {
  const path = 'institutions';
  try {
    const q = isSuperAdmin
      ? query(collection(db, 'institutions'))
      : query(collection(db, 'institutions'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Institution);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function getInstitution(instId: string): Promise<Institution | null> {
  const path = `institutions/${instId}`;
  try {
    const snap = await getDoc(doc(db, 'institutions', instId));
    return snap.exists() ? (snap.data() as Institution) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getInstitutionMember(instId: string, uid: string): Promise<InstitutionMember | null> {
  const path = `institutions/${instId}/members/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'institutions', instId, 'members', uid));
    return snap.exists() ? (snap.data() as InstitutionMember) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createInstitutionWithOwner(params: {
  name: string;
  type: Institution['type'];
  code?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  timezone: string;
  currency: string;
  ownerUid: string;
  ownerEmail: string;
  ownerName: string;
  isSuperAdmin: boolean;
}): Promise<{ institution: Institution; member: InstitutionMember }> {
  const instId = generateId('inst');
  const ts = nowIso();
  const institution: Institution = {
    id: instId,
    name: params.name.trim(),
    type: params.type,
    code: params.code?.trim() || undefined,
    address: params.address?.trim() || undefined,
    phone: params.phone?.trim() || undefined,
    email: params.email?.trim() || undefined,
    website: params.website?.trim() || undefined,
    timezone: params.timezone,
    currency: params.currency,
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    gradingScale: [],
    attendanceRules: { minPercentage: 75, allowTeacherEditPastDays: 7 },
    feeRules: { allowPartialPayment: true, allowOverpayment: false, receiptPrefix: 'REC', onlineGatewayConfigured: false },
    staffCategories: [],
    documentTypes: ['ID Proof', 'Previous Marksheet', 'Transfer Certificate', 'Birth Certificate', 'Photograph'],
    setupCompleted: false,
    setupStep: 2,
    ownerUid: params.ownerUid,
    createdAt: ts,
    updatedAt: ts,
  };

  const member: InstitutionMember = {
    uid: params.ownerUid,
    institutionId: instId,
    email: params.ownerEmail,
    displayName: params.ownerName,
    role: params.isSuperAdmin ? 'super_admin' : 'institution_admin',
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  };

  try {
    await setDoc(doc(db, 'institutions', instId), cleanPayload(institution as unknown as Record<string, unknown>));
    await setDoc(doc(db, 'institutions', instId, 'members', params.ownerUid), cleanPayload(member as unknown as Record<string, unknown>));
    await updateUserAccountFields(params.ownerUid, { activeInstitutionId: instId });
    await writeAuditLog(instId, {
      userUid: params.ownerUid,
      userEmail: params.ownerEmail,
      userName: params.ownerName,
      userRole: member.role,
      action: 'create',
      module: 'institutions',
      recordId: instId,
      summary: `Created institution "${institution.name}"`,
    });
    return { institution, member };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `institutions/${instId}`);
  }
}

export async function acceptInviteAndCreateMembership(
  invite: UserInvite,
  uid: string,
  email: string,
  displayName: string,
): Promise<InstitutionMember> {
  const ts = nowIso();
  const member: InstitutionMember = {
    uid,
    institutionId: invite.institutionId,
    email: email.toLowerCase(),
    displayName: invite.displayName || displayName,
    role: invite.role,
    linkedStudentIds: invite.linkedStudentIds,
    linkedEmployeeId: invite.linkedEmployeeId,
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  };
  const path = `institutions/${invite.institutionId}/members/${uid}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'institutions', invite.institutionId, 'members', uid), cleanPayload(member as unknown as Record<string, unknown>));
    batch.update(doc(db, 'user_invites', invite.id), { status: 'accepted', updatedAt: ts });
    batch.update(doc(db, 'users', uid), { activeInstitutionId: invite.institutionId, updatedAt: ts });
    await batch.commit();
    try {
      await updateDoc(doc(db, 'institutions', invite.institutionId, 'invites', invite.id), {
        status: 'accepted',
        updatedAt: ts,
      });
    } catch {
      // Legacy invite without mirror doc; safe to ignore
    }
    return member;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createOrUpdateInvite(params: {
  institutionId: string;
  institutionName: string;
  email: string;
  role: RoleKey;
  displayName?: string;
  linkedStudentIds?: string[];
  linkedEmployeeId?: string;
  createdByUid: string;
}): Promise<UserInvite> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const inviteId = `${params.institutionId}_${sanitizeEmailKey(normalizedEmail)}`;
  const ts = nowIso();
  const invite: Omit<UserInvite, 'id'> = {
    email: normalizedEmail,
    institutionId: params.institutionId,
    institutionName: params.institutionName,
    role: params.role,
    displayName: params.displayName?.trim() || undefined,
    linkedStudentIds: params.linkedStudentIds,
    linkedEmployeeId: params.linkedEmployeeId || undefined,
    status: 'pending',
    createdByUid: params.createdByUid,
    createdAt: ts,
    updatedAt: ts,
  };
  const path = `user_invites/${inviteId}`;
  try {
    const cleaned = cleanPayload(invite as unknown as Record<string, unknown>);
    const batch = writeBatch(db);
    batch.set(doc(db, 'user_invites', inviteId), cleaned);
    batch.set(doc(db, 'institutions', params.institutionId, 'invites', inviteId), cleaned);
    await batch.commit();
    return { ...invite, id: inviteId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeInstCollection<T>(
  instId: string,
  subcollection: string,
  constraints: QueryConstraint[],
  onData: (rows: T[]) => void,
): Unsubscribe {
  const path = `institutions/${instId}/${subcollection}`;
  const q = query(collection(db, 'institutions', instId, subcollection), ...constraints);
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }) as T);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export async function saveInstDoc<T extends Record<string, unknown>>(
  instId: string,
  subcollection: string,
  docId: string,
  data: T,
  isNew = false,
): Promise<void> {
  const path = `institutions/${instId}/${subcollection}/${docId}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'institutions', instId, subcollection, docId), cleanPayload(data));
    } else {
      await updateDoc(doc(db, 'institutions', instId, subcollection, docId), cleanPayload(data));
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function upsertInstDoc<T extends Record<string, unknown>>(
  instId: string,
  subcollection: string,
  docId: string,
  data: T,
): Promise<void> {
  const path = `institutions/${instId}/${subcollection}/${docId}`;
  try {
    await setDoc(doc(db, 'institutions', instId, subcollection, docId), cleanPayload(data), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteInstDoc(instId: string, subcollection: string, docId: string): Promise<void> {
  const path = `institutions/${instId}/${subcollection}/${docId}`;
  try {
    await deleteDoc(doc(db, 'institutions', instId, subcollection, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function updateInstitution(instId: string, patch: Partial<Institution>): Promise<void> {
  const path = `institutions/${instId}`;
  try {
    await updateDoc(doc(db, 'institutions', instId), cleanPayload({ ...patch, updatedAt: nowIso() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function writeAuditLog(
  instId: string,
  entry: Omit<AuditLog, 'id' | 'institutionId' | 'createdAt' | 'deviceInfo'>,
): Promise<void> {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return;
  const logId = generateId('log');
  const payload: Omit<AuditLog, 'id'> = {
    institutionId: instId,
    userUid: currentUid,
    userEmail: entry.userEmail || auth.currentUser?.email || '',
    userName: entry.userName || auth.currentUser?.displayName || '',
    userRole: entry.userRole || '',
    action: entry.action,
    module: entry.module,
    recordId: entry.recordId,
    summary: entry.summary.slice(0, 500),
    deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : 'Web',
    createdAt: nowIso(),
  };
  try {
    await setDoc(doc(db, 'institutions', instId, 'audit_logs', logId), cleanPayload(payload as unknown as Record<string, unknown>));
  } catch (error) {
    console.warn('Audit log write skipped:', error);
  }
}

export async function recordFeePaymentAtomic(params: {
  instId: string;
  fee: StudentFee;
  paymentAmount: number;
  paymentMethod: PaymentRecord['paymentMethod'];
  transactionRef?: string;
  notes?: string;
  recordedByUid: string;
  recordedByName: string;
  receiptPrefix?: string;
}): Promise<PaymentRecord> {
  const ts = nowIso();
  const paymentId = generateId('pay');
  const receiptNumber = `${params.receiptPrefix || 'REC'}-${Date.now().toString().slice(-6)}`;
  const newPaid = Number((params.fee.paidAmount + params.paymentAmount).toFixed(2));
  const netPayable = Math.max(0, params.fee.amount - (params.fee.discountAmount || 0) + (params.fee.lateFeeAmount || 0));
  const newBalance = Math.max(0, Number((netPayable - newPaid).toFixed(2)));
  const newStatus: StudentFee['status'] = newBalance <= 0 ? 'paid' : 'partial';

  const payment: Omit<PaymentRecord, 'id'> = {
    institutionId: params.instId,
    receiptNumber,
    academicYearId: params.fee.academicYearId,
    studentFeeId: params.fee.id,
    studentId: params.fee.studentId,
    studentName: params.fee.studentName,
    studentUserUid: params.fee.studentUserUid,
    parentUserUid: params.fee.parentUserUid,
    amount: params.paymentAmount,
    paymentMethod: params.paymentMethod,
    transactionRef: params.transactionRef?.trim() || undefined,
    gatewayStatus: 'recorded',
    recordedByUid: params.recordedByUid,
    recordedByName: params.recordedByName,
    notes: params.notes?.trim() || undefined,
    paidAt: ts,
    createdAt: ts,
  };

  const acctId = generateId('acct');
  const acctEntry: Omit<AccountingEntry, 'id'> = {
    institutionId: params.instId,
    academicYearId: params.fee.academicYearId,
    entryType: 'income',
    category: params.fee.categoryName || 'Fee Collection',
    title: `Fee Payment (${receiptNumber}) - ${params.fee.studentName || params.fee.studentId}`,
    amount: params.paymentAmount,
    paymentMethod: params.paymentMethod,
    referenceNumber: receiptNumber,
    entryDate: ts.slice(0, 10),
    relatedPaymentId: paymentId,
    recordedByUid: params.recordedByUid,
    recordedByName: params.recordedByName,
    notes: params.notes?.trim() || undefined,
    createdAt: ts,
  };

  const path = `institutions/${params.instId}/payments/${paymentId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'institutions', params.instId, 'payments', paymentId), cleanPayload(payment as unknown as Record<string, unknown>));
    batch.update(doc(db, 'institutions', params.instId, 'student_fees', params.fee.id), {
      paidAmount: newPaid,
      balanceAmount: newBalance,
      status: newStatus,
      updatedAt: ts,
    });
    batch.set(doc(db, 'institutions', params.instId, 'accounting_entries', acctId), cleanPayload(acctEntry as unknown as Record<string, unknown>));
    await batch.commit();
    return { ...payment, id: paymentId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function refundPaymentAtomic(params: {
  instId: string;
  payment: PaymentRecord;
  fee: StudentFee | undefined;
  reason: string;
  recordedByUid: string;
  recordedByName: string;
}): Promise<void> {
  const ts = nowIso();
  const acctId = generateId('acct');
  const refundEntry: Omit<AccountingEntry, 'id'> = {
    institutionId: params.instId,
    academicYearId: params.payment.academicYearId,
    entryType: 'expense',
    category: 'Fee Refund',
    title: `Refund (${params.payment.receiptNumber}) - ${params.payment.studentName || params.payment.studentId}`,
    amount: params.payment.amount,
    paymentMethod: params.payment.paymentMethod,
    referenceNumber: params.payment.receiptNumber,
    entryDate: ts.slice(0, 10),
    relatedPaymentId: params.payment.id,
    recordedByUid: params.recordedByUid,
    recordedByName: params.recordedByName,
    notes: params.reason,
    createdAt: ts,
  };
  const path = `institutions/${params.instId}/payments/${params.payment.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'institutions', params.instId, 'payments', params.payment.id), {
      gatewayStatus: 'refunded',
      refundedAt: ts,
      refundReason: params.reason,
    });
    if (params.fee) {
      const nextPaid = Math.max(0, Number((params.fee.paidAmount - params.payment.amount).toFixed(2)));
      const netPayable = Math.max(0, params.fee.amount - (params.fee.discountAmount || 0) + (params.fee.lateFeeAmount || 0));
      const nextBalance = Math.max(0, Number((netPayable - nextPaid).toFixed(2)));
      batch.update(doc(db, 'institutions', params.instId, 'student_fees', params.fee.id), {
        paidAmount: nextPaid,
        balanceAmount: nextBalance,
        status: nextPaid > 0 ? 'partial' : 'unpaid',
        updatedAt: ts,
      });
    }
    batch.set(doc(db, 'institutions', params.instId, 'accounting_entries', acctId), cleanPayload(refundEntry as unknown as Record<string, unknown>));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function issueLibraryBookAtomic(params: {
  instId: string;
  book: LibraryBook;
  txData: Omit<LibraryTransaction, 'id' | 'institutionId' | 'createdAt' | 'updatedAt'>;
}): Promise<string> {
  const ts = nowIso();
  const txId = generateId('ltx');
  const tx: Omit<LibraryTransaction, 'id'> = {
    ...params.txData,
    institutionId: params.instId,
    createdAt: ts,
    updatedAt: ts,
  };
  const nextAvail = Math.max(0, params.book.availableQuantity - (params.txData.status === 'issued' ? 1 : 0));
  const nextStatus: LibraryBook['status'] = nextAvail === 0 ? 'out_of_stock' : 'available';
  const path = `institutions/${params.instId}/library_transactions/${txId}`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'institutions', params.instId, 'library_transactions', txId), cleanPayload(tx as unknown as Record<string, unknown>));
    if (params.txData.status === 'issued') {
      batch.update(doc(db, 'institutions', params.instId, 'library_books', params.book.id), {
        availableQuantity: nextAvail,
        status: nextStatus,
        updatedAt: ts,
      });
    }
    await batch.commit();
    return txId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function returnLibraryBookAtomic(params: {
  instId: string;
  tx: LibraryTransaction;
  book: LibraryBook | undefined;
  nextStatus: 'returned' | 'lost' | 'damaged';
  fineAmount: number;
  remarks?: string;
}): Promise<void> {
  const ts = nowIso();
  const path = `institutions/${params.instId}/library_transactions/${params.tx.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'institutions', params.instId, 'library_transactions', params.tx.id), cleanPayload({
      status: params.nextStatus,
      returnDate: ts.slice(0, 10),
      fineAmount: params.fineAmount,
      finePaid: params.fineAmount === 0,
      remarks: params.remarks || params.tx.remarks,
      updatedAt: ts,
    }));
    if (params.book && params.nextStatus === 'returned' && params.tx.status === 'issued') {
      const nextAvail = Math.min(params.book.quantity, params.book.availableQuantity + 1);
      batch.update(doc(db, 'institutions', params.instId, 'library_books', params.book.id), {
        availableQuantity: nextAvail,
        status: nextAvail > 0 ? 'available' : 'out_of_stock',
        updatedAt: ts,
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createNotificationForUser(
  instId: string,
  notification: Omit<NotificationItem, 'id' | 'institutionId' | 'isRead' | 'createdAt'>,
): Promise<void> {
  const id = generateId('notif');
  const payload: Omit<NotificationItem, 'id'> = {
    ...notification,
    institutionId: instId,
    isRead: false,
    createdAt: nowIso(),
  };
  try {
    await setDoc(doc(db, 'institutions', instId, 'notifications', id), cleanPayload(payload as unknown as Record<string, unknown>));
  } catch (error) {
    console.warn('Notification creation failed:', error);
  }
}

export async function fetchAllInstInvites(instId: string): Promise<UserInvite[]> {
  const path = `institutions/${instId}/invites`;
  try {
    const snap = await getDocs(query(collection(db, 'institutions', instId, 'invites')));
    const byId = new Map<string, UserInvite>();
    snap.docs.forEach((d) => {
      byId.set(d.id, { ...(d.data() as Omit<UserInvite, 'id'>), id: d.id });
    });
    const uid = auth.currentUser?.uid;
    if (uid) {
      try {
        const legacySnap = await getDocs(
          query(collection(db, 'user_invites'), where('createdByUid', '==', uid)),
        );
        legacySnap.docs.forEach((d) => {
          const data = d.data() as Omit<UserInvite, 'id'>;
          if (data.institutionId === instId && !byId.has(d.id)) {
            byId.set(d.id, { ...data, id: d.id });
          }
        });
      } catch {
        // Ignore legacy fallback if unavailable
      }
    }
    return Array.from(byId.values());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export {
  limit,
  orderBy,
  where,
  type AcademicClass,
  type AcademicYear,
  type AccountingEntry,
  type Admission,
  type Assignment,
  type AssignmentSubmission,
  type AttendanceRecord,
  type AuditLog,
  type CalendarEvent,
  type Department,
  type DocumentRecord,
  type Employee,
  type ExamMark,
  type Examination,
  type FeeCategory,
  type FeeStructure,
  type Hostel,
  type HostelAllocation,
  type LeaveRequest,
  type LibraryBook,
  type LibraryTransaction,
  type MessageItem,
  type Notice,
  type NotificationItem,
  type PaymentRecord,
  type Program,
  type RolePermissionMatrix,
  type Section,
  type Student,
  type StudentFee,
  type Subject,
  type TimetableSlot,
  type TransportRoute,
};
