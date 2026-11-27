import React, { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Download, FileText, Pencil, Plus, Printer, Trash2, Upload } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  createNotificationForUser,
  deleteInstDoc,
  saveInstDoc,
  subscribeInstCollection,
  where,
  writeAuditLog,
} from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import {
  computeGradeFromScale,
  fileToConstrainedDataUrl,
  formatDate,
  generateId,
  nowIso,
  todayDateStr,
} from '../utils/format';
import { exportToCsv } from '../utils/csv';
import {
  ConfirmDialog,
  EmptyState,
  FormField,
  FormSection,
  Modal,
  PageHeader,
  SectionCard,
  StatusBadge,
} from '../components/ui/Primitives';
import type {
  Assignment,
  AssignmentSubmission,
  ExamMark,
  ExamSubjectSchedule,
  Examination,
  MarkChangeHistory,
} from '../types';

export function ExamsResultsAssignmentsModule() {
  const {
    institution,
    member,
    userAccount,
    activeYearId,
    activeModule,
    can,
    pushToast,
    classes,
    programs,
    subjects,
    students,
    employees,
    examinations,
    assignments,
  } = useApp();

  const isResults = activeModule === 'results';
  const isAssignments = activeModule === 'assignments';
  const isStaffTeacher = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod', 'teacher'].includes(
    member?.role || '',
  );
  const isAcademicMgr = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod'].includes(member?.role || '');

  const canCreate = can(activeModule, 'create');
  const canEdit = can(activeModule, 'edit');
  const canDelete = can(activeModule, 'delete');
  const canExport = can(activeModule, 'export');

  // Marks & Submissions subscriptions scoped by role
  const [marks, setMarks] = useState<ExamMark[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);

  useEffect(() => {
    if (!institution?.id || !userAccount || !member) {
      setMarks([]);
      setSubmissions([]);
      return;
    }
    const instId = institution.id;
    const unsubs: (() => void)[] = [];

    if (isStaffTeacher) {
      unsubs.push(subscribeInstCollection<ExamMark>(instId, 'marks', [], setMarks));
      unsubs.push(subscribeInstCollection<AssignmentSubmission>(instId, 'assignment_submissions', [], setSubmissions));
    } else if (member.role === 'student') {
      unsubs.push(
        subscribeInstCollection<ExamMark>(
          instId,
          'marks',
          [where('isPublished', '==', true), where('studentUserUid', '==', userAccount.uid)],
          setMarks,
        ),
      );
      unsubs.push(
        subscribeInstCollection<AssignmentSubmission>(
          instId,
          'assignment_submissions',
          [where('studentUid', '==', userAccount.uid)],
          setSubmissions,
        ),
      );
    } else if (member.role === 'parent') {
      unsubs.push(
        subscribeInstCollection<ExamMark>(
          instId,
          'marks',
          [where('isPublished', '==', true), where('parentUserUid', '==', userAccount.uid)],
          setMarks,
        ),
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [institution?.id, userAccount?.uid, member?.role, isStaffTeacher]);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const facultyList = useMemo(() => employees.filter((e) => e.staffType === 'faculty'), [employees]);

  // Exam modal state
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Examination | null>(null);
  const [examForm, setExamForm] = useState<Partial<Examination>>({
    examType: 'mid_term',
    status: 'scheduled',
    enableRanking: false,
    subjects: [],
  });
  const [saving, setSaving] = useState(false);
  const [deleteExam, setDeleteExam] = useState<Examination | null>(null);

  // Marks entry state
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [markDrafts, setMarkDrafts] = useState<Record<string, { marks: string; absent: boolean; remarks: string }>>({});
  const [savingMarks, setSavingMarks] = useState(false);

  // Result view state
  const [resultExamId, setResultExamId] = useState('');
  const [marksheetStudentId, setMarksheetStudentId] = useState<string | null>(null);

  // Assignment modal & submission modal
  const [asgnModalOpen, setAsgnModalOpen] = useState(false);
  const [asgnForm, setAsgnForm] = useState<Partial<Assignment>>({ dueDate: todayDateStr(), maxMarks: 100, status: 'active' });
  const [submitModalAsgn, setSubmitModalAsgn] = useState<Assignment | null>(null);
  const [subNotes, setSubNotes] = useState('');
  const [subFileName, setSubFileName] = useState('');
  const [subFileUrl, setSubFileUrl] = useState('');
  const [gradingAsgn, setGradingAsgn] = useState<Assignment | null>(null);
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { marks: string; feedback: string }>>({});

  // ===================== EXAMINATIONS HANDLERS =====================
  const openAddExam = () => {
    setEditingExam(null);
    setExamForm({
      academicYearId: activeYearId || '',
      examType: 'mid_term',
      status: 'scheduled',
      enableRanking: true,
      subjects: [],
    });
    setExamModalOpen(true);
  };

  const addSubjectRowToExam = () => {
    const firstSub = subjects[0];
    const row: ExamSubjectSchedule = {
      subjectId: firstSub?.id || '',
      subjectName: firstSub?.name || '',
      examDate: todayDateStr(),
      startTime: '09:00',
      endTime: '12:00',
      room: '',
      maxMarks: firstSub?.maxMarks || 100,
      passingMarks: firstSub?.passingMarks || 35,
    };
    setExamForm((p) => ({ ...p, subjects: [...(p.subjects || []), row] }));
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !examForm.name?.trim()) return;
    setSaving(true);
    try {
      const ts = nowIso();
      const id = editingExam?.id || generateId('exam');
      const payload: Omit<Examination, 'id'> = {
        institutionId: institution.id,
        academicYearId: examForm.academicYearId || activeYearId || undefined,
        name: examForm.name.trim(),
        examType: examForm.examType || 'mid_term',
        classId: examForm.classId || undefined,
        programId: examForm.programId || undefined,
        semesterNumber: examForm.semesterNumber ? Number(examForm.semesterNumber) : undefined,
        startDate: examForm.startDate || undefined,
        endDate: examForm.endDate || undefined,
        enableRanking: Boolean(examForm.enableRanking),
        status: examForm.status || 'scheduled',
        subjects: examForm.subjects || [],
        createdAt: editingExam?.createdAt || ts,
        updatedAt: ts,
      };
      await saveInstDoc(institution.id, 'examinations', id, payload, !editingExam);
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: editingExam ? 'update' : 'create',
        module: 'examinations',
        recordId: id,
        summary: `${editingExam ? 'Updated' : 'Created'} examination "${payload.name}"`,
      });
      pushToast('success', 'Examination saved.');
      setExamModalOpen(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to save examination.'));
    } finally {
      setSaving(false);
    }
  };

  // ===================== MARKS ENTRY & PUBLISH =====================
  const activeExam = examinations.find((ex) => ex.id === selectedExamId);
  const activeExamSubject = activeExam?.subjects?.find((s) => s.subjectId === selectedSubjectId) || subjectMap.get(selectedSubjectId);
  const activeMaxMarks =
    (activeExamSubject && 'maxMarks' in activeExamSubject ? activeExamSubject.maxMarks : undefined) || 100;
  const activePassMarks =
    (activeExamSubject && 'passingMarks' in activeExamSubject ? activeExamSubject.passingMarks : undefined) || 35;

  const eligibleStudentsForMarks = useMemo(() => {
    if (!activeExam) return [];
    return students.filter((s) => s.status === 'active' && (!activeExam.classId || s.classId === activeExam.classId));
  }, [activeExam, students]);

  const handleSaveMarks = async () => {
    if (!institution || !userAccount || !member || !activeExam || !selectedSubjectId) return;
    setSavingMarks(true);
    try {
      const ts = nowIso();
      for (const stu of eligibleStudentsForMarks) {
        const existing = marks.find(
          (m) => m.examId === activeExam.id && m.subjectId === selectedSubjectId && m.studentId === stu.id,
        );
        const draft = markDrafts[stu.id];
        const isAbsent = draft ? draft.absent : existing?.isAbsent ?? false;
        const rawMarks = draft ? Number(draft.marks || 0) : existing?.marksObtained ?? 0;
        const marksVal = isAbsent ? 0 : rawMarks;

        if (!isAbsent && (Number.isNaN(marksVal) || marksVal < 0 || marksVal > activeMaxMarks)) {
          pushToast('error', `Invalid marks for ${stu.firstName} ${stu.lastName}. Must be 0 to ${activeMaxMarks}.`);
          setSavingMarks(false);
          return;
        }

        const pct = activeMaxMarks > 0 ? (marksVal / activeMaxMarks) * 100 : 0;
        const gradeRes = isAbsent ? { grade: 'AB' } : computeGradeFromScale(pct, institution.gradingScale);
        const docId = existing?.id || `mark_${activeExam.id}_${selectedSubjectId}_${stu.id}`;
        const history: MarkChangeHistory[] = existing?.history ? [...existing.history] : [];
        if (existing && (existing.marksObtained !== marksVal || existing.isAbsent !== isAbsent)) {
          history.push({
            marksObtained: existing.marksObtained,
            isAbsent: existing.isAbsent,
            changedByUid: userAccount.uid,
            changedByName: userAccount.displayName,
            changedAt: ts,
          });
        }

        const payload: Omit<ExamMark, 'id'> = {
          institutionId: institution.id,
          examId: activeExam.id,
          academicYearId: activeExam.academicYearId,
          classId: stu.classId,
          sectionId: stu.sectionId,
          subjectId: selectedSubjectId,
          studentId: stu.id,
          studentName: `${stu.firstName} ${stu.lastName}`,
          studentUserUid: stu.userUid || undefined,
          parentUserUid: stu.parentUid || undefined,
          rollNumber: stu.rollNumber || undefined,
          maxMarks: activeMaxMarks,
          passingMarks: activePassMarks,
          marksObtained: marksVal,
          isAbsent,
          grade: gradeRes.grade,
          remarks: draft?.remarks ?? existing?.remarks ?? undefined,
          enteredByUid: userAccount.uid,
          enteredByName: userAccount.displayName,
          history: history.slice(-25),
          isPublished: existing?.isPublished ?? activeExam.status === 'published',
          createdAt: existing?.createdAt || ts,
          updatedAt: ts,
        };
        await saveInstDoc(institution.id, 'marks', docId, payload, !existing);
      }

      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member.role,
        action: 'save_marks',
        module: 'results',
        recordId: activeExam.id,
        summary: `Entered/updated marks for ${activeExam.name}`,
      });
      pushToast('success', 'Marks saved and graded.');
      setMarkDrafts({});
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to save marks.'));
    } finally {
      setSavingMarks(false);
    }
  };

  const handleTogglePublishExamResults = async (exam: Examination, publish: boolean) => {
    if (!institution || !userAccount) return;
    try {
      const ts = nowIso();
      await saveInstDoc(
        institution.id,
        'examinations',
        exam.id,
        { ...exam, status: publish ? 'published' : 'completed', updatedAt: ts },
        false,
      );
      const examMarks = marks.filter((m) => m.examId === exam.id);
      await Promise.all(
        examMarks.map((m) =>
          saveInstDoc(institution.id, 'marks', m.id, { ...m, isPublished: publish, updatedAt: ts }, false),
        ),
      );
      if (publish) {
        const notifiedUids = new Set<string>();
        for (const m of examMarks) {
          if (m.studentUserUid && !notifiedUids.has(m.studentUserUid)) {
            notifiedUids.add(m.studentUserUid);
            await createNotificationForUser(institution.id, {
              recipientUid: m.studentUserUid,
              type: 'result',
              title: `Results Published: ${exam.name}`,
              message: `Examination results for ${exam.name} are now available.`,
              linkModule: 'results',
            });
          }
        }
      }
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: publish ? 'publish_results' : 'unpublish_results',
        module: 'results',
        recordId: exam.id,
        summary: `${publish ? 'Published' : 'Unpublished'} results for ${exam.name}`,
      });
      pushToast('success', publish ? 'Results published to students & parents.' : 'Results unpublished.');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to update publish status.'));
    }
  };

  // ===================== ASSIGNMENTS HANDLERS =====================
  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !asgnForm.title?.trim() || !asgnForm.classId || !asgnForm.subjectId) {
      pushToast('error', 'Title, class, and subject are required.');
      return;
    }
    setSaving(true);
    try {
      const ts = nowIso();
      const id = generateId('asgn');
      const sub = subjectMap.get(asgnForm.subjectId);
      const payload: Omit<Assignment, 'id'> = {
        institutionId: institution.id,
        academicYearId: activeYearId || undefined,
        title: asgnForm.title.trim(),
        description: asgnForm.description?.trim() || undefined,
        classId: asgnForm.classId,
        sectionId: asgnForm.sectionId || undefined,
        subjectId: asgnForm.subjectId,
        subjectName: sub?.name,
        facultyUid: userAccount.uid,
        facultyName: userAccount.displayName,
        dueDate: asgnForm.dueDate || todayDateStr(),
        maxMarks: asgnForm.maxMarks ? Number(asgnForm.maxMarks) : 100,
        attachmentName: asgnForm.attachmentName || undefined,
        attachmentDataUrl: asgnForm.attachmentDataUrl || undefined,
        status: 'active',
        createdAt: ts,
        updatedAt: ts,
      };
      await saveInstDoc(institution.id, 'assignments', id, payload, true);
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: 'create',
        module: 'assignments',
        recordId: id,
        summary: `Created assignment "${payload.title}"`,
      });
      pushToast('success', 'Assignment published.');
      setAsgnModalOpen(false);
      setAsgnForm({ dueDate: todayDateStr(), maxMarks: 100, status: 'active' });
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to create assignment.'));
    } finally {
      setSaving(false);
    }
  };

  const handleStudentSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !submitModalAsgn) return;
    const stu = students.find((s) => s.userUid === userAccount.uid) || students[0];
    if (!stu) {
      pushToast('error', 'Your account is not linked to a student profile yet.');
      return;
    }
    setSaving(true);
    try {
      const ts = nowIso();
      const existing = submissions.find((s) => s.assignmentId === submitModalAsgn.id && s.studentUid === userAccount.uid);
      const id = existing?.id || generateId('subm');
      const payload: Omit<AssignmentSubmission, 'id'> = {
        institutionId: institution.id,
        assignmentId: submitModalAsgn.id,
        studentId: stu.id,
        studentName: `${stu.firstName} ${stu.lastName}`,
        studentUid: userAccount.uid,
        notes: subNotes.trim() || undefined,
        attachmentName: subFileName || existing?.attachmentName || undefined,
        attachmentDataUrl: subFileUrl || existing?.attachmentDataUrl || undefined,
        submittedAt: ts,
        status: todayDateStr() > submitModalAsgn.dueDate ? 'late' : 'submitted',
        updatedAt: ts,
      };
      await saveInstDoc(institution.id, 'assignment_submissions', id, payload, !existing);
      pushToast('success', 'Assignment submitted.');
      setSubmitModalAsgn(null);
      setSubNotes('');
      setSubFileName('');
      setSubFileUrl('');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to submit assignment.'));
    } finally {
      setSaving(false);
    }
  };

  const handleGradeSubmission = async (subm: AssignmentSubmission) => {
    if (!institution || !userAccount) return;
    const draft = gradeDrafts[subm.id];
    const marksVal = Number(draft?.marks ?? subm.marksAwarded ?? 0);
    try {
      await saveInstDoc(
        institution.id,
        'assignment_submissions',
        subm.id,
        {
          ...subm,
          marksAwarded: marksVal,
          feedback: draft?.feedback ?? subm.feedback ?? undefined,
          status: 'graded',
          gradedByUid: userAccount.uid,
          updatedAt: nowIso(),
        },
        false,
      );
      pushToast('success', `Graded submission for ${subm.studentName}.`);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to grade submission.'));
    }
  };

  // ===================== VIEW: ASSIGNMENTS =====================
  if (isAssignments) {
    const visibleAssignments =
      isStaffTeacher
        ? assignments
        : assignments.filter((a) => students.some((s) => s.classId === a.classId));

    return (
      <div className="space-y-6">
        <PageHeader
          icon={FileText}
          title="Homework & Assignments"
          subtitle="Create class assignments, upload study prompts, collect student submissions, and grade work."
          actions={
            canCreate &&
            isStaffTeacher && (
              <button
                type="button"
                onClick={() => setAsgnModalOpen(true)}
                className="ec-btn-primary"
              >
                <Plus className="w-4 h-4" />
                New Assignment
              </button>
            )
          }
        />

        {visibleAssignments.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No assignments posted yet"
            description="Teachers can create assignments for any class and subject with due dates and attachments."
            actionLabel={canCreate && isStaffTeacher ? 'New Assignment' : undefined}
            onAction={canCreate && isStaffTeacher ? () => setAsgnModalOpen(true) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {visibleAssignments.map((a) => {
              const mySub = submissions.find((s) => s.assignmentId === a.id && s.studentUid === userAccount?.uid);
              const totalSubs = submissions.filter((s) => s.assignmentId === a.id).length;
              return (
                <div key={a.id} className="ec-card border-t-2 border-t-indigo-600 p-5 sm:p-6 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[17px] font-semibold text-slate-900">{a.title}</h3>
                        <div className="text-[13.5px] text-slate-500 mt-1">
                          {classMap.get(a.classId) || a.classId} · {a.subjectName || subjectMap.get(a.subjectId)?.name}
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    {a.description && <p className="text-[14.5px] text-slate-600 mt-3 leading-relaxed">{a.description}</p>}
                    <div className="text-[13.5px] text-slate-500 mt-3.5 flex flex-wrap gap-4">
                      <span>Due: <strong className="font-medium text-slate-700">{formatDate(a.dueDate)}</strong></span>
                      <span>Max Marks: <strong className="font-medium text-slate-700 tabular-nums">{a.maxMarks ?? 100}</strong></span>
                      <span>By: <strong className="font-medium text-slate-700">{a.facultyName || 'Faculty'}</strong></span>
                    </div>
                    {a.attachmentDataUrl && (
                      <a
                        href={a.attachmentDataUrl}
                        download={a.attachmentName || 'assignment'}
                        className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-blue-800 hover:underline mt-3"
                      >
                        <Download className="w-4 h-4" />
                        {a.attachmentName || 'Download Attachment'}
                      </a>
                    )}
                  </div>

                  <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
                    {isStaffTeacher ? (
                      <>
                        <span className="text-[13.5px] text-slate-600 font-medium">{totalSubs} submissions received</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setGradingAsgn(a)}
                            className="px-3.5 py-1.5 text-[13.5px] font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-[8px] hover:bg-blue-100 transition-colors"
                          >
                            Review & Grade
                          </button>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => deleteInstDoc(institution!.id, 'assignments', a.id)}
                              className="p-2 text-slate-400 hover:text-red-700 rounded-[8px] hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {mySub ? (
                          <div className="flex items-center gap-2 text-[13.5px]">
                            <StatusBadge status={mySub.status} />
                            {mySub.marksAwarded !== undefined && (
                              <span className="font-mono font-semibold text-slate-900">
                                Score: {mySub.marksAwarded} / {a.maxMarks ?? 100}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[13.5px] text-slate-500">Not submitted yet</span>
                        )}
                        {member?.role === 'student' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSubmitModalAsgn(a);
                              setSubNotes(mySub?.notes || '');
                            }}
                            className="ec-btn-primary !py-1.5 !px-3.5 !text-[13.5px]"
                          >
                            {mySub ? 'Update Submission' : 'Submit Work'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create Assignment Modal */}
        <Modal open={asgnModalOpen} onClose={() => setAsgnModalOpen(false)} title="Create Assignment" size="md">
          <form onSubmit={handleSaveAssignment} className="space-y-4">
            <FormField label="Title" required>
              <input
                required
                value={asgnForm.title || ''}
                onChange={(e) => setAsgnForm((p) => ({ ...p, title: e.target.value }))}
                className="ec-input"
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Class" required>
                <select
                  required
                  value={asgnForm.classId || ''}
                  onChange={(e) => setAsgnForm((p) => ({ ...p, classId: e.target.value }))}
                  className="ec-select"
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Subject" required>
                <select
                  required
                  value={asgnForm.subjectId || ''}
                  onChange={(e) => setAsgnForm((p) => ({ ...p, subjectId: e.target.value }))}
                  className="ec-select"
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Due Date" required>
                <input
                  type="date"
                  required
                  value={asgnForm.dueDate || todayDateStr()}
                  onChange={(e) => setAsgnForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Max Marks">
                <input
                  type="number"
                  min={1}
                  value={asgnForm.maxMarks ?? 100}
                  onChange={(e) => setAsgnForm((p) => ({ ...p, maxMarks: Number(e.target.value) }))}
                  className="ec-input"
                />
              </FormField>
            </div>
            <FormField label="Instructions">
              <textarea
                rows={3}
                value={asgnForm.description || ''}
                onChange={(e) => setAsgnForm((p) => ({ ...p, description: e.target.value }))}
                className="ec-textarea"
              />
            </FormField>
            <FormField label="Attachment (max 300 KB)">
              <input
                type="file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await fileToConstrainedDataUrl(f, 300 * 1024);
                    setAsgnForm((p) => ({ ...p, attachmentName: f.name, attachmentDataUrl: url }));
                  } catch (err) {
                    pushToast('error', formatUserFriendlyError(err, 'Attachment too large.'));
                  }
                }}
                className="w-full text-[13.5px] text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-[8px] file:border file:border-slate-300 file:text-[13px] file:font-medium file:bg-white file:text-slate-700 hover:file:bg-slate-50"
              />
            </FormField>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setAsgnModalOpen(false)} className="ec-btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="ec-btn-primary">
                {saving ? 'Saving...' : 'Publish Assignment'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Student Submit Work Modal */}
        <Modal
          open={Boolean(submitModalAsgn)}
          onClose={() => setSubmitModalAsgn(null)}
          title={`Submit: ${submitModalAsgn?.title || ''}`}
          size="md"
        >
          <form onSubmit={handleStudentSubmitAssignment} className="space-y-4">
            <FormField label="Submission Notes / Answer" required>
              <textarea
                rows={4}
                required
                value={subNotes}
                onChange={(e) => setSubNotes(e.target.value)}
                className="ec-textarea"
              />
            </FormField>
            <FormField label="Upload File (max 300 KB)">
              <input
                type="file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await fileToConstrainedDataUrl(f, 300 * 1024);
                    setSubFileName(f.name);
                    setSubFileUrl(url);
                  } catch (err) {
                    pushToast('error', formatUserFriendlyError(err, 'File too large.'));
                  }
                }}
                className="w-full text-[13.5px] text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-[8px] file:border file:border-slate-300 file:text-[13px] file:font-medium file:bg-white file:text-slate-700 hover:file:bg-slate-50"
              />
            </FormField>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setSubmitModalAsgn(null)} className="ec-btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="ec-btn-primary">
                <Upload className="w-4 h-4" />
                Submit
              </button>
            </div>
          </form>
        </Modal>

        {/* Teacher Grade Submissions Modal */}
        <Modal
          open={Boolean(gradingAsgn)}
          onClose={() => setGradingAsgn(null)}
          title={`Submissions: ${gradingAsgn?.title || ''}`}
          size="xl"
        >
          {gradingAsgn && (
            <div className="space-y-4">
              {submissions.filter((s) => s.assignmentId === gradingAsgn.id).length === 0 ? (
                <p className="text-[14.5px] text-slate-500 py-4">No student submissions received yet.</p>
              ) : (
                submissions
                  .filter((s) => s.assignmentId === gradingAsgn.id)
                  .map((subm) => (
                    <div key={subm.id} className="p-4 border border-slate-200 rounded-[10px] space-y-3 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-[15px] text-slate-900">{subm.studentName || subm.studentId}</div>
                          <div className="text-[13px] text-slate-500 mt-0.5">Submitted: {formatDate(subm.submittedAt)}</div>
                        </div>
                        <StatusBadge status={subm.status} />
                      </div>
                      {subm.notes && <div className="text-[14px] text-slate-700 bg-slate-50 p-3 rounded-[8px] border border-slate-100">{subm.notes}</div>}
                      {subm.attachmentDataUrl && (
                        <a href={subm.attachmentDataUrl} download={subm.attachmentName || 'submission'} className="text-[13.5px] font-semibold text-blue-800 hover:underline inline-flex items-center gap-1.5">
                          <Download className="w-4 h-4" />
                          Download: {subm.attachmentName}
                        </a>
                      )}
                      <div className="flex flex-wrap items-center gap-2.5 pt-2">
                        <input
                          type="number"
                          min={0}
                          max={gradingAsgn.maxMarks ?? 100}
                          placeholder="Marks"
                          value={gradeDrafts[subm.id]?.marks ?? (subm.marksAwarded !== undefined ? String(subm.marksAwarded) : '')}
                          onChange={(e) =>
                            setGradeDrafts((p) => ({
                              ...p,
                              [subm.id]: { marks: e.target.value, feedback: p[subm.id]?.feedback ?? subm.feedback ?? '' },
                            }))
                          }
                          className="w-28 px-3 py-2 text-[14px] border border-slate-300 rounded-[8px] font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Feedback..."
                          value={gradeDrafts[subm.id]?.feedback ?? subm.feedback ?? ''}
                          onChange={(e) =>
                            setGradeDrafts((p) => ({
                              ...p,
                              [subm.id]: { marks: p[subm.id]?.marks ?? String(subm.marksAwarded ?? ''), feedback: e.target.value },
                            }))
                          }
                          className="flex-1 min-w-[180px] px-3 py-2 text-[14px] border border-slate-300 rounded-[8px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleGradeSubmission(subm)}
                          className="ec-btn-primary !py-2 !px-3.5"
                        >
                          Save Grade
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // ===================== VIEW: RESULTS & MARKSHEETS =====================
  if (isResults) {
    const activeResExamId = resultExamId || examinations[0]?.id || '';
    const activeResExam = examinations.find((e) => e.id === activeResExamId);
    const examMarks = marks.filter((m) => m.examId === activeResExamId);

    // Group marks by student
    const studentSummaries = useMemo(() => {
      const byStu = new Map<string, ExamMark[]>();
      examMarks.forEach((m) => {
        const list = byStu.get(m.studentId) || [];
        list.push(m);
        byStu.set(m.studentId, list);
      });
      const rows = Array.from(byStu.entries()).map(([stuId, stuMarks]) => {
        const totalObtained = stuMarks.reduce((sum, m) => sum + (m.isAbsent ? 0 : m.marksObtained), 0);
        const totalMax = stuMarks.reduce((sum, m) => sum + m.maxMarks, 0);
        const pct = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
        const failedAny = stuMarks.some(
          (m) => m.isAbsent || m.marksObtained < (m.passingMarks ?? 0),
        );
        const gradeInfo = computeGradeFromScale(pct, institution?.gradingScale);
        const stu = students.find((s) => s.id === stuId);
        return {
          studentId: stuId,
          studentName: stu ? `${stu.firstName} ${stu.lastName}` : stuMarks[0]?.studentName || stuId,
          rollNumber: stu?.rollNumber || stuMarks[0]?.rollNumber || '—',
          className: classMap.get(stu?.classId || stuMarks[0]?.classId || '') || '—',
          marks: stuMarks,
          totalObtained,
          totalMax,
          percentage: pct,
          grade: gradeInfo.grade,
          gpa: gradeInfo.gpa,
          resultStatus: failedAny ? 'fail' : 'pass',
          rank: 0,
        };
      });

      if (activeResExam?.enableRanking) {
        const sorted = [...rows].sort((a, b) => b.totalObtained - a.totalObtained);
        sorted.forEach((r, idx) => {
          r.rank = idx + 1;
        });
      }
      return rows;
    }, [examMarks, students, classMap, institution?.gradingScale, activeResExam?.enableRanking]);

    const marksheetRow = studentSummaries.find((r) => r.studentId === marksheetStudentId);

    return (
      <div className="space-y-6">
        <PageHeader
          icon={Award}
          title="Results & Marksheets"
          subtitle="Enter subject marks, publish official results, compute GPA/grades, and print marksheets."
          actions={
            <>
              {canExport && studentSummaries.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    exportToCsv(
                      `results_${activeResExam?.name || 'exam'}`,
                      ['Student', 'Roll No', 'Class', 'Obtained', 'Max Marks', 'Percentage', 'Grade', 'Result'],
                      studentSummaries.map((r) => [
                        r.studentName,
                        r.rollNumber,
                        r.className,
                        r.totalObtained,
                        r.totalMax,
                        `${r.percentage}%`,
                        r.grade,
                        r.resultStatus.toUpperCase(),
                      ]),
                    )
                  }
                  className="ec-btn-secondary"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
              {isAcademicMgr && activeResExam && (
                <button
                  type="button"
                  onClick={() => handleTogglePublishExamResults(activeResExam, activeResExam.status !== 'published')}
                  className={
                    activeResExam.status === 'published'
                      ? 'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[14px] font-medium text-white bg-amber-700 rounded-[10px] hover:bg-amber-800 transition-colors'
                      : 'ec-btn-success'
                  }
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {activeResExam.status === 'published' ? 'Unpublish Results' : 'Publish Results'}
                </button>
              )}
            </>
          }
        />

        {/* Marks Entry Workbench for Teachers/Admins */}
        {isStaffTeacher && canEdit && examinations.length > 0 && (
          <SectionCard variant="tinted-header" icon={Pencil} title="Marks Entry Workbench" className="no-print">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <FormField label="Select Examination">
                <select
                  value={selectedExamId}
                  onChange={(e) => {
                    setSelectedExamId(e.target.value);
                    setMarkDrafts({});
                  }}
                  className="ec-select"
                >
                  <option value="">Choose Exam...</option>
                  {examinations.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name} ({ex.status})
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Select Subject">
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setMarkDrafts({});
                  }}
                  className="ec-select"
                >
                  <option value="">Choose Subject...</option>
                  {(activeExam?.subjects && activeExam.subjects.length > 0
                    ? activeExam.subjects.map((s) => ({ id: s.subjectId, name: s.subjectName }))
                    : subjects.map((s) => ({ id: s.id, name: `${s.code} · ${s.name}` }))
                  ).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {selectedExamId && selectedSubjectId && (
              <div>
                {eligibleStudentsForMarks.length === 0 ? (
                  <p className="text-[14.5px] text-slate-500">No active students enrolled for this exam's class.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto border border-slate-200 rounded-[10px]">
                      <table className="ec-table">
                        <thead className="ec-thead">
                          <tr>
                            <th className="ec-th">Student</th>
                            <th className="ec-th">Roll No</th>
                            <th className="ec-th">Marks (Max {activeMaxMarks})</th>
                            <th className="ec-th">Absent</th>
                            <th className="ec-th">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="ec-tbody">
                          {eligibleStudentsForMarks.map((stu) => {
                            const existing = marks.find(
                              (m) => m.examId === selectedExamId && m.subjectId === selectedSubjectId && m.studentId === stu.id,
                            );
                            const draft = markDrafts[stu.id];
                            const absent = draft ? draft.absent : existing?.isAbsent ?? false;
                            const val = draft ? draft.marks : existing ? String(existing.marksObtained) : '';
                            const rem = draft ? draft.remarks : existing?.remarks || '';
                            return (
                              <tr key={stu.id} className="ec-tr">
                                <td className="ec-td font-medium text-slate-900">
                                  {stu.firstName} {stu.lastName}
                                </td>
                                <td className="ec-td font-mono text-[13px] text-slate-500">{stu.rollNumber || stu.studentCode}</td>
                                <td className="ec-td">
                                  <input
                                    type="number"
                                    min={0}
                                    max={activeMaxMarks}
                                    step="0.5"
                                    disabled={absent}
                                    value={absent ? '0' : val}
                                    onChange={(e) =>
                                      setMarkDrafts((p) => ({
                                        ...p,
                                        [stu.id]: { marks: e.target.value, absent, remarks: rem },
                                      }))
                                    }
                                    className="w-28 px-3 py-1.5 text-[14.5px] border border-slate-300 rounded-[8px] font-mono disabled:bg-slate-100"
                                  />
                                </td>
                                <td className="ec-td">
                                  <input
                                    type="checkbox"
                                    checked={absent}
                                    onChange={(e) =>
                                      setMarkDrafts((p) => ({
                                        ...p,
                                        [stu.id]: { marks: val, absent: e.target.checked, remarks: rem },
                                      }))
                                    }
                                    className="rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                                  />
                                </td>
                                <td className="ec-td">
                                  <input
                                    type="text"
                                    value={rem}
                                    onChange={(e) =>
                                      setMarkDrafts((p) => ({
                                        ...p,
                                        [stu.id]: { marks: val, absent, remarks: e.target.value },
                                      }))
                                    }
                                    className="w-full max-w-xs px-3 py-1.5 text-[14px] border border-slate-300 rounded-[8px]"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={savingMarks}
                        onClick={handleSaveMarks}
                        className="ec-btn-primary"
                      >
                        {savingMarks ? 'Saving...' : 'Save Subject Marks'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* Consolidated Results Table */}
        <SectionCard
          variant="tinted-header"
          icon={Award}
          title="Consolidated Result Summary"
          noPadding
          action={
            <select
              value={activeResExamId}
              onChange={(e) => setResultExamId(e.target.value)}
              className="ec-select !py-2 !w-auto min-w-[220px]"
            >
              {examinations.length === 0 ? (
                <option value="">No examinations created</option>
              ) : (
                examinations.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))
              )}
            </select>
          }
        >
          {studentSummaries.length === 0 ? (
            <div className="p-10 text-center text-[15px] text-slate-500">
              {isStaffTeacher
                ? 'No marks entered for this examination yet.'
                : 'No published examination results available yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ec-table">
                <thead className="ec-thead">
                  <tr>
                    {activeResExam?.enableRanking && <th className="ec-th">Rank</th>}
                    <th className="ec-th">Student</th>
                    <th className="ec-th">Class</th>
                    <th className="ec-th text-right">Total Marks</th>
                    <th className="ec-th text-right">Percentage</th>
                    <th className="ec-th">Grade / GPA</th>
                    <th className="ec-th">Outcome</th>
                    <th className="ec-th text-right">Marksheet</th>
                  </tr>
                </thead>
                <tbody className="ec-tbody">
                  {studentSummaries.map((r) => (
                    <tr key={r.studentId} className="ec-tr">
                      {activeResExam?.enableRanking && (
                        <td className="ec-td font-mono font-semibold text-slate-800">#{r.rank}</td>
                      )}
                      <td className="ec-td">
                        <div className="font-medium text-slate-900">{r.studentName}</div>
                        <div className="text-[13px] text-slate-500">Roll: {r.rollNumber}</div>
                      </td>
                      <td className="ec-td">{r.className}</td>
                      <td className="ec-td text-right font-mono tabular-nums">
                        {r.totalObtained} / {r.totalMax}
                      </td>
                      <td className="ec-td text-right font-mono tabular-nums">{r.percentage}%</td>
                      <td className="ec-td">
                        <span className="font-semibold text-slate-900">{r.grade}</span>
                        {r.gpa > 0 && <span className="text-[13px] text-slate-500 ml-1">({r.gpa} GPA)</span>}
                      </td>
                      <td className="ec-td">
                        <StatusBadge status={r.resultStatus} />
                      </td>
                      <td className="ec-td text-right">
                        <button
                          type="button"
                          onClick={() => setMarksheetStudentId(r.studentId)}
                          className="text-[13.5px] font-semibold text-blue-800 hover:underline"
                        >
                          View Marksheet
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Printable Marksheet Modal */}
        <Modal
          open={Boolean(marksheetRow)}
          onClose={() => setMarksheetStudentId(null)}
          title="Official Statement of Marks"
          size="lg"
          footer={
            <button
              type="button"
              onClick={() => window.print()}
              className="ec-btn-primary"
            >
              <Printer className="w-4 h-4" />
              Print Marksheet
            </button>
          }
        >
          {marksheetRow && (
            <div className="print-surface space-y-5 text-[14.5px]">
              <div className="text-center border-b border-slate-200 pb-4">
                <div className="text-[20px] font-bold text-slate-900">{institution?.name}</div>
                <div className="text-[13.5px] text-slate-500 mt-0.5">{activeResExam?.name} · Official Result Sheet</div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[13.5px] bg-slate-50 p-4 rounded-[10px] border border-slate-200">
                <div>Student Name: <span className="font-semibold text-slate-900">{marksheetRow.studentName}</span></div>
                <div>Roll Number: <span className="font-mono">{marksheetRow.rollNumber}</span></div>
                <div>Class: {marksheetRow.className}</div>
                <div className="flex items-center gap-2">
                  <span>Overall Outcome:</span>
                  <StatusBadge status={marksheetRow.resultStatus} size="sm" />
                </div>
              </div>
              <div className="border border-slate-200 rounded-[10px] overflow-hidden">
                <table className="ec-table">
                  <thead className="ec-thead">
                    <tr>
                      <th className="ec-th">Subject</th>
                      <th className="ec-th text-right">Max Marks</th>
                      <th className="ec-th text-right">Pass Marks</th>
                      <th className="ec-th text-right">Obtained</th>
                      <th className="ec-th">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="ec-tbody">
                    {marksheetRow.marks.map((m) => (
                      <tr key={m.id} className="ec-tr">
                        <td className="ec-td">{subjectMap.get(m.subjectId)?.name || m.subjectId}</td>
                        <td className="ec-td text-right tabular-nums">{m.maxMarks}</td>
                        <td className="ec-td text-right tabular-nums">{m.passingMarks ?? 0}</td>
                        <td className="ec-td text-right font-mono tabular-nums">
                          {m.isAbsent ? 'ABS' : m.marksObtained}
                        </td>
                        <td className="ec-td font-medium">{m.grade || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap justify-between items-center gap-3 p-4 border border-slate-200 rounded-[10px] bg-slate-50 text-[14px] font-semibold">
                <span>Grand Total: {marksheetRow.totalObtained} / {marksheetRow.totalMax}</span>
                <span>Percentage: {marksheetRow.percentage}%</span>
                <span>Grade: {marksheetRow.grade}</span>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // ===================== VIEW: EXAMINATIONS =====================
  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Examinations & Scheduling"
        subtitle="Configure internal, mid-term, semester, practical, and final exams with subject timetables."
        actions={
          <>
            <button
              type="button"
              onClick={() => window.print()}
              className="ec-btn-secondary"
            >
              <Printer className="w-4 h-4" />
              Print Schedule
            </button>
            {canCreate && isAcademicMgr && (
              <button
                type="button"
                onClick={openAddExam}
                className="ec-btn-primary"
              >
                <Plus className="w-4 h-4" />
                Create Examination
              </button>
            )}
          </>
        }
      />

      {examinations.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No examinations scheduled"
          description="Create an examination cycle and add subject dates, rooms, invigilators, and marking limits."
          actionLabel={canCreate && isAcademicMgr ? 'Create Examination' : undefined}
          onAction={canCreate && isAcademicMgr ? openAddExam : undefined}
        />
      ) : (
        <div className="space-y-5 print-surface">
          {examinations.map((ex) => (
            <div key={ex.id} className="ec-card overflow-hidden border-t-2 border-t-purple-600">
              <div className="px-5 sm:px-6 py-4 bg-purple-50/40 border-b border-purple-200/70 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-[17px] font-semibold text-slate-900">{ex.name}</h3>
                    <StatusBadge status={ex.status} />
                  </div>
                  <div className="text-[13.5px] text-slate-500 mt-1 capitalize">
                    {ex.examType.replace(/_/g, ' ')} · {classMap.get(ex.classId || '') || 'All Classes'} ·{' '}
                    {ex.startDate ? `${formatDate(ex.startDate)} – ${formatDate(ex.endDate)}` : 'Dates TBA'}
                  </div>
                </div>
                {isAcademicMgr && (
                  <div className="flex items-center gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExam(ex);
                        setExamForm({ ...ex });
                        setExamModalOpen(true);
                      }}
                      className="ec-btn-secondary !py-1.5 !px-3 !text-[13.5px]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleteExam(ex)}
                        className="p-2 text-slate-500 hover:text-red-700 rounded-[8px] hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {ex.subjects && ex.subjects.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="ec-table">
                    <thead className="ec-thead">
                      <tr>
                        <th className="ec-th">Subject</th>
                        <th className="ec-th">Date</th>
                        <th className="ec-th">Time</th>
                        <th className="ec-th">Room</th>
                        <th className="ec-th">Invigilator</th>
                        <th className="ec-th text-right">Max / Pass</th>
                      </tr>
                    </thead>
                    <tbody className="ec-tbody">
                      {ex.subjects.map((sub, i) => (
                        <tr key={i} className="ec-tr">
                          <td className="ec-td font-medium text-slate-900">{sub.subjectName}</td>
                          <td className="ec-td">{formatDate(sub.examDate)}</td>
                          <td className="ec-td font-mono text-[13px]">{sub.startTime} – {sub.endTime}</td>
                          <td className="ec-td">{sub.room || '—'}</td>
                          <td className="ec-td">{sub.invigilatorName || '—'}</td>
                          <td className="ec-td text-right font-mono text-[13.5px]">{sub.maxMarks} / {sub.passingMarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="px-6 py-4 text-[14px] text-slate-500">No subject schedules added to this exam yet.</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Examination Modal */}
      <Modal
        open={examModalOpen}
        onClose={() => setExamModalOpen(false)}
        title={editingExam ? `Edit ${editingExam.name}` : 'Create Examination'}
        size="xl"
      >
        <form onSubmit={handleSaveExam} className="space-y-6">
          <FormSection title="Examination Configuration">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Examination Name" required className="md:col-span-2">
                <input
                  required
                  value={examForm.name || ''}
                  onChange={(e) => setExamForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Mid-Term Examination 2026"
                  className="ec-input"
                />
              </FormField>
              <FormField label="Exam Type">
                <select
                  value={examForm.examType || 'mid_term'}
                  onChange={(e) => setExamForm((p) => ({ ...p, examType: e.target.value as Examination['examType'] }))}
                  className="ec-select"
                >
                  <option value="internal">Internal Assessment</option>
                  <option value="mid_term">Mid-Term</option>
                  <option value="semester">Semester Exam</option>
                  <option value="final">Final Exam</option>
                  <option value="practical">Practical</option>
                  <option value="viva">Viva</option>
                </select>
              </FormField>
              <FormField label="Target Class / Semester">
                <select
                  value={examForm.classId || ''}
                  onChange={(e) => setExamForm((p) => ({ ...p, classId: e.target.value }))}
                  className="ec-select"
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Start Date">
                <input
                  type="date"
                  value={examForm.startDate || ''}
                  onChange={(e) => setExamForm((p) => ({ ...p, startDate: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="End Date">
                <input
                  type="date"
                  value={examForm.endDate || ''}
                  onChange={(e) => setExamForm((p) => ({ ...p, endDate: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="Status">
                <select
                  value={examForm.status || 'scheduled'}
                  onChange={(e) => setExamForm((p) => ({ ...p, status: e.target.value as Examination['status'] }))}
                  className="ec-select"
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="published">Published</option>
                </select>
              </FormField>
              <FormField label="Program (optional)">
                <select
                  value={examForm.programId || ''}
                  onChange={(e) => setExamForm((p) => ({ ...p, programId: e.target.value }))}
                  className="ec-select"
                >
                  <option value="">All Programs</option>
                  {programs.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <label className="flex items-center gap-2.5 text-[14px] font-medium text-slate-700 pt-7 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(examForm.enableRanking)}
                  onChange={(e) => setExamForm((p) => ({ ...p, enableRanking: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                />
                Enable Student Ranking
              </label>
            </div>
          </FormSection>

          <FormSection title="Exam Subject Timetable" withDivider>
            <div className="flex items-center justify-end mb-3">
              <button
                type="button"
                onClick={addSubjectRowToExam}
                className="px-3.5 py-1.5 text-[13.5px] font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-[8px] hover:bg-blue-100 transition-colors"
              >
                + Add Subject Paper
              </button>
            </div>
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {(examForm.subjects || []).map((row, idx) => (
                <div key={idx} className="grid grid-cols-2 md:grid-cols-6 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-[10px]">
                  <select
                    value={row.subjectId}
                    onChange={(e) => {
                      const sub = subjectMap.get(e.target.value);
                      const next = [...(examForm.subjects || [])];
                      next[idx] = {
                        ...row,
                        subjectId: e.target.value,
                        subjectName: sub?.name || '',
                        maxMarks: sub?.maxMarks || row.maxMarks,
                        passingMarks: sub?.passingMarks || row.passingMarks,
                      };
                      setExamForm((p) => ({ ...p, subjects: next }));
                    }}
                    className="px-2.5 py-2 text-[13.5px] border border-slate-300 rounded-[8px] bg-white"
                  >
                    <option value="">Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} · {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={row.examDate}
                    onChange={(e) => {
                      const next = [...(examForm.subjects || [])];
                      next[idx] = { ...row, examDate: e.target.value };
                      setExamForm((p) => ({ ...p, subjects: next }));
                    }}
                    className="px-2.5 py-2 text-[13.5px] border border-slate-300 rounded-[8px] bg-white"
                  />
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(e) => {
                      const next = [...(examForm.subjects || [])];
                      next[idx] = { ...row, startTime: e.target.value };
                      setExamForm((p) => ({ ...p, subjects: next }));
                    }}
                    className="px-2.5 py-2 text-[13.5px] border border-slate-300 rounded-[8px] bg-white"
                  />
                  <input
                    placeholder="Room"
                    value={row.room}
                    onChange={(e) => {
                      const next = [...(examForm.subjects || [])];
                      next[idx] = { ...row, room: e.target.value };
                      setExamForm((p) => ({ ...p, subjects: next }));
                    }}
                    className="px-2.5 py-2 text-[13.5px] border border-slate-300 rounded-[8px] bg-white"
                  />
                  <select
                    value={row.invigilatorId || ''}
                    onChange={(e) => {
                      const fac = facultyList.find((f) => f.id === e.target.value);
                      const next = [...(examForm.subjects || [])];
                      next[idx] = {
                        ...row,
                        invigilatorId: e.target.value,
                        invigilatorName: fac ? `${fac.firstName} ${fac.lastName}` : '',
                      };
                      setExamForm((p) => ({ ...p, subjects: next }));
                    }}
                    className="px-2.5 py-2 text-[13.5px] border border-slate-300 rounded-[8px] bg-white"
                  >
                    <option value="">Invigilator</option>
                    {facultyList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.firstName} {f.lastName}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={row.maxMarks}
                      onChange={(e) => {
                        const next = [...(examForm.subjects || [])];
                        next[idx] = { ...row, maxMarks: Number(e.target.value) };
                        setExamForm((p) => ({ ...p, subjects: next }));
                      }}
                      className="w-20 px-2.5 py-2 text-[13.5px] border border-slate-300 rounded-[8px] bg-white"
                      title="Max Marks"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setExamForm((p) => ({
                          ...p,
                          subjects: (p.subjects || []).filter((_, i) => i !== idx),
                        }))
                      }
                      className="text-red-600 text-[16px] px-1.5 hover:bg-red-50 rounded"
                      aria-label="Remove paper"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setExamModalOpen(false)} className="ec-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="ec-btn-primary">
              {saving ? 'Saving...' : 'Save Examination'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteExam)}
        onClose={() => setDeleteExam(null)}
        onConfirm={async () => {
          if (!institution || !deleteExam) return;
          await deleteInstDoc(institution.id, 'examinations', deleteExam.id);
          setDeleteExam(null);
          pushToast('success', 'Examination deleted.');
        }}
        title="Delete Examination"
        description={`Delete "${deleteExam?.name}"?`}
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
