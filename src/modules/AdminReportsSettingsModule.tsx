import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Download,
  MailPlus,
  Printer,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  Trash2,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  createOrUpdateInvite,
  fetchAllInstInvites,
  saveInstDoc,
  subscribeInstCollection,
  updateInstitution,
  upsertInstDoc,
  writeAuditLog,
} from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import {
  ALL_MODULES,
  ALL_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_LABELS,
} from '../config/permissions';
import {
  fileToConstrainedDataUrl,
  formatCurrency,
  formatDate,
  formatDateTime,
  nowIso,
} from '../utils/format';
import { exportToCsv } from '../utils/csv';
import {
  DataTable,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  SectionCard,
  StatusBadge,
  Tabs,
} from '../components/ui/Primitives';
import type {
  AuditLog,
  ExamMark,
  GradingRule,
  HostelAllocation,
  Institution,
  InstitutionMember,
  ModuleKey,
  PermissionAction,
  RoleKey,
  TransportRoute,
  UserInvite,
} from '../types';

const REPORT_TYPES = [
  { id: 'student', label: 'Student Directory Report' },
  { id: 'admission', label: 'Admissions Pipeline Report' },
  { id: 'attendance', label: 'Attendance Report' },
  { id: 'faculty', label: 'Faculty Workload & Roster' },
  { id: 'fee_collection', label: 'Fee Collection Report' },
  { id: 'outstanding_fees', label: 'Outstanding Fee Balances' },
  { id: 'examination', label: 'Examination Schedule Report' },
  { id: 'result', label: 'Examination Results Report' },
  { id: 'library', label: 'Library Circulation Report' },
  { id: 'transport', label: 'Transport & Routes Report' },
  { id: 'hostel', label: 'Hostel Occupancy Report' },
  { id: 'employee', label: 'All Employees Report' },
  { id: 'leave', label: 'Leave Requests Report' },
] as const;

type ReportId = (typeof REPORT_TYPES)[number]['id'];

export function AdminReportsSettingsModule() {
  const {
    institution,
    member,
    userAccount,
    activeModule,
    isSuperAdmin,
    pushToast,
    createInstitution,
    academicYears,
    departments,
    classes,
    sections,
    subjects,
    students,
    employees,
    admissions,
    attendance,
    examinations,
    studentFees,
    payments,
    libraryTransactions,
    leaveRequests,
    roleMatrices,
  } = useApp();

  const isInstAdmin = ['super_admin', 'institution_admin', 'principal', 'vice_principal'].includes(
    member?.role || '',
  );
  const currency = institution?.currency || 'USD';

  // Admin collections
  const [membersList, setMembersList] = useState<InstitutionMember[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [allMarks, setAllMarks] = useState<ExamMark[]>([]);
  const [transportRoutes, setTransportRoutes] = useState<TransportRoute[]>([]);
  const [hostelAllocs, setHostelAllocs] = useState<HostelAllocation[]>([]);

  useEffect(() => {
    if (!institution?.id) return;
    const instId = institution.id;
    const unsubs: (() => void)[] = [];

    if (activeModule === 'users_roles' && isInstAdmin) {
      setMembersLoading(true);
      setInvitesLoading(true);
      unsubs.push(
        subscribeInstCollection<InstitutionMember>(instId, 'members', [], (rows) => {
          setMembersList(rows);
          setMembersLoading(false);
        }),
      );
      fetchAllInstInvites(instId)
        .then(setInvites)
        .catch(() => {})
        .finally(() => setInvitesLoading(false));
    }
    if (activeModule === 'audit_logs' && isInstAdmin) {
      setLogsLoading(true);
      unsubs.push(
        subscribeInstCollection<AuditLog>(instId, 'audit_logs', [], (rows) => {
          setAuditLogs(rows);
          setLogsLoading(false);
        }),
      );
    }
    if (activeModule === 'reports') {
      if (['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod', 'teacher'].includes(member?.role || '')) {
        unsubs.push(subscribeInstCollection<ExamMark>(instId, 'marks', [], setAllMarks));
      }
      unsubs.push(subscribeInstCollection<TransportRoute>(instId, 'transport_routes', [], setTransportRoutes));
      unsubs.push(subscribeInstCollection<HostelAllocation>(instId, 'hostel_allocations', [], setHostelAllocs));
    }

    return () => unsubs.forEach((u) => u());
  }, [institution?.id, activeModule, isInstAdmin, member?.role]);

  // ===================== REPORTS STATE =====================
  const [reportType, setReportType] = useState<ReportId>('student');
  const [filterYear, setFilterYear] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // ===================== USERS & ROLES STATE =====================
  const [urTab, setUrTab] = useState<'members' | 'invites' | 'matrix'>('members');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invRole, setInvRole] = useState<RoleKey>('teacher');
  const [invLinkedEmpId, setInvLinkedEmpId] = useState('');
  const [invLinkedStuIds, setInvLinkedStuIds] = useState<string[]>([]);
  const [matrixRole, setMatrixRole] = useState<RoleKey>('teacher');
  const [saving, setSaving] = useState(false);

  // ===================== SETTINGS STATE =====================
  const [instName, setInstName] = useState(institution?.name || '');
  const [instCode, setInstCode] = useState(institution?.code || '');
  const [instType, setInstType] = useState<Institution['type']>(institution?.type || 'school');
  const [instEmail, setInstEmail] = useState(institution?.email || '');
  const [instPhone, setInstPhone] = useState(institution?.phone || '');
  const [instAddress, setInstAddress] = useState(institution?.address || '');
  const [instWebsite, setInstWebsite] = useState(institution?.website || '');
  const [instCurrency, setInstCurrency] = useState(institution?.currency || 'USD');
  const [instLogoUrl, setInstLogoUrl] = useState(institution?.logoUrl || '');
  const [workingDays, setWorkingDays] = useState<string[]>(institution?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [gradingScale, setGradingScale] = useState<GradingRule[]>(institution?.gradingScale || []);
  const [minAttPct, setMinAttPct] = useState(String(institution?.attendanceRules?.minPercentage ?? 75));
  const [receiptPrefix, setReceiptPrefix] = useState(institution?.feeRules?.receiptPrefix || 'REC');
  const [allowPartial, setAllowPartial] = useState(institution?.feeRules?.allowPartialPayment ?? true);
  const [staffCatsText, setStaffCatsText] = useState((institution?.staffCategories || []).join(', '));
  const [docTypesText, setDocTypesText] = useState((institution?.documentTypes || []).join(', '));
  const [newInstOpen, setNewInstOpen] = useState(false);
  const [newInstName, setNewInstName] = useState('');
  const [newInstType, setNewInstType] = useState<Institution['type']>('school');

  useEffect(() => {
    if (!institution) return;
    setInstName(institution.name);
    setInstCode(institution.code || '');
    setInstType(institution.type);
    setInstEmail(institution.email || '');
    setInstPhone(institution.phone || '');
    setInstAddress(institution.address || '');
    setInstWebsite(institution.website || '');
    setInstCurrency(institution.currency);
    setInstLogoUrl(institution.logoUrl || '');
    setWorkingDays(institution.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    setGradingScale(institution.gradingScale || []);
    setMinAttPct(String(institution.attendanceRules?.minPercentage ?? 75));
    setReceiptPrefix(institution.feeRules?.receiptPrefix || 'REC');
    setAllowPartial(institution.feeRules?.allowPartialPayment ?? true);
    setStaffCatsText((institution.staffCategories || []).join(', '));
    setDocTypesText((institution.documentTypes || []).join(', '));
  }, [institution]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections]);
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);

  // ===================== VIEW: REPORTS CENTER =====================
  if (activeModule === 'reports') {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (reportType === 'student') {
      headers = ['Student ID', 'Roll No', 'Name', 'Class', 'Section', 'Guardian', 'Phone', 'Status'];
      rows = students
        .filter((s) => (!filterYear || s.academicYearId === filterYear) && (!filterClass || s.classId === filterClass) && (!filterStatus || s.status === filterStatus))
        .map((s) => [s.studentCode, s.rollNumber || '', `${s.firstName} ${s.lastName}`, classMap.get(s.classId || '') || '', sectionMap.get(s.sectionId || '') || '', s.guardianName || '', s.guardianPhone || s.phone || '', s.status]);
    } else if (reportType === 'admission') {
      headers = ['App No', 'Applicant', 'Target Class', 'Phone', 'Verification', 'Status', 'Created'];
      rows = admissions
        .filter((a) => (!filterYear || a.academicYearId === filterYear) && (!filterStatus || a.status === filterStatus))
        .map((a) => [a.applicationNumber, `${a.firstName} ${a.lastName}`, classMap.get(a.targetClassId || '') || '', a.phone || '', a.verificationStatus || 'pending', a.status, a.createdAt.slice(0, 10)]);
    } else if (reportType === 'attendance') {
      headers = ['Date', 'Type', 'Name', 'Class', 'Subject', 'Status'];
      rows = attendance
        .filter((a) => (!filterClass || a.classId === filterClass) && (!filterDateFrom || a.date >= filterDateFrom) && (!filterDateTo || a.date <= filterDateTo) && (!filterStatus || a.status === filterStatus))
        .map((a) => [a.date, a.targetType, a.targetName || a.targetId, classMap.get(a.classId || '') || '', subjectMap.get(a.subjectId || '') || 'Daily', a.status]);
    } else if (reportType === 'faculty') {
      headers = ['Code', 'Faculty Name', 'Department', 'Designation', 'Assigned Classes', 'Status'];
      rows = employees
        .filter((e) => e.staffType === 'faculty')
        .map((e) => [e.employeeCode, `${e.firstName} ${e.lastName}`, deptMap.get(e.departmentId || '') || '', e.designation || '', e.assignedClassIds?.length || 0, e.status]);
    } else if (reportType === 'fee_collection') {
      headers = ['Receipt #', 'Date', 'Student', 'Method', 'Amount', 'Status'];
      rows = payments
        .filter((p) => (!filterDateFrom || p.paidAt.slice(0, 10) >= filterDateFrom) && (!filterDateTo || p.paidAt.slice(0, 10) <= filterDateTo))
        .map((p) => [p.receiptNumber, p.paidAt.slice(0, 10), p.studentName || p.studentId, p.paymentMethod, formatCurrency(p.amount, currency), p.gatewayStatus]);
    } else if (reportType === 'outstanding_fees') {
      headers = ['Invoice #', 'Student', 'Title', 'Total', 'Paid', 'Balance', 'Due Date', 'Status'];
      rows = studentFees
        .filter((f) => f.balanceAmount > 0 && (!filterClass || f.classId === filterClass))
        .map((f) => [f.invoiceNumber, f.studentName || f.studentId, f.title, formatCurrency(f.amount, currency), formatCurrency(f.paidAmount, currency), formatCurrency(f.balanceAmount, currency), f.dueDate || '', f.status]);
    } else if (reportType === 'examination') {
      headers = ['Exam Name', 'Type', 'Class', 'Start Date', 'End Date', 'Subjects', 'Status'];
      rows = examinations.map((ex) => [ex.name, ex.examType, classMap.get(ex.classId || '') || 'All', ex.startDate || '', ex.endDate || '', ex.subjects?.length || 0, ex.status]);
    } else if (reportType === 'result') {
      headers = ['Student', 'Subject', 'Obtained', 'Max Marks', 'Grade', 'Published'];
      rows = allMarks.map((m) => [m.studentName || m.studentId, subjectMap.get(m.subjectId) || m.subjectId, m.isAbsent ? 'ABS' : m.marksObtained, m.maxMarks, m.grade || '', m.isPublished ? 'Yes' : 'No']);
    } else if (reportType === 'library') {
      headers = ['Book Title', 'Borrower', 'Type', 'Issue Date', 'Due Date', 'Status', 'Fine'];
      rows = libraryTransactions.map((t) => [t.bookTitle || t.bookId, t.borrowerName || t.borrowerId, t.borrowerType, t.issueDate, t.dueDate, t.status, formatCurrency(t.fineAmount || 0, currency)]);
    } else if (reportType === 'transport') {
      headers = ['Route', 'Vehicle #', 'Driver', 'Capacity', 'Assigned Students', 'Status'];
      rows = transportRoutes.map((r) => [r.routeName, r.vehicleNumber, r.driverName || '', r.capacity, r.assignedStudentIds?.length || 0, r.status]);
    } else if (reportType === 'hostel') {
      headers = ['Hostel', 'Room', 'Bed', 'Student', 'Check-In', 'Status'];
      rows = hostelAllocs.map((h) => [h.hostelName || h.hostelId, h.roomNumber, h.bedNumber, h.studentName || h.studentId, h.checkInDate, h.status]);
    } else if (reportType === 'employee') {
      headers = ['Code', 'Type', 'Name', 'Department / Category', 'Designation', 'Phone', 'Status'];
      rows = employees.map((e) => [e.employeeCode, e.staffType, `${e.firstName} ${e.lastName}`, deptMap.get(e.departmentId || '') || e.category || '', e.designation || '', e.phone || '', e.status]);
    } else if (reportType === 'leave') {
      headers = ['Applicant', 'Role Type', 'Leave Type', 'Start Date', 'End Date', 'Status', 'Reviewed By'];
      rows = leaveRequests.map((l) => [l.applicantName || l.applicantId, l.applicantType, l.leaveType, l.startDate, l.endDate, l.status, l.reviewedByName || '']);
    }

    const distColIdx = headers.findIndex((h) => {
      const lower = h.toLowerCase();
      return lower === 'status' || lower === 'verification' || lower === 'published';
    });
    const distEntries =
      rows.length > 0 && distColIdx >= 0
        ? Array.from(
            rows.reduce((acc, row) => {
              const raw = String(row[distColIdx] ?? '').trim();
              if (!raw) return acc;
              const label = raw.replace(/_/g, ' ');
              acc.set(label, (acc.get(label) || 0) + 1);
              return acc;
            }, new Map<string, number>()),
          )
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
        : [];
    const distBarColors = ['bg-blue-700', 'bg-indigo-600', 'bg-teal-600', 'bg-emerald-600', 'bg-amber-600', 'bg-slate-600'];

    return (
      <div className="space-y-6">
        <PageHeader
          icon={BarChart3}
          title="Reports Center"
          subtitle="Generate, filter, print, and export live reports from institutional database records."
          actions={
            <>
              <button
                type="button"
                onClick={() => exportToCsv(`${reportType}_report`, headers, rows)}
                className="ec-btn-secondary"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="ec-btn-primary"
              >
                <Printer className="w-4 h-4" />
                Print Report
              </button>
            </>
          }
        />

        <SectionCard variant="top-accent" className="no-print">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <FormField label="Report Type" className="lg:col-span-2">
              <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportId)} className="ec-select">
                {REPORT_TYPES.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Academic Year">
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="ec-select">
                <option value="">All Years</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Class">
              <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="ec-select">
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="From Date">
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="To Date">
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="ec-input" />
            </FormField>
          </div>
          {filterStatus && (
            <div className="mt-3">
              <button type="button" onClick={() => setFilterStatus('')} className="text-[13px] font-medium text-blue-800 hover:underline">
                Clear status filter ({filterStatus})
              </button>
            </div>
          )}
        </SectionCard>

        {distEntries.length > 0 && (
          <SectionCard
            title="Live Status Distribution"
            subtitle={`Breakdown across ${rows.length} matching records`}
            variant="tinted-header"
            icon={BarChart3}
            className="no-print"
          >
            <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-[10px] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {distEntries.map(([label, count], idx) => {
                const pct = Math.round((count / rows.length) * 100);
                return (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[13.5px]">
                      <span className="font-medium text-slate-700 capitalize">{label}</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {count} <span className="text-slate-500 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${distBarColors[idx % distBarColors.length]}`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        <SectionCard
          title={REPORT_TYPES.find((r) => r.id === reportType)?.label}
          variant="tinted-header"
          icon={BarChart3}
          noPadding
          className="print-surface"
          action={<div className="text-[13.5px] font-medium text-slate-500 tabular-nums">{rows.length} rows</div>}
        >
          {rows.length === 0 ? (
            <div className="p-12 text-center text-[15px] text-slate-500">
              No records match the selected report and filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ec-table">
                <thead className="ec-thead">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="ec-th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="ec-tbody">
                  {rows.map((r, i) => (
                    <tr key={i} className="ec-tr">
                      {r.map((cell, j) => {
                        const colHeader = headers[j]?.toLowerCase();
                        const isStatusCol =
                          colHeader === 'status' ||
                          colHeader === 'verification' ||
                          colHeader === 'published';
                        return (
                          <td key={j} className="ec-td whitespace-nowrap">
                            {isStatusCol && typeof cell === 'string' && cell.trim() !== '' ? (
                              <StatusBadge status={cell} />
                            ) : (
                              cell
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  // ===================== VIEW: AUDIT LOGS =====================
  if (activeModule === 'audit_logs') {
    const sortedLogs = [...auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return (
      <div className="space-y-6">
        <PageHeader icon={ShieldAlert} title="Audit Logs" subtitle="Immutable, append-only activity log across all institutional operations." />
        <DataTable
          rows={sortedLogs}
          loading={logsLoading}
          searchPlaceholder="Search logs by user, module, action, summary..."
          searchFilter={(l, q) =>
            `${l.userEmail || ''} ${l.userName || ''} ${l.module} ${l.action} ${l.summary}`.toLowerCase().includes(q)
          }
          onExport={(rows) =>
            exportToCsv(
              'audit_logs',
              ['Timestamp', 'User', 'Role', 'Module', 'Action', 'Summary'],
              rows.map((l) => [l.createdAt, l.userEmail || l.userUid, l.userRole || '', l.module, l.action, l.summary]),
            )
          }
          columns={[
            { key: 'time', header: 'Timestamp', sortValue: (l) => l.createdAt, render: (l) => <span className="text-[13px] font-mono text-slate-600">{formatDateTime(l.createdAt)}</span> },
            {
              key: 'user',
              header: 'User',
              render: (l) => (
                <div>
                  <div className="font-medium text-slate-900">{l.userName || l.userEmail || l.userUid}</div>
                  <div className="text-[13px] text-slate-500">{l.userRole || '—'}</div>
                </div>
              ),
            },
            { key: 'mod', header: 'Module / Action', render: (l) => <span className="text-[13px] font-mono text-slate-700">{l.module}.{l.action}</span> },
            { key: 'sum', header: 'Summary', render: (l) => <span className="text-[14.5px] text-slate-700">{l.summary}</span> },
          ]}
          emptyState={<EmptyState icon={ShieldAlert} title="No audit logs yet" description="Actions performed by users will be logged automatically." />}
        />
      </div>
    );
  }

  // ===================== VIEW: USERS & ROLES =====================
  if (activeModule === 'users_roles') {
    const customMatrix = roleMatrices.find((m) => m.role === matrixRole)?.modules;
    const effectiveMatrix = {
      ...DEFAULT_ROLE_PERMISSIONS[matrixRole],
      ...(customMatrix || {}),
    };

    const togglePermission = async (modKey: ModuleKey, action: PermissionAction) => {
      if (!institution || !userAccount || matrixRole === 'super_admin' || matrixRole === 'institution_admin') return;
      const current = effectiveMatrix[modKey] || [];
      const nextActions = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      const nextModules = { ...effectiveMatrix, [modKey]: nextActions };
      try {
        await upsertInstDoc(institution.id, 'role_permissions', matrixRole, {
          role: matrixRole,
          institutionId: institution.id,
          modules: nextModules,
          updatedAt: nowIso(),
        });
        pushToast('success', `Updated ${ROLE_LABELS[matrixRole]} permissions.`);
      } catch (err) {
        pushToast('error', formatUserFriendlyError(err, 'Failed to update permission matrix.'));
      }
    };

    return (
      <div className="space-y-6">
        <PageHeader
          icon={Shield}
          title="Users, Invites & Role Permissions"
          subtitle="Invite faculty, staff, students, and parents; assign roles; and customize least-privilege module permissions."
          actions={
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="ec-btn-primary"
            >
              <MailPlus className="w-4 h-4" />
              Invite User
            </button>
          }
        />

        <Tabs
          value={urTab}
          onChange={setUrTab}
          items={[
            { key: 'members', label: 'Active Members', count: membersList.length },
            { key: 'invites', label: 'Invitations', count: invites.length },
            { key: 'matrix', label: 'Role Permission Matrix' },
          ]}
        />

        {urTab === 'members' && (
          <DataTable
            rows={membersList.map((m) => ({ ...m, id: m.uid }))}
            loading={membersLoading}
            searchPlaceholder="Search members by name, email, role..."
            searchFilter={(m, q) => `${m.displayName || ''} ${m.email} ${m.role}`.toLowerCase().includes(q)}
            columns={[
              {
                key: 'user',
                header: 'Member',
                render: (m) => (
                  <div>
                    <div className="font-medium text-slate-900">{m.displayName || m.email}</div>
                    <div className="text-[13px] text-slate-500">{m.email}</div>
                  </div>
                ),
              },
              {
                key: 'role',
                header: 'Role',
                render: (m) => (
                  <select
                    value={m.role}
                    disabled={m.uid === userAccount?.uid || m.role === 'super_admin'}
                    onChange={async (e) => {
                      if (!institution) return;
                      const nextRole = e.target.value as RoleKey;
                      await saveInstDoc(institution.id, 'members', m.uid, { ...m, role: nextRole, updatedAt: nowIso() }, false);
                      pushToast('success', `Updated role to ${ROLE_LABELS[nextRole]}.`);
                    }}
                    className="px-3 py-1.5 text-[13.5px] border border-slate-300 rounded-[8px] bg-white disabled:bg-slate-100"
                  >
                    {ALL_ROLES.filter((r) => r !== 'super_admin' || m.role === 'super_admin').map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                ),
              },
              { key: 'status', header: 'Status', render: (m) => <StatusBadge status={m.status} /> },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (m) =>
                  m.uid !== userAccount?.uid ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!institution) return;
                        const nextStatus = m.status === 'active' ? 'inactive' : 'active';
                        await saveInstDoc(institution.id, 'members', m.uid, { ...m, status: nextStatus, updatedAt: nowIso() }, false);
                        pushToast('success', `Member marked ${nextStatus}.`);
                      }}
                      className="text-[13.5px] font-semibold text-blue-800 hover:underline"
                    >
                      {m.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  ) : (
                    <span className="text-[13px] text-slate-400">Current User</span>
                  ),
              },
            ]}
            emptyState={<EmptyState icon={Shield} title="No members yet" description="Invite users to collaborate inside this institution." />}
          />
        )}

        {urTab === 'invites' && (
          <DataTable
            rows={invites}
            loading={invitesLoading}
            columns={[
              { key: 'email', header: 'Invited Email', render: (inv) => <span className="font-medium text-slate-900">{inv.email}</span> },
              { key: 'role', header: 'Assigned Role', render: (inv) => ROLE_LABELS[inv.role] },
              { key: 'status', header: 'Status', render: (inv) => <StatusBadge status={inv.status} /> },
              { key: 'date', header: 'Sent On', render: (inv) => formatDate(inv.createdAt) },
            ]}
            emptyState={
              <EmptyState
                icon={MailPlus}
                title="No invitations sent"
                description="Send an invite by email so staff, teachers, students, or parents can sign in with Google and join automatically."
                actionLabel="Invite User"
                onAction={() => setInviteOpen(true)}
              />
            }
          />
        )}

        {urTab === 'matrix' && (
          <SectionCard
            title="Customize Role Permissions"
            subtitle="Super Admin and Institution Admin always retain full access."
            variant="tinted-header"
            icon={Shield}
            noPadding
            action={
              <select value={matrixRole} onChange={(e) => setMatrixRole(e.target.value as RoleKey)} className="ec-select !py-2 !w-auto min-w-[200px]">
                {ALL_ROLES.filter((r) => r !== 'super_admin' && r !== 'institution_admin').map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            }
          >
            <div className="overflow-x-auto">
              <table className="ec-table">
                <thead className="ec-thead">
                  <tr>
                    <th className="ec-th">Module</th>
                    <th className="ec-th text-center">View</th>
                    <th className="ec-th text-center">Create</th>
                    <th className="ec-th text-center">Edit</th>
                    <th className="ec-th text-center">Delete</th>
                    <th className="ec-th text-center">Export</th>
                  </tr>
                </thead>
                <tbody className="ec-tbody">
                  {ALL_MODULES.map((m) => {
                    const acts = effectiveMatrix[m.key] || [];
                    return (
                      <tr key={m.key} className="ec-tr">
                        <td className="ec-td font-medium text-slate-800">{m.label}</td>
                        {(['view', 'create', 'edit', 'delete', 'export'] as PermissionAction[]).map((act) => (
                          <td key={act} className="ec-td text-center">
                            <input
                              type="checkbox"
                              checked={acts.includes(act)}
                              onChange={() => togglePermission(m.key, act)}
                              className="rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}

        <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite User to Institution" size="md">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!institution || !userAccount || !invEmail.trim()) return;
              setSaving(true);
              try {
                const inv = await createOrUpdateInvite({
                  institutionId: institution.id,
                  institutionName: institution.name,
                  email: invEmail.trim(),
                  role: invRole,
                  displayName: invName.trim() || undefined,
                  linkedEmployeeId: invLinkedEmpId || undefined,
                  linkedStudentIds: invLinkedStuIds.length > 0 ? invLinkedStuIds : undefined,
                  createdByUid: userAccount.uid,
                });
                setInvites((prev) => [inv, ...prev.filter((x) => x.id !== inv.id)]);
                await writeAuditLog(institution.id, {
                  userUid: userAccount.uid,
                  userRole: member?.role,
                  action: 'invite',
                  module: 'users_roles',
                  summary: `Invited ${invEmail} as ${ROLE_LABELS[invRole]}`,
                });
                pushToast('success', `Invitation created for ${invEmail}.`);
                setInviteOpen(false);
                setInvEmail('');
                setInvName('');
                setInvLinkedEmpId('');
                setInvLinkedStuIds([]);
              } catch (err) {
                pushToast('error', formatUserFriendlyError(err, 'Failed to send invite.'));
              } finally {
                setSaving(false);
              }
            }}
            className="space-y-4"
          >
            <FormField label="Google Account Email" required>
              <input type="email" required value={invEmail} onChange={(e) => setInvEmail(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Display Name">
              <input value={invName} onChange={(e) => setInvName(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Assigned Role" required>
              <select value={invRole} onChange={(e) => setInvRole(e.target.value as RoleKey)} className="ec-select">
                {ALL_ROLES.filter((r) => r !== 'super_admin').map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </FormField>
            {(invRole === 'teacher' || invRole === 'hod' || invRole === 'accountant' || invRole === 'librarian') && employees.length > 0 && (
              <FormField label="Link to Employee Profile (optional)">
                <select value={invLinkedEmpId} onChange={(e) => setInvLinkedEmpId(e.target.value)} className="ec-select">
                  <option value="">None</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.employeeCode} · {emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </FormField>
            )}
            {(invRole === 'student' || invRole === 'parent') && students.length > 0 && (
              <FormField label="Link Student(s) (optional)">
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-[10px] p-3 space-y-2 bg-slate-50/40">
                  {students.map((s) => (
                    <label key={s.id} className="flex items-center gap-2.5 text-[14px] text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invLinkedStuIds.includes(s.id)}
                        onChange={() =>
                          setInvLinkedStuIds((p) =>
                            p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id],
                          )
                        }
                        className="rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                      />
                      <span>{s.studentCode} · {s.firstName} {s.lastName}</span>
                    </label>
                  ))}
                </div>
              </FormField>
            )}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setInviteOpen(false)} className="ec-btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="ec-btn-primary">Create Invite</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ===================== VIEW: SETTINGS & BACKUP =====================
  const handleExportJsonBackup = () => {
    const backup = {
      exportedAt: nowIso(),
      institution,
      academicYears,
      departments,
      classes,
      sections,
      subjects,
      students,
      employees,
      admissions,
      examinations,
      studentFees,
      payments,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `educore_backup_${institution?.id || 'export'}_${nowIso().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Institution Settings"
        subtitle="Configure profile, logo, working days, grading scale, fee/attendance rules, and JSON data backup."
        actions={
          <>
            <button
              type="button"
              onClick={handleExportJsonBackup}
              className="ec-btn-secondary"
            >
              <Download className="w-4 h-4" />
              Export JSON Backup
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setNewInstOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-white bg-slate-900 rounded-[10px] hover:bg-slate-800 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Create Institution
              </button>
            )}
          </>
        }
      />

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!institution || !userAccount) return;
          setSaving(true);
          try {
            await updateInstitution(institution.id, {
              name: instName.trim(),
              code: instCode.trim() || undefined,
              type: instType,
              email: instEmail.trim() || undefined,
              phone: instPhone.trim() || undefined,
              address: instAddress.trim() || undefined,
              website: instWebsite.trim() || undefined,
              currency: instCurrency,
              logoUrl: instLogoUrl || undefined,
              workingDays,
              gradingScale,
              attendanceRules: { minPercentage: Number(minAttPct || 75), allowTeacherEditPastDays: 7 },
              feeRules: {
                allowPartialPayment: allowPartial,
                allowOverpayment: false,
                receiptPrefix: receiptPrefix.trim() || 'REC',
                onlineGatewayConfigured: institution.feeRules?.onlineGatewayConfigured || false,
              },
              staffCategories: staffCatsText.split(',').map((s) => s.trim()).filter(Boolean),
              documentTypes: docTypesText.split(',').map((s) => s.trim()).filter(Boolean),
            });
            await writeAuditLog(institution.id, {
              userUid: userAccount.uid,
              userRole: member?.role,
              action: 'update',
              module: 'settings',
              summary: 'Updated institution configuration settings',
            });
            pushToast('success', 'Settings saved.');
          } catch (err) {
            pushToast('error', formatUserFriendlyError(err, 'Failed to save settings.'));
          } finally {
            setSaving(false);
          }
        }}
        className="space-y-6"
      >
        <SectionCard title="Institution Identity & Branding" variant="tinted-header" icon={Building2}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Institution Name" required className="md:col-span-2">
              <input required value={instName} onChange={(e) => setInstName(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Type">
              <select value={instType} onChange={(e) => setInstType(e.target.value as Institution['type'])} className="ec-select">
                <option value="school">School (K-12)</option>
                <option value="college">College</option>
                <option value="university">University</option>
                <option value="k12_and_college">Combined K-12 & College</option>
              </select>
            </FormField>
            <FormField label="Code">
              <input value={instCode} onChange={(e) => setInstCode(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Currency">
              <select value={instCurrency} onChange={(e) => setInstCurrency(e.target.value)} className="ec-select">
                {['USD', 'INR', 'GBP', 'EUR', 'CAD', 'AUD', 'SGD', 'AED'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Logo (max 200 KB)">
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await fileToConstrainedDataUrl(f, 200 * 1024);
                    setInstLogoUrl(url);
                  } catch (err) {
                    pushToast('error', formatUserFriendlyError(err, 'Logo too large.'));
                  }
                }}
                className="w-full text-[13.5px] text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-[8px] file:border file:border-slate-300 file:text-[13px] file:font-medium file:bg-white file:text-slate-700 hover:file:bg-slate-50"
              />
            </FormField>
            <FormField label="Email">
              <input type="email" value={instEmail} onChange={(e) => setInstEmail(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Phone">
              <input value={instPhone} onChange={(e) => setInstPhone(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Website">
              <input value={instWebsite} onChange={(e) => setInstWebsite(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Address" className="md:col-span-3">
              <input value={instAddress} onChange={(e) => setInstAddress(e.target.value)} className="ec-input" />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard title="Academic, Attendance & Finance Rules" variant="tinted-header" icon={Sliders}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Minimum Attendance %">
                <input type="number" min={0} max={100} value={minAttPct} onChange={(e) => setMinAttPct(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Fee Receipt Prefix">
                <input value={receiptPrefix} onChange={(e) => setReceiptPrefix(e.target.value)} className="ec-input font-mono" />
              </FormField>
              <label className="flex items-center gap-2.5 text-[14px] font-medium text-slate-700 pt-7 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPartial}
                  onChange={(e) => setAllowPartial(e.target.checked)}
                  className="rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                />
                Allow Partial Fee Payments
              </label>
              <FormField label="Non-Teaching Staff Categories (comma-separated)" className="md:col-span-3">
                <input value={staffCatsText} onChange={(e) => setStaffCatsText(e.target.value)} placeholder="e.g. Administration, Accounting, Library, Lab Assistant, Transport, Maintenance" className="ec-input" />
              </FormField>
              <FormField label="Accepted Document Types (comma-separated)" className="md:col-span-3">
                <input value={docTypesText} onChange={(e) => setDocTypesText(e.target.value)} className="ec-input" />
              </FormField>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[15px] font-semibold text-slate-900">Grading Scale Rules</span>
                <button
                  type="button"
                  onClick={() =>
                    setGradingScale((p) => [...p, { grade: 'A', minPercent: 90, maxPercent: 100, gpaPoint: 4.0, remarks: 'Excellent' }])
                  }
                  className="px-3.5 py-1.5 text-[13.5px] font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-[8px] hover:bg-blue-100 transition-colors"
                >
                  + Add Grade Band
                </button>
              </div>
              {gradingScale.length === 0 ? (
                <p className="text-[14px] text-slate-500">No grading bands configured yet. Add bands to auto-compute grades & GPA on results.</p>
              ) : (
                <div className="space-y-2.5">
                  {gradingScale.map((g, idx) => (
                    <div key={idx} className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-center">
                      <input placeholder="Grade" value={g.grade} onChange={(e) => { const next = [...gradingScale]; next[idx] = { ...g, grade: e.target.value }; setGradingScale(next); }} className="ec-input !py-2" />
                      <input type="number" placeholder="Min %" value={g.minPercent} onChange={(e) => { const next = [...gradingScale]; next[idx] = { ...g, minPercent: Number(e.target.value) }; setGradingScale(next); }} className="ec-input !py-2" />
                      <input type="number" placeholder="Max %" value={g.maxPercent} onChange={(e) => { const next = [...gradingScale]; next[idx] = { ...g, maxPercent: Number(e.target.value) }; setGradingScale(next); }} className="ec-input !py-2" />
                      <input type="number" step="0.1" placeholder="GPA" value={g.gpaPoint} onChange={(e) => { const next = [...gradingScale]; next[idx] = { ...g, gpaPoint: Number(e.target.value) }; setGradingScale(next); }} className="ec-input !py-2" />
                      <button type="button" onClick={() => setGradingScale((p) => p.filter((_, i) => i !== idx))} className="text-red-700 text-[13.5px] font-medium flex items-center gap-1.5 hover:underline px-2 py-1">
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="ec-btn-primary !px-6"
          >
            {saving ? 'Saving Settings...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      <Modal open={newInstOpen} onClose={() => setNewInstOpen(false)} title="Create New Institution" size="sm">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newInstName.trim()) return;
            try {
              await createInstitution({
                name: newInstName.trim(),
                type: newInstType,
                timezone: 'UTC',
                currency: 'USD',
              });
              setNewInstOpen(false);
              setNewInstName('');
              pushToast('success', 'New institution created and activated.');
            } catch (err) {
              pushToast('error', formatUserFriendlyError(err, 'Failed to create institution.'));
            }
          }}
          className="space-y-4"
        >
          <FormField label="Institution Name" required>
            <input required value={newInstName} onChange={(e) => setNewInstName(e.target.value)} className="ec-input" />
          </FormField>
          <FormField label="Type">
            <select value={newInstType} onChange={(e) => setNewInstType(e.target.value as Institution['type'])} className="ec-select">
              <option value="school">School (K-12)</option>
              <option value="college">College</option>
              <option value="university">University</option>
              <option value="k12_and_college">Combined K-12 & College</option>
            </select>
          </FormField>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setNewInstOpen(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" className="ec-btn-primary">Create</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
