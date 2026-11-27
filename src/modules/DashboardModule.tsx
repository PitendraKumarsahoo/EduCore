import React, { useMemo } from 'react';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  Layers,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  UserCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { Avatar, EmptyState, PageHeader, SectionCard, Skeleton, StatCard, StatusBadge } from '../components/ui/Primitives';
import { formatCurrency, formatDate, todayDateStr } from '../utils/format';
import { ROLE_LABELS } from '../config/permissions';

export function DashboardModule() {
  const {
    institution,
    member,
    userAccount,
    academicYears,
    departments,
    programs,
    classes,
    subjects,
    students,
    employees,
    admissions,
    attendance,
    timetables,
    examinations,
    feeCategories,
    studentFees,
    payments,
    libraryBooks,
    libraryTransactions,
    assignments,
    notices,
    calendarEvents,
    setActiveModule,
    selectedChildId,
    setSelectedChildId,
    activeYearId,
    dataLoading,
  } = useApp();

  const role = member?.role || 'student';
  const currency = institution?.currency || 'USD';
  const today = todayDateStr();
  const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as any;

  const yearStudents = useMemo(
    () => (activeYearId ? students.filter((s) => !s.academicYearId || s.academicYearId === activeYearId) : students),
    [students, activeYearId],
  );

  const facultyList = useMemo(() => employees.filter((e) => e.staffType === 'faculty'), [employees]);
  const staffList = useMemo(() => employees.filter((e) => e.staffType === 'staff'), [employees]);

  const todayAttendance = useMemo(
    () => attendance.filter((a) => a.date === today && a.targetType === 'student'),
    [attendance, today],
  );

  const todayPresentPct = useMemo(() => {
    if (todayAttendance.length === 0) return null;
    const present = todayAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    return Math.round((present / todayAttendance.length) * 100);
  }, [todayAttendance]);

  const pendingFeesTotal = useMemo(
    () => studentFees.reduce((sum, f) => sum + (f.balanceAmount || 0), 0),
    [studentFees],
  );

  const collectedFeesTotal = useMemo(
    () => payments.filter((p) => p.gatewayStatus === 'recorded').reduce((sum, p) => sum + p.amount, 0),
    [payments],
  );

  const setupProgress = useMemo(() => {
    const steps = [
      { label: 'Institution', done: Boolean(institution?.name), module: 'setup_wizard' as const },
      { label: 'Academic Year', done: academicYears.length > 0, module: 'academics' as const },
      { label: 'Departments', done: departments.length > 0, module: 'departments' as const },
      { label: 'Programs', done: programs.length > 0, module: 'programs' as const },
      { label: 'Classes', done: classes.length > 0, module: 'classes' as const },
      { label: 'Subjects', done: subjects.length > 0, module: 'subjects' as const },
      { label: 'Users', done: employees.length > 0 || students.length > 0, module: 'users_roles' as const },
    ];
    return steps;
  }, [institution?.name, academicYears.length, departments.length, programs.length, classes.length, subjects.length, employees.length, students.length]);

  const completedSetupCount = setupProgress.filter((s) => s.done).length;

  // Real monthly fee collection breakdown from recorded payments (only non-zero if payments exist)
  const monthlyCollections = useMemo(() => {
    if (payments.length === 0) return [];
    const map = new Map<string, number>();
    for (const p of payments) {
      if (p.gatewayStatus !== 'recorded') continue;
      const ym = (p.paidAt || p.createdAt).slice(0, 7);
      map.set(ym, (map.get(ym) || 0) + p.amount);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, total]) => ({ month, total }));
  }, [payments]);

  // Student / Parent scoped records
  const activeStudent = useMemo(() => {
    if (role === 'student') {
      return students[0] || null;
    }
    if (role === 'parent') {
      return students.find((s) => s.id === selectedChildId) || students[0] || null;
    }
    return null;
  }, [role, students, selectedChildId]);

  const activeStudentAttendance = useMemo(() => {
    if (!activeStudent) return [];
    return attendance.filter((a) => a.targetId === activeStudent.id);
  }, [attendance, activeStudent]);

  const activeStudentPct = useMemo(() => {
    if (activeStudentAttendance.length === 0) return null;
    const ok = activeStudentAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    return Math.round((ok / activeStudentAttendance.length) * 100);
  }, [activeStudentAttendance]);

  const activeStudentPendingFees = useMemo(() => {
    if (!activeStudent) return 0;
    return studentFees
      .filter((f) => f.studentId === activeStudent.id)
      .reduce((sum, f) => sum + (f.balanceAmount || 0), 0);
  }, [studentFees, activeStudent]);

  // Teacher scoped records
  const teacherEmployee = useMemo(
    () => employees.find((e) => e.userUid === userAccount?.uid || e.email?.toLowerCase() === userAccount?.email?.toLowerCase()),
    [employees, userAccount],
  );

  const teacherTodaySlots = useMemo(() => {
    if (!teacherEmployee) return [];
    return timetables.filter((t) => t.facultyId === teacherEmployee.id && t.dayOfWeek === todayWeekday && t.status === 'active');
  }, [timetables, teacherEmployee, todayWeekday]);

  // ==================== ROLE-SPECIFIC DASHBOARDS ====================

  if (role === 'student' || role === 'parent') {
    return (
      <div>
        <PageHeader
          icon={GraduationCap}
          title={role === 'parent' ? 'Parent & Guardian Portal' : 'Student Portal'}
          subtitle={`${institution?.name || ''} · ${ROLE_LABELS[role]}`}
          actions={
            role === 'parent' && students.length > 1 ? (
              <div className="flex items-center gap-2.5">
                <span className="text-[13.5px] font-medium text-slate-600">Selected Child:</span>
                <select
                  value={activeStudent?.id || ''}
                  onChange={(e) => setSelectedChildId(e.target.value)}
                  className="ec-select w-auto min-w-[220px]"
                >
                  {students.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} ({c.studentCode})
                    </option>
                  ))}
                </select>
              </div>
            ) : undefined
          }
        />

        {dataLoading && !activeStudent ? (
          <div className="space-y-7">
            <Skeleton variant="card" className="h-28" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="card" />
              ))}
            </div>
          </div>
        ) : !activeStudent ? (
          <EmptyState
            icon={GraduationCap}
            title="No student profile linked yet"
            description="Ask your institution administrator to link your account email to your student enrollment record."
          />
        ) : (
          <div className="space-y-7">
            <SectionCard variant="top-accent" accent="blue">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar
                    src={activeStudent.photoUrl}
                    name={`${activeStudent.firstName} ${activeStudent.lastName}`}
                    size="xl"
                  />
                  <div>
                    <div className="text-[13.5px] text-slate-500 font-medium">
                      <span className="font-mono">{activeStudent.studentCode}</span> ·{' '}
                      {classes.find((c) => c.id === activeStudent.classId)?.name || 'Class unassigned'}
                    </div>
                    <h2 className="text-[22px] font-bold text-slate-900 mt-0.5">
                      {activeStudent.firstName} {activeStudent.lastName}
                    </h2>
                    <div className="text-[14px] text-slate-500 mt-1">
                      Roll No: {activeStudent.rollNumber || '—'} · Admission No:{' '}
                      {activeStudent.admissionNumber || '—'}
                    </div>
                  </div>
                </div>
                <StatusBadge status={activeStudent.status} />
              </div>
            </SectionCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                accent="emerald"
                icon={CheckSquare}
                label="Attendance Rate"
                value={activeStudentPct !== null ? `${activeStudentPct}%` : '—'}
                subtext={
                  activeStudentAttendance.length > 0
                    ? `${activeStudentAttendance.length} recorded days`
                    : 'No attendance marked yet'
                }
                actionLabel="View Attendance"
                onAction={() => setActiveModule('attendance')}
              />
              <StatCard
                accent="amber"
                icon={CreditCard}
                label="Outstanding Fees"
                value={formatCurrency(activeStudentPendingFees, currency)}
                subtext={activeStudentPendingFees > 0 ? 'Balance due' : 'No pending dues'}
                actionLabel="View Fee Ledger"
                onAction={() => setActiveModule('fees')}
              />
              <StatCard
                accent="indigo"
                icon={ClipboardCheck}
                label="Active Assignments"
                value={assignments.filter((a) => a.classId === activeStudent.classId && a.status === 'active').length}
                subtext="Coursework for your class"
                actionLabel="Open Assignments"
                onAction={() => setActiveModule('assignments')}
              />
              <StatCard
                accent="purple"
                icon={FileText}
                label="Examinations"
                value={examinations.filter((e) => !e.classId || e.classId === activeStudent.classId).length}
                subtext="Scheduled exams"
                actionLabel="View Results"
                onAction={() => setActiveModule('results')}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                variant="tinted-header"
                accent="emerald"
                icon={Calendar}
                title={`Today's Timetable (${todayWeekday})`}
                action={
                  <button
                    type="button"
                    onClick={() => setActiveModule('timetable')}
                    className="text-[14px] font-semibold text-blue-800 hover:underline"
                  >
                    Full Schedule
                  </button>
                }
              >
                {dataLoading && timetables.length === 0 ? (
                  <div className="space-y-3 py-1">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 py-2">
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-3.5 w-32" />
                        </div>
                        <Skeleton className="h-4 w-20 shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : timetables.filter((t) => t.classId === activeStudent.classId && t.dayOfWeek === todayWeekday)
                  .length === 0 ? (
                  <p className="text-[15px] text-slate-500 py-6 text-center">No classes scheduled for today.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {timetables
                      .filter((t) => t.classId === activeStudent.classId && t.dayOfWeek === todayWeekday)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((slot) => (
                        <div key={slot.id} className="py-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[15px] font-medium text-slate-900">
                              {slot.subjectName || 'Subject'}
                            </div>
                            <div className="text-[13.5px] text-slate-500 mt-0.5">
                              {slot.facultyName || 'Faculty'} · Room {slot.room || 'TBD'}
                            </div>
                          </div>
                          <span className="font-mono text-[13.5px] font-medium text-slate-700 tabular-nums">
                            {slot.startTime}–{slot.endTime}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                variant="tinted-header"
                accent="blue"
                icon={Megaphone}
                title="Published Notices"
                action={
                  <button
                    type="button"
                    onClick={() => setActiveModule('notices')}
                    className="text-[14px] font-semibold text-blue-800 hover:underline"
                  >
                    View All
                  </button>
                }
              >
                {dataLoading && notices.length === 0 ? (
                  <div className="space-y-3 py-1">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="space-y-1.5 py-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3.5 w-full" />
                      </div>
                    ))}
                  </div>
                ) : notices.length === 0 ? (
                  <p className="text-[15px] text-slate-500 py-6 text-center">No notices published yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {notices.slice(0, 5).map((n) => (
                      <div key={n.id} className="py-3">
                        <div className="text-[15px] font-medium text-slate-900">{n.title}</div>
                        <div className="text-[13.5px] text-slate-500 mt-1 line-clamp-2">{n.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (role === 'teacher') {
    const mySubjects = subjects.filter((s) => s.facultyId === teacherEmployee?.id);
    return (
      <div className="space-y-7">
        <PageHeader
          accent="violet"
          icon={Users}
          title="Faculty Teaching Workspace"
          subtitle={`${institution?.name || ''} · ${userAccount?.displayName || ''}`}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {dataLoading && employees.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="card" />)
          ) : (
            <>
              <StatCard
                accent="emerald"
                icon={Calendar}
                label="Today's Classes"
                value={teacherTodaySlots.length}
                subtext={todayWeekday}
                actionLabel="View Timetable"
                onAction={() => setActiveModule('timetable')}
              />
              <StatCard
                accent="indigo"
                icon={BookOpen}
                label="Assigned Subjects"
                value={mySubjects.length}
                subtext={mySubjects.length === 0 ? 'No subjects assigned yet' : 'Active curriculum'}
                actionLabel="Open Subjects"
                onAction={() => setActiveModule('subjects')}
              />
              <StatCard
                accent="blue"
                icon={GraduationCap}
                label="Students"
                value={yearStudents.length}
                subtext="Enrolled in institution"
                actionLabel="Mark Attendance"
                onAction={() => setActiveModule('attendance')}
              />
              <StatCard
                accent="purple"
                icon={ClipboardCheck}
                label="Active Assignments"
                value={assignments.filter((a) => a.facultyUid === userAccount?.uid && a.status === 'active').length}
                subtext="Created by you"
                actionLabel="Manage Assignments"
                onAction={() => setActiveModule('assignments')}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectionCard variant="tinted-header" accent="emerald" icon={Calendar} title="Today's Teaching Schedule">
            {teacherTodaySlots.length === 0 ? (
              <p className="text-[15px] text-slate-500 py-6 text-center">
                No timetable slots scheduled for you today ({todayWeekday}).
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {teacherTodaySlots.map((slot) => (
                  <div key={slot.id} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-medium text-slate-900">{slot.subjectName}</div>
                      <div className="text-[13.5px] text-slate-500 mt-0.5">
                        {classes.find((c) => c.id === slot.classId)?.name || 'Class'} · Room{' '}
                        {slot.room || 'TBD'}
                      </div>
                    </div>
                    <span className="font-mono text-[13.5px] font-medium text-slate-700 tabular-nums">
                      {slot.startTime}–{slot.endTime}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard variant="tinted-header" accent="blue" icon={Megaphone} title="Recent Institutional Notices">
            {notices.length === 0 ? (
              <p className="text-[15px] text-slate-500 py-6 text-center">No notices posted yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {notices.slice(0, 5).map((n) => (
                  <div key={n.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium text-slate-900 truncate">{n.title}</div>
                      <div className="text-[13.5px] text-slate-500 mt-0.5">
                        {formatDate(n.publishDate || n.createdAt)}
                      </div>
                    </div>
                    <StatusBadge status={n.status} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    );
  }

  if (role === 'accountant') {
    const totalInvoiced = studentFees.reduce((s, f) => s + f.amount, 0);
    return (
      <div className="space-y-7">
        <PageHeader
          accent="amber"
          icon={CreditCard}
          title="Financial Overview"
          subtitle={`${institution?.name || ''} · Accounting & Fee Operations`}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {dataLoading && studentFees.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="card" />)
          ) : (
            <>
              <StatCard
                accent="blue"
                icon={FileText}
                label="Total Fee Billed"
                value={formatCurrency(totalInvoiced, currency)}
                subtext={`${studentFees.length} student invoices`}
                actionLabel="Manage Fees"
                onAction={() => setActiveModule('fees')}
              />
              <StatCard
                accent="emerald"
                icon={CreditCard}
                label="Collected Revenue"
                value={formatCurrency(collectedFeesTotal, currency)}
                subtext={`${payments.filter((p) => p.gatewayStatus === 'recorded').length} recorded receipts`}
                actionLabel="View Accounting"
                onAction={() => setActiveModule('accounting')}
              />
              <StatCard
                accent="amber"
                icon={Layers}
                label="Outstanding Receivables"
                value={formatCurrency(pendingFeesTotal, currency)}
                subtext={`${studentFees.filter((f) => f.balanceAmount > 0).length} unpaid/partial invoices`}
                actionLabel="Collect Fee"
                onAction={() => setActiveModule('fees')}
              />
              <StatCard
                accent="slate"
                icon={BookOpen}
                label="Fee Categories"
                value={feeCategories.length}
                subtext={feeCategories.length === 0 ? 'No categories configured' : 'Configured fee heads'}
                actionLabel="Configure Categories"
                onAction={() => setActiveModule('fees')}
              />
            </>
          )}
        </div>

        <SectionCard variant="tinted-header" accent="emerald" icon={CreditCard} title="Recent Recorded Payments">
          {dataLoading && payments.length === 0 ? (
            <div className="space-y-4 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <Skeleton variant="text" lines={2} className="flex-1 max-w-sm" />
                  <Skeleton className="h-6 w-24 rounded-[6px]" />
                </div>
              ))}
            </div>
          ) : payments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No fee payments recorded yet"
              description="Assign fee structures to students and record payments to see real financial activity."
              actionLabel="Go to Fees"
              onAction={() => setActiveModule('fees')}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {payments.slice(0, 8).map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-medium text-slate-900">
                      <span className="font-mono">{p.receiptNumber}</span> · {p.studentName || p.studentId}
                    </div>
                    <div className="text-[13.5px] text-slate-500 mt-0.5">
                      {p.paymentMethod.replace(/_/g, ' ')} · {formatDate(p.paidAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[15px] font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(p.amount, currency)}
                    </span>
                    <StatusBadge status={p.gatewayStatus} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  if (role === 'librarian') {
    const totalCopies = libraryBooks.reduce((s, b) => s + b.quantity, 0);
    const availableCopies = libraryBooks.reduce((s, b) => s + b.availableQuantity, 0);
    const activeIssued = libraryTransactions.filter((t) => t.status === 'issued').length;
    const overdue = libraryTransactions.filter((t) => t.status === 'issued' && t.dueDate < today).length;
    return (
      <div className="space-y-7">
        <PageHeader accent="teal" icon={BookOpen} title="Library Overview" subtitle={`${institution?.name || ''} · Catalog & Circulation`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {dataLoading && libraryBooks.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="card" />)
          ) : (
            <>
              <StatCard
                accent="teal"
                icon={BookOpen}
                label="Catalog Titles"
                value={libraryBooks.length}
                subtext={`${totalCopies} total copies`}
                actionLabel="Manage Catalog"
                onAction={() => setActiveModule('library')}
              />
              <StatCard accent="emerald" icon={Layers} label="Available Copies" value={availableCopies} subtext="Ready for circulation" />
              <StatCard accent="blue" icon={UserCheck} label="Currently Issued" value={activeIssued} subtext="Active loans" />
              <StatCard accent="rose" icon={Calendar} label="Overdue Books" value={overdue} subtext="Past return due date" />
            </>
          )}
        </div>
      </div>
    );
  }

  // ==================== ADMINISTRATOR / PRINCIPAL / STAFF OVERVIEW ====================
  const maxBar = monthlyCollections.reduce((m, c) => Math.max(m, c.total), 0);
  const setupPct = Math.round((completedSetupCount / setupProgress.length) * 100);

  return (
    <div className="space-y-7">
      <PageHeader
        icon={LayoutDashboard}
        title="Institutional Dashboard"
        subtitle={`${institution?.name || ''} · ${ROLE_LABELS[role]}`}
        actions={
          !institution?.setupCompleted ? (
            <button
              type="button"
              onClick={() => setActiveModule('setup_wizard')}
              className="ec-btn-primary"
            >
              Continue Setup Wizard
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : undefined
        }
      />

      {/* Setup Onboarding Progress Banner (only when setup is incomplete) */}
      {!institution?.setupCompleted && (
        <SectionCard
          variant="tinted-header"
          accent="blue"
          icon={ListChecks}
          title="Let's set up your institution"
          subtitle={`${completedSetupCount} of ${setupProgress.length} core institutional foundations configured`}
          action={
            <button
              type="button"
              onClick={() => setActiveModule('setup_wizard')}
              className="text-[14px] font-semibold text-blue-800 hover:underline"
            >
              Open Guided 10-Step Setup →
            </button>
          }
        >
          <div className="mb-4">
            <div className="flex items-center justify-between text-[13px] font-medium text-slate-600 mb-1.5">
              <span>Setup Progress</span>
              <span className="tabular-nums font-semibold text-slate-800">{setupPct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-800 rounded-full transition-all duration-200"
                style={{ width: `${setupPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {setupProgress.map((step) => (
              <button
                key={step.label}
                type="button"
                onClick={() => setActiveModule(step.module)}
                className={`p-3.5 rounded-[10px] border text-left transition-all duration-150 ${
                  step.done
                    ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-900'
                    : 'bg-slate-50/80 border-slate-200 text-slate-700 hover:border-blue-600 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[14px] font-semibold truncate">{step.label}</span>
                  {step.done && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
                </div>
                <div className="mt-2">
                  <StatusBadge status={step.done ? 'configured' : 'pending'} size="sm" />
                </div>
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Primary KPI Grid - Strictly calculated from live database records */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {dataLoading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="card" />)
        ) : (
          <>
            <StatCard
              accent="blue"
              icon={GraduationCap}
              label="Students"
              value={yearStudents.length}
              subtext={
                yearStudents.length === 0
                  ? 'No students added yet'
                  : `${yearStudents.filter((s) => s.status === 'active').length} active`
              }
              actionLabel="Manage Students"
              onAction={() => setActiveModule('students')}
            />
            <StatCard
              accent="violet"
              icon={Users}
              label="Faculty"
              value={facultyList.length}
              subtext={
                facultyList.length === 0
                  ? 'No faculty members added yet'
                  : `${facultyList.filter((f) => f.status === 'active').length} active`
              }
              actionLabel="Manage Faculty"
              onAction={() => setActiveModule('faculty')}
            />
            <StatCard
              accent="teal"
              icon={Briefcase}
              label="Staff"
              value={staffList.length}
              subtext={
                staffList.length === 0
                  ? 'No non-teaching staff added yet'
                  : `${staffList.length} total staff`
              }
              actionLabel="Manage Staff"
              onAction={() => setActiveModule('staff')}
            />
            <StatCard
              accent="indigo"
              icon={Building2}
              label="Active Classes & Departments"
              value={`${classes.filter((c) => c.status === 'active').length} / ${departments.filter((d) => d.status === 'active').length}`}
              subtext={classes.length === 0 ? 'No classes configured yet' : `${subjects.length} subjects configured`}
              actionLabel="Configure Academics"
              onAction={() => setActiveModule('academics')}
            />
            <StatCard
              accent="emerald"
              icon={CheckSquare}
              label="Attendance Today"
              value={todayPresentPct !== null ? `${todayPresentPct}%` : '—'}
              subtext={
                todayAttendance.length === 0
                  ? 'No attendance marked today'
                  : `${todayAttendance.length} student records today`
              }
              actionLabel="Mark Attendance"
              onAction={() => setActiveModule('attendance')}
            />
            <StatCard
              accent="amber"
              icon={CreditCard}
              label="Pending Fees"
              value={formatCurrency(pendingFeesTotal, currency)}
              subtext={
                studentFees.length === 0
                  ? 'No fee invoices generated yet'
                  : `${studentFees.filter((f) => f.balanceAmount > 0).length} open invoices`
              }
              actionLabel="Open Fee Desk"
              onAction={() => setActiveModule('fees')}
            />
            <StatCard
              accent="cyan"
              icon={UserCheck}
              label="Admission Applications"
              value={admissions.length}
              subtext={
                admissions.length === 0
                  ? 'No admission applications yet'
                  : `${admissions.filter((a) => a.status === 'submitted' || a.status === 'under_review').length} awaiting review`
              }
              actionLabel="Open Admissions"
              onAction={() => setActiveModule('admissions')}
            />
            <StatCard
              accent="rose"
              icon={FileText}
              label="Examinations"
              value={examinations.length}
              subtext={
                examinations.length === 0
                  ? 'No examinations created yet'
                  : `${examinations.filter((e) => e.status === 'scheduled' || e.status === 'ongoing').length} upcoming/ongoing`
              }
              actionLabel="Manage Exams"
              onAction={() => setActiveModule('examinations')}
            />
          </>
        )}
      </div>

      {/* Real-Data Financial Chart + Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <SectionCard
          className="lg:col-span-8"
          variant="top-accent"
          accent="blue"
          icon={CreditCard}
          title="Fee Collections by Month"
          subtitle="Calculated directly from recorded payment receipts"
          action={
            <div className="text-right">
              <div className="text-[12.5px] font-medium text-slate-500">Total Collected</div>
              <div className="text-[17px] font-bold font-mono text-blue-950 tabular-nums">
                {formatCurrency(collectedFeesTotal, currency)}
              </div>
            </div>
          }
        >
          {dataLoading ? (
            <div className="rounded-[10px] bg-[#F8FAFC] border border-slate-200/80 p-5 h-60 flex items-end gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-2">
                  <Skeleton className={`w-full max-w-[48px] rounded-t-[6px] ${i % 2 === 0 ? 'h-28' : 'h-40'}`} />
                  <Skeleton className="h-3 w-12 rounded-[4px]" />
                </div>
              ))}
            </div>
          ) : monthlyCollections.length === 0 ? (
            <div className="py-12 px-6 text-center border border-dashed border-amber-200/80 rounded-[10px] bg-amber-50/30">
              <div className="w-12 h-12 rounded-[12px] bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 mx-auto mb-3.5">
                <CreditCard className="w-5 h-5" />
              </div>
              <p className="text-[16px] font-semibold text-slate-800">No fee transactions yet</p>
              <p className="text-[14px] text-slate-500 mt-1 max-w-md mx-auto">
                Monthly collection analytics will appear automatically once real fee payments are recorded.
              </p>
            </div>
          ) : (
            <div className="rounded-[10px] bg-[#F8FAFC] border border-slate-200/80 p-4 sm:p-5">
              <div className="relative flex items-end gap-4 h-56 pt-6 border-b border-slate-200">
                <div className="pointer-events-none absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between">
                  <div className="border-t border-dashed border-slate-200/80" />
                  <div className="border-t border-dashed border-slate-200/80" />
                  <div className="border-t border-dashed border-slate-200/80" />
                </div>
                {monthlyCollections.map((item) => {
                  const heightPct = maxBar > 0 ? Math.max(10, Math.round((item.total / maxBar) * 100)) : 10;
                  return (
                    <div
                      key={item.month}
                      className="relative z-10 flex-1 flex flex-col items-center justify-end h-full gap-2 group"
                    >
                      <div className="text-[12.5px] font-mono font-semibold text-slate-700 tabular-nums">
                        {formatCurrency(item.total, currency)}
                      </div>
                      <div
                        className="w-full max-w-[52px] bg-gradient-to-t from-blue-800 to-indigo-600 group-hover:from-blue-900 group-hover:to-indigo-700 rounded-t-[6px] transition-colors shadow-[0_2px_6px_rgba(30,64,175,0.16)]"
                        style={{ height: `${heightPct}%` }}
                        title={`${item.month}: ${formatCurrency(item.total, currency)}`}
                      />
                      <div className="text-[13px] font-mono text-slate-500 pb-1.5">{item.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          className="lg:col-span-4"
          variant="tinted-header"
          accent="violet"
          icon={Calendar}
          title="Upcoming Events"
          action={
            <button
              type="button"
              onClick={() => setActiveModule('calendar')}
              className="text-[14px] font-semibold text-blue-800 hover:underline"
            >
              Calendar
            </button>
          }
        >
          {dataLoading ? (
            <div className="space-y-4 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="text" lines={2} />
              ))}
            </div>
          ) : calendarEvents.filter((e) => e.startDate >= today).length === 0 ? (
            <div className="py-10 text-center">
              <div className="w-12 h-12 rounded-[12px] bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mx-auto mb-3.5">
                <Calendar className="w-5 h-5" />
              </div>
              <p className="text-[15px] font-medium text-slate-700">No upcoming events</p>
              <p className="text-[13.5px] text-slate-500 mt-1">
                Create your first institutional event to see it here.
              </p>
              <button
                type="button"
                onClick={() => setActiveModule('calendar')}
                className="mt-4 ec-btn-secondary text-[13.5px]"
              >
                Add Event
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {calendarEvents
                .filter((e) => e.startDate >= today)
                .sort((a, b) => a.startDate.localeCompare(b.startDate))
                .slice(0, 5)
                .map((ev) => (
                  <div key={ev.id} className="py-3">
                    <div className="text-[15px] font-medium text-slate-900">{ev.title}</div>
                    <div className="text-[13.5px] text-slate-500 mt-0.5 capitalize">
                      {formatDate(ev.startDate)} · {ev.eventType.replace(/_/g, ' ')}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Bottom Operational Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard
          variant="tinted-header"
          accent="cyan"
          icon={UserCheck}
          title="Recent Admissions"
          action={
            <button
              type="button"
              onClick={() => setActiveModule('admissions')}
              className="text-[14px] font-semibold text-blue-800 hover:underline"
            >
              View All
            </button>
          }
        >
          {dataLoading ? (
            <div className="space-y-4 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton variant="text" lines={2} className="flex-1" />
                  <Skeleton className="h-6 w-20 rounded-[6px] shrink-0" />
                </div>
              ))}
            </div>
          ) : admissions.length === 0 ? (
            <p className="text-[15px] text-slate-500 py-8 text-center">
              No admission applications recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {admissions.slice(0, 5).map((adm) => (
                <div key={adm.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium text-slate-900 truncate">
                      {adm.firstName} {adm.lastName}
                    </div>
                    <div className="text-[13px] font-mono text-slate-500 mt-0.5">
                      {adm.applicationNumber}
                    </div>
                  </div>
                  <StatusBadge status={adm.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          variant="tinted-header"
          accent="purple"
          icon={FileText}
          title="Upcoming Examinations"
          action={
            <button
              type="button"
              onClick={() => setActiveModule('examinations')}
              className="text-[14px] font-semibold text-blue-800 hover:underline"
            >
              View All
            </button>
          }
        >
          {dataLoading ? (
            <div className="space-y-4 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton variant="text" lines={2} className="flex-1" />
                  <Skeleton className="h-6 w-20 rounded-[6px] shrink-0" />
                </div>
              ))}
            </div>
          ) : examinations.length === 0 ? (
            <p className="text-[15px] text-slate-500 py-8 text-center">No examinations created yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {examinations.slice(0, 5).map((ex) => (
                <div key={ex.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium text-slate-900 truncate">{ex.name}</div>
                    <div className="text-[13px] text-slate-500 mt-0.5 capitalize">
                      {ex.examType.replace(/_/g, ' ')}{' '}
                      {ex.startDate ? `· ${formatDate(ex.startDate)}` : ''}
                    </div>
                  </div>
                  <StatusBadge status={ex.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          variant="tinted-header"
          accent="blue"
          icon={Megaphone}
          title="Recent Notices"
          action={
            <button
              type="button"
              onClick={() => setActiveModule('notices')}
              className="text-[14px] font-semibold text-blue-800 hover:underline"
            >
              Notice Board
            </button>
          }
        >
          {dataLoading ? (
            <div className="space-y-4 py-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton variant="text" lines={2} className="flex-1" />
                  <Skeleton className="h-6 w-20 rounded-[6px] shrink-0" />
                </div>
              ))}
            </div>
          ) : notices.length === 0 ? (
            <p className="text-[15px] text-slate-500 py-8 text-center">
              No institutional notices created yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {notices.slice(0, 5).map((n) => (
                <div key={n.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[15px] font-medium text-slate-900 truncate">{n.title}</div>
                    <div className="text-[13px] text-slate-500 mt-0.5">Audience: {n.targetAudience}</div>
                  </div>
                  <StatusBadge status={n.status} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
