import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, CalendarCheck, CheckCircle2, CreditCard, Eye, GraduationCap, Pencil, Plus, Printer, Trash2, Users, XCircle } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { createNotificationForUser, saveInstDoc, subscribeInstCollection, where, writeAuditLog } from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import { fileToConstrainedDataUrl, formatCurrency, formatDate, generateId, nowIso, todayDateStr } from '../utils/format';
import { exportToCsv } from '../utils/csv';
import {
  Avatar,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  FormSection,
  Modal,
  PageHeader,
  QrCodeCanvas,
  SectionCard,
  StatusBadge,
  Tabs,
} from '../components/ui/Primitives';
import type { DocumentRecord, Employee, LeaveRequest } from '../types';

export function PeopleModule() {
  const {
    institution,
    member,
    userAccount,
    activeModule,
    can,
    pushToast,
    employees,
    departments,
    classes,
    subjects,
    attendance,
    timetables,
    leaveRequests,
    students,
    selectedEmployeeIdForProfile,
    setSelectedEmployeeIdForProfile,
    dataLoading,
  } = useApp();

  const isLeaveView = activeModule === 'leave';
  const staffTypeFilter: 'faculty' | 'staff' = activeModule === 'staff' ? 'staff' : 'faculty';

  const canCreate = can(activeModule, 'create');
  const canEdit = can(activeModule, 'edit');
  const canDelete = can(activeModule, 'delete');
  const canExport = can(activeModule, 'export');
  const canReviewLeave = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod'].includes(member?.role || '');

  // Employee modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState<Partial<Employee>>({ status: 'active', employmentType: 'full_time' });
  const [saving, setSaving] = useState(false);
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null);

  // Employee Profile & ID card
  const [profileEmp, setProfileEmp] = useState<Employee | null>(null);
  const [profileTab, setProfileTab] = useState<'overview' | 'attendance' | 'timetable' | 'classes' | 'leave' | 'payroll' | 'documents'>('overview');
  const [empDocs, setEmpDocs] = useState<DocumentRecord[]>([]);
  const [idCardEmp, setIdCardEmp] = useState<Employee | null>(null);

  // Leave form & review
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [leaveStart, setLeaveStart] = useState(todayDateStr());
  const [leaveEnd, setLeaveEnd] = useState(todayDateStr());
  const [leaveReason, setLeaveReason] = useState('');
  const [reviewTarget, setReviewTarget] = useState<LeaveRequest | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');

  useEffect(() => {
    if (selectedEmployeeIdForProfile) {
      const found = employees.find((e) => e.id === selectedEmployeeIdForProfile);
      if (found) {
        setProfileEmp(found);
        setProfileTab('overview');
      }
      setSelectedEmployeeIdForProfile(null);
    }
  }, [selectedEmployeeIdForProfile, employees, setSelectedEmployeeIdForProfile]);

  useEffect(() => {
    const isStaff = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod', 'teacher', 'accountant', 'librarian', 'receptionist'].includes(member?.role || '');
    if (!institution?.id || !profileEmp || !isStaff) {
      setEmpDocs([]);
      return;
    }
    return subscribeInstCollection<DocumentRecord>(
      institution.id,
      'documents',
      [where('ownerId', '==', profileEmp.id)],
      setEmpDocs,
    );
  }, [institution?.id, profileEmp, member?.role]);

  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);
  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);

  const filteredEmployees = useMemo(
    () => employees.filter((e) => e.staffType === staffTypeFilter),
    [employees, staffTypeFilter],
  );

  const openAddEmployee = () => {
    setEditingEmp(null);
    setEmpForm({
      employeeCode: `${staffTypeFilter === 'faculty' ? 'FAC' : 'STF'}-${Date.now().toString().slice(-5)}`,
      staffType: staffTypeFilter,
      employmentType: 'full_time',
      joiningDate: todayDateStr(),
      status: 'active',
      assignedClassIds: [],
      assignedSubjectIds: [],
    });
    setFormOpen(true);
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingEmp(emp);
    setEmpForm({ ...emp });
    setFormOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToConstrainedDataUrl(file, 200 * 1024);
      setEmpForm((p) => ({ ...p, photoUrl: url }));
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Photo exceeds 200 KB limit.'));
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount) return;
    if (!empForm.firstName?.trim() || !empForm.lastName?.trim() || !empForm.employeeCode?.trim()) {
      pushToast('error', 'Employee ID, first name, and last name are required.');
      return;
    }
    setSaving(true);
    try {
      const ts = nowIso();
      const id = editingEmp?.id || generateId('emp');
      const payload: Omit<Employee, 'id'> = {
        institutionId: institution.id,
        employeeCode: empForm.employeeCode.trim(),
        staffType: empForm.staffType || staffTypeFilter,
        category: empForm.category?.trim() || undefined,
        firstName: empForm.firstName.trim(),
        lastName: empForm.lastName.trim(),
        photoUrl: empForm.photoUrl || undefined,
        email: empForm.email?.trim() || undefined,
        phone: empForm.phone?.trim() || undefined,
        joiningDate: empForm.joiningDate || undefined,
        departmentId: empForm.departmentId || undefined,
        designation: empForm.designation?.trim() || undefined,
        qualification: empForm.qualification?.trim() || undefined,
        experienceYears: empForm.experienceYears !== undefined ? Number(empForm.experienceYears) : undefined,
        employmentType: empForm.employmentType || 'full_time',
        assignedSubjectIds: empForm.assignedSubjectIds || [],
        assignedClassIds: empForm.assignedClassIds || [],
        salaryMonthly: empForm.salaryMonthly !== undefined ? Number(empForm.salaryMonthly) : undefined,
        userUid: empForm.userUid?.trim() || undefined,
        status: empForm.status || 'active',
        isDeleted: false,
        createdAt: editingEmp?.createdAt || ts,
        updatedAt: ts,
      };
      await saveInstDoc(institution.id, 'employees', id, payload, !editingEmp);
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: editingEmp ? 'update' : 'create',
        module: staffTypeFilter,
        recordId: id,
        summary: `${editingEmp ? 'Updated' : 'Created'} ${staffTypeFilter} ${payload.firstName} ${payload.lastName}`,
      });
      pushToast('success', editingEmp ? 'Record updated.' : 'Member added successfully.');
      setFormOpen(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to save employee.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDeleteEmployee = async () => {
    if (!institution || !deleteEmp || !userAccount) return;
    try {
      await saveInstDoc(
        institution.id,
        'employees',
        deleteEmp.id,
        { ...deleteEmp, isDeleted: true, status: 'resigned', updatedAt: nowIso() },
        false,
      );
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: 'delete',
        module: staffTypeFilter,
        recordId: deleteEmp.id,
        summary: `Archived employee ${deleteEmp.firstName} ${deleteEmp.lastName}`,
      });
      pushToast('success', 'Record archived.');
      setDeleteEmp(null);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to archive record.'));
    }
  };

  // Leave Management Handlers
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !member) return;
    if (leaveEnd < leaveStart) {
      pushToast('error', 'End date cannot precede start date.');
      return;
    }
    setSaving(true);
    try {
      const ts = nowIso();
      const id = generateId('leave');
      const isStudentOrParent = member.role === 'student' || member.role === 'parent';
      const linkedStu = isStudentOrParent ? students[0] : undefined;
      const linkedEmp = employees.find((emp) => emp.userUid === userAccount.uid);

      const payload: Omit<LeaveRequest, 'id'> = {
        institutionId: institution.id,
        applicantType: isStudentOrParent ? 'student' : 'employee',
        applicantId: linkedStu?.id || linkedEmp?.id || userAccount.uid,
        applicantName: linkedStu ? `${linkedStu.firstName} ${linkedStu.lastName}` : userAccount.displayName,
        applicantUid: userAccount.uid,
        leaveType,
        startDate: leaveStart,
        endDate: leaveEnd,
        reason: leaveReason.trim() || undefined,
        status: 'pending',
        createdAt: ts,
        updatedAt: ts,
      };
      await saveInstDoc(institution.id, 'leave_requests', id, payload, true);
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member.role,
        action: 'create',
        module: 'leave',
        recordId: id,
        summary: `Submitted ${leaveType} request (${leaveStart} to ${leaveEnd})`,
      });
      pushToast('success', 'Leave request submitted.');
      setLeaveOpen(false);
      setLeaveReason('');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to submit leave request.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReviewLeave = async (decision: 'approved' | 'rejected') => {
    if (!institution || !reviewTarget || !userAccount) return;
    try {
      const updated: LeaveRequest = {
        ...reviewTarget,
        status: decision,
        reviewedByUid: userAccount.uid,
        reviewedByName: userAccount.displayName,
        reviewRemarks: reviewRemarks.trim() || undefined,
        updatedAt: nowIso(),
      };
      await saveInstDoc(institution.id, 'leave_requests', reviewTarget.id, { ...updated }, false);
      await createNotificationForUser(institution.id, {
        recipientUid: reviewTarget.applicantUid,
        type: 'leave',
        title: `Leave Request ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
        message: `Your ${reviewTarget.leaveType} (${reviewTarget.startDate} to ${reviewTarget.endDate}) was ${decision}.`,
        linkModule: 'leave',
      });
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: decision,
        module: 'leave',
        recordId: reviewTarget.id,
        summary: `${decision} leave request for ${reviewTarget.applicantName}`,
      });
      pushToast('success', `Leave request ${decision}.`);
      setReviewTarget(null);
      setReviewRemarks('');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to review leave request.'));
    }
  };

  if (isLeaveView) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={CalendarCheck}
          title="Leave Management"
          subtitle="Submit leave applications, review pending requests, and track approval history."
          actions={
            canCreate && (
              <button
                type="button"
                onClick={() => setLeaveOpen(true)}
                className="ec-btn-primary"
              >
                <Plus className="w-4 h-4" />
                Apply for Leave
              </button>
            )
          }
        />

        <DataTable
          rows={leaveRequests}
          loading={dataLoading}
          searchPlaceholder="Search by applicant, leave type, status..."
          searchFilter={(r, q) =>
            `${r.applicantName || ''} ${r.leaveType} ${r.status} ${r.reason || ''}`.toLowerCase().includes(q)
          }
          onExport={
            canExport
              ? (rows) =>
                  exportToCsv(
                    'leave_requests',
                    ['Applicant', 'Type', 'Leave Category', 'Start Date', 'End Date', 'Status', 'Reviewer', 'Remarks'],
                    rows.map((r) => [
                      r.applicantName || r.applicantId,
                      r.applicantType,
                      r.leaveType,
                      r.startDate,
                      r.endDate,
                      r.status,
                      r.reviewedByName || '',
                      r.reviewRemarks || '',
                    ]),
                  )
              : undefined
          }
          columns={[
            {
              key: 'applicant',
              header: 'Applicant',
              sortValue: (r) => r.applicantName || '',
              render: (r) => (
                <div>
                  <div className="font-medium text-slate-900">{r.applicantName || r.applicantId}</div>
                  <div className="text-[13px] text-slate-500 capitalize">{r.applicantType}</div>
                </div>
              ),
            },
            {
              key: 'type',
              header: 'Leave Type',
              render: (r) => <span className="font-medium text-slate-800">{r.leaveType}</span>,
            },
            {
              key: 'dates',
              header: 'Duration',
              sortValue: (r) => r.startDate,
              render: (r) => (
                <span className="text-[13.5px] text-slate-700">
                  {formatDate(r.startDate)} → {formatDate(r.endDate)}
                </span>
              ),
            },
            {
              key: 'reason',
              header: 'Reason',
              render: (r) => <span className="text-[13.5px] text-slate-600 line-clamp-2 max-w-xs">{r.reason || '—'}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              sortValue: (r) => r.status,
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (r) =>
                canReviewLeave && r.status === 'pending' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setReviewTarget(r);
                      setReviewRemarks('');
                    }}
                    className="px-3 py-1.5 text-[13px] font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-[8px] hover:bg-blue-100 transition-colors"
                  >
                    Review
                  </button>
                ) : (
                  <span className="text-[13px] text-slate-500">{r.reviewedByName ? `By ${r.reviewedByName}` : '—'}</span>
                ),
            },
          ]}
          emptyState={
            <EmptyState
              icon={CalendarCheck}
              title="No leave requests submitted"
              description="Submitted student and staff leave applications will appear here."
              actionLabel={canCreate ? 'Apply for Leave' : undefined}
              onAction={canCreate ? () => setLeaveOpen(true) : undefined}
            />
          }
        />

        <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Apply for Leave" size="md">
          <form onSubmit={handleSubmitLeave} className="space-y-4">
            <FormField label="Leave Type">
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="ec-select"
              >
                <option value="Casual Leave">Casual Leave</option>
                <option value="Sick / Medical Leave">Sick / Medical Leave</option>
                <option value="Earned / Annual Leave">Earned / Annual Leave</option>
                <option value="Academic / Duty Leave">Academic / Duty Leave</option>
                <option value="Personal Leave">Personal Leave</option>
              </select>
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Start Date" required>
                <input
                  type="date"
                  required
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  className="ec-input"
                />
              </FormField>
              <FormField label="End Date" required>
                <input
                  type="date"
                  required
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  className="ec-input"
                />
              </FormField>
            </div>
            <FormField label="Reason">
              <textarea
                rows={3}
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                className="ec-textarea"
                placeholder="Provide reason for leave..."
              />
            </FormField>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setLeaveOpen(false)}
                className="ec-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="ec-btn-primary"
              >
                {saving ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </Modal>

        <Modal
          open={Boolean(reviewTarget)}
          onClose={() => setReviewTarget(null)}
          title="Review Leave Request"
          subtitle={reviewTarget ? `${reviewTarget.applicantName} · ${reviewTarget.leaveType}` : ''}
          size="md"
        >
          {reviewTarget && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-[10px] text-[14.5px] space-y-1.5">
                <div className="font-medium text-slate-900">
                  Duration: {formatDate(reviewTarget.startDate)} → {formatDate(reviewTarget.endDate)}
                </div>
                <div className="text-slate-600">Reason: {reviewTarget.reason || 'No reason provided'}</div>
              </div>
              <FormField label="Reviewer Remarks">
                <textarea
                  rows={2}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  className="ec-textarea"
                />
              </FormField>
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleReviewLeave('rejected')}
                  className="ec-btn-danger"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewLeave('approved')}
                  className="ec-btn-success"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // Faculty & Non-Teaching Staff View
  const staffCategories = institution?.staffCategories || [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={staffTypeFilter === 'faculty' ? Users : Briefcase}
        title={staffTypeFilter === 'faculty' ? 'Faculty & Teachers' : 'Non-Teaching Staff'}
        subtitle={
          staffTypeFilter === 'faculty'
            ? 'Manage teaching faculty, subject assignments, profiles, and employee ID cards.'
            : 'Manage administrative and support staff using institution-configured categories.'
        }
        actions={
          canCreate && (
            <button
              type="button"
              onClick={openAddEmployee}
              className="ec-btn-primary"
            >
              <Plus className="w-4 h-4" />
              {staffTypeFilter === 'faculty' ? 'Add Faculty' : 'Add Staff Member'}
            </button>
          )
        }
      />

      <DataTable
        rows={filteredEmployees}
        loading={dataLoading}
        searchPlaceholder="Search by name, employee ID, department, designation..."
        searchFilter={(e, q) =>
          `${e.firstName} ${e.lastName} ${e.employeeCode} ${e.designation || ''} ${e.category || ''} ${e.email || ''}`
            .toLowerCase()
            .includes(q)
        }
        onExport={
          canExport
            ? (rows) =>
                exportToCsv(
                  staffTypeFilter,
                  ['Employee ID', 'First Name', 'Last Name', 'Department', 'Designation', 'Category', 'Email', 'Phone', 'Status'],
                  rows.map((r) => [
                    r.employeeCode,
                    r.firstName,
                    r.lastName,
                    deptMap.get(r.departmentId || '') || '',
                    r.designation || '',
                    r.category || '',
                    r.email || '',
                    r.phone || '',
                    r.status,
                  ]),
                )
            : undefined
        }
        columns={[
          {
            key: 'code',
            header: 'Employee ID',
            sortValue: (e) => e.employeeCode,
            render: (e) => <span className="font-mono text-[13px] text-slate-700">{e.employeeCode}</span>,
          },
          {
            key: 'name',
            header: 'Name',
            sortValue: (e) => `${e.firstName} ${e.lastName}`,
            render: (e) => (
              <div className="flex items-center gap-3">
                <Avatar src={e.photoUrl} name={`${e.firstName} ${e.lastName}`} size="sm" />
                <button
                  type="button"
                  onClick={() => {
                    setProfileEmp(e);
                    setProfileTab('overview');
                  }}
                  className="font-semibold text-[14.5px] text-slate-900 hover:text-blue-800 hover:underline text-left"
                >
                  {e.firstName} {e.lastName}
                </button>
              </div>
            ),
          },
          {
            key: 'dept',
            header: staffTypeFilter === 'faculty' ? 'Department / Designation' : 'Category / Designation',
            render: (e) => (
              <div>
                <div className="text-[14px] text-slate-800 font-medium">
                  {staffTypeFilter === 'faculty'
                    ? deptMap.get(e.departmentId || '') || 'General'
                    : e.category || 'Uncategorized'}
                </div>
                <div className="text-[13px] text-slate-500">{e.designation || '—'}</div>
              </div>
            ),
          },
          {
            key: 'contact',
            header: 'Contact',
            render: (e) => (
              <div>
                <div className="text-[14px] text-slate-800">{e.email || '—'}</div>
                <div className="text-[13px] text-slate-500">{e.phone || '—'}</div>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (e) => <StatusBadge status={e.status} />,
          },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (e) => (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileEmp(e);
                    setProfileTab('overview');
                  }}
                  title="View Profile"
                  className="p-2 text-slate-600 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIdCardEmp(e)}
                  title="ID Card"
                  className="p-2 text-slate-600 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                >
                  <CreditCard className="w-4 h-4" />
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEditEmployee(e)}
                    title="Edit"
                    className="p-2 text-slate-600 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleteEmp(e)}
                    title="Archive"
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
            icon={staffTypeFilter === 'faculty' ? GraduationCap : Briefcase}
            title={staffTypeFilter === 'faculty' ? 'No faculty members added yet' : 'No non-teaching staff added yet'}
            description={
              staffTypeFilter === 'faculty'
                ? 'Add teachers and professors to assign subjects, timetables, and attendance.'
                : 'Configure staff categories in Settings and add administrative or campus staff.'
            }
            actionLabel={canCreate ? (staffTypeFilter === 'faculty' ? 'Add Faculty' : 'Add Staff Member') : undefined}
            onAction={canCreate ? openAddEmployee : undefined}
          />
        }
      />

      {/* Add/Edit Employee Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingEmp ? `Edit ${editingEmp.firstName} ${editingEmp.lastName}` : `Add ${staffTypeFilter === 'faculty' ? 'Faculty' : 'Staff'}`}
        size="xl"
      >
        <form onSubmit={handleSaveEmployee} className="space-y-6">
          <FormSection title="Personal & Contact Details">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Employee ID" required>
                <input
                  required
                  value={empForm.employeeCode || ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, employeeCode: e.target.value }))}
                  className="ec-input font-mono"
                />
              </FormField>
              <FormField label="First Name" required>
                <input
                  required
                  value={empForm.firstName || ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, firstName: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Last Name" required>
                <input
                  required
                  value={empForm.lastName || ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, lastName: e.target.value }))}
                  className="ec-input"
                />
              </FormField>

              <FormField label="Email">
                <input
                  type="email"
                  value={empForm.email || ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, email: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Phone">
                <input
                  value={empForm.phone || ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, phone: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Photo (max 200 KB)">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="w-full text-[13.5px] text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-[8px] file:border file:border-slate-300 file:text-[13px] file:font-medium file:bg-white file:text-slate-700 hover:file:bg-slate-50"
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Employment & Role Details" withDivider>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {staffTypeFilter === 'staff' ? (
                <FormField label="Staff Category">
                  {staffCategories.length > 0 ? (
                    <select
                      value={empForm.category || ''}
                      onChange={(e) => setEmpForm((p) => ({ ...p, category: e.target.value }))}
                      className="ec-select"
                    >
                      <option value="">Select category</option>
                      {staffCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={empForm.category || ''}
                      onChange={(e) => setEmpForm((p) => ({ ...p, category: e.target.value }))}
                      placeholder="Define categories in Settings or type..."
                      className="ec-input"
                    />
                  )}
                </FormField>
              ) : (
                <FormField label="Department">
                  <select
                    value={empForm.departmentId || ''}
                    onChange={(e) => setEmpForm((p) => ({ ...p, departmentId: e.target.value }))}
                    className="ec-select"
                  >
                    <option value="">General</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}

              <FormField label="Designation">
                <input
                  value={empForm.designation || ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, designation: e.target.value }))}
                  placeholder="e.g. Senior Lecturer"
                  className="ec-input"
                />
              </FormField>
              <FormField label="Qualification">
                <input
                  value={empForm.qualification || ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, qualification: e.target.value }))}
                  className="ec-input"
                />
              </FormField>

              <FormField label="Joining Date">
                <input
                  type="date"
                  value={empForm.joiningDate || ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, joiningDate: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Experience (Years)">
                <input
                  type="number"
                  min={0}
                  value={empForm.experienceYears ?? ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, experienceYears: e.target.value ? Number(e.target.value) : undefined }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Employment Type">
                <select
                  value={empForm.employmentType || 'full_time'}
                  onChange={(e) => setEmpForm((p) => ({ ...p, employmentType: e.target.value as Employee['employmentType'] }))}
                  className="ec-select"
                >
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="visiting">Visiting</option>
                </select>
              </FormField>

              <FormField label="Monthly Salary (optional)">
                <input
                  type="number"
                  min={0}
                  value={empForm.salaryMonthly ?? ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, salaryMonthly: e.target.value ? Number(e.target.value) : undefined }))}
                  className="ec-input font-mono"
                />
              </FormField>
              <FormField label="Status">
                <select
                  value={empForm.status || 'active'}
                  onChange={(e) => setEmpForm((p) => ({ ...p, status: e.target.value as Employee['status'] }))}
                  className="ec-select"
                >
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="inactive">Inactive</option>
                  <option value="resigned">Resigned</option>
                </select>
              </FormField>
              <FormField label="Linked User UID (optional)">
                <input
                  value={empForm.userUid || ''}
                  onChange={(e) => setEmpForm((p) => ({ ...p, userUid: e.target.value }))}
                  className="ec-input font-mono"
                />
              </FormField>
            </div>
          </FormSection>

          {staffTypeFilter === 'faculty' && (
            <FormSection title="Class & Subject Assignments" withDivider>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Assigned Classes">
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-[10px] p-3 space-y-2 bg-slate-50/40">
                    {classes.length === 0 ? (
                      <span className="text-[13.5px] text-slate-400">No classes created yet.</span>
                    ) : (
                      classes.map((c) => {
                        const checked = (empForm.assignedClassIds || []).includes(c.id);
                        return (
                          <label key={c.id} className="flex items-center gap-2.5 text-[14px] text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setEmpForm((p) => ({
                                  ...p,
                                  assignedClassIds: checked
                                    ? (p.assignedClassIds || []).filter((id) => id !== c.id)
                                    : [...(p.assignedClassIds || []), c.id],
                                }))
                              }
                              className="rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                            />
                            <span>{c.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </FormField>
                <FormField label="Assigned Subjects">
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-[10px] p-3 space-y-2 bg-slate-50/40">
                    {subjects.length === 0 ? (
                      <span className="text-[13.5px] text-slate-400">No subjects created yet.</span>
                    ) : (
                      subjects.map((sub) => {
                        const checked = (empForm.assignedSubjectIds || []).includes(sub.id);
                        return (
                          <label key={sub.id} className="flex items-center gap-2.5 text-[14px] text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setEmpForm((p) => ({
                                  ...p,
                                  assignedSubjectIds: checked
                                    ? (p.assignedSubjectIds || []).filter((id) => id !== sub.id)
                                    : [...(p.assignedSubjectIds || []), sub.id],
                                }))
                              }
                              className="rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                            />
                            <span>{sub.code} · {sub.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </FormField>
              </div>
            </FormSection>
          )}

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="ec-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="ec-btn-primary"
            >
              {saving ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Faculty / Staff Profile Modal */}
      <Modal
        open={Boolean(profileEmp)}
        onClose={() => setProfileEmp(null)}
        title={profileEmp ? `${profileEmp.firstName} ${profileEmp.lastName}` : ''}
        subtitle={profileEmp ? `${profileEmp.employeeCode} · ${profileEmp.designation || profileEmp.staffType}` : ''}
        size="xl"
      >
        {profileEmp && (
          <div className="space-y-5">
            <div
              className={`flex flex-wrap items-center justify-between gap-4 p-4 rounded-[12px] border bg-gradient-to-r to-white ${
                profileEmp.staffType === 'faculty'
                  ? 'from-violet-50/60 border-violet-200/80'
                  : 'from-teal-50/60 border-teal-200/80'
              }`}
            >
              <div className="flex items-center gap-4">
                <Avatar src={profileEmp.photoUrl} name={`${profileEmp.firstName} ${profileEmp.lastName}`} size="xl" />
                <div>
                  <div className="text-[18px] font-bold text-slate-900">
                    {profileEmp.firstName} {profileEmp.lastName}
                  </div>
                  <div className="text-[14px] text-slate-600 mt-0.5">
                    {profileEmp.designation || profileEmp.staffType} · {deptMap.get(profileEmp.departmentId || '') || profileEmp.category || 'Administration'}
                  </div>
                </div>
              </div>
              <StatusBadge status={profileEmp.status} />
            </div>

            <Tabs
              value={profileTab}
              onChange={setProfileTab}
              items={[
                { key: 'overview', label: 'Overview' },
                { key: 'attendance', label: 'Attendance' },
                { key: 'timetable', label: 'Timetable' },
                { key: 'classes', label: 'Classes & Subjects' },
                { key: 'leave', label: 'Leave' },
                { key: 'payroll', label: 'Payroll' },
                { key: 'documents', label: 'Documents' },
              ]}
            />

            {profileTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-[14.5px]">
                <SectionCard variant="tinted-header" title="Personal & Employment">
                  <div className="space-y-2.5 text-slate-700">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Employee Code</span>
                      <span className="font-mono font-medium text-slate-900">{profileEmp.employeeCode}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Department / Category</span>
                      <span className="font-medium text-slate-900">{deptMap.get(profileEmp.departmentId || '') || profileEmp.category || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Designation</span>
                      <span className="font-medium text-slate-900">{profileEmp.designation || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Qualification</span>
                      <span className="font-medium text-slate-900">{profileEmp.qualification || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Experience</span>
                      <span className="font-medium text-slate-900">{profileEmp.experienceYears ?? '—'} years</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Joining Date</span>
                      <span className="font-medium text-slate-900">{formatDate(profileEmp.joiningDate)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 pt-1">
                      <span className="text-slate-500">Status</span>
                      <StatusBadge status={profileEmp.status} />
                    </div>
                  </div>
                </SectionCard>
                <SectionCard variant="tinted-header" title="Contact Details">
                  <div className="space-y-2.5 text-slate-700">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Email</span>
                      <span className="font-medium text-slate-900">{profileEmp.email || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Phone</span>
                      <span className="font-medium text-slate-900">{profileEmp.phone || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Employment Type</span>
                      <span className="font-medium text-slate-900 capitalize">{(profileEmp.employmentType || '').replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                </SectionCard>
              </div>
            )}

            {profileTab === 'attendance' && (
              <div>
                {attendance.filter((a) => a.targetId === profileEmp.id).length === 0 ? (
                  <p className="text-[14.5px] text-slate-500 py-4">No attendance records marked for this employee.</p>
                ) : (
                  <div className="ec-card overflow-hidden">
                    <table className="ec-table">
                      <thead className="ec-thead">
                        <tr>
                          <th className="ec-th">Date</th>
                          <th className="ec-th">Status</th>
                          <th className="ec-th">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="ec-tbody">
                        {attendance
                          .filter((a) => a.targetId === profileEmp.id)
                          .map((a) => (
                            <tr key={a.id} className="ec-tr">
                              <td className="ec-td">{formatDate(a.date)}</td>
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

            {profileTab === 'timetable' && (
              <div>
                {timetables.filter((t) => t.facultyId === profileEmp.id).length === 0 ? (
                  <p className="text-[14.5px] text-slate-500 py-4">No timetable slots assigned.</p>
                ) : (
                  <div className="ec-card overflow-hidden">
                    <table className="ec-table">
                      <thead className="ec-thead">
                        <tr>
                          <th className="ec-th">Day</th>
                          <th className="ec-th">Time</th>
                          <th className="ec-th">Class</th>
                          <th className="ec-th">Subject</th>
                          <th className="ec-th">Room</th>
                        </tr>
                      </thead>
                      <tbody className="ec-tbody">
                        {timetables
                          .filter((t) => t.facultyId === profileEmp.id)
                          .map((t) => (
                            <tr key={t.id} className="ec-tr">
                              <td className="ec-td font-medium text-slate-900">{t.dayOfWeek}</td>
                              <td className="ec-td font-mono text-[13px]">{t.startTime} - {t.endTime}</td>
                              <td className="ec-td">{classMap.get(t.classId) || t.classId}</td>
                              <td className="ec-td">{t.subjectName || subjectMap.get(t.subjectId) || t.subjectId}</td>
                              <td className="ec-td">{t.room || '—'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {profileTab === 'classes' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-[14.5px]">
                <SectionCard title="Assigned Classes">
                  {(profileEmp.assignedClassIds || []).length === 0 ? (
                    <p className="text-slate-500">None assigned.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {(profileEmp.assignedClassIds || []).map((cid) => (
                        <li key={cid} className="text-slate-800 font-medium">{classMap.get(cid) || cid}</li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
                <SectionCard title="Assigned Subjects">
                  {(profileEmp.assignedSubjectIds || []).length === 0 ? (
                    <p className="text-slate-500">None assigned.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {(profileEmp.assignedSubjectIds || []).map((sid) => (
                        <li key={sid} className="text-slate-800 font-medium">{subjectMap.get(sid) || sid}</li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              </div>
            )}

            {profileTab === 'leave' && (
              <div>
                {leaveRequests.filter((l) => l.applicantId === profileEmp.id || l.applicantUid === profileEmp.userUid).length === 0 ? (
                  <p className="text-[14.5px] text-slate-500 py-4">No leave requests found.</p>
                ) : (
                  <div className="space-y-2.5">
                    {leaveRequests
                      .filter((l) => l.applicantId === profileEmp.id || l.applicantUid === profileEmp.userUid)
                      .map((l) => (
                        <div key={l.id} className="p-4 border border-slate-200 rounded-[10px] flex items-center justify-between text-[14.5px]">
                          <div>
                            <div className="font-semibold text-slate-900">{l.leaveType}</div>
                            <div className="text-[13px] text-slate-500 mt-0.5">{formatDate(l.startDate)} → {formatDate(l.endDate)}</div>
                          </div>
                          <StatusBadge status={l.status} />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {profileTab === 'payroll' && (
              <SectionCard title="Payroll Summary">
                <div className="text-[13.5px] text-slate-500">Configured Monthly Compensation</div>
                <div className="text-[28px] font-bold font-mono tabular-nums text-slate-900 mt-1.5">
                  {profileEmp.salaryMonthly !== undefined
                    ? formatCurrency(profileEmp.salaryMonthly, institution?.currency)
                    : 'Not configured'}
                </div>
              </SectionCard>
            )}

            {profileTab === 'documents' && (
              <div>
                {empDocs.length === 0 ? (
                  <p className="text-[14.5px] text-slate-500 py-4">No documents uploaded for this employee.</p>
                ) : (
                  <div className="space-y-2.5">
                    {empDocs.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-[10px] text-[14.5px]">
                        <div>
                          <div className="font-semibold text-slate-900">{d.title}</div>
                          <div className="text-[13px] text-slate-500 mt-0.5">{d.documentType} · {d.fileName}</div>
                        </div>
                        {d.dataUrl && (
                          <a href={d.dataUrl} download={d.fileName} className="text-[13.5px] font-semibold text-blue-800 hover:underline">
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Employee ID Card */}
      <Modal
        open={Boolean(idCardEmp)}
        onClose={() => setIdCardEmp(null)}
        title="Employee Identity Card"
        size="md"
        footer={
          <button
            type="button"
            onClick={() => window.print()}
            className="ec-btn-primary"
          >
            <Printer className="w-4 h-4" />
            Print ID Card
          </button>
        }
      >
        {idCardEmp && institution && (
          <div className="print-surface max-w-sm mx-auto border border-slate-300 rounded-[12px] overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-bold">{institution.name}</div>
                <div className="text-[12px] text-slate-300">Official Staff / Faculty Card</div>
              </div>
              <span className="text-[12px] font-mono bg-slate-800 px-2.5 py-1 rounded-[6px]">{idCardEmp.employeeCode}</span>
            </div>
            <div className="p-5 flex gap-4 items-center">
              {idCardEmp.photoUrl ? (
                <img src={idCardEmp.photoUrl} alt={idCardEmp.firstName} className="w-20 h-24 rounded-[8px] object-cover border border-slate-200" />
              ) : (
                <div className="w-20 h-24 rounded-[8px] bg-slate-100 border border-slate-200 flex items-center justify-center text-[20px] font-bold text-slate-500">
                  {idCardEmp.firstName[0]}
                  {idCardEmp.lastName[0]}
                </div>
              )}
              <div className="space-y-1 text-[13.5px]">
                <div className="text-[17px] font-bold text-slate-900">{idCardEmp.firstName} {idCardEmp.lastName}</div>
                <div className="text-slate-700 font-medium">{idCardEmp.designation || idCardEmp.staffType}</div>
                <div className="text-slate-600">{deptMap.get(idCardEmp.departmentId || '') || idCardEmp.category || 'Administration'}</div>
                <div className="text-slate-600">Joined: {formatDate(idCardEmp.joiningDate)}</div>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                <span>Status:</span>
                <StatusBadge status={idCardEmp.status} size="sm" />
              </div>
              <QrCodeCanvas
                value={`${window.location.origin}${window.location.pathname}#verify/employee/${idCardEmp.id}`}
                size={64}
              />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteEmp)}
        onClose={() => setDeleteEmp(null)}
        onConfirm={handleSoftDeleteEmployee}
        title="Archive Employee Record"
        description={`Archive "${deleteEmp?.firstName} ${deleteEmp?.lastName}"?`}
        confirmLabel="Archive"
        destructive
      />
    </div>
  );
}
