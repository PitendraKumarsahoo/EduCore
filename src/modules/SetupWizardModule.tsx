import React, { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ListChecks, Plus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { createOrUpdateInvite, saveInstDoc, updateInstitution, writeAuditLog } from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import { ALL_ROLES, ROLE_LABELS } from '../config/permissions';
import { generateId, nowIso } from '../utils/format';
import { FormField, PageHeader, SectionCard, StatusBadge } from '../components/ui/Primitives';
import type { Institution, RoleKey } from '../types';

const SETUP_STEPS = [
  'Institution Info',
  'Academic Year',
  'Departments',
  'Classes / Programs',
  'Sections / Batches',
  'Subjects',
  'Working Days',
  'Fee Categories',
  'User Accounts',
  'Complete Setup',
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function SetupWizardModule() {
  const {
    institution,
    member,
    userAccount,
    academicYears,
    departments,
    programs,
    classes,
    sections,
    subjects,
    feeCategories,
    pushToast,
    setActiveModule,
    setActiveYearId,
  } = useApp();

  const [step, setStep] = useState<number>(Math.min(10, Math.max(1, institution?.setupStep || 1)));
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [instName, setInstName] = useState(institution?.name || '');
  const [instType, setInstType] = useState<Institution['type']>(institution?.type || 'school');
  const [instPhone, setInstPhone] = useState(institution?.phone || '');
  const [instEmail, setInstEmail] = useState(institution?.email || '');
  const [instWebsite, setInstWebsite] = useState(institution?.website || '');
  const [instAddress, setInstAddress] = useState(institution?.address || '');
  const [currency, setCurrency] = useState(institution?.currency || 'USD');

  // Step 2: Academic Year
  const [yearName, setYearName] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');

  // Step 3: Department
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');

  // Step 4: Program & Class
  const [progName, setProgName] = useState('');
  const [progCode, setProgCode] = useState('');
  const [className, setClassName] = useState('');
  const [classProgId, setClassProgId] = useState('');
  const [classDeptId, setClassDeptId] = useState('');

  // Step 5: Section
  const [secClassId, setSecClassId] = useState('');
  const [secName, setSecName] = useState('');
  const [secRoom, setSecRoom] = useState('');

  // Step 6: Subject
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subClassId, setSubClassId] = useState('');
  const [subMax, setSubMax] = useState(100);
  const [subPass, setSubPass] = useState(35);

  // Step 7: Working days
  const [workingDays, setWorkingDays] = useState<string[]>(
    institution?.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  );

  // Step 8: Fee category
  const [feeCatName, setFeeCatName] = useState('');
  const [feeCatCode, setFeeCatCode] = useState('');

  // Step 9: Invite user
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invRole, setInvRole] = useState<RoleKey>('teacher');
  const [invitedList, setInvitedList] = useState<{ email: string; role: RoleKey }[]>([]);

  if (!institution) return null;
  const instId = institution.id;

  const saveStepProgress = async (nextStep: number, complete = false) => {
    await updateInstitution(instId, {
      setupStep: nextStep,
      setupCompleted: complete ? true : institution.setupCompleted,
    });
  };

  const handleSaveInstInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateInstitution(instId, {
        name: instName.trim(),
        type: instType,
        phone: instPhone.trim() || undefined,
        email: instEmail.trim() || undefined,
        website: instWebsite.trim() || undefined,
        address: instAddress.trim() || undefined,
        currency,
        setupStep: 2,
      });
      pushToast('success', 'Institution profile updated.');
      setStep(2);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yearName.trim() || !yearStart || !yearEnd) return;
    setSaving(true);
    try {
      const id = generateId('ay');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'academic_years',
        id,
        {
          institutionId: instId,
          name: yearName.trim(),
          startDate: yearStart,
          endDate: yearEnd,
          isCurrent: academicYears.length === 0,
          status: 'active',
          createdAt: ts,
          updatedAt: ts,
        },
        true,
      );
      if (academicYears.length === 0) {
        await updateInstitution(instId, { currentAcademicYearId: id });
        setActiveYearId(id);
      }
      setYearName('');
      setYearStart('');
      setYearEnd('');
      pushToast('success', 'Academic year created.');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim() || !deptCode.trim()) return;
    setSaving(true);
    try {
      const id = generateId('dept');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'departments',
        id,
        {
          institutionId: instId,
          name: deptName.trim(),
          code: deptCode.trim().toUpperCase(),
          status: 'active',
          createdAt: ts,
          updatedAt: ts,
        },
        true,
      );
      setDeptName('');
      setDeptCode('');
      pushToast('success', 'Department added.');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progName.trim() || !progCode.trim()) return;
    setSaving(true);
    try {
      const id = generateId('prog');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'programs',
        id,
        {
          institutionId: instId,
          name: progName.trim(),
          code: progCode.trim().toUpperCase(),
          status: 'active',
          createdAt: ts,
          updatedAt: ts,
        },
        true,
      );
      setProgName('');
      setProgCode('');
      pushToast('success', 'Program added.');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;
    setSaving(true);
    try {
      const id = generateId('cls');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'classes',
        id,
        {
          institutionId: instId,
          academicYearId: institution.currentAcademicYearId || undefined,
          departmentId: classDeptId || undefined,
          programId: classProgId || undefined,
          name: className.trim(),
          levelType: instType === 'school' ? 'school_class' : 'college_semester',
          status: 'active',
          createdAt: ts,
          updatedAt: ts,
        },
        true,
      );
      setClassName('');
      pushToast('success', 'Class / Semester added.');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetClass = secClassId || classes[0]?.id;
    if (!targetClass || !secName.trim()) return;
    setSaving(true);
    try {
      const id = generateId('sec');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'sections',
        id,
        {
          institutionId: instId,
          academicYearId: institution.currentAcademicYearId || undefined,
          classId: targetClass,
          name: secName.trim(),
          roomNumber: secRoom.trim() || undefined,
          status: 'active',
          createdAt: ts,
          updatedAt: ts,
        },
        true,
      );
      setSecName('');
      setSecRoom('');
      pushToast('success', 'Section / Batch added.');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCode.trim() || !subName.trim()) return;
    setSaving(true);
    try {
      const id = generateId('sub');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'subjects',
        id,
        {
          institutionId: instId,
          code: subCode.trim().toUpperCase(),
          name: subName.trim(),
          classId: subClassId || undefined,
          subjectType: 'theory',
          maxMarks: Number(subMax),
          passingMarks: Number(subPass),
          status: 'active',
          createdAt: ts,
          updatedAt: ts,
        },
        true,
      );
      setSubCode('');
      setSubName('');
      pushToast('success', 'Subject added.');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkingDays = async () => {
    setSaving(true);
    try {
      await updateInstitution(instId, { workingDays, setupStep: 8 });
      pushToast('success', 'Working days saved.');
      setStep(8);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddFeeCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeCatName.trim()) return;
    setSaving(true);
    try {
      const id = generateId('fcat');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'fee_categories',
        id,
        {
          institutionId: instId,
          name: feeCatName.trim(),
          code: feeCatCode.trim().toUpperCase() || undefined,
          isRecurring: true,
          status: 'active',
          createdAt: ts,
          updatedAt: ts,
        },
        true,
      );
      setFeeCatName('');
      setFeeCatCode('');
      pushToast('success', 'Fee category added.');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invEmail.trim() || !userAccount) return;
    setSaving(true);
    try {
      await createOrUpdateInvite({
        institutionId: instId,
        institutionName: institution.name,
        email: invEmail.trim(),
        role: invRole,
        displayName: invName.trim() || undefined,
        createdByUid: userAccount.uid,
      });
      setInvitedList((prev) => [...prev, { email: invEmail.trim(), role: invRole }]);
      setInvEmail('');
      setInvName('');
      pushToast('success', 'User invitation recorded.');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteSetup = async () => {
    setSaving(true);
    try {
      await updateInstitution(instId, { setupCompleted: true, setupStep: 10 });
      if (userAccount) {
        await writeAuditLog(instId, {
          userUid: userAccount.uid,
          userEmail: userAccount.email,
          userName: userAccount.displayName,
          userRole: member?.role || 'institution_admin',
          action: 'update',
          module: 'setup_wizard',
          recordId: instId,
          summary: 'Completed 10-step institutional setup wizard',
        });
      }
      pushToast('success', 'Institutional setup completed.');
      setActiveModule('dashboard');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        icon={ListChecks}
        title="Institution Setup Wizard"
        subtitle="Configure your academic structure, working schedule, fee categories, and team roles."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stepper Sidebar */}
        <div className="lg:col-span-3 ec-card p-3.5 h-fit border-t-2 border-t-blue-700">
          <div className="px-2.5 pb-2.5 mb-2 border-b border-slate-100 text-[12.5px] font-semibold text-slate-500">
            Setup Steps ({step} of {SETUP_STEPS.length})
          </div>
          <div className="space-y-1">
            {SETUP_STEPS.map((label, idx) => {
              const num = idx + 1;
              const isCurrent = step === num;
              const isPast = num < step;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(num)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-[14px] rounded-[10px] text-left transition-colors ${
                    isCurrent
                      ? 'bg-blue-100/75 text-blue-950 font-semibold'
                      : 'text-slate-700 hover:bg-blue-50/55 font-medium'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-mono shrink-0 ${
                      isCurrent
                        ? 'bg-blue-800 text-white'
                        : isPast
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : num}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <SectionCard variant="top-accent" className="lg:col-span-9">
          {step === 1 && (
            <form onSubmit={handleSaveInstInfo} className="space-y-5">
              <div>
                <h2 className="text-[19px] font-semibold text-slate-900">Step 1: Institution Information</h2>
                <p className="text-[14px] text-slate-500 mt-0.5">
                  Verify your official school or college workspace profile and currency.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Institution Name" required className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    value={instName}
                    onChange={(e) => setInstName(e.target.value)}
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Type">
                  <select
                    value={instType}
                    onChange={(e) => setInstType(e.target.value as Institution['type'])}
                    className="ec-select"
                  >
                    <option value="school">School (K-12)</option>
                    <option value="college">College</option>
                    <option value="university">University</option>
                    <option value="k12_and_college">School &amp; College</option>
                  </select>
                </FormField>
                <FormField label="Currency">
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    maxLength={5}
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Official Email">
                  <input
                    type="email"
                    value={instEmail}
                    onChange={(e) => setInstEmail(e.target.value)}
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Phone">
                  <input
                    type="tel"
                    value={instPhone}
                    onChange={(e) => setInstPhone(e.target.value)}
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Website">
                  <input
                    type="url"
                    value={instWebsite}
                    onChange={(e) => setInstWebsite(e.target.value)}
                    placeholder="https://"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Address">
                  <input
                    type="text"
                    value={instAddress}
                    onChange={(e) => setInstAddress(e.target.value)}
                    className="ec-input"
                  />
                </FormField>
              </div>
              <div className="flex justify-end pt-3">
                <button type="submit" disabled={saving} className="ec-btn-primary">
                  Save &amp; Continue
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[19px] font-semibold text-slate-900">Step 2: Academic Year</h2>
                <p className="text-[14px] text-slate-500 mt-0.5">
                  Define the active academic session (e.g. 2026-27).
                </p>
              </div>
              <form onSubmit={handleAddYear} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <FormField label="Year Name" required>
                  <input
                    type="text"
                    required
                    value={yearName}
                    onChange={(e) => setYearName(e.target.value)}
                    placeholder="2026-27"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Start Date" required>
                  <input
                    type="date"
                    required
                    value={yearStart}
                    onChange={(e) => setYearStart(e.target.value)}
                    className="ec-input"
                  />
                </FormField>
                <FormField label="End Date" required>
                  <input
                    type="date"
                    required
                    value={yearEnd}
                    onChange={(e) => setYearEnd(e.target.value)}
                    className="ec-input"
                  />
                </FormField>
                <button type="submit" disabled={saving} className="ec-btn-primary">
                  <Plus className="w-4 h-4" /> Add Year
                </button>
              </form>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-[10px] overflow-hidden">
                {academicYears.length === 0 ? (
                  <p className="p-5 text-[14px] text-slate-500">No academic years added yet.</p>
                ) : (
                  academicYears.map((y) => (
                    <div key={y.id} className="px-4 py-3 flex items-center justify-between text-[15px]">
                      <div>
                        <span className="font-semibold text-slate-900">{y.name}</span>
                        <span className="text-[13.5px] text-slate-500 ml-3 font-mono">
                          {y.startDate} to {y.endDate}
                        </span>
                      </div>
                      <StatusBadge
                        status={y.isCurrent ? 'current' : y.status}
                        label={y.isCurrent ? 'Current' : undefined}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[19px] font-semibold text-slate-900">Step 3: Departments</h2>
                <p className="text-[14px] text-slate-500 mt-0.5">
                  Add academic or administrative departments.
                </p>
              </div>
              <form onSubmit={handleAddDept} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <FormField label="Department Name" required>
                  <input
                    type="text"
                    required
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="Department Name"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Code" required>
                  <input
                    type="text"
                    required
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    placeholder="DEPT"
                    className="ec-input"
                  />
                </FormField>
                <button type="submit" disabled={saving} className="ec-btn-primary">
                  <Plus className="w-4 h-4" /> Add Department
                </button>
              </form>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-[10px] overflow-hidden">
                {departments.length === 0 ? (
                  <p className="p-5 text-[14px] text-slate-500">No departments created yet.</p>
                ) : (
                  departments.map((d) => (
                    <div key={d.id} className="px-4 py-3 flex items-center justify-between text-[15px]">
                      <span className="font-medium text-slate-900">
                        <span className="font-mono text-[13.5px] text-slate-600 mr-2">{d.code}</span> ·{' '}
                        {d.name}
                      </span>
                      <StatusBadge status={d.status} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[19px] font-semibold text-slate-900">Step 4: Programs &amp; Classes</h2>
                <p className="text-[14px] text-slate-500 mt-0.5">
                  Configure degree programs (if applicable) and classes/semesters.
                </p>
              </div>
              <form
                onSubmit={handleAddProgram}
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end border-b border-slate-200 pb-6"
              >
                <FormField label="Program Name">
                  <input
                    type="text"
                    value={progName}
                    onChange={(e) => setProgName(e.target.value)}
                    placeholder="Program Title"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Program Code">
                  <input
                    type="text"
                    value={progCode}
                    onChange={(e) => setProgCode(e.target.value)}
                    placeholder="CODE"
                    className="ec-input"
                  />
                </FormField>
                <button type="submit" disabled={saving} className="ec-btn-secondary">
                  Add Program ({programs.length})
                </button>
              </form>

              <form onSubmit={handleAddClass} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <FormField label="Class / Semester" required>
                  <input
                    type="text"
                    required
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="Class or Semester Name"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Department">
                  <select
                    value={classDeptId}
                    onChange={(e) => setClassDeptId(e.target.value)}
                    className="ec-select"
                  >
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Program">
                  <select
                    value={classProgId}
                    onChange={(e) => setClassProgId(e.target.value)}
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
                <button type="submit" disabled={saving} className="ec-btn-primary">
                  Add Class ({classes.length})
                </button>
              </form>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[19px] font-semibold text-slate-900">Step 5: Sections / Batches</h2>
                <p className="text-[14px] text-slate-500 mt-0.5">
                  Add sections or batches under your configured classes.
                </p>
              </div>
              <form onSubmit={handleAddSection} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <FormField label="Class" required>
                  <select
                    required
                    value={secClassId || classes[0]?.id || ''}
                    onChange={(e) => setSecClassId(e.target.value)}
                    className="ec-select"
                  >
                    {classes.length === 0 && <option value="">Create a class first</option>}
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Section / Batch" required>
                  <input
                    type="text"
                    required
                    value={secName}
                    onChange={(e) => setSecName(e.target.value)}
                    placeholder="Section Name"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Room">
                  <input
                    type="text"
                    value={secRoom}
                    onChange={(e) => setSecRoom(e.target.value)}
                    placeholder="Room #"
                    className="ec-input"
                  />
                </FormField>
                <button
                  type="submit"
                  disabled={saving || classes.length === 0}
                  className="ec-btn-primary"
                >
                  Add Section ({sections.length})
                </button>
              </form>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[19px] font-semibold text-slate-900">Step 6: Subjects</h2>
                <p className="text-[14px] text-slate-500 mt-0.5">
                  Define curriculum subjects and maximum/passing marks.
                </p>
              </div>
              <form onSubmit={handleAddSubject} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <FormField label="Subject Code" required>
                  <input
                    type="text"
                    required
                    value={subCode}
                    onChange={(e) => setSubCode(e.target.value)}
                    placeholder="SUB101"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Subject Name" required className="sm:col-span-2">
                  <input
                    type="text"
                    required
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    placeholder="Subject Title"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Class">
                  <select
                    value={subClassId}
                    onChange={(e) => setSubClassId(e.target.value)}
                    className="ec-select"
                  >
                    <option value="">All / Unassigned</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Max Marks">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={subMax}
                    onChange={(e) => setSubMax(Number(e.target.value))}
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Passing Marks">
                  <input
                    type="number"
                    min={0}
                    max={subMax}
                    value={subPass}
                    onChange={(e) => setSubPass(Number(e.target.value))}
                    className="ec-input"
                  />
                </FormField>
                <div className="sm:col-span-3 flex justify-end">
                  <button type="submit" disabled={saving} className="ec-btn-primary">
                    Add Subject ({subjects.length})
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[19px] font-semibold text-slate-900">Step 7: Working Days</h2>
                <p className="text-[14px] text-slate-500 mt-0.5">
                  Select the official instructional days of the week.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {WEEKDAYS.map((day) => {
                  const active = workingDays.includes(day);
                  return (
                    <label
                      key={day}
                      className={`flex items-center gap-2.5 p-3.5 border rounded-[10px] cursor-pointer text-[15px] transition-colors ${
                        active
                          ? 'bg-blue-50 border-blue-700 text-blue-900 font-semibold'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() =>
                          setWorkingDays((prev) =>
                            active ? prev.filter((d) => d !== day) : [...prev, day],
                          )
                        }
                        className="w-4 h-4 rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                      />
                      <span>{day}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveWorkingDays}
                  disabled={saving}
                  className="ec-btn-primary"
                >
                  Save Working Days
                </button>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[19px] font-semibold text-slate-900">Step 8: Fee Categories</h2>
                <p className="text-[14px] text-slate-500 mt-0.5">
                  Configure institutional fee heads (e.g., Tuition, Admission, Examination, Library, Transport).
                </p>
              </div>
              <form onSubmit={handleAddFeeCategory} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <FormField label="Category Name" required>
                  <input
                    type="text"
                    required
                    value={feeCatName}
                    onChange={(e) => setFeeCatName(e.target.value)}
                    placeholder="Category Name"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Code">
                  <input
                    type="text"
                    value={feeCatCode}
                    onChange={(e) => setFeeCatCode(e.target.value)}
                    placeholder="CODE"
                    className="ec-input"
                  />
                </FormField>
                <button type="submit" disabled={saving} className="ec-btn-primary">
                  Add Fee Category ({feeCategories.length})
                </button>
              </form>
            </div>
          )}

          {step === 9 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[19px] font-semibold text-slate-900">
                  Step 9: User Accounts &amp; Invitations
                </h2>
                <p className="text-[14px] text-slate-500 mt-0.5">
                  Invite administrators, faculty, accountants, librarians, students, or parents by verified email.
                </p>
              </div>
              <form onSubmit={handleInviteUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <FormField label="Email" required>
                  <input
                    type="email"
                    required
                    value={invEmail}
                    onChange={(e) => setInvEmail(e.target.value)}
                    placeholder="staff@institution.edu"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Full Name">
                  <input
                    type="text"
                    value={invName}
                    onChange={(e) => setInvName(e.target.value)}
                    placeholder="Name"
                    className="ec-input"
                  />
                </FormField>
                <FormField label="Role" required>
                  <select
                    value={invRole}
                    onChange={(e) => setInvRole(e.target.value as RoleKey)}
                    className="ec-select"
                  >
                    {ALL_ROLES.filter((r) => r !== 'super_admin').map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </FormField>
                <button type="submit" disabled={saving} className="ec-btn-primary">
                  Send Invite
                </button>
              </form>
              {invitedList.length > 0 && (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-[10px] overflow-hidden">
                  {invitedList.map((i, idx) => (
                    <div key={idx} className="px-4 py-3 text-[14.5px] flex justify-between items-center">
                      <span className="font-medium text-slate-900">{i.email}</span>
                      <span className="text-[13px] font-medium text-slate-600">{ROLE_LABELS[i.role]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 10 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-[19px] font-semibold text-slate-900">Step 10: Complete Initial Setup</h2>
                <p className="text-[15px] text-slate-600 mt-1">
                  Review your configured foundation below. You can always adjust or expand any module later.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50/45 border border-blue-200/75 rounded-[10px]">
                  <div className="text-[13.5px] font-medium text-slate-600">Academic Years</div>
                  <div className="text-[28px] font-bold text-blue-950 tabular-nums mt-1 font-display">
                    {academicYears.length}
                  </div>
                </div>
                <div className="p-4 bg-indigo-50/45 border border-indigo-200/75 rounded-[10px]">
                  <div className="text-[13.5px] font-medium text-slate-600">Departments</div>
                  <div className="text-[28px] font-bold text-indigo-950 tabular-nums mt-1 font-display">
                    {departments.length}
                  </div>
                </div>
                <div className="p-4 bg-violet-50/45 border border-violet-200/75 rounded-[10px]">
                  <div className="text-[13.5px] font-medium text-slate-600">Programs / Classes</div>
                  <div className="text-[28px] font-bold text-violet-950 tabular-nums mt-1 font-display">
                    {programs.length} / {classes.length}
                  </div>
                </div>
                <div className="p-4 bg-teal-50/45 border border-teal-200/75 rounded-[10px]">
                  <div className="text-[13.5px] font-medium text-slate-600">Sections</div>
                  <div className="text-[28px] font-bold text-teal-950 tabular-nums mt-1 font-display">
                    {sections.length}
                  </div>
                </div>
                <div className="p-4 bg-emerald-50/45 border border-emerald-200/75 rounded-[10px]">
                  <div className="text-[13.5px] font-medium text-slate-600">Subjects</div>
                  <div className="text-[28px] font-bold text-emerald-950 tabular-nums mt-1 font-display">
                    {subjects.length}
                  </div>
                </div>
                <div className="p-4 bg-amber-50/45 border border-amber-200/75 rounded-[10px]">
                  <div className="text-[13.5px] font-medium text-slate-600">Fee Categories</div>
                  <div className="text-[28px] font-bold text-amber-950 tabular-nums mt-1 font-display">
                    {feeCategories.length}
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCompleteSetup}
                  disabled={saving}
                  className="ec-btn-success px-6 py-2.5"
                >
                  <Check className="w-4 h-4" />
                  Finish &amp; Launch Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="mt-8 pt-5 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              disabled={step <= 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="ec-btn-secondary disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            {step < 10 && (
              <button
                type="button"
                onClick={async () => {
                  const next = Math.min(10, step + 1);
                  await saveStepProgress(next);
                  setStep(next);
                }}
                className="ec-btn-secondary"
              >
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
