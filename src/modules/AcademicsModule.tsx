import React, { useState } from 'react';
import { BookOpen, Building2, ClipboardList, Landmark, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { deleteInstDoc, saveInstDoc, updateInstitution, writeAuditLog } from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import { generateId, nowIso } from '../utils/format';
import { exportToCsv } from '../utils/csv';
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  SearchableSelect,
  StatusBadge,
  Tabs,
} from '../components/ui/Primitives';
import type { AcademicClass, AcademicYear, Department, Program, Section, Subject } from '../types';

export function AcademicsModule() {
  const {
    institution,
    member,
    userAccount,
    activeModule,
    setActiveModule,
    academicYears,
    departments,
    programs,
    classes,
    sections,
    subjects,
    employees,
    can,
    pushToast,
    setActiveYearId,
    dataLoading,
  } = useApp();

  const instId = institution?.id || '';
  const facultyList = employees.filter((e) => e.staffType === 'faculty');

  // Modals
  const [yearModal, setYearModal] = useState(false);
  const [editYear, setEditYear] = useState<AcademicYear | null>(null);
  const [yName, setYName] = useState('');
  const [yStart, setYStart] = useState('');
  const [yEnd, setYEnd] = useState('');
  const [yCurrent, setYCurrent] = useState(false);

  const [deptModal, setDeptModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [dName, setDName] = useState('');
  const [dCode, setDCode] = useState('');
  const [dHodId, setDHodId] = useState('');
  const [dDesc, setDDesc] = useState('');

  const [progModal, setProgModal] = useState(false);
  const [editProg, setEditProg] = useState<Program | null>(null);
  const [pName, setPName] = useState('');
  const [pCode, setPCode] = useState('');
  const [pDegree, setPDegree] = useState('');
  const [pDeptId, setPDeptId] = useState('');
  const [pYears, setPYears] = useState(3);
  const [pSems, setPSems] = useState(6);
  const [pCredits, setPCredits] = useState('');

  const [clsModal, setClsModal] = useState(false);
  const [editCls, setEditCls] = useState<AcademicClass | null>(null);
  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('');
  const [cDeptId, setCDeptId] = useState('');
  const [cProgId, setCProgId] = useState('');
  const [cSem, setCSem] = useState(1);
  const [cLevel, setCLevel] = useState<'school_class' | 'college_semester'>(
    institution?.type === 'school' ? 'school_class' : 'college_semester',
  );
  const [cCap, setCCap] = useState(40);

  const [secModal, setSecModal] = useState(false);
  const [editSec, setEditSec] = useState<Section | null>(null);
  const [sClassId, setSClassId] = useState('');
  const [sName, setSName] = useState('');
  const [sBatch, setSBatch] = useState('');
  const [sRoom, setSRoom] = useState('');
  const [sCap, setSCap] = useState(40);

  const [subModal, setSubModal] = useState(false);
  const [editSub, setEditSub] = useState<Subject | null>(null);
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subDeptId, setSubDeptId] = useState('');
  const [subProgId, setSubProgId] = useState('');
  const [subClassId, setSubClassId] = useState('');
  const [subSecId, setSubSecId] = useState('');
  const [subCredits, setSubCredits] = useState(4);
  const [subType, setSubType] = useState<'theory' | 'practical' | 'both'>('theory');
  const [subMax, setSubMax] = useState(100);
  const [subPass, setSubPass] = useState(35);
  const [subFacId, setSubFacId] = useState('');

  const [confirmDel, setConfirmDel] = useState<{ subcollection: string; id: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const logAction = async (action: string, module: string, recordId: string, summary: string) => {
    if (!userAccount || !instId) return;
    await writeAuditLog(instId, {
      userUid: userAccount.uid,
      userEmail: userAccount.email,
      userName: userAccount.displayName,
      userRole: member?.role || '',
      action,
      module,
      recordId,
      summary,
    });
  };

  // Save Year
  const saveYear = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = editYear?.id || generateId('ay');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'academic_years',
        id,
        {
          institutionId: instId,
          name: yName.trim(),
          startDate: yStart,
          endDate: yEnd,
          isCurrent: yCurrent,
          status: 'active',
          createdAt: editYear?.createdAt || ts,
          updatedAt: ts,
        },
        !editYear,
      );
      if (yCurrent) {
        await updateInstitution(instId, { currentAcademicYearId: id });
        setActiveYearId(id);
      }
      await logAction(editYear ? 'update' : 'create', 'academic_years', id, `Saved academic year ${yName}`);
      pushToast('success', 'Academic year saved.');
      setYearModal(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  // Save Department
  const saveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = editDept?.id || generateId('dept');
      const ts = nowIso();
      const hod = facultyList.find((f) => f.id === dHodId);
      await saveInstDoc(
        instId,
        'departments',
        id,
        {
          institutionId: instId,
          name: dName.trim(),
          code: dCode.trim().toUpperCase(),
          hodEmployeeId: dHodId || undefined,
          hodName: hod ? `${hod.firstName} ${hod.lastName}` : undefined,
          description: dDesc.trim() || undefined,
          status: editDept?.status || 'active',
          createdAt: editDept?.createdAt || ts,
          updatedAt: ts,
        },
        !editDept,
      );
      await logAction(editDept ? 'update' : 'create', 'departments', id, `Saved department ${dName}`);
      pushToast('success', 'Department saved.');
      setDeptModal(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  // Save Program
  const saveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = editProg?.id || generateId('prog');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'programs',
        id,
        {
          institutionId: instId,
          name: pName.trim(),
          code: pCode.trim().toUpperCase(),
          degreeType: pDegree.trim() || undefined,
          departmentId: pDeptId || undefined,
          durationYears: Number(pYears),
          semesterCount: Number(pSems),
          creditStructure: pCredits.trim() || undefined,
          status: editProg?.status || 'active',
          createdAt: editProg?.createdAt || ts,
          updatedAt: ts,
        },
        !editProg,
      );
      await logAction(editProg ? 'update' : 'create', 'programs', id, `Saved program ${pName}`);
      pushToast('success', 'Program saved.');
      setProgModal(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  // Save Class
  const saveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = editCls?.id || generateId('cls');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'classes',
        id,
        {
          institutionId: instId,
          academicYearId: institution?.currentAcademicYearId || undefined,
          departmentId: cDeptId || undefined,
          programId: cProgId || undefined,
          name: cName.trim(),
          code: cCode.trim() || undefined,
          semesterNumber: Number(cSem),
          levelType: cLevel,
          capacity: Number(cCap),
          status: editCls?.status || 'active',
          createdAt: editCls?.createdAt || ts,
          updatedAt: ts,
        },
        !editCls,
      );
      await logAction(editCls ? 'update' : 'create', 'classes', id, `Saved class ${cName}`);
      pushToast('success', 'Class / Semester saved.');
      setClsModal(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  // Save Section
  const saveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sClassId) {
      pushToast('error', 'Please select a parent class.');
      return;
    }
    setSaving(true);
    try {
      const id = editSec?.id || generateId('sec');
      const ts = nowIso();
      await saveInstDoc(
        instId,
        'sections',
        id,
        {
          institutionId: instId,
          academicYearId: institution?.currentAcademicYearId || undefined,
          classId: sClassId,
          name: sName.trim(),
          batchName: sBatch.trim() || undefined,
          roomNumber: sRoom.trim() || undefined,
          capacity: Number(sCap),
          status: editSec?.status || 'active',
          createdAt: editSec?.createdAt || ts,
          updatedAt: ts,
        },
        !editSec,
      );
      await logAction(editSec ? 'update' : 'create', 'sections', id, `Saved section ${sName}`);
      pushToast('success', 'Section / Batch saved.');
      setSecModal(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  // Save Subject
  const saveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subPass > subMax) {
      pushToast('error', 'Passing marks cannot exceed maximum marks.');
      return;
    }
    setSaving(true);
    try {
      const id = editSub?.id || generateId('sub');
      const ts = nowIso();
      const fac = facultyList.find((f) => f.id === subFacId);
      await saveInstDoc(
        instId,
        'subjects',
        id,
        {
          institutionId: instId,
          code: subCode.trim().toUpperCase(),
          name: subName.trim(),
          departmentId: subDeptId || undefined,
          programId: subProgId || undefined,
          classId: subClassId || undefined,
          sectionId: subSecId || undefined,
          credits: Number(subCredits),
          subjectType: subType,
          maxMarks: Number(subMax),
          passingMarks: Number(subPass),
          facultyId: subFacId || undefined,
          facultyName: fac ? `${fac.firstName} ${fac.lastName}` : undefined,
          status: editSub?.status || 'active',
          createdAt: editSub?.createdAt || ts,
          updatedAt: ts,
        },
        !editSub,
      );
      await logAction(editSub ? 'update' : 'create', 'subjects', id, `Saved subject ${subCode} ${subName}`);
      pushToast('success', 'Subject saved.');
      setSubModal(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDel) return;
    setSaving(true);
    try {
      await deleteInstDoc(instId, confirmDel.subcollection, confirmDel.id);
      await logAction('delete', confirmDel.subcollection, confirmDel.id, `Deleted ${confirmDel.label}`);
      pushToast('success', `${confirmDel.label} deleted.`);
      setConfirmDel(null);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const renderTabs = () => (
    <div className="mb-6">
      <Tabs
        value={activeModule as 'academics' | 'departments' | 'programs' | 'classes' | 'subjects'}
        onChange={(tab) => setActiveModule(tab)}
        items={[
          { key: 'academics', label: 'Academic Years', count: academicYears.length },
          { key: 'departments', label: 'Departments', count: departments.length },
          { key: 'programs', label: 'Programs', count: programs.length },
          { key: 'classes', label: 'Classes & Sections', count: classes.length },
          { key: 'subjects', label: 'Subjects', count: subjects.length },
        ]}
      />
    </div>
  );

  return (
    <div>
      {activeModule === 'academics' && (
        <>
          <PageHeader
            icon={Landmark}
            title="Academic Years & Structure"
            subtitle="Manage institutional academic sessions for both school and college structures."
            actions={
              can('academics', 'create') && (
                <button
                  type="button"
                  onClick={() => {
                    setEditYear(null);
                    setYName('');
                    setYStart('');
                    setYEnd('');
                    setYCurrent(academicYears.length === 0);
                    setYearModal(true);
                  }}
                  className="ec-btn-primary"
                >
                  <Plus className="w-4 h-4" /> Add Academic Year
                </button>
              )
            }
          />
          {renderTabs()}
          <DataTable
            rows={academicYears}
            loading={dataLoading}
            searchFilter={(r, q) => r.name.toLowerCase().includes(q)}
            emptyState={
              <EmptyState
                icon={Landmark}
                title="No academic years created yet"
                description="Create your first academic year (such as 2026-27) to isolate enrollments, attendance, exams, and fees by session."
                actionLabel={can('academics', 'create') ? 'Create Academic Year' : undefined}
                onAction={() => setYearModal(true)}
              />
            }
            columns={[
              { key: 'name', header: 'Academic Year', sortValue: (r) => r.name, render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
              { key: 'start', header: 'Start Date', render: (r) => <span className="font-mono text-[13.5px] text-slate-700">{r.startDate}</span> },
              { key: 'end', header: 'End Date', render: (r) => <span className="font-mono text-[13.5px] text-slate-700">{r.endDate}</span> },
              { key: 'current', header: 'Session Status', render: (r) => <StatusBadge status={r.isCurrent ? 'current' : r.status} /> },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (r) => (
                  <div className="inline-flex items-center gap-1.5">
                    {can('academics', 'edit') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditYear(r);
                          setYName(r.name);
                          setYStart(r.startDate);
                          setYEnd(r.endDate);
                          setYCurrent(Boolean(r.isCurrent));
                          setYearModal(true);
                        }}
                        className="p-2 text-slate-500 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {can('academics', 'delete') && (
                      <button
                        type="button"
                        onClick={() => setConfirmDel({ subcollection: 'academic_years', id: r.id, label: r.name })}
                        className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-[8px] transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}

      {activeModule === 'departments' && (
        <>
          <PageHeader
            icon={Building2}
            title="Departments"
            subtitle="Academic and administrative departments configured for your institution."
            actions={
              can('departments', 'create') && (
                <button
                  type="button"
                  onClick={() => {
                    setEditDept(null);
                    setDName('');
                    setDCode('');
                    setDHodId('');
                    setDDesc('');
                    setDeptModal(true);
                  }}
                  className="ec-btn-primary"
                >
                  <Plus className="w-4 h-4" /> Add Department
                </button>
              )
            }
          />
          {renderTabs()}
          <DataTable
            rows={departments}
            loading={dataLoading}
            searchFilter={(r, q) => `${r.name} ${r.code} ${r.hodName || ''}`.toLowerCase().includes(q)}
            onExport={(rows) =>
              exportToCsv(
                'departments.csv',
                ['Code', 'Name', 'HOD', 'Status'],
                rows.map((r) => [r.code, r.name, r.hodName || '', r.status]),
              )
            }
            emptyState={
              <EmptyState
                icon={Building2}
                title="No departments created yet"
                description="Create departments and assign Heads of Department (HOD)."
                actionLabel={can('departments', 'create') ? 'Add Department' : undefined}
                onAction={() => setDeptModal(true)}
              />
            }
            columns={[
              { key: 'code', header: 'Code', sortValue: (r) => r.code, render: (r) => <span className="font-mono text-[13.5px] font-semibold text-slate-700">{r.code}</span> },
              { key: 'name', header: 'Department Name', sortValue: (r) => r.name, render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
              { key: 'hod', header: 'Head of Department', render: (r) => r.hodName || '—' },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (r) => (
                  <div className="inline-flex items-center gap-1.5">
                    {can('departments', 'edit') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditDept(r);
                          setDName(r.name);
                          setDCode(r.code);
                          setDHodId(r.hodEmployeeId || '');
                          setDDesc(r.description || '');
                          setDeptModal(true);
                        }}
                        className="p-2 text-slate-500 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {can('departments', 'delete') && (
                      <button
                        type="button"
                        onClick={() => setConfirmDel({ subcollection: 'departments', id: r.id, label: r.name })}
                        className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-[8px] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}

      {activeModule === 'programs' && (
        <>
          <PageHeader
            icon={Layers}
            title="Programs & Courses"
            subtitle="Configure degree programs, durations, semesters, and credit structures."
            actions={
              can('programs', 'create') && (
                <button
                  type="button"
                  onClick={() => {
                    setEditProg(null);
                    setPName('');
                    setPCode('');
                    setPDegree('');
                    setPDeptId('');
                    setPYears(3);
                    setPSems(6);
                    setPCredits('');
                    setProgModal(true);
                  }}
                  className="ec-btn-primary"
                >
                  <Plus className="w-4 h-4" /> Add Program
                </button>
              )
            }
          />
          {renderTabs()}
          <DataTable
            rows={programs}
            loading={dataLoading}
            searchFilter={(r, q) => `${r.name} ${r.code} ${r.degreeType || ''}`.toLowerCase().includes(q)}
            emptyState={
              <EmptyState
                icon={Layers}
                title="No programs configured yet"
                description="Add academic programs or degree tracks for your institution."
                actionLabel={can('programs', 'create') ? 'Add Program' : undefined}
                onAction={() => setProgModal(true)}
              />
            }
            columns={[
              { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-[13.5px] font-semibold text-slate-700">{r.code}</span> },
              { key: 'name', header: 'Program Name', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
              { key: 'degree', header: 'Degree / Type', render: (r) => r.degreeType || '—' },
              { key: 'dept', header: 'Department', render: (r) => departments.find((d) => d.id === r.departmentId)?.name || '—' },
              { key: 'dur', header: 'Duration / Semesters', render: (r) => `${r.durationYears || '—'} yrs · ${r.semesterCount || '—'} sems` },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (r) => (
                  <div className="inline-flex items-center gap-1.5">
                    {can('programs', 'edit') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditProg(r);
                          setPName(r.name);
                          setPCode(r.code);
                          setPDegree(r.degreeType || '');
                          setPDeptId(r.departmentId || '');
                          setPYears(r.durationYears || 3);
                          setPSems(r.semesterCount || 6);
                          setPCredits(r.creditStructure || '');
                          setProgModal(true);
                        }}
                        className="p-2 text-slate-500 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {can('programs', 'delete') && (
                      <button
                        type="button"
                        onClick={() => setConfirmDel({ subcollection: 'programs', id: r.id, label: r.name })}
                        className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-[8px] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}

      {activeModule === 'classes' && (
        <>
          <PageHeader
            icon={ClipboardList}
            title="Classes, Semesters & Sections"
            subtitle="Manage school classes, college semesters, sections, and batches."
            actions={
              can('classes', 'create') && (
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditCls(null);
                      setCName('');
                      setCCode('');
                      setCDeptId('');
                      setCProgId('');
                      setClsModal(true);
                    }}
                    className="ec-btn-primary"
                  >
                    <Plus className="w-4 h-4" /> Add Class
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditSec(null);
                      setSClassId(classes[0]?.id || '');
                      setSName('');
                      setSBatch('');
                      setSRoom('');
                      setSecModal(true);
                    }}
                    className="ec-btn-secondary"
                  >
                    <Plus className="w-4 h-4" /> Add Section
                  </button>
                </div>
              )
            }
          />
          {renderTabs()}
          <div className="space-y-7">
            <div>
              <h2 className="text-[18px] font-semibold text-slate-900 mb-3">
                Classes / Semesters ({classes.length})
              </h2>
              <DataTable
                rows={classes}
                loading={dataLoading}
                searchFilter={(r, q) => `${r.name} ${r.code || ''}`.toLowerCase().includes(q)}
                emptyState={
                  <EmptyState
                    icon={ClipboardList}
                    title="No classes or semesters created yet"
                    description="Create school classes or college semesters before adding sections and enrolling students."
                    actionLabel={can('classes', 'create') ? 'Add Class' : undefined}
                    onAction={() => setClsModal(true)}
                  />
                }
                columns={[
                  { key: 'name', header: 'Class / Semester', render: (r) => <span className="font-semibold text-slate-900">{r.name}</span> },
                  { key: 'level', header: 'Structure', render: (r) => (r.levelType === 'college_semester' ? 'College Semester' : 'School Class') },
                  { key: 'prog', header: 'Program', render: (r) => programs.find((p) => p.id === r.programId)?.name || '—' },
                  { key: 'secs', header: 'Sections', render: (r) => sections.filter((s) => s.classId === r.id).map((s) => s.name).join(', ') || 'None' },
                  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                  {
                    key: 'actions',
                    header: 'Actions',
                    align: 'right',
                    render: (r) => (
                      <div className="inline-flex items-center gap-1.5">
                        {can('classes', 'edit') && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditCls(r);
                              setCName(r.name);
                              setCCode(r.code || '');
                              setCDeptId(r.departmentId || '');
                              setCProgId(r.programId || '');
                              setCSem(r.semesterNumber || 1);
                              setCLevel(r.levelType || 'school_class');
                              setCCap(r.capacity || 40);
                              setClsModal(true);
                            }}
                            className="p-2 text-slate-500 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {can('classes', 'delete') && (
                          <button
                            type="button"
                            onClick={() => setConfirmDel({ subcollection: 'classes', id: r.id, label: r.name })}
                            className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-[8px] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </div>

            {sections.length > 0 && (
              <div>
                <h2 className="text-[18px] font-semibold text-slate-900 mb-3">
                  Sections &amp; Batches ({sections.length})
                </h2>
                <DataTable
                  rows={sections}
                  loading={dataLoading}
                  searchFilter={(r, q) => `${r.name} ${r.batchName || ''} ${r.roomNumber || ''}`.toLowerCase().includes(q)}
                  emptyState={<div />}
                  columns={[
                    { key: 'class', header: 'Class', render: (r) => classes.find((c) => c.id === r.classId)?.name || '—' },
                    { key: 'name', header: 'Section', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
                    { key: 'batch', header: 'Batch', render: (r) => r.batchName || '—' },
                    { key: 'room', header: 'Room', render: (r) => r.roomNumber || '—' },
                    { key: 'cap', header: 'Capacity', align: 'right', render: (r) => r.capacity || '—' },
                    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
                    {
                      key: 'actions',
                      header: 'Actions',
                      align: 'right',
                      render: (r) =>
                        can('classes', 'delete') && (
                          <button
                            type="button"
                            onClick={() => setConfirmDel({ subcollection: 'sections', id: r.id, label: r.name })}
                            className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-[8px] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ),
                    },
                  ]}
                />
              </div>
            )}
          </div>
        </>
      )}

      {activeModule === 'subjects' && (
        <>
          <PageHeader
            icon={BookOpen}
            title="Subjects & Curriculum"
            subtitle="Configure subjects, credit weights, maximum/passing marks, and faculty assignments."
            actions={
              can('subjects', 'create') && (
                <button
                  type="button"
                  onClick={() => {
                    setEditSub(null);
                    setSubCode('');
                    setSubName('');
                    setSubDeptId('');
                    setSubProgId('');
                    setSubClassId('');
                    setSubSecId('');
                    setSubFacId('');
                    setSubMax(100);
                    setSubPass(35);
                    setSubModal(true);
                  }}
                  className="ec-btn-primary"
                >
                  <Plus className="w-4 h-4" /> Add Subject
                </button>
              )
            }
          />
          {renderTabs()}
          <DataTable
            rows={subjects}
            loading={dataLoading}
            searchFilter={(r, q) => `${r.code} ${r.name} ${r.facultyName || ''}`.toLowerCase().includes(q)}
            onExport={(rows) =>
              exportToCsv(
                'subjects.csv',
                ['Code', 'Name', 'Class', 'Type', 'Max Marks', 'Passing Marks', 'Faculty'],
                rows.map((r) => [
                  r.code,
                  r.name,
                  classes.find((c) => c.id === r.classId)?.name || '',
                  r.subjectType || 'theory',
                  r.maxMarks,
                  r.passingMarks,
                  r.facultyName || '',
                ]),
              )
            }
            emptyState={
              <EmptyState
                icon={BookOpen}
                title="No subjects created yet"
                description="Add subjects and link them to classes, sections, and faculty members."
                actionLabel={can('subjects', 'create') ? 'Add Subject' : undefined}
                onAction={() => setSubModal(true)}
              />
            }
            columns={[
              { key: 'code', header: 'Code', sortValue: (r) => r.code, render: (r) => <span className="font-mono text-[13.5px] font-semibold text-slate-700">{r.code}</span> },
              { key: 'name', header: 'Subject Name', sortValue: (r) => r.name, render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
              { key: 'cls', header: 'Class / Sem', render: (r) => classes.find((c) => c.id === r.classId)?.name || 'All' },
              { key: 'type', header: 'Type', render: (r) => <span className="capitalize">{r.subjectType || 'theory'}</span> },
              { key: 'marks', header: 'Max / Pass', align: 'right', render: (r) => <span className="font-mono text-[13.5px]">{r.maxMarks} / {r.passingMarks}</span> },
              { key: 'fac', header: 'Assigned Faculty', render: (r) => r.facultyName || 'Unassigned' },
              { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
              {
                key: 'actions',
                header: 'Actions',
                align: 'right',
                render: (r) => (
                  <div className="inline-flex items-center gap-1.5">
                    {can('subjects', 'edit') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditSub(r);
                          setSubCode(r.code);
                          setSubName(r.name);
                          setSubDeptId(r.departmentId || '');
                          setSubProgId(r.programId || '');
                          setSubClassId(r.classId || '');
                          setSubSecId(r.sectionId || '');
                          setSubCredits(r.credits || 4);
                          setSubType(r.subjectType || 'theory');
                          setSubMax(r.maxMarks);
                          setSubPass(r.passingMarks);
                          setSubFacId(r.facultyId || '');
                          setSubModal(true);
                        }}
                        className="p-2 text-slate-500 hover:text-blue-800 hover:bg-slate-100 rounded-[8px] transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {can('subjects', 'delete') && (
                      <button
                        type="button"
                        onClick={() => setConfirmDel({ subcollection: 'subjects', id: r.id, label: r.name })}
                        className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-[8px] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </>
      )}

      {/* Modals */}
      <Modal open={yearModal} onClose={() => setYearModal(false)} title={editYear ? 'Edit Academic Year' : 'Create Academic Year'} size="md">
        <form onSubmit={saveYear} className="space-y-4">
          <FormField label="Academic Year Name" required>
            <input type="text" required value={yName} onChange={(e) => setYName(e.target.value)} placeholder="e.g. 2026-27" className="ec-input" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start Date" required>
              <input type="date" required value={yStart} onChange={(e) => setYStart(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="End Date" required>
              <input type="date" required value={yEnd} onChange={(e) => setYEnd(e.target.value)} className="ec-input" />
            </FormField>
          </div>
          <label className="flex items-center gap-2.5 text-[14.5px] text-slate-700 cursor-pointer">
            <input type="checkbox" checked={yCurrent} onChange={(e) => setYCurrent(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-blue-800 focus:ring-blue-700" />
            <span>Set as current active academic year</span>
          </label>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setYearModal(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={deptModal} onClose={() => setDeptModal(false)} title={editDept ? 'Edit Department' : 'Add Department'} size="md">
        <form onSubmit={saveDept} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Department Name" required>
              <input type="text" required value={dName} onChange={(e) => setDName(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Code" required>
              <input type="text" required value={dCode} onChange={(e) => setDCode(e.target.value)} className="ec-input" />
            </FormField>
          </div>
          <SearchableSelect
            label="Head of Department (HOD)"
            value={dHodId}
            onChange={setDHodId}
            options={facultyList.map((f) => ({ value: f.id, label: `${f.firstName} ${f.lastName}`, meta: f.employeeCode }))}
            placeholder="Optional HOD assignment"
          />
          <FormField label="Description">
            <textarea rows={3} value={dDesc} onChange={(e) => setDDesc(e.target.value)} className="ec-textarea" />
          </FormField>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setDeptModal(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={progModal} onClose={() => setProgModal(false)} title={editProg ? 'Edit Program' : 'Add Program'} size="md">
        <form onSubmit={saveProgram} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Program Name" required>
              <input type="text" required value={pName} onChange={(e) => setPName(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Code" required>
              <input type="text" required value={pCode} onChange={(e) => setPCode(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Degree / Track Type">
              <input type="text" value={pDegree} onChange={(e) => setPDegree(e.target.value)} placeholder="Undergraduate / High School" className="ec-input" />
            </FormField>
            <FormField label="Department">
              <select value={pDeptId} onChange={(e) => setPDeptId(e.target.value)} className="ec-select">
                <option value="">None</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormField>
            <FormField label="Duration (Years)">
              <input type="number" min={1} max={10} value={pYears} onChange={(e) => setPYears(Number(e.target.value))} className="ec-input" />
            </FormField>
            <FormField label="Semesters / Terms">
              <input type="number" min={1} max={20} value={pSems} onChange={(e) => setPSems(Number(e.target.value))} className="ec-input" />
            </FormField>
          </div>
          <FormField label="Credit Structure">
            <input type="text" value={pCredits} onChange={(e) => setPCredits(e.target.value)} placeholder="e.g. 120 Total Credits" className="ec-input" />
          </FormField>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setProgModal(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={clsModal} onClose={() => setClsModal(false)} title={editCls ? 'Edit Class / Semester' : 'Add Class / Semester'} size="md">
        <form onSubmit={saveClass} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Class / Semester Name" required>
              <input type="text" required value={cName} onChange={(e) => setCName(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Code">
              <input type="text" value={cCode} onChange={(e) => setCCode(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Structure Type">
              <select value={cLevel} onChange={(e) => setCLevel(e.target.value as any)} className="ec-select">
                <option value="school_class">School Class</option>
                <option value="college_semester">College Semester</option>
              </select>
            </FormField>
            <FormField label="Capacity">
              <input type="number" min={1} value={cCap} onChange={(e) => setCCap(Number(e.target.value))} className="ec-input" />
            </FormField>
            <FormField label="Department">
              <select value={cDeptId} onChange={(e) => setCDeptId(e.target.value)} className="ec-select">
                <option value="">None</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormField>
            <FormField label="Program">
              <select value={cProgId} onChange={(e) => setCProgId(e.target.value)} className="ec-select">
                <option value="">None</option>
                {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setClsModal(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={secModal} onClose={() => setSecModal(false)} title="Add Section / Batch" size="md">
        <form onSubmit={saveSection} className="space-y-4">
          <FormField label="Parent Class / Semester" required>
            <select required value={sClassId} onChange={(e) => setSClassId(e.target.value)} className="ec-select">
              <option value="">Select Class...</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Section Name" required>
              <input type="text" required value={sName} onChange={(e) => setSName(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Batch Name">
              <input type="text" value={sBatch} onChange={(e) => setSBatch(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Room Number">
              <input type="text" value={sRoom} onChange={(e) => setSRoom(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Capacity">
              <input type="number" min={1} value={sCap} onChange={(e) => setSCap(Number(e.target.value))} className="ec-input" />
            </FormField>
          </div>
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setSecModal(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={subModal} onClose={() => setSubModal(false)} title={editSub ? 'Edit Subject' : 'Add Subject'} size="lg">
        <form onSubmit={saveSubject} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Subject Code" required>
              <input type="text" required value={subCode} onChange={(e) => setSubCode(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Subject Name" required>
              <input type="text" required value={subName} onChange={(e) => setSubName(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Department">
              <select value={subDeptId} onChange={(e) => setSubDeptId(e.target.value)} className="ec-select">
                <option value="">None</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </FormField>
            <FormField label="Class / Semester">
              <select value={subClassId} onChange={(e) => setSubClassId(e.target.value)} className="ec-select">
                <option value="">All / Unassigned</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Type">
              <select value={subType} onChange={(e) => setSubType(e.target.value as any)} className="ec-select">
                <option value="theory">Theory</option>
                <option value="practical">Practical</option>
                <option value="both">Theory + Practical</option>
              </select>
            </FormField>
            <FormField label="Credits">
              <input type="number" min={0} max={20} value={subCredits} onChange={(e) => setSubCredits(Number(e.target.value))} className="ec-input" />
            </FormField>
            <FormField label="Max Marks" required>
              <input type="number" required min={1} max={1000} value={subMax} onChange={(e) => setSubMax(Number(e.target.value))} className="ec-input" />
            </FormField>
            <FormField label="Passing Marks" required>
              <input type="number" required min={0} max={subMax} value={subPass} onChange={(e) => setSubPass(Number(e.target.value))} className="ec-input" />
            </FormField>
          </div>
          <SearchableSelect
            label="Assign Faculty"
            value={subFacId}
            onChange={setSubFacId}
            options={facultyList.map((f) => ({ value: f.id, label: `${f.firstName} ${f.lastName}`, meta: f.employeeCode }))}
            placeholder="Select teacher/faculty..."
          />
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button type="button" onClick={() => setSubModal(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Save Subject</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDel)}
        onClose={() => setConfirmDel(null)}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        description={`Are you sure you want to delete "${confirmDel?.label}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={saving}
      />
    </div>
  );
}
