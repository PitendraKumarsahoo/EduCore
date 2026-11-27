import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, orderBy, where } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import {
  acceptInviteAndCreateMembership,
  createInstitutionWithOwner,
  findPendingInvitesForEmail,
  getInstitution,
  getInstitutionMember,
  getUserAccount,
  listOwnedOrAllInstitutions,
  subscribeInstCollection,
  upsertUserAccount,
  writeAuditLog,
} from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import { hasModulePermission } from '../config/permissions';
import { nowIso } from '../utils/format';
import type {
  AcademicClass,
  AcademicYear,
  Admission,
  Assignment,
  AttendanceRecord,
  CalendarEvent,
  Department,
  Employee,
  Examination,
  FeeCategory,
  FeeStructure,
  Institution,
  InstitutionMember,
  LeaveRequest,
  LibraryBook,
  LibraryTransaction,
  ModuleKey,
  Notice,
  NotificationItem,
  PaymentRecord,
  PermissionAction,
  Program,
  RolePermissionMatrix,
  Section,
  Student,
  StudentFee,
  Subject,
  TimetableSlot,
  UserAccount,
  UserInvite,
} from '../types';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface AppContextValue {
  authReady: boolean;
  dataLoading: boolean;
  firebaseUser: User | null;
  userAccount: UserAccount | null;
  institution: Institution | null;
  institutions: Institution[];
  member: InstitutionMember | null;
  pendingInvites: UserInvite[];
  activeYearId: string;
  setActiveYearId: (id: string) => void;
  activeModule: ModuleKey;
  setActiveModule: (mod: ModuleKey) => void;
  isSuperAdmin: boolean;
  can: (mod: ModuleKey, action?: PermissionAction) => boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchInstitution: (instId: string) => Promise<void>;
  createInstitution: (params: {
    name: string;
    type: Institution['type'];
    code?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    timezone: string;
    currency: string;
  }) => Promise<Institution>;
  claimInvite: (invite: UserInvite) => Promise<void>;
  refreshSession: () => Promise<void>;
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], text: string) => void;
  dismissToast: (id: string) => void;
  // Live synchronized institutional core data
  academicYears: AcademicYear[];
  departments: Department[];
  programs: Program[];
  classes: AcademicClass[];
  sections: Section[];
  subjects: Subject[];
  students: Student[];
  employees: Employee[];
  admissions: Admission[];
  attendance: AttendanceRecord[];
  timetables: TimetableSlot[];
  examinations: Examination[];
  feeCategories: FeeCategory[];
  feeStructures: FeeStructure[];
  studentFees: StudentFee[];
  payments: PaymentRecord[];
  libraryBooks: LibraryBook[];
  libraryTransactions: LibraryTransaction[];
  assignments: Assignment[];
  leaveRequests: LeaveRequest[];
  notices: Notice[];
  calendarEvents: CalendarEvent[];
  notifications: NotificationItem[];
  roleMatrices: RolePermissionMatrix[];
  // Parent child switcher
  selectedChildId: string;
  setSelectedChildId: (id: string) => void;
  // Global modal/nav triggers
  selectedStudentIdForProfile: string | null;
  setSelectedStudentIdForProfile: (id: string | null) => void;
  selectedEmployeeIdForProfile: string | null;
  setSelectedEmployeeIdForProfile: (id: string | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const PLATFORM_SUPER_ADMIN_EMAIL = 'pitendrakumarsahoo84@gmail.com';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [member, setMember] = useState<InstitutionMember | null>(null);
  const [pendingInvites, setPendingInvites] = useState<UserInvite[]>([]);
  const [activeYearId, setActiveYearId] = useState<string>('');
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Live datasets
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [timetables, setTimetables] = useState<TimetableSlot[]>([]);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [feeCategories, setFeeCategories] = useState<FeeCategory[]>([]);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [libraryBooks, setLibraryBooks] = useState<LibraryBook[]>([]);
  const [libraryTransactions, setLibraryTransactions] = useState<LibraryTransaction[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [roleMatrices, setRoleMatrices] = useState<RolePermissionMatrix[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedStudentIdForProfile, setSelectedStudentIdForProfile] = useState<string | null>(null);
  const [selectedEmployeeIdForProfile, setSelectedEmployeeIdForProfile] = useState<string | null>(null);

  const pushToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const isSuperAdmin = useMemo(() => {
    return Boolean(
      firebaseUser?.emailVerified &&
        firebaseUser.email?.toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL.toLowerCase(),
    );
  }, [firebaseUser]);

  const hydrateUserSession = useCallback(async (user: User) => {
    const ts = nowIso();
    const existing = await getUserAccount(user.uid);
    const account: UserAccount = {
      uid: user.uid,
      email: (user.email || '').toLowerCase(),
      displayName: existing?.displayName || user.displayName || user.email?.split('@')[0] || 'User',
      phone: existing?.phone,
      photoUrl: existing?.photoUrl || user.photoURL || undefined,
      activeInstitutionId: existing?.activeInstitutionId,
      notificationPrefs: existing?.notificationPrefs || {
        inApp: true,
        emailDigest: false,
        feeAlerts: true,
        examAlerts: true,
      },
      lastLoginAt: ts,
      createdAt: existing?.createdAt || ts,
      updatedAt: ts,
    };
    await upsertUserAccount(account);
    setUserAccount(account);

    const superUser = Boolean(
      user.emailVerified && user.email?.toLowerCase() === PLATFORM_SUPER_ADMIN_EMAIL.toLowerCase(),
    );

    let invites: UserInvite[] = [];
    if (user.email && user.emailVerified) {
      try {
        invites = await findPendingInvitesForEmail(user.email);
      } catch {
        invites = [];
      }
    }
    setPendingInvites(invites);

    let ownedOrAll: Institution[] = [];
    try {
      ownedOrAll = await listOwnedOrAllInstitutions(user.uid, superUser);
    } catch {
      ownedOrAll = [];
    }
    setInstitutions(ownedOrAll);

    let targetInstId = account.activeInstitutionId;
    if (!targetInstId && ownedOrAll.length > 0) {
      targetInstId = ownedOrAll[0].id;
    }

    if (targetInstId) {
      try {
        const [instDoc, memDoc] = await Promise.all([
          getInstitution(targetInstId),
          getInstitutionMember(targetInstId, user.uid),
        ]);
        if (instDoc && (memDoc || superUser)) {
          setInstitution(instDoc);
          if (memDoc) {
            setMember(memDoc);
          } else if (superUser) {
            setMember({
              uid: user.uid,
              institutionId: instDoc.id,
              email: account.email,
              displayName: account.displayName,
              role: 'super_admin',
              status: 'active',
              createdAt: ts,
              updatedAt: ts,
            });
          }
          setActiveYearId(instDoc.currentAcademicYearId || '');
          await writeAuditLog(instDoc.id, {
            userUid: user.uid,
            userEmail: account.email,
            userName: account.displayName,
            userRole: memDoc?.role || (superUser ? 'super_admin' : 'user'),
            action: 'login',
            module: 'auth',
            summary: 'User signed in',
          });
          return;
        }
      } catch {
        // Fallback to unassigned state
      }
    }

    setInstitution(null);
    setMember(null);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await hydrateUserSession(user);
        } catch (err) {
          pushToast('error', formatUserFriendlyError(err, 'Failed to load user session.'));
        }
      } else {
        setUserAccount(null);
        setInstitution(null);
        setMember(null);
        setInstitutions([]);
        setPendingInvites([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [hydrateUserSession, pushToast]);

  // Subscribe to institution-scoped collections whenever institution + member are ready
  useEffect(() => {
    if (!institution?.id || !member || !firebaseUser) {
      setDataLoading(false);
      setAcademicYears([]);
      setDepartments([]);
      setPrograms([]);
      setClasses([]);
      setSections([]);
      setSubjects([]);
      setStudents([]);
      setEmployees([]);
      setAdmissions([]);
      setAttendance([]);
      setTimetables([]);
      setExaminations([]);
      setFeeCategories([]);
      setFeeStructures([]);
      setStudentFees([]);
      setPayments([]);
      setLibraryBooks([]);
      setLibraryTransactions([]);
      setAssignments([]);
      setLeaveRequests([]);
      setNotices([]);
      setCalendarEvents([]);
      setNotifications([]);
      setRoleMatrices([]);
      return;
    }

    let cancelled = false;
    setDataLoading(true);
    const pendingKeys = new Set<string>([
      'academic_years',
      'departments',
      'programs',
      'classes',
      'subjects',
      'examinations',
      'notices',
      'students',
      'student_fees',
    ]);
    const markSettled = (key: string) => {
      if (cancelled) return;
      pendingKeys.delete(key);
      if (pendingKeys.size === 0) {
        setDataLoading(false);
      }
    };
    const settleTimer = setTimeout(() => {
      if (!cancelled) setDataLoading(false);
    }, 3500);

    const instId = institution.id;
    const role = member.role;
    const isStaff = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod', 'teacher', 'accountant', 'librarian', 'receptionist'].includes(role);
    const isFinance = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'accountant'].includes(role);
    const isLib = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'librarian'].includes(role);
    const isAdminOrMgr = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod'].includes(role);

    const unsubs: (() => void)[] = [];

    unsubs.push(subscribeInstCollection<AcademicYear>(instId, 'academic_years', [orderBy('createdAt', 'desc')], (rows) => {
      setAcademicYears(rows);
      if (!activeYearId) {
        const cur = rows.find((r) => r.isCurrent) || rows[0];
        if (cur) setActiveYearId(cur.id);
      }
      markSettled('academic_years');
    }));
    unsubs.push(subscribeInstCollection<Department>(instId, 'departments', [], (rows) => {
      setDepartments(rows);
      markSettled('departments');
    }));
    unsubs.push(subscribeInstCollection<Program>(instId, 'programs', [], (rows) => {
      setPrograms(rows);
      markSettled('programs');
    }));
    unsubs.push(subscribeInstCollection<AcademicClass>(instId, 'classes', [], (rows) => {
      setClasses(rows);
      markSettled('classes');
    }));
    unsubs.push(subscribeInstCollection<Section>(instId, 'sections', [], setSections));
    unsubs.push(subscribeInstCollection<Subject>(instId, 'subjects', [], (rows) => {
      setSubjects(rows);
      markSettled('subjects');
    }));
    unsubs.push(subscribeInstCollection<TimetableSlot>(instId, 'timetables', [], setTimetables));
    unsubs.push(subscribeInstCollection<Examination>(instId, 'examinations', [], (rows) => {
      setExaminations(rows);
      markSettled('examinations');
    }));
    unsubs.push(subscribeInstCollection<FeeCategory>(instId, 'fee_categories', [], setFeeCategories));
    unsubs.push(subscribeInstCollection<FeeStructure>(instId, 'fee_structures', [], setFeeStructures));
    unsubs.push(subscribeInstCollection<LibraryBook>(instId, 'library_books', [], setLibraryBooks));
    unsubs.push(subscribeInstCollection<Assignment>(instId, 'assignments', [], setAssignments));
    unsubs.push(subscribeInstCollection<CalendarEvent>(instId, 'calendar_events', [], setCalendarEvents));
    unsubs.push(subscribeInstCollection<RolePermissionMatrix>(instId, 'role_permissions', [], setRoleMatrices));

    // Notices: staff/admin see all; students/parents see published
    if (isStaff) {
      unsubs.push(subscribeInstCollection<Notice>(instId, 'notices', [], (rows) => {
        setNotices(rows);
        markSettled('notices');
      }));
    } else {
      unsubs.push(subscribeInstCollection<Notice>(instId, 'notices', [where('status', '==', 'published')], (rows) => {
        setNotices(rows);
        markSettled('notices');
      }));
    }

    // Notifications for current user
    unsubs.push(
      subscribeInstCollection<NotificationItem>(
        instId,
        'notifications',
        [where('recipientUid', '==', firebaseUser.uid)],
        setNotifications,
      ),
    );

    // Role-scoped PII collections
    if (isStaff) {
      unsubs.push(subscribeInstCollection<Student>(instId, 'students', [where('isDeleted', '==', false)], (rows) => {
        setStudents(rows);
        markSettled('students');
      }));
      unsubs.push(subscribeInstCollection<Employee>(instId, 'employees', [where('isDeleted', '==', false)], setEmployees));
      unsubs.push(subscribeInstCollection<Admission>(instId, 'admissions', [], setAdmissions));
      unsubs.push(subscribeInstCollection<AttendanceRecord>(instId, 'attendance', [], setAttendance));
    } else if (role === 'student') {
      unsubs.push(
        subscribeInstCollection<Student>(instId, 'students', [where('userUid', '==', firebaseUser.uid)], (rows) => {
          setStudents(rows);
          markSettled('students');
        }),
      );
      unsubs.push(
        subscribeInstCollection<AttendanceRecord>(
          instId,
          'attendance',
          [where('studentUserUid', '==', firebaseUser.uid)],
          setAttendance,
        ),
      );
    } else if (role === 'parent') {
      unsubs.push(
        subscribeInstCollection<Student>(instId, 'students', [where('parentUid', '==', firebaseUser.uid)], (rows) => {
          setStudents(rows);
          if (rows.length > 0 && !selectedChildId) setSelectedChildId(rows[0].id);
          markSettled('students');
        }),
      );
      unsubs.push(
        subscribeInstCollection<AttendanceRecord>(
          instId,
          'attendance',
          [where('parentUserUid', '==', firebaseUser.uid)],
          setAttendance,
        ),
      );
    } else {
      markSettled('students');
    }

    if (isFinance) {
      unsubs.push(subscribeInstCollection<StudentFee>(instId, 'student_fees', [], (rows) => {
        setStudentFees(rows);
        markSettled('student_fees');
      }));
      unsubs.push(subscribeInstCollection<PaymentRecord>(instId, 'payments', [], setPayments));
    } else if (role === 'student') {
      unsubs.push(
        subscribeInstCollection<StudentFee>(instId, 'student_fees', [where('studentUserUid', '==', firebaseUser.uid)], (rows) => {
          setStudentFees(rows);
          markSettled('student_fees');
        }),
      );
      unsubs.push(
        subscribeInstCollection<PaymentRecord>(instId, 'payments', [where('studentUserUid', '==', firebaseUser.uid)], setPayments),
      );
    } else if (role === 'parent') {
      unsubs.push(
        subscribeInstCollection<StudentFee>(instId, 'student_fees', [where('parentUserUid', '==', firebaseUser.uid)], (rows) => {
          setStudentFees(rows);
          markSettled('student_fees');
        }),
      );
      unsubs.push(
        subscribeInstCollection<PaymentRecord>(instId, 'payments', [where('parentUserUid', '==', firebaseUser.uid)], setPayments),
      );
    } else {
      markSettled('student_fees');
    }

    if (isLib) {
      unsubs.push(subscribeInstCollection<LibraryTransaction>(instId, 'library_transactions', [], setLibraryTransactions));
    } else {
      unsubs.push(
        subscribeInstCollection<LibraryTransaction>(
          instId,
          'library_transactions',
          [where('borrowerUid', '==', firebaseUser.uid)],
          setLibraryTransactions,
        ),
      );
    }

    if (isAdminOrMgr) {
      unsubs.push(subscribeInstCollection<LeaveRequest>(instId, 'leave_requests', [], setLeaveRequests));
    } else {
      unsubs.push(
        subscribeInstCollection<LeaveRequest>(
          instId,
          'leave_requests',
          [where('applicantUid', '==', firebaseUser.uid)],
          setLeaveRequests,
        ),
      );
    }

    // Live institution document updates
    unsubs.push(
      onSnapshot(
        doc(db, 'institutions', instId),
        (snap) => {
          if (snap.exists()) {
            setInstitution(snap.data() as Institution);
          }
        },
        () => {},
      ),
    );

    return () => {
      cancelled = true;
      clearTimeout(settleTimer);
      unsubs.forEach((u) => {
        try {
          u();
        } catch {
          // ignore
        }
      });
    };
  }, [institution?.id, member?.role, firebaseUser?.uid]);

  const can = useCallback(
    (mod: ModuleKey, action: PermissionAction = 'view') => {
      if (!member) return false;
      const customMatrix = roleMatrices.find((m) => m.role === member.role)?.modules;
      return hasModulePermission(member.role, mod, action, customMatrix, member.permissions);
    },
    [member, roleMatrices],
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Sign-in failed.'));
    }
  }, [pushToast]);

  const logout = useCallback(async () => {
    try {
      if (institution?.id && firebaseUser) {
        await writeAuditLog(institution.id, {
          userUid: firebaseUser.uid,
          userEmail: firebaseUser.email || '',
          userName: userAccount?.displayName || firebaseUser.displayName || '',
          userRole: member?.role || '',
          action: 'logout',
          module: 'auth',
          summary: 'User signed out',
        });
      }
      await signOut(auth);
      setActiveModule('dashboard');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to sign out.'));
    }
  }, [institution?.id, firebaseUser, userAccount?.displayName, member?.role, pushToast]);

  const switchInstitution = useCallback(
    async (instId: string) => {
      if (!firebaseUser) return;
      try {
        const instDoc = await getInstitution(instId);
        const memDoc = await getInstitutionMember(instId, firebaseUser.uid);
        if (!instDoc || (!memDoc && !isSuperAdmin)) {
          pushToast('error', 'You do not have access to this institution.');
          return;
        }
        setInstitution(instDoc);
        setMember(
          memDoc || {
            uid: firebaseUser.uid,
            institutionId: instDoc.id,
            email: firebaseUser.email || '',
            displayName: userAccount?.displayName || firebaseUser.displayName || 'Super Admin',
            role: 'super_admin',
            status: 'active',
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
        );
        setActiveYearId(instDoc.currentAcademicYearId || '');
        setActiveModule('dashboard');
        pushToast('success', `Switched to ${instDoc.name}`);
      } catch (err) {
        pushToast('error', formatUserFriendlyError(err, 'Failed to switch institution.'));
      }
    },
    [firebaseUser, isSuperAdmin, userAccount?.displayName, pushToast],
  );

  const createInstitution = useCallback(
    async (params: {
      name: string;
      type: Institution['type'];
      code?: string;
      address?: string;
      phone?: string;
      email?: string;
      website?: string;
      timezone: string;
      currency: string;
    }) => {
      if (!firebaseUser) throw new Error('Authentication required');
      const res = await createInstitutionWithOwner({
        ...params,
        ownerUid: firebaseUser.uid,
        ownerEmail: (firebaseUser.email || '').toLowerCase(),
        ownerName: userAccount?.displayName || firebaseUser.displayName || 'Administrator',
        isSuperAdmin,
      });
      setInstitution(res.institution);
      setMember(res.member);
      setInstitutions((prev) => [res.institution, ...prev]);
      return res.institution;
    },
    [firebaseUser, userAccount?.displayName, isSuperAdmin],
  );

  const claimInvite = useCallback(
    async (invite: UserInvite) => {
      if (!firebaseUser || !firebaseUser.email) return;
      try {
        const mem = await acceptInviteAndCreateMembership(
          invite,
          firebaseUser.uid,
          firebaseUser.email,
          userAccount?.displayName || firebaseUser.displayName || 'Member',
        );
        const inst = await getInstitution(invite.institutionId);
        if (inst) {
          setInstitution(inst);
          setMember(mem);
          setPendingInvites((prev) => prev.filter((p) => p.id !== invite.id));
          pushToast('success', `Joined ${inst.name}`);
        }
      } catch (err) {
        pushToast('error', formatUserFriendlyError(err, 'Unable to accept invitation.'));
      }
    },
    [firebaseUser, userAccount?.displayName, pushToast],
  );

  const refreshSession = useCallback(async () => {
    if (firebaseUser) {
      await hydrateUserSession(firebaseUser);
    }
  }, [firebaseUser, hydrateUserSession]);

  return (
    <AppContext.Provider
      value={{
        authReady,
        dataLoading,
        firebaseUser,
        userAccount,
        institution,
        institutions,
        member,
        pendingInvites,
        activeYearId,
        setActiveYearId,
        activeModule,
        setActiveModule,
        isSuperAdmin,
        can,
        signInWithGoogle,
        logout,
        switchInstitution,
        createInstitution,
        claimInvite,
        refreshSession,
        toasts,
        pushToast,
        dismissToast,
        academicYears,
        departments,
        programs,
        classes,
        sections,
        subjects,
        students,
        employees,
        admissions,
        attendance,
        timetables,
        examinations,
        feeCategories,
        feeStructures,
        studentFees,
        payments,
        libraryBooks,
        libraryTransactions,
        assignments,
        leaveRequests,
        notices,
        calendarEvents,
        notifications,
        roleMatrices,
        selectedChildId,
        setSelectedChildId,
        selectedStudentIdForProfile,
        setSelectedStudentIdForProfile,
        selectedEmployeeIdForProfile,
        setSelectedEmployeeIdForProfile,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
