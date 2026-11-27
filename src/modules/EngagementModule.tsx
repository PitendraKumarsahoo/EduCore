import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Download,
  FolderLock,
  Info,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  deleteInstDoc,
  saveInstDoc,
  subscribeInstCollection,
  where,
  writeAuditLog,
} from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import {
  fileToConstrainedDataUrl,
  formatDate,
  formatDateTime,
  generateId,
  nowIso,
  todayDateStr,
} from '../utils/format';
import { EmptyState, FormField, LoadingState, Modal, PageHeader, StatusBadge } from '../components/ui/Primitives';
import type { CalendarEvent, DocumentRecord, MessageItem, Notice } from '../types';

export function EngagementModule() {
  const {
    institution,
    member,
    userAccount,
    activeYearId,
    activeModule,
    can,
    pushToast,
    notices,
    calendarEvents,
    students,
    employees,
    classes,
    departments,
  } = useApp();

  const isCalendar = activeModule === 'calendar';
  const isComms = activeModule === 'communication';
  const isDocs = activeModule === 'documents';

  const canCreate = can(activeModule, 'create');
  const canDelete = can(activeModule, 'delete');
  const isAdminMgr = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod'].includes(
    member?.role || '',
  );
  const isInstAdmin = ['super_admin', 'institution_admin', 'principal', 'vice_principal'].includes(
    member?.role || '',
  );
  const isStaff = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'hod', 'teacher', 'accountant', 'librarian', 'receptionist'].includes(
    member?.role || '',
  );

  // Messages & Documents subscriptions scoped strictly to Firestore rules
  const [inboxMessages, setInboxMessages] = useState<MessageItem[]>([]);
  const [sentMessages, setSentMessages] = useState<MessageItem[]>([]);
  const [allMessages, setAllMessages] = useState<MessageItem[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  useEffect(() => {
    if (!institution?.id || !userAccount || !member) return;
    const instId = institution.id;
    const unsubs: (() => void)[] = [];

    if (isComms) {
      if (isInstAdmin) {
        unsubs.push(subscribeInstCollection<MessageItem>(instId, 'messages', [], setAllMessages));
      } else {
        unsubs.push(
          subscribeInstCollection<MessageItem>(
            instId,
            'messages',
            [where('recipientUid', '==', userAccount.uid)],
            setInboxMessages,
          ),
        );
        unsubs.push(
          subscribeInstCollection<MessageItem>(
            instId,
            'messages',
            [where('senderUid', '==', userAccount.uid)],
            setSentMessages,
          ),
        );
      }
    }

    if (isDocs) {
      setDocsLoading(true);
      if (isStaff) {
        unsubs.push(
          subscribeInstCollection<DocumentRecord>(instId, 'documents', [], (rows) => {
            setDocuments(rows);
            setDocsLoading(false);
          }),
        );
      } else {
        unsubs.push(
          subscribeInstCollection<DocumentRecord>(
            instId,
            'documents',
            [where('uploadedByUid', '==', userAccount.uid)],
            (rows) => {
              setDocuments(rows);
              setDocsLoading(false);
            },
          ),
        );
      }
    }

    return () => unsubs.forEach((u) => u());
  }, [institution?.id, userAccount?.uid, member?.role, isComms, isDocs, isInstAdmin, isStaff]);

  const mergedMessages = useMemo(() => {
    if (isInstAdmin) return allMessages;
    const map = new Map<string, MessageItem>();
    [...inboxMessages, ...sentMessages].forEach((m) => map.set(m.id, m));
    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [isInstAdmin, allMessages, inboxMessages, sentMessages]);

  const [saving, setSaving] = useState(false);

  // Notice modal
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeForm, setNoticeForm] = useState<Partial<Notice>>({
    targetAudience: 'all',
    status: 'published',
    publishDate: todayDateStr(),
  });

  // Calendar modal
  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState<Partial<CalendarEvent>>({
    eventType: 'academic',
    audience: 'all',
    startDate: todayDateStr(),
  });

  // Message modal
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgRecipientUid, setMsgRecipientUid] = useState('');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgChannel, setMsgChannel] = useState<MessageItem['channel']>('in_app');

  // Document modal
  const [docOpen, setDocOpen] = useState(false);
  const [docOwnerType, setDocOwnerType] = useState<DocumentRecord['ownerType']>('student');
  const [docOwnerId, setDocOwnerId] = useState('');
  const [docType, setDocType] = useState(institution?.documentTypes?.[0] || 'ID Proof');
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<{ name: string; mime: string; size: number; url: string } | null>(null);

  // ===================== VIEW: CALENDAR =====================
  if (isCalendar) {
    const sortedEvents = [...calendarEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));
    return (
      <div className="space-y-6">
        <PageHeader
          icon={Calendar}
          title="Academic Calendar"
          subtitle="Manage academic milestones, examination periods, holidays, meetings, and deadlines."
          actions={
            canCreate &&
            isAdminMgr && (
              <button
                type="button"
                onClick={() => {
                  setEventForm({ eventType: 'academic', audience: 'all', startDate: todayDateStr() });
                  setEventOpen(true);
                }}
                className="ec-btn-primary"
              >
                <Plus className="w-4 h-4" />
                Add Event
              </button>
            )
          }
        />

        {sortedEvents.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No calendar events scheduled"
            description="Add holidays, academic terms, parent-teacher meetings, and exam schedules."
            actionLabel={canCreate && isAdminMgr ? 'Add Event' : undefined}
            onAction={canCreate && isAdminMgr ? () => setEventOpen(true) : undefined}
          />
        ) : (
          <div className="space-y-4">
            {sortedEvents.map((ev) => (
              <div key={ev.id} className="ec-card border-t-2 border-t-violet-600 p-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[13px] font-semibold text-violet-800 bg-violet-50 border border-violet-200 px-2.5 py-0.5 rounded-[6px]">
                      {formatDate(ev.startDate)}
                      {ev.endDate && ev.endDate !== ev.startDate ? ` – ${formatDate(ev.endDate)}` : ''}
                    </span>
                    <span className="text-[13px] uppercase font-semibold text-slate-500">{ev.eventType.replace(/_/g, ' ')}</span>
                    <span className="text-[13px] text-slate-400">· Audience: {ev.audience}</span>
                  </div>
                  <h3 className="text-[17px] font-semibold text-slate-900 mt-2">{ev.title}</h3>
                  {ev.description && <p className="text-[14.5px] text-slate-600 mt-1.5 leading-relaxed">{ev.description}</p>}
                  {ev.location && <div className="text-[13.5px] text-slate-500 mt-1.5">Location: {ev.location}</div>}
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => deleteInstDoc(institution!.id, 'calendar_events', ev.id)}
                    className="p-2 text-slate-400 hover:text-red-700 rounded-[8px] hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <Modal open={eventOpen} onClose={() => setEventOpen(false)} title="Add Calendar Event" size="md">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!institution || !userAccount || !eventForm.title?.trim()) return;
              setSaving(true);
              try {
                const ts = nowIso();
                const id = generateId('evt');
                await saveInstDoc(
                  institution.id,
                  'calendar_events',
                  id,
                  {
                    institutionId: institution.id,
                    academicYearId: activeYearId || undefined,
                    title: eventForm.title.trim(),
                    eventType: eventForm.eventType || 'academic',
                    startDate: eventForm.startDate || todayDateStr(),
                    endDate: eventForm.endDate || undefined,
                    audience: eventForm.audience || 'all',
                    location: eventForm.location?.trim() || undefined,
                    description: eventForm.description?.trim() || undefined,
                    createdByUid: userAccount.uid,
                    createdAt: ts,
                    updatedAt: ts,
                  },
                  true,
                );
                pushToast('success', 'Calendar event added.');
                setEventOpen(false);
              } catch (err) {
                pushToast('error', formatUserFriendlyError(err, 'Failed to add event.'));
              } finally {
                setSaving(false);
              }
            }}
            className="space-y-4"
          >
            <FormField label="Event Title" required>
              <input required value={eventForm.title || ''} onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))} className="ec-input" />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Type">
                <select value={eventForm.eventType || 'academic'} onChange={(e) => setEventForm((p) => ({ ...p, eventType: e.target.value as CalendarEvent['eventType'] }))} className="ec-select">
                  <option value="academic">Academic</option>
                  <option value="exam">Examination</option>
                  <option value="holiday">Holiday</option>
                  <option value="meeting">Meeting</option>
                  <option value="parent_meeting">Parent Meeting</option>
                  <option value="deadline">Deadline</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <FormField label="Audience">
                <select value={eventForm.audience || 'all'} onChange={(e) => setEventForm((p) => ({ ...p, audience: e.target.value as CalendarEvent['audience'] }))} className="ec-select">
                  <option value="all">All</option>
                  <option value="faculty">Faculty</option>
                  <option value="students">Students</option>
                  <option value="parents">Parents</option>
                </select>
              </FormField>
              <FormField label="Start Date" required>
                <input type="date" required value={eventForm.startDate || todayDateStr()} onChange={(e) => setEventForm((p) => ({ ...p, startDate: e.target.value }))} className="ec-input" />
              </FormField>
              <FormField label="End Date">
                <input type="date" value={eventForm.endDate || ''} onChange={(e) => setEventForm((p) => ({ ...p, endDate: e.target.value }))} className="ec-input" />
              </FormField>
            </div>
            <FormField label="Location">
              <input value={eventForm.location || ''} onChange={(e) => setEventForm((p) => ({ ...p, location: e.target.value }))} className="ec-input" />
            </FormField>
            <FormField label="Description">
              <textarea rows={2} value={eventForm.description || ''} onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))} className="ec-textarea" />
            </FormField>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setEventOpen(false)} className="ec-btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="ec-btn-primary">Save Event</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ===================== VIEW: COMMUNICATION =====================
  if (isComms) {
    const contactOptions = [
      ...employees.filter((e) => e.userUid).map((e) => ({ uid: e.userUid!, label: `${e.firstName} ${e.lastName} (${e.designation || e.staffType})` })),
      ...students.filter((s) => s.userUid).map((s) => ({ uid: s.userUid!, label: `${s.firstName} ${s.lastName} (Student · ${s.studentCode})` })),
    ];

    return (
      <div className="space-y-6">
        <PageHeader
          icon={MessageSquare}
          title="Communication & Messaging"
          subtitle="Direct in-app institutional messaging between staff, faculty, students, and parents."
          actions={
            canCreate && (
              <button
                type="button"
                onClick={() => setMsgOpen(true)}
                className="ec-btn-primary"
              >
                <Send className="w-4 h-4" />
                New Message
              </button>
            )
          }
        />

        <div className="ec-card p-4 bg-blue-50/50 border-blue-200/80 flex items-start gap-3 text-[14px] text-slate-700">
          <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900">Channel Status:</span> In-app notifications and direct messages deliver immediately. External Email/SMS gateway dispatch is not configured, so Email/SMS options log messages in-app only.
          </div>
        </div>

        {mergedMessages.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Send a direct message to any linked student, parent, or faculty member."
            actionLabel={canCreate ? 'New Message' : undefined}
            onAction={canCreate ? () => setMsgOpen(true) : undefined}
          />
        ) : (
          <div className="space-y-4">
            {mergedMessages.map((m) => (
              <div key={m.id} className="ec-card p-5 hover:border-blue-200 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-slate-500">
                  <div>
                    <span className="font-semibold text-slate-800">{m.senderName || m.senderUid}</span>
                    {' → '}
                    <span className="font-semibold text-slate-800">{m.recipientName || m.targetAudience || m.recipientUid || 'All'}</span>
                  </div>
                  <span>{formatDateTime(m.createdAt)}</span>
                </div>
                <h3 className="text-[16px] font-semibold text-slate-900 mt-1.5">{m.subject}</h3>
                <p className="text-[14.5px] text-slate-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{m.body}</p>
              </div>
            ))}
          </div>
        )}

        <Modal open={msgOpen} onClose={() => setMsgOpen(false)} title="Send Institutional Message" size="md">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!institution || !userAccount || !msgSubject.trim() || !msgBody.trim()) return;
              setSaving(true);
              try {
                const contact = contactOptions.find((c) => c.uid === msgRecipientUid);
                const id = generateId('msg');
                await saveInstDoc(
                  institution.id,
                  'messages',
                  id,
                  {
                    institutionId: institution.id,
                    senderUid: userAccount.uid,
                    senderName: userAccount.displayName,
                    recipientUid: msgRecipientUid || undefined,
                    recipientName: contact?.label || undefined,
                    targetAudience: msgRecipientUid ? 'direct' : 'all',
                    subject: msgSubject.trim(),
                    body: msgBody.trim(),
                    channel: msgChannel,
                    isRead: false,
                    createdAt: nowIso(),
                  },
                  true,
                );
                pushToast('success', 'Message sent.');
                setMsgOpen(false);
                setMsgSubject('');
                setMsgBody('');
              } catch (err) {
                pushToast('error', formatUserFriendlyError(err, 'Failed to send message.'));
              } finally {
                setSaving(false);
              }
            }}
            className="space-y-4"
          >
            <FormField label="Recipient (Linked Account)">
              <select value={msgRecipientUid} onChange={(e) => setMsgRecipientUid(e.target.value)} className="ec-select">
                <option value="">General Broadcast / Institution Log</option>
                {contactOptions.map((c) => (
                  <option key={c.uid} value={c.uid}>{c.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Channel">
              <select value={msgChannel} onChange={(e) => setMsgChannel(e.target.value as MessageItem['channel'])} className="ec-select">
                <option value="in_app">In-App Message</option>
                <option value="email_queued">In-App + Email Log (Gateway unconfigured)</option>
                <option value="sms_queued">In-App + SMS Log (Gateway unconfigured)</option>
              </select>
            </FormField>
            <FormField label="Subject" required>
              <input required value={msgSubject} onChange={(e) => setMsgSubject(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="Message" required>
              <textarea required rows={4} value={msgBody} onChange={(e) => setMsgBody(e.target.value)} className="ec-textarea" />
            </FormField>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setMsgOpen(false)} className="ec-btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="ec-btn-primary">Send</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ===================== VIEW: DOCUMENTS =====================
  if (isDocs) {
    const docTypes = institution?.documentTypes || ['ID Proof', 'Marksheet', 'Transfer Certificate', 'Birth Certificate'];

    return (
      <div className="space-y-6">
        <PageHeader
          icon={FolderLock}
          title="Documents & Certificates"
          subtitle="Upload, verify, and download student, employee, and institutional records (max 320 KB per file)."
          actions={
            canCreate && (
              <button
                type="button"
                onClick={() => {
                  setDocFile(null);
                  setDocTitle('');
                  setDocOpen(true);
                }}
                className="ec-btn-primary"
              >
                <Plus className="w-4 h-4" />
                Upload Document
              </button>
            )
          }
        />

        {docsLoading && documents.length === 0 ? (
          <LoadingState variant="table" columns={5} />
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FolderLock}
            title="No documents uploaded yet"
            description="Upload verified certificates, ID proofs, transcripts, and institutional records."
            actionLabel={canCreate ? 'Upload Document' : undefined}
            onAction={canCreate ? () => setDocOpen(true) : undefined}
          />
        ) : (
          <div className="ec-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="ec-table">
                <thead className="ec-thead">
                  <tr>
                    <th className="ec-th">Document Title</th>
                    <th className="ec-th">Owner</th>
                    <th className="ec-th">Type</th>
                    <th className="ec-th">Status</th>
                    <th className="ec-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="ec-tbody">
                  {documents.map((d) => (
                    <tr key={d.id} className="ec-tr">
                      <td className="ec-td">
                        <div className="font-medium text-slate-900">{d.title}</div>
                        <div className="text-[13px] text-slate-500">{d.fileName}</div>
                      </td>
                      <td className="ec-td">
                        <div className="text-slate-900">{d.ownerName || d.ownerId}</div>
                        <div className="text-[13px] text-slate-500 capitalize">{d.ownerType}</div>
                      </td>
                      <td className="ec-td">{d.documentType}</td>
                      <td className="ec-td">
                        <StatusBadge status={d.verified ? 'verified' : 'pending'} />
                      </td>
                      <td className="ec-td text-right">
                        <div className="inline-flex items-center gap-3">
                          {isStaff && !d.verified && (
                            <button
                              type="button"
                              onClick={async () => {
                                await saveInstDoc(institution!.id, 'documents', d.id, { ...d, verified: true }, false);
                                pushToast('success', 'Document verified.');
                              }}
                              className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-emerald-700 hover:underline"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Verify
                            </button>
                          )}
                          {d.dataUrl && (
                            <a href={d.dataUrl} download={d.fileName} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-blue-800 hover:underline">
                              <Download className="w-4 h-4" />
                              Download
                            </a>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => deleteInstDoc(institution!.id, 'documents', d.id)}
                              className="p-1.5 text-slate-400 hover:text-red-700 rounded-[8px] hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Modal open={docOpen} onClose={() => setDocOpen(false)} title="Upload Document" size="md">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!institution || !userAccount || !docTitle.trim() || !docFile) {
                pushToast('error', 'Title and file selection are required.');
                return;
              }
              setSaving(true);
              try {
                const ownerId = docOwnerType === 'institution' ? institution.id : docOwnerId || userAccount.uid;
                const ownerName =
                  docOwnerType === 'institution'
                    ? institution.name
                    : docOwnerType === 'student'
                      ? (() => {
                          const s = students.find((x) => x.id === ownerId);
                          return s ? `${s.firstName} ${s.lastName}` : ownerId;
                        })()
                      : (() => {
                          const emp = employees.find((x) => x.id === ownerId);
                          return emp ? `${emp.firstName} ${emp.lastName}` : ownerId;
                        })();
                const id = generateId('doc');
                await saveInstDoc(
                  institution.id,
                  'documents',
                  id,
                  {
                    institutionId: institution.id,
                    ownerType: docOwnerType,
                    ownerId,
                    ownerName,
                    documentType: docType,
                    title: docTitle.trim(),
                    fileName: docFile.name,
                    mimeType: docFile.mime,
                    sizeBytes: docFile.size,
                    dataUrl: docFile.url,
                    verified: isStaff,
                    uploadedByUid: userAccount.uid,
                    createdAt: nowIso(),
                  },
                  true,
                );
                await writeAuditLog(institution.id, {
                  userUid: userAccount.uid,
                  userRole: member?.role,
                  action: 'upload',
                  module: 'documents',
                  recordId: id,
                  summary: `Uploaded document "${docTitle.trim()}" for ${ownerName}`,
                });
                pushToast('success', 'Document uploaded.');
                setDocOpen(false);
              } catch (err) {
                pushToast('error', formatUserFriendlyError(err, 'Failed to upload document.'));
              } finally {
                setSaving(false);
              }
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Owner Type">
                <select value={docOwnerType} onChange={(e) => { setDocOwnerType(e.target.value as DocumentRecord['ownerType']); setDocOwnerId(''); }} className="ec-select">
                  <option value="student">Student</option>
                  <option value="employee">Employee</option>
                  <option value="institution">Institution</option>
                </select>
              </FormField>
              <FormField label="Document Type">
                <select value={docType} onChange={(e) => setDocType(e.target.value)} className="ec-select">
                  {docTypes.map((dt) => (
                    <option key={dt} value={dt}>{dt}</option>
                  ))}
                </select>
              </FormField>
            </div>
            {docOwnerType !== 'institution' && (
              <FormField label={`Select ${docOwnerType}`} required>
                <select required value={docOwnerId} onChange={(e) => setDocOwnerId(e.target.value)} className="ec-select">
                  <option value="">Select...</option>
                  {(docOwnerType === 'student' ? students : employees).map((p) => (
                    <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label="Title" required>
              <input required value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="ec-input" />
            </FormField>
            <FormField label="File (max 320 KB)" required>
              <input
                type="file"
                required
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const url = await fileToConstrainedDataUrl(f, 320 * 1024);
                    setDocFile({ name: f.name, mime: f.type, size: f.size, url });
                  } catch (err) {
                    pushToast('error', formatUserFriendlyError(err, 'File exceeds 320 KB limit.'));
                  }
                }}
                className="w-full text-[13.5px] text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-[8px] file:border file:border-slate-300 file:text-[13px] file:font-medium file:bg-white file:text-slate-700 hover:file:bg-slate-50"
              />
            </FormField>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setDocOpen(false)} className="ec-btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="ec-btn-primary">Upload</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ===================== VIEW: NOTICES =====================
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Megaphone}
        title="Notice Board"
        subtitle="Publish institutional circulars, announcements, and targeted notices."
        actions={
          canCreate &&
          isAdminMgr && (
            <button
              type="button"
              onClick={() => {
                setNoticeForm({ targetAudience: 'all', status: 'published', publishDate: todayDateStr() });
                setNoticeOpen(true);
              }}
              className="ec-btn-primary"
            >
              <Plus className="w-4 h-4" />
              Publish Notice
            </button>
          )
        }
      />

      {notices.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No notices published"
          description="Create announcements for all campus members, faculty, students, parents, or specific classes."
          actionLabel={canCreate && isAdminMgr ? 'Publish Notice' : undefined}
          onAction={canCreate && isAdminMgr ? () => setNoticeOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {notices.map((n) => (
            <div key={n.id} className="ec-card border-t-2 border-t-blue-700 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-[17px] font-semibold text-slate-900">{n.title}</h3>
                    <StatusBadge status={n.status} />
                  </div>
                  <div className="text-[13.5px] text-slate-500 mt-1 capitalize">
                    Audience: {n.targetAudience} · Published {formatDate(n.publishDate || n.createdAt)} · By {n.authorName || 'Administration'}
                  </div>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => deleteInstDoc(institution!.id, 'notices', n.id)}
                    className="p-2 text-slate-400 hover:text-red-700 rounded-[8px] hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-[14.5px] text-slate-700 mt-3.5 whitespace-pre-wrap leading-relaxed">{n.content}</p>
            </div>
          ))}
        </div>
      )}

      <Modal open={noticeOpen} onClose={() => setNoticeOpen(false)} title="Create Notice" size="md">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!institution || !userAccount || !noticeForm.title?.trim() || !noticeForm.content?.trim()) return;
            setSaving(true);
            try {
              const ts = nowIso();
              const id = generateId('ntc');
              await saveInstDoc(
                institution.id,
                'notices',
                id,
                {
                  institutionId: institution.id,
                  title: noticeForm.title.trim(),
                  content: noticeForm.content.trim(),
                  targetAudience: noticeForm.targetAudience || 'all',
                  targetId: noticeForm.targetId || undefined,
                  publishDate: noticeForm.publishDate || todayDateStr(),
                  expiryDate: noticeForm.expiryDate || undefined,
                  status: noticeForm.status || 'published',
                  authorUid: userAccount.uid,
                  authorName: userAccount.displayName,
                  createdAt: ts,
                  updatedAt: ts,
                },
                true,
              );
              await writeAuditLog(institution.id, {
                userUid: userAccount.uid,
                userRole: member?.role,
                action: 'create',
                module: 'notices',
                recordId: id,
                summary: `Published notice "${noticeForm.title.trim()}"`,
              });
              pushToast('success', 'Notice saved.');
              setNoticeOpen(false);
            } catch (err) {
              pushToast('error', formatUserFriendlyError(err, 'Failed to publish notice.'));
            } finally {
              setSaving(false);
            }
          }}
          className="space-y-4"
        >
          <FormField label="Title" required>
            <input required value={noticeForm.title || ''} onChange={(e) => setNoticeForm((p) => ({ ...p, title: e.target.value }))} className="ec-input" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Target Audience">
              <select value={noticeForm.targetAudience || 'all'} onChange={(e) => setNoticeForm((p) => ({ ...p, targetAudience: e.target.value as Notice['targetAudience'], targetId: '' }))} className="ec-select">
                <option value="all">All Users</option>
                <option value="faculty">Faculty Only</option>
                <option value="staff">Staff Only</option>
                <option value="students">Students Only</option>
                <option value="parents">Parents Only</option>
                <option value="department">Specific Department</option>
                <option value="class">Specific Class</option>
              </select>
            </FormField>
            <FormField label="Status">
              <select value={noticeForm.status || 'published'} onChange={(e) => setNoticeForm((p) => ({ ...p, status: e.target.value as Notice['status'] }))} className="ec-select">
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </FormField>
          </div>
          {(noticeForm.targetAudience === 'class' || noticeForm.targetAudience === 'department') && (
            <FormField label={`Target ${noticeForm.targetAudience}`}>
              <select value={noticeForm.targetId || ''} onChange={(e) => setNoticeForm((p) => ({ ...p, targetId: e.target.value }))} className="ec-select">
                <option value="">Select...</option>
                {(noticeForm.targetAudience === 'class' ? classes : departments).map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Message Content" required>
            <textarea required rows={4} value={noticeForm.content || ''} onChange={(e) => setNoticeForm((p) => ({ ...p, content: e.target.value }))} className="ec-textarea" />
          </FormField>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setNoticeOpen(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Save Notice</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
