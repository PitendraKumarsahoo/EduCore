import React, { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { saveInstDoc, subscribeInstCollection, where, writeAuditLog } from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import {
  fileToConstrainedDataUrl,
  formatCurrency,
  formatDate,
  generateId,
  nowIso,
  todayDateStr,
} from '../utils/format';
import { exportToCsv, parseCsvText } from '../utils/csv';
import {
  Avatar,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  QrCodeCanvas,
  SectionCard,
  StatusBadge,
  Tabs,
} from '../components/ui/Primitives';
import type {
  DisciplineRecord,
  DocumentRecord,
  ExamMark,
  HostelAllocation,
  MessageItem,
  Student,
  TransportRoute,
} from '../types';

type StudentProfileTab =
  | 'overview'
  | 'attendance'
  | 'academics'
  | 'examinations'
  | 'fees'
  | 'documents'
  | 'discipline'
  | 'library'
  | 'transport'
  | 'communication';

export function StudentsModule() {
  const {
    institution,
    member,
    userAccount,
    activeYearId,
    can,
    pushToast,
    students,
    academicYears,
    departments,
    programs,
    classes,
    sections,
    subjects,
    attendance,
    examinations,
    studentFees,
    payments,
    libraryTransactions,
    selectedStudentIdForProfile,
    setSelectedStudentIdForProfile,
    dataLoading,
  } = useApp();

  const canCreate = can('students', 'create');
  const canEdit = can('students', 'edit');
  const canDelete = can('students', 'delete');
  const canExport = can('students', 'export');

  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Multi-step Add/Edit modal
  const [formOpen, setFormOpen] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [editing, setEditing] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Student>>({
    status: 'active',
    admissionDate: todayDateStr(),
  });

  // Profile modal + 10 tabs
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [profileTab, setProfileTab] = useState<StudentProfileTab>('overview');
  const [profileMarks, setProfileMarks] = useState<ExamMark[]>([]);
  const [profileDocs, setProfileDocs] = useState<DocumentRecord[]>([]);
  const [transportRoutes, setTransportRoutes] = useState<TransportRoute[]>([]);
  const [hostelAllocs, setHostelAllocs] = useState<HostelAllocation[]>([]);
  const [profileMessages, setProfileMessages] = useState<MessageItem[]>([]);

  // Discipline form inside profile
  const [discCat, setDiscCat] = useState('Academic Conduct');
  const [discDesc, setDiscDesc] = useState('');
  const [discAction, setDiscAction] = useState('');

  // ID Card modal
  const [idCardStudent, setIdCardStudent] = useState<Student | null>(null);

  // Soft delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);

  // CSV Import modal
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  // Sync deep-link from global search
  useEffect(() => {
    if (selectedStudentIdForProfile) {
      const found = students.find((s) => s.id === selectedStudentIdForProfile);
      if (found) {
        setProfileStudent(found);
        setProfileTab('overview');
      }
      setSelectedStudentIdForProfile(null);
    }
  }, [selectedStudentIdForProfile, students, setSelectedStudentIdForProfile]);

  // Subscribe to profile-specific data when profile modal is open
  useEffect(() => {
    if (!institution?.id || !profileStudent || !member) {
      setProfileMarks([]);
      setProfileDocs([]);
      setTransportRoutes([]);
      setHostelAllocs([]);
      setProfileMessages([]);
      return;
    }
    const instId = institution.id;
    const role = member.role;
    const isInstAdmin = ['super_admin', 'institution_admin', 'principal', 'vice_principal'].includes(role);
    const isTeacherOrAbove = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod', 'teacher'].includes(role);
    const isStaff = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod', 'teacher', 'accountant', 'librarian', 'receptionist'].includes(role);

    const unsubs: (() => void)[] = [
      subscribeInstCollection<TransportRoute>(instId, 'transport_routes', [], setTransportRoutes),
      subscribeInstCollection<HostelAllocation>(
        instId,
        'hostel_allocations',
        [where('studentId', '==', profileStudent.id)],
        setHostelAllocs,
      ),
    ];

    if (isTeacherOrAbove) {
      unsubs.push(
        subscribeInstCollection<ExamMark>(
          instId,
          'marks',
          [where('studentId', '==', profileStudent.id)],
          setProfileMarks,
        ),
      );
    } else if (role === 'student' && userAccount?.uid && profileStudent.userUid === userAccount.uid) {
      unsubs.push(
        subscribeInstCollection<ExamMark>(
          instId,
          'marks',
          [where('isPublished', '==', true), where('studentUserUid', '==', userAccount.uid)],
          (rows) => setProfileMarks(rows.filter((m) => m.studentId === profileStudent.id)),
        ),
      );
    } else if (role === 'parent' && userAccount?.uid && profileStudent.parentUid === userAccount.uid) {
      unsubs.push(
        subscribeInstCollection<ExamMark>(
          instId,
          'marks',
          [where('isPublished', '==', true), where('parentUserUid', '==', userAccount.uid)],
          (rows) => setProfileMarks(rows.filter((m) => m.studentId === profileStudent.id)),
        ),
      );
    } else {
      setProfileMarks([]);
    }

    if (isStaff) {
      unsubs.push(
        subscribeInstCollection<DocumentRecord>(
          instId,
          'documents',
          [where('ownerId', '==', profileStudent.id)],
          setProfileDocs,
        ),
      );
    } else if (userAccount?.uid) {
      unsubs.push(
        subscribeInstCollection<DocumentRecord>(
          instId,
          'documents',
          [where('uploadedByUid', '==', userAccount.uid)],
          (rows) => setProfileDocs(rows.filter((d) => d.ownerId === profileStudent.id)),
        ),
      );
    } else {
      setProfileDocs([]);
    }

    if (profileStudent.userUid && (isInstAdmin || profileStudent.userUid === userAccount?.uid)) {
      unsubs.push(
        subscribeInstCollection<MessageItem>(
          instId,
          'messages',
          [where('recipientUid', '==', profileStudent.userUid)],
          setProfileMessages,
        ),
      );
    } else {
      setProfileMessages([]);
    }

    return () => unsubs.forEach((u) => u());
  }, [institution?.id, profileStudent, member?.role, userAccount?.uid]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections]);
  const programMap = useMemo(() => new Map(programs.map((p) => [p.id, p.name])), [programs]);
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);
  const yearMap = useMemo(() => new Map(academicYears.map((y) => [y.id, y.name])), [academicYears]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const examMap = useMemo(() => new Map(examinations.map((e) => [e.id, e.name])), [examinations]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (classFilter && s.classId !== classFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      return true;
    });
  }, [students, classFilter, statusFilter]);

  const openAdd = () => {
    setEditing(null);
    setFormStep(1);
    setForm({
      studentCode: `STU-${Date.now().toString().slice(-6)}`,
      academicYearId: activeYearId || academicYears.find((y) => y.isCurrent)?.id || '',
      admissionDate: todayDateStr(),
      status: 'active',
    });
    setFormOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditing(s);
    setFormStep(1);
    setForm({ ...s });
    setFormOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToConstrainedDataUrl(file, 200 * 1024);
      setForm((prev) => ({ ...prev, photoUrl: dataUrl }));
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Photo exceeds 200 KB limit.'));
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount) return;
    if (!form.firstName?.trim() || !form.lastName?.trim() || !form.studentCode?.trim()) {
      pushToast('error', 'Student code, first name, and last name are required.');
      setFormStep(1);
      return;
    }

    const duplicate = students.find(
      (s) =>
        s.studentCode.toLowerCase() === form.studentCode!.trim().toLowerCase() &&
        s.id !== editing?.id,
    );
    if (duplicate) {
      pushToast('error', `Student ID "${form.studentCode}" already exists.`);
      setFormStep(1);
      return;
    }

    setSaving(true);
    try {
      const ts = nowIso();
      const id = editing?.id || generateId('stu');
      const payload: Omit<Student, 'id'> = {
        institutionId: institution.id,
        studentCode: form.studentCode.trim(),
        admissionNumber: form.admissionNumber?.trim() || undefined,
        rollNumber: form.rollNumber?.trim() || undefined,
        firstName: form.firstName.trim(),
        middleName: form.middleName?.trim() || undefined,
        lastName: form.lastName.trim(),
        dob: form.dob || undefined,
        gender: form.gender || undefined,
        bloodGroup: form.bloodGroup || undefined,
        phone: form.phone?.trim() || undefined,
        email: form.email?.trim() || undefined,
        address: form.address?.trim() || undefined,
        city: form.city?.trim() || undefined,
        state: form.state?.trim() || undefined,
        country: form.country?.trim() || undefined,
        postalCode: form.postalCode?.trim() || undefined,
        photoUrl: form.photoUrl || undefined,
        admissionDate: form.admissionDate || undefined,
        academicYearId: form.academicYearId || undefined,
        departmentId: form.departmentId || undefined,
        programId: form.programId || undefined,
        classId: form.classId || undefined,
        sectionId: form.sectionId || undefined,
        status: form.status || 'active',
        previousInstitution: form.previousInstitution?.trim() || undefined,
        transferInfo: form.transferInfo?.trim() || undefined,
        guardianName: form.guardianName?.trim() || undefined,
        guardianRelation: form.guardianRelation?.trim() || undefined,
        guardianPhone: form.guardianPhone?.trim() || undefined,
        guardianEmail: form.guardianEmail?.trim() || undefined,
        emergencyContactName: form.emergencyContactName?.trim() || undefined,
        emergencyContactPhone: form.emergencyContactPhone?.trim() || undefined,
        userUid: form.userUid?.trim() || undefined,
        parentUid: form.parentUid?.trim() || undefined,
        disciplineRecords: editing?.disciplineRecords || [],
        isDeleted: false,
        createdAt: editing?.createdAt || ts,
        updatedAt: ts,
      };
      await saveInstDoc(institution.id, 'students', id, payload, !editing);
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: editing ? 'update' : 'create',
        module: 'students',
        recordId: id,
        summary: `${editing ? 'Updated' : 'Created'} student ${payload.firstName} ${payload.lastName} (${payload.studentCode})`,
      });
      pushToast('success', editing ? 'Student record updated.' : 'Student added successfully.');
      setFormOpen(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to save student.'));
    } finally {
      setSaving(false);
    }
  };

  const handleBulkStatus = async (ids: string[], clearSelection: () => void, nextStatus: Student['status']) => {
    if (!institution || !userAccount) return;
    try {
      const ts = nowIso();
      await Promise.all(
        ids.map((id) => {
          const st = students.find((s) => s.id === id);
          if (!st) return Promise.resolve();
          return saveInstDoc(institution.id, 'students', id, { ...st, status: nextStatus, updatedAt: ts }, false);
        }),
      );
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: 'bulk_update',
        module: 'students',
        summary: `Bulk updated ${ids.length} students to status "${nextStatus}"`,
      });
      pushToast('success', `Updated ${ids.length} student records.`);
      clearSelection();
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Bulk update failed.'));
    }
  };

  const handleSoftDelete = async () => {
    if (!institution || !deleteTarget || !userAccount) return;
    try {
      await saveInstDoc(
        institution.id,
        'students',
        deleteTarget.id,
        { ...deleteTarget, isDeleted: true, status: 'withdrawn', updatedAt: nowIso() },
        false,
      );
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: 'delete',
        module: 'students',
        recordId: deleteTarget.id,
        summary: `Archived student ${deleteTarget.firstName} ${deleteTarget.lastName} (${deleteTarget.studentCode})`,
      });
      pushToast('success', 'Student archived.');
      setDeleteTarget(null);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to archive student.'));
    }
  };

  const handleAddDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !profileStudent || !userAccount || !discDesc.trim()) return;
    try {
      const nextRec: DisciplineRecord = {
        date: todayDateStr(),
        category: discCat,
        description: discDesc.trim(),
        actionTaken: discAction.trim() || 'Recorded',
        recordedBy: userAccount.displayName,
      };
      const updated = [...(profileStudent.disciplineRecords || []), nextRec];
      await saveInstDoc(
        institution.id,
        'students',
        profileStudent.id,
        { ...profileStudent, disciplineRecords: updated, updatedAt: nowIso() },
        false,
      );
      setProfileStudent({ ...profileStudent, disciplineRecords: updated });
      setDiscDesc('');
      setDiscAction('');
      pushToast('success', 'Discipline record saved.');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to save discipline record.'));
    }
  };

  // CSV Import Handlers
  const downloadImportTemplate = () => {
    exportToCsv(
      'student_import_template',
      ['studentCode', 'firstName', 'lastName', 'email', 'phone', 'gender', 'dob', 'rollNumber', 'guardianName', 'guardianPhone'],
      [],
    );
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { headers, rows } = parseCsvText(text);
    const required = ['studentCode', 'firstName', 'lastName'];
    const errs: string[] = [];
    for (const req of required) {
      if (!headers.includes(req)) errs.push(`Missing required column: "${req}"`);
    }
    const existingCodes = new Set(students.map((s) => s.studentCode.toLowerCase()));
    const seenInFile = new Set<string>();
    rows.forEach((r, idx) => {
      const code = (r.studentCode || '').trim().toLowerCase();
      if (!code || !r.firstName?.trim() || !r.lastName?.trim()) {
        errs.push(`Row ${idx + 2}: studentCode, firstName, and lastName are required.`);
      } else if (existingCodes.has(code)) {
        errs.push(`Row ${idx + 2}: duplicate studentCode "${r.studentCode}" already exists.`);
      } else if (seenInFile.has(code)) {
        errs.push(`Row ${idx + 2}: duplicate studentCode "${r.studentCode}" inside CSV.`);
      }
      if (code) seenInFile.add(code);
    });
    setImportErrors(errs);
    setImportRows(rows);
  };

  const confirmCsvImport = async () => {
    if (!institution || !userAccount || importErrors.length > 0 || importRows.length === 0) return;
    setImporting(true);
    try {
      const ts = nowIso();
      for (const r of importRows) {
        const id = generateId('stu');
        const payload: Omit<Student, 'id'> = {
          institutionId: institution.id,
          studentCode: r.studentCode.trim(),
          firstName: r.firstName.trim(),
          lastName: r.lastName.trim(),
          email: r.email?.trim() || undefined,
          phone: r.phone?.trim() || undefined,
          gender: r.gender?.trim() || undefined,
          dob: r.dob?.trim() || undefined,
          rollNumber: r.rollNumber?.trim() || undefined,
          guardianName: r.guardianName?.trim() || undefined,
          guardianPhone: r.guardianPhone?.trim() || undefined,
          academicYearId: activeYearId || undefined,
          admissionDate: todayDateStr(),
          status: 'active',
          isDeleted: false,
          createdAt: ts,
          updatedAt: ts,
        };
        await saveInstDoc(institution.id, 'students', id, payload, true);
      }
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: 'import',
        module: 'students',
        summary: `Imported ${importRows.length} students via CSV`,
      });
      pushToast('success', `Imported ${importRows.length} students.`);
      setImportOpen(false);
      setImportRows([]);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'CSV import failed.'));
    } finally {
      setImporting(false);
    }
  };

  // Computed profile slices
  const profileAtt = useMemo(
    () => (profileStudent ? attendance.filter((a) => a.targetId === profileStudent.id) : []),
    [profileStudent, attendance],
  );
  const profileFees = useMemo(
    () => (profileStudent ? studentFees.filter((f) => f.studentId === profileStudent.id) : []),
    [profileStudent, studentFees],
  );
  const profilePayments = useMemo(
    () => (profileStudent ? payments.filter((p) => p.studentId === profileStudent.id) : []),
    [profileStudent, payments],
  );
  const profileLibrary = useMemo(
    () => (profileStudent ? libraryTransactions.filter((t) => t.borrowerId === profileStudent.id) : []),
    [profileStudent, libraryTransactions],
  );
  const profileRoute = useMemo(
    () =>
      profileStudent
        ? transportRoutes.find((r) => r.assignedStudentIds?.includes(profileStudent.id))
        : undefined,
    [profileStudent, transportRoutes],
  );

  return (
    <div>
      <PageHeader
        icon={GraduationCap}
        title="Students"
        subtitle="Manage student directory, enrollment profiles, ID cards, and bulk CSV imports."
        actions={
          <>
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setImportRows([]);
                  setImportErrors([]);
                  setImportOpen(true);
                }}
                className="ec-btn-secondary"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
            )}
            {canCreate && (
              <button type="button" onClick={openAdd} className="ec-btn-primary">
                <Plus className="w-4 h-4" />
                Add Student
              </button>
            )}
          </>
        }
      />

      <DataTable
        rows={filteredStudents}
        loading={dataLoading}
        searchPlaceholder="Search by name, student ID, roll no, email..."
        searchFilter={(s, q) =>
          `${s.firstName} ${s.lastName} ${s.studentCode} ${s.rollNumber || ''} ${s.email || ''} ${s.guardianName || ''}`
            .toLowerCase()
            .includes(q)
        }
        filters={
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="ec-select w-auto min-w-[180px] py-2 text-[14px]"
            >
              <option value="">All Classes / Semesters</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ec-select w-auto min-w-[150px] py-2 text-[14px]"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="graduated">Graduated</option>
              <option value="transferred">Transferred</option>
              <option value="suspended">Suspended</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        }
        onExport={
          canExport
            ? (rows) =>
                exportToCsv(
                  'students',
                  ['Student ID', 'Roll No', 'First Name', 'Last Name', 'Class', 'Section', 'Guardian', 'Phone', 'Email', 'Status'],
                  rows.map((r) => [
                    r.studentCode,
                    r.rollNumber || '',
                    r.firstName,
                    r.lastName,
                    classMap.get(r.classId || '') || '',
                    sectionMap.get(r.sectionId || '') || '',
                    r.guardianName || '',
                    r.phone || r.guardianPhone || '',
                    r.email || '',
                    r.status,
                  ]),
                )
            : undefined
        }
        bulkActions={
          canEdit
            ? (ids, clear) => (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBulkStatus(ids, clear, 'active')}
                    className="ec-btn-secondary px-2.5 py-1 text-[13px]"
                  >
                    Set Active
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkStatus(ids, clear, 'graduated')}
                    className="ec-btn-secondary px-2.5 py-1 text-[13px]"
                  >
                    Mark Graduated
                  </button>
                </div>
              )
            : undefined
        }
        columns={[
          {
            key: 'code',
            header: 'Student ID',
            sortValue: (s) => s.studentCode,
            render: (s) => <span className="font-mono text-[13.5px] font-medium text-slate-700">{s.studentCode}</span>,
          },
          {
            key: 'name',
            header: 'Student Name',
            sortValue: (s) => `${s.firstName} ${s.lastName}`,
            render: (s) => (
              <div className="flex items-center gap-3">
                <Avatar src={s.photoUrl} name={`${s.firstName} ${s.lastName}`} size="md" />
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileStudent(s);
                      setProfileTab('overview');
                    }}
                    className="text-[15px] font-semibold text-slate-900 hover:text-blue-800 hover:underline text-left"
                  >
                    {s.firstName} {s.lastName}
                  </button>
                  {s.rollNumber && <div className="text-[13px] text-slate-500">Roll: {s.rollNumber}</div>}
                </div>
              </div>
            ),
          },
          {
            key: 'class',
            header: 'Class / Section',
            sortValue: (s) => classMap.get(s.classId || '') || '',
            render: (s) => (
              <span className="text-slate-700">
                {classMap.get(s.classId || '') || 'Unassigned'}
                {s.sectionId ? ` · ${sectionMap.get(s.sectionId) || ''}` : ''}
              </span>
            ),
          },
          {
            key: 'guardian',
            header: 'Guardian / Contact',
            render: (s) => (
              <div>
                <div className="text-[14px] text-slate-800">{s.guardianName || '—'}</div>
                <div className="text-[13px] text-slate-500">{s.guardianPhone || s.phone || '—'}</div>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            sortValue: (s) => s.status,
            render: (s) => <StatusBadge status={s.status} />,
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (s) => (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileStudent(s);
                    setProfileTab('overview');
                  }}
                  title="View 10-Tab Profile"
                  className="p-2 text-slate-600 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIdCardStudent(s)}
                  title="Generate ID Card"
                  className="p-2 text-slate-600 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEdit(s)}
                    title="Edit Student"
                    className="p-2 text-slate-600 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(s)}
                    title="Archive Student"
                    className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-[8px] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ),
          },
        ]}
        emptyState={
          <EmptyState
            icon={Users}
            title="No students added yet"
            description="Enroll students individually, convert approved admissions, or import a CSV roster."
            actionLabel={canCreate ? 'Add Student' : undefined}
            onAction={canCreate ? openAdd : undefined}
          />
        }
      />

      {/* Multi-step Add/Edit Student Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit Student · ${editing.firstName} ${editing.lastName}` : 'Add New Student'}
        subtitle={`Step ${formStep} of 3: ${
          formStep === 1 ? 'Student Identity & Contact' : formStep === 2 ? 'Guardian & Emergency Contact' : 'Academic Enrollment'
        }`}
        size="xl"
      >
        <form onSubmit={handleSaveStudent} className="space-y-5">
          <Tabs
            value={String(formStep) as '1' | '2' | '3'}
            onChange={(val) => setFormStep(Number(val) as 1 | 2 | 3)}
            items={[
              { key: '1', label: '1. Student Info' },
              { key: '2', label: '2. Guardian & Emergency' },
              { key: '3', label: '3. Academic Enrollment' },
            ]}
          />

          {formStep === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Student ID / Code" required>
                <input
                  required
                  value={form.studentCode || ''}
                  onChange={(e) => setForm((p) => ({ ...p, studentCode: e.target.value }))}
                  className="ec-input font-mono"
                />
              </FormField>
              <FormField label="Admission No">
                <input
                  value={form.admissionNumber || ''}
                  onChange={(e) => setForm((p) => ({ ...p, admissionNumber: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Roll Number">
                <input
                  value={form.rollNumber || ''}
                  onChange={(e) => setForm((p) => ({ ...p, rollNumber: e.target.value }))}
                  className="ec-input"
                />
              </FormField>

              <FormField label="First Name" required>
                <input
                  required
                  value={form.firstName || ''}
                  onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Middle Name">
                <input
                  value={form.middleName || ''}
                  onChange={(e) => setForm((p) => ({ ...p, middleName: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Last Name" required>
                <input
                  required
                  value={form.lastName || ''}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  className="ec-input"
                />
              </FormField>

              <FormField label="Date of Birth">
                <input
                  type="date"
                  value={form.dob || ''}
                  onChange={(e) => setForm((p) => ({ ...p, dob: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Gender">
                <select
                  value={form.gender || ''}
                  onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                  className="ec-select"
                >
                  <option value="">Select</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </FormField>
              <FormField label="Blood Group">
                <input
                  value={form.bloodGroup || ''}
                  onChange={(e) => setForm((p) => ({ ...p, bloodGroup: e.target.value }))}
                  placeholder="e.g. O+"
                  className="ec-input"
                />
              </FormField>

              <FormField label="Email">
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Phone">
                <input
                  value={form.phone || ''}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Photo (max 200 KB)">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="w-full text-[13.5px] text-slate-600 py-2"
                />
              </FormField>

              <FormField label="Address" className="md:col-span-3">
                <input
                  value={form.address || ''}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
            </div>
          )}

          {formStep === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Guardian Name">
                <input
                  value={form.guardianName || ''}
                  onChange={(e) => setForm((p) => ({ ...p, guardianName: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Relation">
                <input
                  value={form.guardianRelation || ''}
                  onChange={(e) => setForm((p) => ({ ...p, guardianRelation: e.target.value }))}
                  placeholder="Father / Mother / Guardian"
                  className="ec-input"
                />
              </FormField>
              <FormField label="Guardian Phone">
                <input
                  value={form.guardianPhone || ''}
                  onChange={(e) => setForm((p) => ({ ...p, guardianPhone: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Guardian Email">
                <input
                  type="email"
                  value={form.guardianEmail || ''}
                  onChange={(e) => setForm((p) => ({ ...p, guardianEmail: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Emergency Contact Name">
                <input
                  value={form.emergencyContactName || ''}
                  onChange={(e) => setForm((p) => ({ ...p, emergencyContactName: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Emergency Contact Phone">
                <input
                  value={form.emergencyContactPhone || ''}
                  onChange={(e) => setForm((p) => ({ ...p, emergencyContactPhone: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Previous Institution">
                <input
                  value={form.previousInstitution || ''}
                  onChange={(e) => setForm((p) => ({ ...p, previousInstitution: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Transfer Info / TC Notes">
                <input
                  value={form.transferInfo || ''}
                  onChange={(e) => setForm((p) => ({ ...p, transferInfo: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
            </div>
          )}

          {formStep === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Academic Year">
                <select
                  value={form.academicYearId || ''}
                  onChange={(e) => setForm((p) => ({ ...p, academicYearId: e.target.value }))}
                  className="ec-select"
                >
                  <option value="">Select Academic Year</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Admission Date">
                <input
                  type="date"
                  value={form.admissionDate || ''}
                  onChange={(e) => setForm((p) => ({ ...p, admissionDate: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Department">
                <select
                  value={form.departmentId || ''}
                  onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}
                  className="ec-select"
                >
                  <option value="">None / General</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Program">
                <select
                  value={form.programId || ''}
                  onChange={(e) => setForm((p) => ({ ...p, programId: e.target.value }))}
                  className="ec-select"
                >
                  <option value="">None</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Class / Semester">
                <select
                  value={form.classId || ''}
                  onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value, sectionId: '' }))}
                  className="ec-select"
                >
                  <option value="">Unassigned</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Section / Batch">
                <select
                  value={form.sectionId || ''}
                  onChange={(e) => setForm((p) => ({ ...p, sectionId: e.target.value }))}
                  className="ec-select"
                >
                  <option value="">Unassigned</option>
                  {sections
                    .filter((sec) => !form.classId || sec.classId === form.classId)
                    .map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        {sec.name}
                      </option>
                    ))}
                </select>
              </FormField>
              <FormField label="Enrollment Status">
                <select
                  value={form.status || 'active'}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Student['status'] }))}
                  className="ec-select"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="graduated">Graduated</option>
                  <option value="transferred">Transferred</option>
                  <option value="suspended">Suspended</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </FormField>
              <FormField label="Linked Student User UID (optional)">
                <input
                  value={form.userUid || ''}
                  onChange={(e) => setForm((p) => ({ ...p, userUid: e.target.value }))}
                  placeholder="Linked from Users & Roles"
                  className="ec-input font-mono"
                />
              </FormField>
              <FormField label="Linked Parent User UID (optional)">
                <input
                  value={form.parentUid || ''}
                  onChange={(e) => setForm((p) => ({ ...p, parentUid: e.target.value }))}
                  placeholder="Linked from Users & Roles"
                  className="ec-input font-mono"
                />
              </FormField>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div>
              {formStep > 1 && (
                <button
                  type="button"
                  onClick={() => setFormStep((s) => (s === 3 ? 2 : 1))}
                  className="ec-btn-secondary"
                >
                  Previous
                </button>
              )}
            </div>
            <div className="flex gap-2.5">
              <button type="button" onClick={() => setFormOpen(false)} className="ec-btn-secondary">
                Cancel
              </button>
              {formStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setFormStep((s) => (s === 1 ? 2 : 3))}
                  className="ec-btn-primary"
                >
                  Next Step
                </button>
              ) : (
                <button type="submit" disabled={saving} className="ec-btn-primary">
                  {saving ? 'Saving...' : editing ? 'Update Student' : 'Save Student'}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* 10-Tab Student Profile Modal */}
      <Modal
        open={Boolean(profileStudent)}
        onClose={() => setProfileStudent(null)}
        title={profileStudent ? `${profileStudent.firstName} ${profileStudent.lastName}` : ''}
        subtitle={
          profileStudent
            ? `Student ID: ${profileStudent.studentCode} · ${classMap.get(profileStudent.classId || '') || 'Unassigned'}`
            : ''
        }
        size="2xl"
        footer={
          profileStudent && (
            <>
              <button type="button" onClick={() => window.print()} className="ec-btn-secondary">
                <Printer className="w-4 h-4" />
                Print Profile
              </button>
              <button
                type="button"
                onClick={() => setIdCardStudent(profileStudent)}
                className="ec-btn-primary"
              >
                <CreditCard className="w-4 h-4" />
                ID Card
              </button>
            </>
          )
        }
      >
        {profileStudent && (
          <div className="space-y-5 print-surface">
            <div className="no-print">
              <Tabs
                value={profileTab}
                onChange={setProfileTab}
                items={[
                  { key: 'overview', label: 'Overview' },
                  { key: 'attendance', label: 'Attendance' },
                  { key: 'academics', label: 'Academic Records' },
                  { key: 'examinations', label: 'Examinations' },
                  { key: 'fees', label: 'Fees' },
                  { key: 'documents', label: 'Documents' },
                  { key: 'discipline', label: 'Discipline' },
                  { key: 'library', label: 'Library' },
                  { key: 'transport', label: 'Transport & Hostel' },
                  { key: 'communication', label: 'Communication' },
                ]}
              />
            </div>

            {profileTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <SectionCard variant="top-accent">
                  <div className="flex items-center gap-3.5 mb-4">
                    <Avatar
                      src={profileStudent.photoUrl}
                      name={`${profileStudent.firstName} ${profileStudent.lastName}`}
                      size="xl"
                    />
                    <div>
                      <div className="text-[16px] font-semibold text-slate-900">
                        {profileStudent.firstName} {profileStudent.middleName || ''} {profileStudent.lastName}
                      </div>
                      <div className="mt-1.5">
                        <StatusBadge status={profileStudent.status} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-[14px]">
                    <div className="text-slate-500">DOB: <span className="text-slate-900 font-medium">{formatDate(profileStudent.dob)}</span></div>
                    <div className="text-slate-500">Gender: <span className="text-slate-900 font-medium">{profileStudent.gender || '—'}</span></div>
                    <div className="text-slate-500">Blood Group: <span className="text-slate-900 font-medium">{profileStudent.bloodGroup || '—'}</span></div>
                    <div className="text-slate-500">Email: <span className="text-slate-900 font-medium">{profileStudent.email || '—'}</span></div>
                    <div className="text-slate-500">Phone: <span className="text-slate-900 font-medium">{profileStudent.phone || '—'}</span></div>
                  </div>
                </SectionCard>
                <SectionCard variant="tinted-header" title="Academic Placement">
                  <div className="space-y-2 text-[14px]">
                    <div className="text-slate-500">Academic Year: <span className="text-slate-900 font-medium">{yearMap.get(profileStudent.academicYearId || '') || '—'}</span></div>
                    <div className="text-slate-500">Department: <span className="text-slate-900 font-medium">{deptMap.get(profileStudent.departmentId || '') || '—'}</span></div>
                    <div className="text-slate-500">Program: <span className="text-slate-900 font-medium">{programMap.get(profileStudent.programId || '') || '—'}</span></div>
                    <div className="text-slate-500">Class: <span className="text-slate-900 font-medium">{classMap.get(profileStudent.classId || '') || '—'}</span></div>
                    <div className="text-slate-500">Section: <span className="text-slate-900 font-medium">{sectionMap.get(profileStudent.sectionId || '') || '—'}</span></div>
                    <div className="text-slate-500">Roll No: <span className="text-slate-900 font-medium">{profileStudent.rollNumber || '—'}</span></div>
                    <div className="text-slate-500">Admission Date: <span className="text-slate-900 font-medium">{formatDate(profileStudent.admissionDate)}</span></div>
                  </div>
                </SectionCard>
                <SectionCard variant="tinted-header" title="Guardian & Address">
                  <div className="space-y-2 text-[14px]">
                    <div className="text-slate-500">Guardian: <span className="text-slate-900 font-medium">{profileStudent.guardianName || '—'} ({profileStudent.guardianRelation || 'Guardian'})</span></div>
                    <div className="text-slate-500">Guardian Phone: <span className="text-slate-900 font-medium">{profileStudent.guardianPhone || '—'}</span></div>
                    <div className="text-slate-500">Guardian Email: <span className="text-slate-900 font-medium">{profileStudent.guardianEmail || '—'}</span></div>
                    <div className="text-slate-500">Emergency: <span className="text-slate-900 font-medium">{profileStudent.emergencyContactName || '—'} · {profileStudent.emergencyContactPhone || ''}</span></div>
                    <div className="text-slate-500">Address: <span className="text-slate-900 font-medium">{profileStudent.address || '—'}</span></div>
                  </div>
                </SectionCard>
              </div>
            )}

            {profileTab === 'attendance' && (
              <div className="space-y-4">
                <div className="text-[14.5px] text-slate-600">
                  Total Attendance Records: <span className="font-semibold text-slate-900">{profileAtt.length}</span> · Present:{' '}
                  <span className="font-semibold text-emerald-700">{profileAtt.filter((a) => a.status === 'present').length}</span> · Absent:{' '}
                  <span className="font-semibold text-red-700">{profileAtt.filter((a) => a.status === 'absent').length}</span>
                </div>
                {profileAtt.length === 0 ? (
                  <p className="text-[15px] text-slate-500 py-6">No attendance records marked for this student yet.</p>
                ) : (
                  <div className="border border-slate-200 rounded-[10px] overflow-hidden">
                    <table className="ec-table">
                      <thead className="ec-thead">
                        <tr>
                          <th className="ec-th">Date</th>
                          <th className="ec-th">Subject</th>
                          <th className="ec-th">Status</th>
                          <th className="ec-th">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="ec-tbody">
                        {profileAtt.slice(0, 50).map((a) => (
                          <tr key={a.id} className="ec-tr">
                            <td className="ec-td">{formatDate(a.date)}</td>
                            <td className="ec-td">{subjectMap.get(a.subjectId || '') || 'Daily Attendance'}</td>
                            <td className="ec-td"><StatusBadge status={a.status} /></td>
                            <td className="ec-td text-slate-500">{a.remarks || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {profileTab === 'academics' && (
              <SectionCard>
                <div className="space-y-3 text-[15px]">
                  <div>Previous Institution: <span className="font-semibold text-slate-900">{profileStudent.previousInstitution || '—'}</span></div>
                  <div>Transfer / TC Details: <span className="font-semibold text-slate-900">{profileStudent.transferInfo || '—'}</span></div>
                  <div className="pt-2">
                    <div className="text-[14px] font-medium text-slate-600 mb-2">Enrolled Subjects in Class:</div>
                    <div className="flex flex-wrap gap-2">
                      {subjects.filter((sub) => sub.classId === profileStudent.classId).length === 0 ? (
                        <span className="text-[14px] text-slate-500">No subjects mapped to this class yet.</span>
                      ) : (
                        subjects
                          .filter((sub) => sub.classId === profileStudent.classId)
                          .map((sub) => (
                            <span key={sub.id} className="px-3 py-1.5 text-[13.5px] font-medium bg-indigo-50/75 border border-indigo-200/80 rounded-[8px] text-indigo-900">
                              {sub.code} · {sub.name}
                            </span>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}

            {profileTab === 'examinations' && (
              <div>
                {profileMarks.length === 0 ? (
                  <p className="text-[15px] text-slate-500 py-6">No examination marks recorded for this student yet.</p>
                ) : (
                  <div className="border border-slate-200 rounded-[10px] overflow-hidden">
                    <table className="ec-table">
                      <thead className="ec-thead">
                        <tr>
                          <th className="ec-th">Examination</th>
                          <th className="ec-th">Subject</th>
                          <th className="ec-th text-right">Marks</th>
                          <th className="ec-th">Grade</th>
                          <th className="ec-th">Status</th>
                        </tr>
                      </thead>
                      <tbody className="ec-tbody">
                        {profileMarks.map((m) => (
                          <tr key={m.id} className="ec-tr">
                            <td className="ec-td">{examMap.get(m.examId) || m.examId}</td>
                            <td className="ec-td">{subjectMap.get(m.subjectId) || m.subjectId}</td>
                            <td className="ec-td text-right tabular-nums">
                              {m.isAbsent ? 'ABS' : `${m.marksObtained} / ${m.maxMarks}`}
                            </td>
                            <td className="ec-td">{m.grade || '—'}</td>
                            <td className="ec-td">
                              <StatusBadge status={m.isPublished ? 'published' : 'draft'} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {profileTab === 'fees' && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-[14px] font-semibold text-slate-700 mb-2.5">Fee Invoices</h4>
                  {profileFees.length === 0 ? (
                    <p className="text-[15px] text-slate-500">No fee invoices assigned yet.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-[10px] overflow-hidden">
                      <table className="ec-table">
                        <thead className="ec-thead">
                          <tr>
                            <th className="ec-th">Invoice</th>
                            <th className="ec-th">Title</th>
                            <th className="ec-th text-right">Total</th>
                            <th className="ec-th text-right">Balance</th>
                            <th className="ec-th">Status</th>
                          </tr>
                        </thead>
                        <tbody className="ec-tbody">
                          {profileFees.map((f) => (
                            <tr key={f.id} className="ec-tr">
                              <td className="ec-td font-mono text-[13.5px]">{f.invoiceNumber}</td>
                              <td className="ec-td">{f.title}</td>
                              <td className="ec-td text-right tabular-nums">{formatCurrency(f.amount, institution?.currency)}</td>
                              <td className="ec-td text-right tabular-nums">{formatCurrency(f.balanceAmount, institution?.currency)}</td>
                              <td className="ec-td"><StatusBadge status={f.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                {profilePayments.length > 0 && (
                  <div>
                    <h4 className="text-[14px] font-semibold text-slate-700 mb-2.5">Payment Receipts</h4>
                    <div className="border border-slate-200 rounded-[10px] overflow-hidden">
                      <table className="ec-table">
                        <thead className="ec-thead">
                          <tr>
                            <th className="ec-th">Receipt</th>
                            <th className="ec-th">Date</th>
                            <th className="ec-th">Method</th>
                            <th className="ec-th text-right">Amount</th>
                            <th className="ec-th">Status</th>
                          </tr>
                        </thead>
                        <tbody className="ec-tbody">
                          {profilePayments.map((p) => (
                            <tr key={p.id} className="ec-tr">
                              <td className="ec-td font-mono text-[13.5px]">{p.receiptNumber}</td>
                              <td className="ec-td">{formatDate(p.paidAt)}</td>
                              <td className="ec-td capitalize">{p.paymentMethod.replace(/_/g, ' ')}</td>
                              <td className="ec-td text-right tabular-nums">{formatCurrency(p.amount, institution?.currency)}</td>
                              <td className="ec-td"><StatusBadge status={p.gatewayStatus} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {profileTab === 'documents' && (
              <div>
                {profileDocs.length === 0 ? (
                  <p className="text-[15px] text-slate-500 py-6">No documents uploaded for this student yet. Upload documents from the Documents module.</p>
                ) : (
                  <div className="space-y-2.5">
                    {profileDocs.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-[10px] text-[15px]">
                        <div>
                          <div className="font-medium text-slate-900">{d.title}</div>
                          <div className="text-[13.5px] text-slate-500 mt-0.5">{d.documentType} · {d.fileName}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={d.verified ? 'verified' : 'pending'} />
                          {d.dataUrl && (
                            <a href={d.dataUrl} download={d.fileName} className="text-[13.5px] font-medium text-blue-800 hover:underline">
                              Download
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {profileTab === 'discipline' && (
              <div className="space-y-4">
                {(profileStudent.disciplineRecords || []).length === 0 ? (
                  <p className="text-[15px] text-slate-500">No discipline records logged.</p>
                ) : (
                  <div className="space-y-2.5">
                    {(profileStudent.disciplineRecords || []).map((rec, idx) => (
                      <div key={idx} className="p-4 border border-slate-200 rounded-[10px] text-[15px]">
                        <div className="flex justify-between text-[13px] text-slate-500 mb-1">
                          <span className="font-semibold text-slate-700">{rec.category}</span>
                          <span>{formatDate(rec.date)} · by {rec.recordedBy}</span>
                        </div>
                        <div className="text-slate-900">{rec.description}</div>
                        <div className="text-[13.5px] text-slate-600 mt-1">Action Taken: {rec.actionTaken}</div>
                      </div>
                    ))}
                  </div>
                )}
                {canEdit && (
                  <form onSubmit={handleAddDiscipline} className="p-4 bg-slate-50 border border-slate-200 rounded-[10px] space-y-3 no-print">
                    <div className="text-[14px] font-semibold text-slate-800">Log Discipline / Conduct Note</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        value={discCat}
                        onChange={(e) => setDiscCat(e.target.value)}
                        placeholder="Category"
                        className="ec-input"
                      />
                      <input
                        required
                        value={discDesc}
                        onChange={(e) => setDiscDesc(e.target.value)}
                        placeholder="Incident description *"
                        className="ec-input"
                      />
                      <input
                        value={discAction}
                        onChange={(e) => setDiscAction(e.target.value)}
                        placeholder="Action taken"
                        className="ec-input"
                      />
                    </div>
                    <button type="submit" className="ec-btn-primary text-[13.5px]">
                      Save Record
                    </button>
                  </form>
                )}
              </div>
            )}

            {profileTab === 'library' && (
              <div>
                {profileLibrary.length === 0 ? (
                  <p className="text-[15px] text-slate-500 py-6">No library transactions for this student.</p>
                ) : (
                  <div className="border border-slate-200 rounded-[10px] overflow-hidden">
                    <table className="ec-table">
                      <thead className="ec-thead">
                        <tr>
                          <th className="ec-th">Book</th>
                          <th className="ec-th">Issued</th>
                          <th className="ec-th">Due</th>
                          <th className="ec-th">Status</th>
                        </tr>
                      </thead>
                      <tbody className="ec-tbody">
                        {profileLibrary.map((tx) => (
                          <tr key={tx.id} className="ec-tr">
                            <td className="ec-td">{tx.bookTitle || tx.bookId}</td>
                            <td className="ec-td">{formatDate(tx.issueDate)}</td>
                            <td className="ec-td">{formatDate(tx.dueDate)}</td>
                            <td className="ec-td"><StatusBadge status={tx.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {profileTab === 'transport' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <SectionCard title="Transport Assignment">
                  {profileRoute ? (
                    <div className="space-y-1.5 text-[14.5px]">
                      <div className="font-semibold text-slate-900">{profileRoute.routeName}</div>
                      <div className="text-slate-600">Vehicle: {profileRoute.vehicleNumber}</div>
                      <div className="text-slate-600">Driver: {profileRoute.driverName || '—'} ({profileRoute.driverPhone || '—'})</div>
                    </div>
                  ) : (
                    <p className="text-[15px] text-slate-500">No transport route assigned.</p>
                  )}
                </SectionCard>
                <SectionCard title="Hostel Allocation">
                  {hostelAllocs.length === 0 ? (
                    <p className="text-[15px] text-slate-500">No hostel bed allocated.</p>
                  ) : (
                    hostelAllocs.map((h) => (
                      <div key={h.id} className="space-y-1.5 text-[14.5px]">
                        <div className="font-semibold text-slate-900">{h.hostelName || h.hostelId}</div>
                        <div className="text-slate-600">Room {h.roomNumber} · Bed {h.bedNumber}</div>
                        <StatusBadge status={h.status} />
                      </div>
                    ))
                  )}
                </SectionCard>
              </div>
            )}

            {profileTab === 'communication' && (
              <div>
                {profileMessages.length === 0 ? (
                  <p className="text-[15px] text-slate-500 py-6">No direct messages recorded for this student user account.</p>
                ) : (
                  <div className="space-y-2.5">
                    {profileMessages.map((m) => (
                      <div key={m.id} className="p-4 border border-slate-200 rounded-[10px]">
                        <div className="flex justify-between text-[13px] text-slate-500">
                          <span>From: {m.senderName || 'Staff'}</span>
                          <span>{formatDate(m.createdAt)}</span>
                        </div>
                        <div className="text-[15px] font-semibold text-slate-900 mt-1">{m.subject}</div>
                        <div className="text-slate-600 text-[14px] mt-1">{m.body}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Student ID Card Generator Modal */}
      <Modal
        open={Boolean(idCardStudent)}
        onClose={() => setIdCardStudent(null)}
        title="Student Identity Card"
        size="md"
        footer={
          <button type="button" onClick={() => window.print()} className="ec-btn-primary">
            <Printer className="w-4 h-4" />
            Print ID Card
          </button>
        }
      >
        {idCardStudent && institution && (
          <div className="print-surface max-w-sm mx-auto border border-slate-300 rounded-[14px] overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {institution.logoUrl && (
                  <img src={institution.logoUrl} alt={institution.name} className="w-8 h-8 rounded bg-white object-contain p-0.5" />
                )}
                <div>
                  <div className="text-[14.5px] font-bold leading-tight">{institution.name}</div>
                  <div className="text-[12px] text-slate-300">Official Student ID Card</div>
                </div>
              </div>
              <span className="text-[12px] font-mono bg-slate-800 px-2 py-0.5 rounded">{idCardStudent.studentCode}</span>
            </div>
            <div className="p-5 flex gap-4 items-center">
              {idCardStudent.photoUrl ? (
                <img
                  src={idCardStudent.photoUrl}
                  alt={idCardStudent.firstName}
                  className="w-20 h-24 rounded-[8px] object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-20 h-24 rounded-[8px] bg-slate-100 border border-slate-200 flex items-center justify-center text-lg font-bold text-slate-500 shrink-0">
                  {idCardStudent.firstName[0]}
                  {idCardStudent.lastName[0]}
                </div>
              )}
              <div className="space-y-1 text-[13.5px] min-w-0">
                <div className="text-[17px] font-bold text-slate-900 truncate">
                  {idCardStudent.firstName} {idCardStudent.lastName}
                </div>
                <div className="text-slate-600">
                  Class: <span className="font-medium text-slate-900">{classMap.get(idCardStudent.classId || '') || 'Unassigned'}</span>
                  {idCardStudent.sectionId ? ` (${sectionMap.get(idCardStudent.sectionId) || ''})` : ''}
                </div>
                <div className="text-slate-600">Roll No: {idCardStudent.rollNumber || '—'}</div>
                <div className="text-slate-600">Academic Year: {yearMap.get(idCardStudent.academicYearId || '') || 'Current'}</div>
                <div className="text-slate-600">Emergency: {idCardStudent.guardianPhone || idCardStudent.phone || '—'}</div>
              </div>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-[12px] text-slate-500 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span>Status:</span>
                  <StatusBadge status={idCardStudent.status} size="sm" />
                </div>
                <div>Scan QR to verify</div>
              </div>
              <QrCodeCanvas
                value={`${window.location.origin}${window.location.pathname}#verify/student/${idCardStudent.id}`}
                size={64}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Bulk CSV Student Import"
        subtitle="Download the CSV template, populate student rows, validate, and confirm import."
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-slate-50 border border-slate-200 rounded-[10px]">
            <div className="text-[13.5px] text-slate-600">
              Required headers: <span className="font-mono font-semibold text-slate-800">studentCode, firstName, lastName</span>
            </div>
            <button
              type="button"
              onClick={downloadImportTemplate}
              className="ec-btn-secondary px-3 py-1.5 text-[13.5px] text-blue-800"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Download Template
            </button>
          </div>

          <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="text-[14.5px] text-slate-700" />

          {importErrors.length > 0 && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-[10px] text-[13.5px] text-red-800 space-y-1 max-h-40 overflow-y-auto">
              {importErrors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

          {importRows.length > 0 && importErrors.length === 0 && (
            <div className="border border-slate-200 rounded-[10px] overflow-hidden">
              <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 text-[13.5px] font-medium text-emerald-900">
                Validated {importRows.length} rows ready to import.
              </div>
              <div className="max-h-52 overflow-y-auto">
                <table className="ec-table">
                  <thead className="ec-thead">
                    <tr>
                      <th className="ec-th">Student ID</th>
                      <th className="ec-th">Name</th>
                      <th className="ec-th">Email</th>
                    </tr>
                  </thead>
                  <tbody className="ec-tbody">
                    {importRows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="ec-tr">
                        <td className="ec-td font-mono text-[13.5px]">{r.studentCode}</td>
                        <td className="ec-td">{r.firstName} {r.lastName}</td>
                        <td className="ec-td">{r.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button type="button" onClick={() => setImportOpen(false)} className="ec-btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={importing || importRows.length === 0 || importErrors.length > 0}
              onClick={confirmCsvImport}
              className="ec-btn-primary"
            >
              {importing ? 'Importing...' : `Confirm Import (${importRows.length})`}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleSoftDelete}
        title="Archive Student Record"
        description={`Are you sure you want to archive "${deleteTarget?.firstName} ${deleteTarget?.lastName}"? Their record will be marked withdrawn and hidden from active rosters.`}
        confirmLabel="Archive Student"
        destructive
      />
    </div>
  );
}
