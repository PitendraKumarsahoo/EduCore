import React, { useMemo, useState } from 'react';
import { CalendarCheck, Check, CheckCircle2, Clock, Download, Plus, Printer, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { deleteInstDoc, saveInstDoc, writeAuditLog } from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import { formatDate, generateId, nowIso, todayDateStr } from '../utils/format';
import { exportToCsv } from '../utils/csv';
import {
  ConfirmDialog,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  Tabs,
} from '../components/ui/Primitives';
import type { AttendanceRecord, TimetableSlot } from '../types';

const DAYS: TimetableSlot['dayOfWeek'][] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function AttendanceTimetableModule() {
  const {
    institution,
    member,
    userAccount,
    activeYearId,
    activeModule,
    can,
    pushToast,
    classes,
    sections,
    subjects,
    students,
    employees,
    attendance,
    timetables,
  } = useApp();

  const isTimetable = activeModule === 'timetable';
  const canCreate = can(activeModule, 'create');
  const canDelete = can(activeModule, 'delete');
  const canExport = can(activeModule, 'export');
  const isStaff = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod', 'teacher', 'accountant', 'librarian', 'receptionist'].includes(
    member?.role || '',
  );
  const isAdminMgr = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod'].includes(member?.role || '');

  // Attendance state
  const [attMode, setAttMode] = useState<'student' | 'employee'>('student');
  const [attDate, setAttDate] = useState(todayDateStr());
  const [attClassId, setAttClassId] = useState('');
  const [attSectionId, setAttSectionId] = useState('');
  const [attSubjectId, setAttSubjectId] = useState('');
  const [draftStatuses, setDraftStatuses] = useState<Record<string, AttendanceRecord['status']>>({});
  const [draftRemarks, setDraftRemarks] = useState<Record<string, string>>({});
  const [savingAtt, setSavingAtt] = useState(false);

  // Timetable state
  const [ttViewMode, setTtViewMode] = useState<'class' | 'faculty' | 'room'>('class');
  const [ttFilterId, setTtFilterId] = useState('');
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [slotForm, setSlotForm] = useState<Partial<TimetableSlot>>({
    dayOfWeek: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    status: 'active',
  });
  const [savingSlot, setSavingSlot] = useState(false);
  const [deleteSlot, setDeleteSlot] = useState<TimetableSlot | null>(null);

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s.name])), [sections]);
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const facultyList = useMemo(() => employees.filter((e) => e.staffType === 'faculty'), [employees]);

  // Attendance target list
  const targetStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.status !== 'active') return false;
      if (attClassId && s.classId !== attClassId) return false;
      if (attSectionId && s.sectionId !== attSectionId) return false;
      return true;
    });
  }, [students, attClassId, attSectionId]);

  const existingDayMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance.forEach((a) => {
      if (a.date === attDate && a.targetType === attMode && (attSubjectId ? a.subjectId === attSubjectId : !a.subjectId)) {
        map.set(a.targetId, a);
      }
    });
    return map;
  }, [attendance, attDate, attMode, attSubjectId]);

  const setBulkStatus = (status: AttendanceRecord['status']) => {
    const next: Record<string, AttendanceRecord['status']> = {};
    if (attMode === 'student') {
      targetStudents.forEach((s) => {
        next[s.id] = status;
      });
    } else {
      employees.forEach((e) => {
        next[e.id] = status;
      });
    }
    setDraftStatuses(next);
  };

  const handleSaveAttendance = async () => {
    if (!institution || !userAccount || !member) return;
    if (attMode === 'student' && targetStudents.length === 0) {
      pushToast('error', 'No students match the selected class/section.');
      return;
    }

    // Teacher authorization check if assigned classes/subjects configured
    if (member.role === 'teacher' && member.assignedClassIds && member.assignedClassIds.length > 0 && attClassId) {
      if (!member.assignedClassIds.includes(attClassId)) {
        pushToast('error', 'You are not assigned to mark attendance for this class.');
        return;
      }
    }

    setSavingAtt(true);
    try {
      const ts = nowIso();
      if (attMode === 'student') {
        await Promise.all(
          targetStudents.map((stu) => {
            const existing = existingDayMap.get(stu.id);
            const status = draftStatuses[stu.id] || existing?.status || 'present';
            const docId = existing?.id || `att_${attDate}_stu_${stu.id}_${attSubjectId || 'daily'}`;
            const payload: Omit<AttendanceRecord, 'id'> = {
              institutionId: institution.id,
              academicYearId: activeYearId || undefined,
              targetType: 'student',
              targetId: stu.id,
              targetName: `${stu.firstName} ${stu.lastName}`,
              studentUserUid: stu.userUid || undefined,
              parentUserUid: stu.parentUid || undefined,
              classId: stu.classId || attClassId || undefined,
              sectionId: stu.sectionId || attSectionId || undefined,
              subjectId: attSubjectId || undefined,
              date: attDate,
              status,
              remarks: draftRemarks[stu.id] ?? existing?.remarks ?? undefined,
              markedByUid: userAccount.uid,
              markedByName: userAccount.displayName,
              createdAt: existing?.createdAt || ts,
              updatedAt: ts,
            };
            return saveInstDoc(institution.id, 'attendance', docId, payload, !existing);
          }),
        );
      } else {
        await Promise.all(
          employees.map((emp) => {
            const existing = existingDayMap.get(emp.id);
            const status = draftStatuses[emp.id] || existing?.status || 'present';
            const docId = existing?.id || `att_${attDate}_emp_${emp.id}`;
            const payload: Omit<AttendanceRecord, 'id'> = {
              institutionId: institution.id,
              academicYearId: activeYearId || undefined,
              targetType: 'employee',
              targetId: emp.id,
              targetName: `${emp.firstName} ${emp.lastName}`,
              date: attDate,
              status,
              remarks: draftRemarks[emp.id] ?? existing?.remarks ?? undefined,
              markedByUid: userAccount.uid,
              markedByName: userAccount.displayName,
              createdAt: existing?.createdAt || ts,
              updatedAt: ts,
            };
            return saveInstDoc(institution.id, 'attendance', docId, payload, !existing);
          }),
        );
      }

      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member.role,
        action: 'mark_attendance',
        module: 'attendance',
        summary: `Marked ${attMode} attendance for ${attDate}`,
      });
      pushToast('success', `Attendance saved for ${formatDate(attDate)}.`);
      setDraftStatuses({});
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to save attendance.'));
    } finally {
      setSavingAtt(false);
    }
  };

  // Timetable Save with Strict Conflict Validation
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount) return;
    if (!slotForm.classId || !slotForm.subjectId || !slotForm.startTime || !slotForm.endTime) {
      pushToast('error', 'Class, subject, start time, and end time are required.');
      return;
    }
    if (slotForm.endTime <= slotForm.startTime) {
      pushToast('error', 'End time must be after start time.');
      return;
    }

    // Conflict validation against existing active timetable slots on the same day
    const sameDaySlots = timetables.filter(
      (s) => s.status === 'active' && s.dayOfWeek === slotForm.dayOfWeek && s.id !== slotForm.id,
    );
    for (const existing of sameDaySlots) {
      if (!timesOverlap(slotForm.startTime, slotForm.endTime, existing.startTime, existing.endTime)) {
        continue;
      }
      if (slotForm.facultyId && existing.facultyId === slotForm.facultyId) {
        pushToast(
          'error',
          `Faculty conflict: ${existing.facultyName || 'This teacher'} is already scheduled ${existing.startTime}-${existing.endTime}.`,
        );
        return;
      }
      if (slotForm.room?.trim() && existing.room?.toLowerCase() === slotForm.room.trim().toLowerCase()) {
        pushToast(
          'error',
          `Room conflict: Room "${existing.room}" is already occupied ${existing.startTime}-${existing.endTime}.`,
        );
        return;
      }
      if (
        existing.classId === slotForm.classId &&
        (existing.sectionId || '') === (slotForm.sectionId || '')
      ) {
        pushToast(
          'error',
          `Class/Section conflict: Another class is already scheduled ${existing.startTime}-${existing.endTime}.`,
        );
        return;
      }
    }

    setSavingSlot(true);
    try {
      const ts = nowIso();
      const id = slotForm.id || generateId('tt');
      const subj = subjects.find((s) => s.id === slotForm.subjectId);
      const fac = facultyList.find((f) => f.id === slotForm.facultyId);
      const payload: Omit<TimetableSlot, 'id'> = {
        institutionId: institution.id,
        academicYearId: activeYearId || undefined,
        classId: slotForm.classId,
        sectionId: slotForm.sectionId || undefined,
        subjectId: slotForm.subjectId,
        subjectName: subj?.name || slotForm.subjectName,
        facultyId: slotForm.facultyId || undefined,
        facultyName: fac ? `${fac.firstName} ${fac.lastName}` : slotForm.facultyName,
        room: slotForm.room?.trim() || undefined,
        dayOfWeek: slotForm.dayOfWeek || 'Monday',
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        status: 'active',
        createdAt: slotForm.createdAt || ts,
        updatedAt: ts,
      };
      await saveInstDoc(institution.id, 'timetables', id, payload, !slotForm.id);
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: slotForm.id ? 'update' : 'create',
        module: 'timetable',
        recordId: id,
        summary: `Scheduled ${payload.subjectName || payload.subjectId} on ${payload.dayOfWeek} ${payload.startTime}-${payload.endTime}`,
      });
      pushToast('success', 'Timetable slot saved.');
      setSlotModalOpen(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to save timetable slot.'));
    } finally {
      setSavingSlot(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!institution || !deleteSlot) return;
    try {
      await deleteInstDoc(institution.id, 'timetables', deleteSlot.id);
      pushToast('success', 'Timetable slot deleted.');
      setDeleteSlot(null);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to delete slot.'));
    }
  };

  const filteredSlots = useMemo(() => {
    let list = timetables;
    if (member?.role === 'student' || member?.role === 'parent') {
      const myClassIds = new Set(students.map((s) => s.classId).filter(Boolean));
      list = list.filter((t) => myClassIds.has(t.classId));
    } else if (ttFilterId) {
      if (ttViewMode === 'class') list = list.filter((t) => t.classId === ttFilterId);
      else if (ttViewMode === 'faculty') list = list.filter((t) => t.facultyId === ttFilterId);
      else if (ttViewMode === 'room') list = list.filter((t) => (t.room || '') === ttFilterId);
    }
    return [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [timetables, member?.role, students, ttFilterId, ttViewMode]);

  const distinctRooms = useMemo(
    () => Array.from(new Set(timetables.map((t) => t.room).filter(Boolean) as string[])),
    [timetables],
  );

  if (isTimetable) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={Clock}
          title="Timetable & Scheduling"
          subtitle="Weekly schedule across classes, faculty, and rooms with automated conflict detection."
          actions={
            <>
              {canExport && (
                <button
                  type="button"
                  onClick={() =>
                    exportToCsv(
                      'timetable',
                      ['Day', 'Start', 'End', 'Class', 'Section', 'Subject', 'Faculty', 'Room'],
                      filteredSlots.map((s) => [
                        s.dayOfWeek,
                        s.startTime,
                        s.endTime,
                        classMap.get(s.classId) || s.classId,
                        sectionMap.get(s.sectionId || '') || '',
                        s.subjectName || subjectMap.get(s.subjectId) || '',
                        s.facultyName || '',
                        s.room || '',
                      ]),
                    )
                  }
                  className="ec-btn-secondary"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
                className="ec-btn-secondary"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setSlotForm({
                      dayOfWeek: 'Monday',
                      startTime: '09:00',
                      endTime: '10:00',
                      classId: classes[0]?.id || '',
                      status: 'active',
                    });
                    setSlotModalOpen(true);
                  }}
                  className="ec-btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Add Slot
                </button>
              )}
            </>
          }
        />

        {isStaff && (
          <SectionCard className="no-print">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Tabs
                value={ttViewMode}
                onChange={(m) => {
                  setTtViewMode(m);
                  setTtFilterId('');
                }}
                items={[
                  { key: 'class', label: 'By Class' },
                  { key: 'faculty', label: 'By Faculty' },
                  { key: 'room', label: 'By Room' },
                ]}
              />
              <div className="w-full sm:w-72">
                <select
                  value={ttFilterId}
                  onChange={(e) => setTtFilterId(e.target.value)}
                  className="ec-select"
                >
                  <option value="">
                    All {ttViewMode === 'class' ? 'Classes' : ttViewMode === 'faculty' ? 'Faculty' : 'Rooms'}
                  </option>
                  {ttViewMode === 'class' &&
                    classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  {ttViewMode === 'faculty' &&
                    facultyList.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.firstName} {f.lastName}
                      </option>
                    ))}
                  {ttViewMode === 'room' &&
                    distinctRooms.map((r) => (
                      <option key={r} value={r}>
                        Room {r}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </SectionCard>
        )}

        {filteredSlots.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No timetable slots scheduled"
            description="Add class periods with subject, faculty, and room details. Overlapping conflicts are prevented automatically."
            actionLabel={canCreate ? 'Add Timetable Slot' : undefined}
            onAction={canCreate ? () => setSlotModalOpen(true) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print-surface">
            {DAYS.map((day) => {
              const daySlots = filteredSlots.filter((s) => s.dayOfWeek === day);
              return (
                <div key={day} className="ec-card overflow-hidden border-t-2 border-t-emerald-600">
                  <div className="px-5 py-3.5 bg-emerald-50/50 border-b border-emerald-200/75 flex items-center justify-between">
                    <span className="text-[16px] font-semibold text-slate-900">{day}</span>
                    <span className="text-[13px] font-medium text-emerald-800 tabular-nums">
                      {daySlots.length} {daySlots.length === 1 ? 'period' : 'periods'}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    {daySlots.length === 0 ? (
                      <div className="text-[14px] text-slate-400 py-5 text-center">No scheduled periods</div>
                    ) : (
                      daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="p-3.5 border border-slate-200 rounded-[10px] hover:border-emerald-300 hover:bg-emerald-50/20 bg-white transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[13px] font-semibold text-emerald-800">
                              {slot.startTime} – {slot.endTime}
                            </span>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteSlot(slot)}
                                className="p-1 text-slate-400 hover:text-red-700 rounded hover:bg-red-50 transition-colors no-print"
                                title="Delete slot"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="font-semibold text-slate-900 text-[15px] mt-1.5">
                            {slot.subjectName || subjectMap.get(slot.subjectId) || slot.subjectId}
                          </div>
                          <div className="text-[13.5px] text-slate-600 mt-0.5">
                            {classMap.get(slot.classId) || slot.classId}
                            {slot.sectionId ? ` · ${sectionMap.get(slot.sectionId) || ''}` : ''}
                          </div>
                          <div className="text-[13px] text-slate-500 flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                            <span>{slot.facultyName || 'Faculty TBA'}</span>
                            {slot.room && <span className="font-mono">Room {slot.room}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Modal open={slotModalOpen} onClose={() => setSlotModalOpen(false)} title="Add Timetable Slot" size="md">
          <form onSubmit={handleSaveSlot} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Day" required>
                <select
                  value={slotForm.dayOfWeek || 'Monday'}
                  onChange={(e) => setSlotForm((p) => ({ ...p, dayOfWeek: e.target.value as TimetableSlot['dayOfWeek'] }))}
                  className="ec-select"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Room">
                <input
                  value={slotForm.room || ''}
                  onChange={(e) => setSlotForm((p) => ({ ...p, room: e.target.value }))}
                  placeholder="e.g. R-204"
                  className="ec-input"
                />
              </FormField>
              <FormField label="Start Time" required>
                <input
                  type="time"
                  required
                  value={slotForm.startTime || '09:00'}
                  onChange={(e) => setSlotForm((p) => ({ ...p, startTime: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
              <FormField label="End Time" required>
                <input
                  type="time"
                  required
                  value={slotForm.endTime || '10:00'}
                  onChange={(e) => setSlotForm((p) => ({ ...p, endTime: e.target.value }))}
                  className="ec-input"
                />
              </FormField>
            </div>
            <FormField label="Class / Semester" required>
              <select
                required
                value={slotForm.classId || ''}
                onChange={(e) => setSlotForm((p) => ({ ...p, classId: e.target.value, sectionId: '' }))}
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
            <FormField label="Section / Batch">
              <select
                value={slotForm.sectionId || ''}
                onChange={(e) => setSlotForm((p) => ({ ...p, sectionId: e.target.value }))}
                className="ec-select"
              >
                <option value="">All / Default</option>
                {sections
                  .filter((sec) => !slotForm.classId || sec.classId === slotForm.classId)
                  .map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField label="Subject" required>
              <select
                required
                value={slotForm.subjectId || ''}
                onChange={(e) => setSlotForm((p) => ({ ...p, subjectId: e.target.value }))}
                className="ec-select"
              >
                <option value="">Select Subject</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} · {sub.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Faculty">
              <select
                value={slotForm.facultyId || ''}
                onChange={(e) => setSlotForm((p) => ({ ...p, facultyId: e.target.value }))}
                className="ec-select"
              >
                <option value="">Select Faculty</option>
                {facultyList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.firstName} {f.lastName}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSlotModalOpen(false)}
                className="ec-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSlot}
                className="ec-btn-primary"
              >
                {savingSlot ? 'Checking & Saving...' : 'Save Slot'}
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          open={Boolean(deleteSlot)}
          onClose={() => setDeleteSlot(null)}
          onConfirm={handleDeleteSlot}
          title="Delete Timetable Slot"
          description="Remove this scheduled period from the timetable?"
          confirmLabel="Delete"
          destructive
        />
      </div>
    );
  }

  // Attendance View (Staff marking OR Student/Parent viewing)
  if (!isStaff) {
    const presentCount = attendance.filter((a) => a.status === 'present').length;
    const pct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;
    return (
      <div className="space-y-6">
        <PageHeader icon={CalendarCheck} title="Attendance Record" subtitle="View daily and subject-wise attendance logs." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard accent="emerald" label="Attendance Rate" value={`${pct}%`} icon={CheckCircle2} />
          <StatCard accent="blue" label="Days Present" value={presentCount} icon={CalendarCheck} />
          <StatCard accent="slate" label="Total Sessions Logged" value={attendance.length} icon={Clock} />
        </div>
        {attendance.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="No attendance records yet"
            description="Attendance entries marked by teachers will appear here."
          />
        ) : (
          <div className="ec-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ec-table">
                <thead className="ec-thead">
                  <tr>
                    <th className="ec-th">Date</th>
                    <th className="ec-th">Student</th>
                    <th className="ec-th">Subject</th>
                    <th className="ec-th">Status</th>
                    <th className="ec-th">Remarks</th>
                  </tr>
                </thead>
                <tbody className="ec-tbody">
                  {attendance.map((a) => (
                    <tr key={a.id} className="ec-tr">
                      <td className="ec-td">{formatDate(a.date)}</td>
                      <td className="ec-td font-medium text-slate-900">{a.targetName || '—'}</td>
                      <td className="ec-td">{subjectMap.get(a.subjectId || '') || 'Daily'}</td>
                      <td className="ec-td"><StatusBadge status={a.status} /></td>
                      <td className="ec-td text-slate-500">{a.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  const rowsToMark = attMode === 'student' ? targetStudents : employees;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarCheck}
        title="Attendance Management"
        subtitle="Mark daily, class, subject, or employee attendance with bulk controls and exportable reports."
        actions={
          <>
            {canExport && (
              <button
                type="button"
                onClick={() =>
                  exportToCsv(
                    `attendance_${attDate}`,
                    ['Date', 'Type', 'Name', 'Class', 'Subject', 'Status', 'Remarks'],
                    attendance
                      .filter((a) => a.date === attDate)
                      .map((a) => [
                        a.date,
                        a.targetType,
                        a.targetName || a.targetId,
                        classMap.get(a.classId || '') || '',
                        subjectMap.get(a.subjectId || '') || 'Daily',
                        a.status,
                        a.remarks || '',
                      ]),
                  )
                }
                className="ec-btn-secondary"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="ec-btn-secondary"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
          </>
        }
      />

      <SectionCard variant="top-accent" className="no-print">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {isAdminMgr && (
              <Tabs
                value={attMode}
                onChange={(mode) => {
                  setAttMode(mode);
                  setDraftStatuses({});
                }}
                items={[
                  { key: 'student', label: 'Student Attendance' },
                  { key: 'employee', label: 'Faculty & Staff' },
                ]}
              />
            )}

            <div className="w-full sm:w-48">
              <input
                type="date"
                value={attDate}
                onChange={(e) => {
                  setAttDate(e.target.value);
                  setDraftStatuses({});
                }}
                className="ec-input"
              />
            </div>

            {attMode === 'student' && (
              <>
                <div className="w-full sm:w-48">
                  <select
                    value={attClassId}
                    onChange={(e) => {
                      setAttClassId(e.target.value);
                      setAttSectionId('');
                    }}
                    className="ec-select"
                  >
                    <option value="">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full sm:w-44">
                  <select
                    value={attSectionId}
                    onChange={(e) => setAttSectionId(e.target.value)}
                    className="ec-select"
                  >
                    <option value="">All Sections</option>
                    {sections
                      .filter((sec) => !attClassId || sec.classId === attClassId)
                      .map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="w-full sm:w-64">
                  <select
                    value={attSubjectId}
                    onChange={(e) => setAttSubjectId(e.target.value)}
                    className="ec-select"
                  >
                    <option value="">Daily / Homeroom Attendance</option>
                    {subjects
                      .filter((sub) => !attClassId || sub.classId === attClassId)
                      .map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.code} · {sub.name}
                        </option>
                      ))}
                  </select>
                </div>
              </>
            )}
          </div>

          {canCreate && rowsToMark.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-medium text-slate-600 mr-1">Bulk Mark:</span>
                {(['present', 'absent', 'late', 'leave', 'holiday'] as const).map((st) => {
                  const bulkTone =
                    st === 'present'
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                      : st === 'absent'
                        ? 'bg-red-50 hover:bg-red-100 text-red-800 border-red-200'
                        : st === 'late'
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                          : st === 'leave'
                            ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200';
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setBulkStatus(st)}
                      className={`px-3 py-1.5 text-[13.5px] font-medium capitalize border rounded-[8px] transition-colors ${bulkTone}`}
                    >
                      All {st}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={savingAtt}
                onClick={handleSaveAttendance}
                className="ec-btn-primary"
              >
                <Check className="w-4 h-4" />
                {savingAtt ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {rowsToMark.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title={attMode === 'student' ? 'No active students found' : 'No employees found'}
          description="Add active records or adjust the selected class/section filter."
        />
      ) : (
        <div className="ec-card overflow-hidden print-surface">
          <div className="overflow-x-auto">
            <table className="ec-table">
              <thead className="ec-thead">
                <tr>
                  <th className="ec-th">ID / Code</th>
                  <th className="ec-th">Name</th>
                  <th className="ec-th">Status</th>
                  <th className="ec-th">Remarks</th>
                </tr>
              </thead>
              <tbody className="ec-tbody">
                {rowsToMark.map((item) => {
                  const existing = existingDayMap.get(item.id);
                  const currentStatus = draftStatuses[item.id] || existing?.status || 'present';
                  const currentRemarks = draftRemarks[item.id] ?? existing?.remarks ?? '';
                  const code = 'studentCode' in item ? item.studentCode : item.employeeCode;
                  return (
                    <tr key={item.id} className="ec-tr">
                      <td className="ec-td font-mono text-[13px] text-slate-600">{code}</td>
                      <td className="ec-td font-medium text-slate-900">
                        {item.firstName} {item.lastName}
                      </td>
                      <td className="ec-td">
                        <div className="flex flex-wrap gap-1.5">
                          {(['present', 'absent', 'late', 'leave', 'holiday'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={!canCreate}
                              onClick={() => setDraftStatuses((p) => ({ ...p, [item.id]: st }))}
                              className={`px-3 py-1.5 text-[13px] font-medium capitalize rounded-[8px] border transition-colors ${
                                currentStatus === st
                                  ? st === 'present'
                                    ? 'bg-emerald-700 border-emerald-700 text-white'
                                    : st === 'absent'
                                      ? 'bg-red-700 border-red-700 text-white'
                                      : st === 'late'
                                        ? 'bg-amber-600 border-amber-600 text-white'
                                        : st === 'leave'
                                          ? 'bg-blue-700 border-blue-700 text-white'
                                          : 'bg-slate-700 border-slate-700 text-white'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="ec-td">
                        <input
                          type="text"
                          disabled={!canCreate}
                          value={currentRemarks}
                          onChange={(e) => setDraftRemarks((p) => ({ ...p, [item.id]: e.target.value }))}
                          placeholder="Optional note..."
                          className="w-full max-w-xs px-3 py-1.5 text-[14px] text-slate-900 bg-white border border-slate-300 rounded-[8px] focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15 disabled:bg-slate-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
