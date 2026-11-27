import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, Plus, Printer, UserCheck } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { saveInstDoc, writeAuditLog } from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import { generateId, nowIso, todayDateStr } from '../utils/format';
import { exportToCsv } from '../utils/csv';
import {
  DataTable,
  EmptyState,
  FormField,
  FormSection,
  Modal,
  PageHeader,
  StatusBadge,
} from '../components/ui/Primitives';
import type { Admission } from '../types';

const ADMISSION_STATUSES: Admission['status'][] = [
  'draft',
  'submitted',
  'under_review',
  'documents_pending',
  'approved',
  'rejected',
  'enrolled',
];

export function AdmissionsModule() {
  const {
    institution,
    member,
    userAccount,
    admissions,
    classes,
    sections,
    programs,
    academicYears,
    activeYearId,
    can,
    pushToast,
    dataLoading,
  } = useApp();

  const instId = institution?.id || '';
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Admission | null>(null);
  const [receiptItem, setReceiptItem] = useState<Admission | null>(null);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [previousInstitution, setPreviousInstitution] = useState('');
  const [previousScore, setPreviousScore] = useState('');
  const [targetProgramId, setTargetProgramId] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'flagged'>('pending');
  const [status, setStatus] = useState<Admission['status']>('submitted');
  const [remarks, setRemarks] = useState('');

  const filtered = useMemo(() => {
    return admissions.filter((a) => {
      if (activeYearId && a.academicYearId && a.academicYearId !== activeYearId) return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      return true;
    });
  }, [admissions, activeYearId, statusFilter]);

  const openNew = () => {
    setEditItem(null);
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setDob('');
    setGender('');
    setEmail('');
    setPhone('');
    setAddress('');
    setPreviousInstitution('');
    setPreviousScore('');
    setTargetProgramId('');
    setTargetClassId('');
    setTargetSectionId('');
    setGuardianName('');
    setGuardianRelation('');
    setGuardianPhone('');
    setGuardianEmail('');
    setInterviewDate('');
    setInterviewNotes('');
    setVerificationStatus('pending');
    setStatus('submitted');
    setRemarks('');
    setModalOpen(true);
  };

  const openEdit = (a: Admission) => {
    setEditItem(a);
    setFirstName(a.firstName);
    setMiddleName(a.middleName || '');
    setLastName(a.lastName);
    setDob(a.dob || '');
    setGender(a.gender || '');
    setEmail(a.email || '');
    setPhone(a.phone || '');
    setAddress(a.address || '');
    setPreviousInstitution(a.previousInstitution || '');
    setPreviousScore(a.previousScore || '');
    setTargetProgramId(a.targetProgramId || '');
    setTargetClassId(a.targetClassId || '');
    setTargetSectionId(a.targetSectionId || '');
    setGuardianName(a.guardianName || '');
    setGuardianRelation(a.guardianRelation || '');
    setGuardianPhone(a.guardianPhone || '');
    setGuardianEmail(a.guardianEmail || '');
    setInterviewDate(a.interviewDate || '');
    setInterviewNotes(a.interviewNotes || '');
    setVerificationStatus(a.verificationStatus || 'pending');
    setStatus(a.status);
    setRemarks(a.remarks || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = editItem?.id || generateId('adm');
      const ts = nowIso();
      const appNo = editItem?.applicationNumber || `APP-${Date.now().toString().slice(-6)}`;
      await saveInstDoc(
        instId,
        'admissions',
        id,
        {
          institutionId: instId,
          applicationNumber: appNo,
          academicYearId: activeYearId || institution?.currentAcademicYearId || undefined,
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
          dob: dob || undefined,
          gender: gender || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          previousInstitution: previousInstitution.trim() || undefined,
          previousScore: previousScore.trim() || undefined,
          targetProgramId: targetProgramId || undefined,
          targetClassId: targetClassId || undefined,
          targetSectionId: targetSectionId || undefined,
          guardianName: guardianName.trim() || undefined,
          guardianRelation: guardianRelation.trim() || undefined,
          guardianPhone: guardianPhone.trim() || undefined,
          guardianEmail: guardianEmail.trim() || undefined,
          interviewDate: interviewDate || undefined,
          interviewNotes: interviewNotes.trim() || undefined,
          verificationStatus,
          status,
          enrolledStudentId: editItem?.enrolledStudentId,
          remarks: remarks.trim() || undefined,
          createdAt: editItem?.createdAt || ts,
          updatedAt: ts,
        },
        !editItem,
      );
      if (userAccount) {
        await writeAuditLog(instId, {
          userUid: userAccount.uid,
          userEmail: userAccount.email,
          userName: userAccount.displayName,
          userRole: member?.role || '',
          action: editItem ? 'update' : 'create',
          module: 'admissions',
          recordId: id,
          summary: `${editItem ? 'Updated' : 'Created'} admission application ${appNo} (${firstName} ${lastName})`,
        });
      }
      pushToast('success', `Application ${appNo} saved.`);
      setModalOpen(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEnrollStudent = async (adm: Admission) => {
    if (adm.status === 'enrolled') return;
    setSaving(true);
    try {
      const stuId = generateId('stu');
      const ts = nowIso();
      const studentCode = `STU-${Date.now().toString().slice(-6)}`;
      await saveInstDoc(
        instId,
        'students',
        stuId,
        {
          institutionId: instId,
          studentCode,
          admissionNumber: adm.applicationNumber,
          firstName: adm.firstName,
          middleName: adm.middleName,
          lastName: adm.lastName,
          dob: adm.dob,
          gender: adm.gender,
          phone: adm.phone,
          email: adm.email,
          address: adm.address,
          admissionDate: todayDateStr(),
          academicYearId: adm.academicYearId || activeYearId || undefined,
          programId: adm.targetProgramId,
          classId: adm.targetClassId,
          sectionId: adm.targetSectionId,
          status: 'active',
          previousInstitution: adm.previousInstitution,
          guardianName: adm.guardianName,
          guardianRelation: adm.guardianRelation,
          guardianPhone: adm.guardianPhone,
          guardianEmail: adm.guardianEmail,
          isDeleted: false,
          createdAt: ts,
          updatedAt: ts,
        },
        true,
      );
      await saveInstDoc(
        instId,
        'admissions',
        adm.id,
        {
          status: 'enrolled',
          enrolledStudentId: stuId,
          updatedAt: ts,
        },
        false,
      );
      if (userAccount) {
        await writeAuditLog(instId, {
          userUid: userAccount.uid,
          userEmail: userAccount.email,
          userName: userAccount.displayName,
          userRole: member?.role || '',
          action: 'create',
          module: 'admissions',
          recordId: stuId,
          summary: `Enrolled applicant ${adm.applicationNumber} as student ${studentCode}`,
        });
      }
      pushToast('success', `Applicant enrolled with Student ID ${studentCode}.`);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        icon={UserCheck}
        title="Admissions Management"
        subtitle="Manage applications, document verification, interviews, approvals, and student enrollment."
        actions={
          can('admissions', 'create') && (
            <button type="button" onClick={openNew} className="ec-btn-primary">
              <Plus className="w-4 h-4" /> New Application
            </button>
          )
        }
      />

      <DataTable
        rows={filtered}
        loading={dataLoading}
        searchPlaceholder="Search application #, applicant, email..."
        searchFilter={(r, q) =>
          `${r.applicationNumber} ${r.firstName} ${r.lastName} ${r.email || ''} ${r.phone || ''}`
            .toLowerCase()
            .includes(q)
        }
        filters={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ec-select w-auto min-w-[160px] py-2 text-[14px]"
          >
            <option value="all">All Statuses</option>
            {ADMISSION_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        }
        onExport={(rows) =>
          exportToCsv(
            'admissions.csv',
            ['Application #', 'First Name', 'Last Name', 'Email', 'Phone', 'Class', 'Verification', 'Status'],
            rows.map((r) => [
              r.applicationNumber,
              r.firstName,
              r.lastName,
              r.email || '',
              r.phone || '',
              classes.find((c) => c.id === r.targetClassId)?.name || '',
              r.verificationStatus || 'pending',
              r.status,
            ]),
          )
        }
        emptyState={
          <EmptyState
            icon={UserCheck}
            title="No admission applications yet"
            description="Create a new admission application to begin tracking inquiries, verification, and student enrollment."
            actionLabel={can('admissions', 'create') ? 'Create Application' : undefined}
            onAction={openNew}
          />
        }
        columns={[
          { key: 'appNo', header: 'Application #', sortValue: (r) => r.applicationNumber, render: (r) => <span className="font-mono text-[13.5px] font-semibold text-slate-700">{r.applicationNumber}</span> },
          {
            key: 'name',
            header: 'Applicant',
            sortValue: (r) => `${r.firstName} ${r.lastName}`,
            render: (r) => (
              <div>
                <div className="font-medium text-slate-900">
                  {r.firstName} {r.lastName}
                </div>
                <div className="text-[13px] text-slate-500 mt-0.5">{r.email || r.phone || '—'}</div>
              </div>
            ),
          },
          { key: 'target', header: 'Target Class / Program', render: (r) => classes.find((c) => c.id === r.targetClassId)?.name || programs.find((p) => p.id === r.targetProgramId)?.name || '—' },
          { key: 'verify', header: 'Verification', render: (r) => <StatusBadge status={r.verificationStatus || 'pending'} /> },
          { key: 'status', header: 'Application Status', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (r) => (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setReceiptItem(r)}
                  className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-[8px] transition-colors"
                  title="Admission Receipt"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="p-2 text-slate-500 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                  title="Review / Edit"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {r.status === 'approved' && can('students', 'create') && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleEnrollStudent(r)}
                    className="ec-btn-success px-3 py-1.5 text-[13px]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Enroll
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Application Form Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? `Application ${editItem.applicationNumber}` : 'New Admission Application'}
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-5">
          <FormSection title="Applicant Details">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="First Name" required>
                <input type="text" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Middle Name">
                <input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Last Name" required>
                <input type="text" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Date of Birth">
                <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Gender">
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="ec-select">
                  <option value="">Select</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-Binary">Non-Binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </FormField>
              <FormField label="Phone">
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Email">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Address" className="sm:col-span-2">
                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="ec-input" />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Academic Target" withDivider>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Target Program">
                <select value={targetProgramId} onChange={(e) => setTargetProgramId(e.target.value)} className="ec-select">
                  <option value="">None</option>
                  {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </FormField>
              <FormField label="Target Class / Sem">
                <select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)} className="ec-select">
                  <option value="">Select Class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Target Section">
                <select value={targetSectionId} onChange={(e) => setTargetSectionId(e.target.value)} className="ec-select">
                  <option value="">Select Section</option>
                  {sections.filter((s) => !targetClassId || s.classId === targetClassId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
              <FormField label="Previous Institution">
                <input type="text" value={previousInstitution} onChange={(e) => setPreviousInstitution(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Previous Grade / Score">
                <input type="text" value={previousScore} onChange={(e) => setPreviousScore(e.target.value)} className="ec-input" />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Guardian Information" withDivider>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <FormField label="Guardian Name">
                <input type="text" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Relation">
                <input type="text" value={guardianRelation} onChange={(e) => setGuardianRelation(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Guardian Phone">
                <input type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Guardian Email">
                <input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} className="ec-input" />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Review & Status" withDivider>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Verification Status">
                <select value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value as any)} className="ec-select">
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="flagged">Flagged</option>
                </select>
              </FormField>
              <FormField label="Interview / Test Date">
                <input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className="ec-input" />
              </FormField>
              <FormField label="Application Status">
                <select
                  value={status}
                  disabled={editItem?.status === 'enrolled'}
                  onChange={(e) => setStatus(e.target.value as Admission['status'])}
                  className="ec-select"
                >
                  {ADMISSION_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Interview / Committee Remarks" className="sm:col-span-3">
                <textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="ec-textarea" />
              </FormField>
            </div>
          </FormSection>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">
              {saving ? 'Saving...' : 'Save Application'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Admission Receipt */}
      <Modal open={Boolean(receiptItem)} onClose={() => setReceiptItem(null)} title="Admission Confirmation Receipt" size="md">
        {receiptItem && (
          <div className="space-y-4">
            <div className="print-surface border border-slate-200 rounded-[12px] p-6 space-y-5 bg-white">
              <div className="flex justify-between items-start border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-[19px] font-bold text-slate-900">{institution?.name}</h2>
                  <p className="text-[13.5px] text-slate-500 mt-0.5">
                    {institution?.address || 'Official Admission Acknowledgement'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[13.5px] font-mono font-bold text-slate-900">{receiptItem.applicationNumber}</div>
                  <div className="mt-1.5 flex justify-end">
                    <StatusBadge status={receiptItem.status} size="sm" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[15px]">
                <div>
                  <div className="text-[13px] text-slate-500">Applicant Name</div>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {receiptItem.firstName} {receiptItem.lastName}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-slate-500">Academic Year</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {academicYears.find((y) => y.id === receiptItem.academicYearId)?.name || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-slate-500">Applied Class / Program</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {classes.find((c) => c.id === receiptItem.targetClassId)?.name ||
                      programs.find((p) => p.id === receiptItem.targetProgramId)?.name ||
                      '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[13px] text-slate-500">Guardian</div>
                  <div className="font-medium text-slate-900 mt-0.5">{receiptItem.guardianName || '—'}</div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 no-print">
              <button type="button" onClick={() => window.print()} className="ec-btn-primary">
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
