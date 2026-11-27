import React, { useEffect, useMemo, useState } from 'react';
import { BedDouble, BookOpen, Building2, Bus, Home, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  deleteInstDoc,
  issueLibraryBookAtomic,
  returnLibraryBookAtomic,
  saveInstDoc,
  subscribeInstCollection,
  writeAuditLog,
} from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import { formatCurrency, formatDate, generateId, nowIso, todayDateStr } from '../utils/format';
import { exportToCsv } from '../utils/csv';
import {
  DataTable,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  Tabs,
} from '../components/ui/Primitives';
import type { Hostel, HostelAllocation, LibraryBook, LibraryTransaction, TransportRoute } from '../types';

export function CampusServicesModule() {
  const {
    institution,
    member,
    userAccount,
    activeModule,
    can,
    pushToast,
    students,
    employees,
    libraryBooks,
    libraryTransactions,
    dataLoading,
  } = useApp();

  const isTransport = activeModule === 'transport';
  const isHostel = activeModule === 'hostel';
  const canCreate = can(activeModule, 'create');
  const canEdit = can(activeModule, 'edit');
  const canDelete = can(activeModule, 'delete');
  const canExport = can(activeModule, 'export');
  const isLibStaff = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'librarian'].includes(
    member?.role || '',
  );

  // Subscribe to transport & hostel collections when active
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [allocations, setAllocations] = useState<HostelAllocation[]>([]);
  const [hostelLoading, setHostelLoading] = useState(false);

  useEffect(() => {
    if (!institution?.id) return;
    if (isTransport) {
      return subscribeInstCollection<TransportRoute>(institution.id, 'transport_routes', [], setRoutes);
    }
    if (isHostel) {
      setHostelLoading(true);
      const u1 = subscribeInstCollection<Hostel>(institution.id, 'hostels', [], setHostels);
      const u2 = subscribeInstCollection<HostelAllocation>(institution.id, 'hostel_allocations', [], (rows) => {
        setAllocations(rows);
        setHostelLoading(false);
      });
      return () => {
        u1();
        u2();
      };
    }
  }, [institution?.id, isTransport, isHostel]);

  const currency = institution?.currency || 'USD';
  const [saving, setSaving] = useState(false);

  // Library modals
  const [libTab, setLibTab] = useState<'catalog' | 'transactions'>('catalog');
  const [bookOpen, setBookOpen] = useState(false);
  const [bookForm, setBookForm] = useState<Partial<LibraryBook>>({ quantity: 1, status: 'available' });
  const [issueBookTarget, setIssueBookTarget] = useState<LibraryBook | null>(null);
  const [borrowerType, setBorrowerType] = useState<'student' | 'employee'>('student');
  const [borrowerId, setBorrowerId] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [returnTarget, setReturnTarget] = useState<LibraryTransaction | null>(null);
  const [returnStatus, setReturnStatus] = useState<'returned' | 'lost' | 'damaged'>('returned');
  const [returnFine, setReturnFine] = useState('0');

  // Transport modals
  const [routeOpen, setRouteOpen] = useState(false);
  const [routeForm, setRouteForm] = useState<Partial<TransportRoute>>({ capacity: 40, status: 'active', stops: [] });
  const [assignRoute, setAssignRoute] = useState<TransportRoute | null>(null);
  const [assignStuId, setAssignStuId] = useState('');

  // Hostel modals
  const [hostelOpen, setHostelOpen] = useState(false);
  const [hostelForm, setHostelForm] = useState<Partial<Hostel>>({ totalRooms: 10, totalBeds: 20, status: 'active' });
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocForm, setAllocForm] = useState<Partial<HostelAllocation>>({ checkInDate: todayDateStr() });

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  // ===================== LIBRARY HANDLERS =====================
  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !bookForm.title?.trim() || !bookForm.author?.trim()) return;
    setSaving(true);
    try {
      const ts = nowIso();
      const id = generateId('book');
      const qty = Math.max(0, Number(bookForm.quantity || 1));
      const payload: Omit<LibraryBook, 'id'> = {
        institutionId: institution.id,
        isbn: bookForm.isbn?.trim() || undefined,
        title: bookForm.title.trim(),
        author: bookForm.author.trim(),
        publisher: bookForm.publisher?.trim() || undefined,
        category: bookForm.category?.trim() || undefined,
        edition: bookForm.edition?.trim() || undefined,
        quantity: qty,
        availableQuantity: qty,
        shelfLocation: bookForm.shelfLocation?.trim() || undefined,
        status: qty > 0 ? 'available' : 'out_of_stock',
        createdAt: ts,
        updatedAt: ts,
      };
      await saveInstDoc(institution.id, 'library_books', id, payload, true);
      pushToast('success', 'Book added to catalog.');
      setBookOpen(false);
      setBookForm({ quantity: 1, status: 'available' });
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to add book.'));
    } finally {
      setSaving(false);
    }
  };

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !issueBookTarget || !borrowerId) return;
    const person =
      borrowerType === 'student'
        ? students.find((s) => s.id === borrowerId)
        : employees.find((emp) => emp.id === borrowerId);
    if (!person) return;

    const isReserve = issueBookTarget.availableQuantity <= 0;
    setSaving(true);
    try {
      await issueLibraryBookAtomic({
        instId: institution.id,
        book: issueBookTarget,
        txData: {
          bookId: issueBookTarget.id,
          bookTitle: issueBookTarget.title,
          borrowerType,
          borrowerId: person.id,
          borrowerName: `${person.firstName} ${person.lastName}`,
          borrowerUid: person.userUid || undefined,
          issueDate: todayDateStr(),
          dueDate,
          status: isReserve ? 'reserved' : 'issued',
          renewCount: 0,
          issuedByUid: userAccount.uid,
        },
      });
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: isReserve ? 'reserve_book' : 'issue_book',
        module: 'library',
        summary: `${isReserve ? 'Reserved' : 'Issued'} "${issueBookTarget.title}" to ${person.firstName} ${person.lastName}`,
      });
      pushToast('success', isReserve ? 'Book reserved.' : 'Book issued.');
      setIssueBookTarget(null);
      setBorrowerId('');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to issue book.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReturnBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !returnTarget) return;
    setSaving(true);
    try {
      const book = libraryBooks.find((b) => b.id === returnTarget.bookId);
      await returnLibraryBookAtomic({
        instId: institution.id,
        tx: returnTarget,
        book,
        nextStatus: returnStatus,
        fineAmount: Math.max(0, Number(returnFine || 0)),
      });
      pushToast('success', `Book marked as ${returnStatus}.`);
      setReturnTarget(null);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to process return.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRenewTx = async (tx: LibraryTransaction) => {
    if (!institution) return;
    const d = new Date(tx.dueDate);
    d.setDate(d.getDate() + 7);
    await saveInstDoc(
      institution.id,
      'library_transactions',
      tx.id,
      {
        ...tx,
        dueDate: d.toISOString().slice(0, 10),
        renewCount: (tx.renewCount || 0) + 1,
        updatedAt: nowIso(),
      },
      false,
    );
    pushToast('success', 'Renewed due date by 7 days.');
  };

  // ===================== VIEW: TRANSPORT =====================
  if (isTransport) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={Bus}
          title="Transport & Vehicles"
          subtitle="Manage buses, routes, pickup/drop stops, vehicle capacity, and student assignments."
          actions={
            canCreate && (
              <button
                type="button"
                onClick={() => {
                  setRouteForm({ capacity: 40, status: 'active', stops: [] });
                  setRouteOpen(true);
                }}
                className="ec-btn-primary"
              >
                <Plus className="w-4 h-4" />
                Add Route / Vehicle
              </button>
            )
          }
        />

        {routes.length === 0 ? (
          <EmptyState
            icon={Bus}
            title="No transport routes configured"
            description="Create routes with vehicle details, driver contacts, stops, and student assignments."
            actionLabel={canCreate ? 'Add Route / Vehicle' : undefined}
            onAction={canCreate ? () => setRouteOpen(true) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {routes.map((r) => {
              const assignedCount = r.assignedStudentIds?.length || 0;
              return (
                <div key={r.id} className="ec-card border-t-2 border-t-orange-600 p-5 sm:p-6 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[17px] font-semibold text-slate-900">{r.routeName}</h3>
                      <div className="text-[13.5px] text-slate-500 mt-1">
                        Vehicle: <span className="font-mono font-medium text-slate-700">{r.vehicleNumber}</span> · Driver: {r.driverName || '—'} ({r.driverPhone || '—'})
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-[14px] text-slate-600 flex flex-wrap gap-5">
                    <span>Capacity: <strong className="font-mono text-slate-900">{assignedCount} / {r.capacity}</strong></span>
                    {r.monthlyFee !== undefined && (
                      <span>Monthly Fee: <strong className="font-mono text-slate-900">{formatCurrency(r.monthlyFee, currency)}</strong></span>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setAssignRoute(r)}
                        className="text-[13.5px] font-semibold text-blue-800 hover:underline"
                      >
                        Manage Assigned Students ({assignedCount})
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deleteInstDoc(institution!.id, 'transport_routes', r.id)}
                          className="p-1.5 text-slate-400 hover:text-red-700 rounded-[8px] hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Modal open={routeOpen} onClose={() => setRouteOpen(false)} title="Add Transport Route & Vehicle" size="md">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!institution || !routeForm.routeName?.trim() || !routeForm.vehicleNumber?.trim()) return;
              const ts = nowIso();
              const id = generateId('rte');
              await saveInstDoc(
                institution.id,
                'transport_routes',
                id,
                {
                  institutionId: institution.id,
                  routeName: routeForm.routeName.trim(),
                  vehicleNumber: routeForm.vehicleNumber.trim(),
                  vehicleType: routeForm.vehicleType || 'Bus',
                  capacity: Number(routeForm.capacity || 40),
                  driverName: routeForm.driverName?.trim() || undefined,
                  driverPhone: routeForm.driverPhone?.trim() || undefined,
                  monthlyFee: routeForm.monthlyFee ? Number(routeForm.monthlyFee) : undefined,
                  assignedStudentIds: [],
                  status: 'active',
                  createdAt: ts,
                  updatedAt: ts,
                },
                true,
              );
              pushToast('success', 'Route created.');
              setRouteOpen(false);
            }}
            className="space-y-4"
          >
            <FormField label="Route Name" required>
              <input required value={routeForm.routeName || ''} onChange={(e) => setRouteForm((p) => ({ ...p, routeName: e.target.value }))} className="ec-input" />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Vehicle Number" required>
                <input required value={routeForm.vehicleNumber || ''} onChange={(e) => setRouteForm((p) => ({ ...p, vehicleNumber: e.target.value }))} className="ec-input font-mono" />
              </FormField>
              <FormField label="Capacity" required>
                <input type="number" required min={1} value={routeForm.capacity ?? 40} onChange={(e) => setRouteForm((p) => ({ ...p, capacity: Number(e.target.value) }))} className="ec-input" />
              </FormField>
              <FormField label="Driver Name">
                <input value={routeForm.driverName || ''} onChange={(e) => setRouteForm((p) => ({ ...p, driverName: e.target.value }))} className="ec-input" />
              </FormField>
              <FormField label="Driver Phone">
                <input value={routeForm.driverPhone || ''} onChange={(e) => setRouteForm((p) => ({ ...p, driverPhone: e.target.value }))} className="ec-input" />
              </FormField>
            </div>
            <FormField label={`Monthly Fee (${currency})`}>
              <input type="number" min={0} step="0.01" value={routeForm.monthlyFee ?? ''} onChange={(e) => setRouteForm((p) => ({ ...p, monthlyFee: e.target.value ? Number(e.target.value) : undefined }))} className="ec-input font-mono" />
            </FormField>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setRouteOpen(false)} className="ec-btn-secondary">Cancel</button>
              <button type="submit" className="ec-btn-primary">Save Route</button>
            </div>
          </form>
        </Modal>

        <Modal open={Boolean(assignRoute)} onClose={() => setAssignRoute(null)} title={`Passengers · ${assignRoute?.routeName || ''}`} size="md">
          {assignRoute && (
            <div className="space-y-4">
              <div className="flex gap-2.5">
                <select value={assignStuId} onChange={(e) => setAssignStuId(e.target.value)} className="ec-select flex-1">
                  <option value="">Select Student to Assign...</option>
                  {students
                    .filter((s) => !assignRoute.assignedStudentIds?.includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.studentCode} · {s.firstName} {s.lastName}</option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!assignStuId}
                  onClick={async () => {
                    if (!institution || !assignStuId) return;
                    if ((assignRoute.assignedStudentIds?.length || 0) >= assignRoute.capacity) {
                      pushToast('error', 'Vehicle capacity reached.');
                      return;
                    }
                    const nextIds = [...(assignRoute.assignedStudentIds || []), assignStuId];
                    await saveInstDoc(institution.id, 'transport_routes', assignRoute.id, { ...assignRoute, assignedStudentIds: nextIds, updatedAt: nowIso() }, false);
                    setAssignRoute({ ...assignRoute, assignedStudentIds: nextIds });
                    setAssignStuId('');
                    pushToast('success', 'Student assigned to route.');
                  }}
                  className="ec-btn-primary"
                >
                  Assign
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(assignRoute.assignedStudentIds || []).length === 0 ? (
                  <p className="text-[14px] text-slate-500">No students assigned to this route yet.</p>
                ) : (
                  (assignRoute.assignedStudentIds || []).map((sid) => {
                    const st = studentMap.get(sid);
                    return (
                      <div key={sid} className="flex items-center justify-between p-3 border border-slate-200 rounded-[10px] text-[14.5px]">
                        <span className="font-medium text-slate-900">{st ? `${st.firstName} ${st.lastName} (${st.studentCode})` : sid}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!institution) return;
                            const nextIds = (assignRoute.assignedStudentIds || []).filter((id) => id !== sid);
                            await saveInstDoc(institution.id, 'transport_routes', assignRoute.id, { ...assignRoute, assignedStudentIds: nextIds, updatedAt: nowIso() }, false);
                            setAssignRoute({ ...assignRoute, assignedStudentIds: nextIds });
                          }}
                          className="text-[13.5px] font-medium text-red-700 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // ===================== VIEW: HOSTEL =====================
  if (isHostel) {
    const occupiedCount = allocations.filter((a) => a.status === 'occupied').length;
    const totalBeds = hostels.reduce((s, h) => s + h.totalBeds, 0);

    return (
      <div className="space-y-6">
        <PageHeader
          icon={Home}
          title="Hostel & Accommodation"
          subtitle="Manage residential buildings, room & bed capacity, student allocations, and check-ins."
          actions={
            canCreate && (
              <>
                <button
                  type="button"
                  onClick={() => setHostelOpen(true)}
                  className="ec-btn-secondary"
                >
                  + Add Hostel
                </button>
                <button
                  type="button"
                  onClick={() => setAllocOpen(true)}
                  className="ec-btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Allocate Bed
                </button>
              </>
            )
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard label="Hostels" value={hostels.length} icon={Building2} accent="purple" />
          <StatCard label="Occupied Beds" value={occupiedCount} icon={BedDouble} accent="indigo" />
          <StatCard label="Vacant Beds" value={Math.max(0, totalBeds - occupiedCount)} icon={Home} accent="emerald" />
        </div>

        {hostels.length === 0 ? (
          <EmptyState
            icon={Home}
            title="No hostels configured"
            description="Create hostel buildings with room/bed counts, then allocate beds to students."
            actionLabel={canCreate ? 'Add Hostel' : undefined}
            onAction={canCreate ? () => setHostelOpen(true) : undefined}
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {hostels.map((h) => {
                const occ = allocations.filter((a) => a.hostelId === h.id && a.status === 'occupied').length;
                return (
                  <div key={h.id} className="ec-card border-t-2 border-t-purple-600 p-5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-[16px] font-semibold text-slate-900">{h.name}</h3>
                        <div className="text-[13.5px] text-slate-500 mt-0.5">Warden: {h.wardenName || '—'}</div>
                      </div>
                      <StatusBadge status={h.status} />
                    </div>
                    <div className="text-[14px] text-slate-600 pt-1">
                      Occupancy: <span className="font-mono font-semibold text-slate-900">{occ} / {h.totalBeds} beds</span> · {h.totalRooms} rooms
                    </div>
                  </div>
                );
              })}
            </div>

            <DataTable
              rows={allocations}
              loading={hostelLoading}
              columns={[
                { key: 'stu', header: 'Student', render: (a) => <span className="font-medium text-slate-900">{a.studentName || a.studentId}</span> },
                { key: 'hostel', header: 'Hostel', render: (a) => a.hostelName || a.hostelId },
                { key: 'room', header: 'Room / Bed', render: (a) => `Room ${a.roomNumber} · Bed ${a.bedNumber}` },
                { key: 'in', header: 'Check-In', render: (a) => formatDate(a.checkInDate) },
                { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
                {
                  key: 'actions',
                  header: 'Action',
                  align: 'right',
                  render: (a) =>
                    canEdit && a.status === 'occupied' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!institution) return;
                          await saveInstDoc(
                            institution.id,
                            'hostel_allocations',
                            a.id,
                            { ...a, status: 'checked_out', checkOutDate: todayDateStr(), updatedAt: nowIso() },
                            false,
                          );
                          pushToast('success', 'Student checked out.');
                        }}
                        className="text-[13.5px] font-semibold text-blue-800 hover:underline"
                      >
                        Check Out
                      </button>
                    ) : (
                      <span className="text-[13px] text-slate-400">—</span>
                    ),
                },
              ]}
              emptyState={<EmptyState icon={Home} title="No bed allocations yet" description="Allocate a hostel bed to a student." />}
            />
          </div>
        )}

        <Modal open={hostelOpen} onClose={() => setHostelOpen(false)} title="Add Hostel Building" size="md">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!institution || !hostelForm.name?.trim()) return;
              const ts = nowIso();
              const id = generateId('hos');
              await saveInstDoc(
                institution.id,
                'hostels',
                id,
                {
                  institutionId: institution.id,
                  name: hostelForm.name.trim(),
                  wardenName: hostelForm.wardenName?.trim() || undefined,
                  wardenPhone: hostelForm.wardenPhone?.trim() || undefined,
                  totalRooms: Number(hostelForm.totalRooms || 0),
                  totalBeds: Number(hostelForm.totalBeds || 0),
                  monthlyFee: hostelForm.monthlyFee ? Number(hostelForm.monthlyFee) : undefined,
                  status: 'active',
                  createdAt: ts,
                  updatedAt: ts,
                },
                true,
              );
              pushToast('success', 'Hostel created.');
              setHostelOpen(false);
            }}
            className="space-y-4"
          >
            <FormField label="Hostel Name" required>
              <input required value={hostelForm.name || ''} onChange={(e) => setHostelForm((p) => ({ ...p, name: e.target.value }))} className="ec-input" />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Total Rooms" required>
                <input type="number" required min={1} value={hostelForm.totalRooms ?? 10} onChange={(e) => setHostelForm((p) => ({ ...p, totalRooms: Number(e.target.value) }))} className="ec-input" />
              </FormField>
              <FormField label="Total Beds" required>
                <input type="number" required min={1} value={hostelForm.totalBeds ?? 20} onChange={(e) => setHostelForm((p) => ({ ...p, totalBeds: Number(e.target.value) }))} className="ec-input" />
              </FormField>
              <FormField label="Warden Name">
                <input value={hostelForm.wardenName || ''} onChange={(e) => setHostelForm((p) => ({ ...p, wardenName: e.target.value }))} className="ec-input" />
              </FormField>
              <FormField label="Warden Phone">
                <input value={hostelForm.wardenPhone || ''} onChange={(e) => setHostelForm((p) => ({ ...p, wardenPhone: e.target.value }))} className="ec-input" />
              </FormField>
            </div>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setHostelOpen(false)} className="ec-btn-secondary">Cancel</button>
              <button type="submit" className="ec-btn-primary">Save Hostel</button>
            </div>
          </form>
        </Modal>

        <Modal open={allocOpen} onClose={() => setAllocOpen(false)} title="Allocate Hostel Bed" size="md">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!institution || !allocForm.hostelId || !allocForm.studentId || !allocForm.roomNumber || !allocForm.bedNumber) return;
              const h = hostels.find((x) => x.id === allocForm.hostelId);
              const stu = studentMap.get(allocForm.studentId);
              const ts = nowIso();
              const id = generateId('hal');
              await saveInstDoc(
                institution.id,
                'hostel_allocations',
                id,
                {
                  institutionId: institution.id,
                  hostelId: allocForm.hostelId,
                  hostelName: h?.name,
                  roomNumber: allocForm.roomNumber,
                  bedNumber: allocForm.bedNumber,
                  studentId: allocForm.studentId,
                  studentName: stu ? `${stu.firstName} ${stu.lastName}` : allocForm.studentId,
                  checkInDate: allocForm.checkInDate || todayDateStr(),
                  status: 'occupied',
                  createdAt: ts,
                  updatedAt: ts,
                },
                true,
              );
              pushToast('success', 'Bed allocated.');
              setAllocOpen(false);
            }}
            className="space-y-4"
          >
            <FormField label="Hostel" required>
              <select required value={allocForm.hostelId || ''} onChange={(e) => setAllocForm((p) => ({ ...p, hostelId: e.target.value }))} className="ec-select">
                <option value="">Select Hostel</option>
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Student" required>
              <select required value={allocForm.studentId || ''} onChange={(e) => setAllocForm((p) => ({ ...p, studentId: e.target.value }))} className="ec-select">
                <option value="">Select Student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.studentCode} · {s.firstName} {s.lastName}</option>
                ))}
              </select>
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Room Number" required>
                <input required value={allocForm.roomNumber || ''} onChange={(e) => setAllocForm((p) => ({ ...p, roomNumber: e.target.value }))} className="ec-input" />
              </FormField>
              <FormField label="Bed Number" required>
                <input required value={allocForm.bedNumber || ''} onChange={(e) => setAllocForm((p) => ({ ...p, bedNumber: e.target.value }))} className="ec-input" />
              </FormField>
            </div>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setAllocOpen(false)} className="ec-btn-secondary">Cancel</button>
              <button type="submit" className="ec-btn-primary">Allocate</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ===================== VIEW: LIBRARY =====================
  return (
    <div className="space-y-6">
      <PageHeader
        icon={BookOpen}
        title="Library Management"
        subtitle="Manage book catalog, issue/return/renew/reserve workflows, and overdue fines."
        actions={
          isLibStaff &&
          canCreate && (
            <button
              type="button"
              onClick={() => setBookOpen(true)}
              className="ec-btn-primary"
            >
              <Plus className="w-4 h-4" />
              Add Book
            </button>
          )
        }
      />

      <Tabs
        value={libTab}
        onChange={setLibTab}
        items={[
          { key: 'catalog', label: 'Book Catalog', count: libraryBooks.length },
          { key: 'transactions', label: 'Issued & Transactions', count: libraryTransactions.length },
        ]}
      />

      {libTab === 'catalog' ? (
        <DataTable
          rows={libraryBooks}
          loading={dataLoading}
          searchPlaceholder="Search by title, author, ISBN, category..."
          searchFilter={(b, q) =>
            `${b.title} ${b.author} ${b.isbn || ''} ${b.category || ''}`.toLowerCase().includes(q)
          }
          onExport={
            canExport
              ? (rows) =>
                  exportToCsv(
                    'library_catalog',
                    ['ISBN', 'Title', 'Author', 'Category', 'Total', 'Available', 'Shelf', 'Status'],
                    rows.map((b) => [b.isbn || '', b.title, b.author, b.category || '', b.quantity, b.availableQuantity, b.shelfLocation || '', b.status]),
                  )
              : undefined
          }
          columns={[
            {
              key: 'title',
              header: 'Book Title',
              sortValue: (b) => b.title,
              render: (b) => (
                <div>
                  <div className="font-medium text-slate-900">{b.title}</div>
                  <div className="text-[13px] text-slate-500">{b.author}</div>
                </div>
              ),
            },
            { key: 'isbn', header: 'ISBN', render: (b) => <span className="font-mono text-[13px]">{b.isbn || '—'}</span> },
            { key: 'cat', header: 'Category', render: (b) => b.category || '—' },
            { key: 'avail', header: 'Available / Total', align: 'right', render: (b) => <span className="font-mono tabular-nums">{b.availableQuantity} / {b.quantity}</span> },
            { key: 'status', header: 'Status', render: (b) => <StatusBadge status={b.status} /> },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (b) =>
                isLibStaff ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIssueBookTarget(b);
                      setBorrowerId('');
                    }}
                    className="px-3 py-1.5 text-[13px] font-medium text-blue-800 bg-blue-50 border border-blue-200 rounded-[8px] hover:bg-blue-100 transition-colors"
                  >
                    {b.availableQuantity > 0 ? 'Issue' : 'Reserve'}
                  </button>
                ) : (
                  <span className="text-[13px] text-slate-400">—</span>
                ),
            },
          ]}
          emptyState={
            <EmptyState
              icon={BookOpen}
              title="No books in library catalog"
              description="Add books with ISBN, quantity, and shelf location to start issuing to students and faculty."
              actionLabel={isLibStaff && canCreate ? 'Add Book' : undefined}
              onAction={isLibStaff && canCreate ? () => setBookOpen(true) : undefined}
            />
          }
        />
      ) : (
        <DataTable
          rows={libraryTransactions}
          loading={dataLoading}
          searchPlaceholder="Search transactions by book, borrower..."
          searchFilter={(t, q) => `${t.bookTitle || ''} ${t.borrowerName || ''} ${t.status}`.toLowerCase().includes(q)}
          columns={[
            { key: 'book', header: 'Book', render: (t) => <span className="font-medium text-slate-900">{t.bookTitle || t.bookId}</span> },
            {
              key: 'borrower',
              header: 'Borrower',
              render: (t) => (
                <div>
                  <div className="font-medium text-slate-900">{t.borrowerName || t.borrowerId}</div>
                  <div className="text-[13px] text-slate-500 capitalize">{t.borrowerType}</div>
                </div>
              ),
            },
            { key: 'issued', header: 'Issued / Due', render: (t) => <span className="text-[13.5px]">{formatDate(t.issueDate)} → {formatDate(t.dueDate)}</span> },
            { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} /> },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (t) =>
                isLibStaff && (t.status === 'issued' || t.status === 'reserved') ? (
                  <div className="inline-flex items-center gap-2">
                    {t.status === 'issued' && (
                      <button
                        type="button"
                        onClick={() => handleRenewTx(t)}
                        className="ec-btn-secondary !py-1.5 !px-3 !text-[13px]"
                      >
                        Renew
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setReturnTarget(t);
                        setReturnStatus('returned');
                        setReturnFine('0');
                      }}
                      className="ec-btn-primary !py-1.5 !px-3 !text-[13px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Return
                    </button>
                  </div>
                ) : (
                  <span className="text-[13.5px] text-slate-500">{t.fineAmount ? `Fine: ${formatCurrency(t.fineAmount, currency)}` : '—'}</span>
                ),
            },
          ]}
          emptyState={<EmptyState icon={BookOpen} title="No library transactions" description="Issued and returned book logs appear here." />}
        />
      )}

      {/* Add Book Modal */}
      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title="Add Book to Catalog" size="md">
        <form onSubmit={handleSaveBook} className="space-y-4">
          <FormField label="Book Title" required>
            <input required value={bookForm.title || ''} onChange={(e) => setBookForm((p) => ({ ...p, title: e.target.value }))} className="ec-input" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Author" required>
              <input required value={bookForm.author || ''} onChange={(e) => setBookForm((p) => ({ ...p, author: e.target.value }))} className="ec-input" />
            </FormField>
            <FormField label="ISBN">
              <input value={bookForm.isbn || ''} onChange={(e) => setBookForm((p) => ({ ...p, isbn: e.target.value }))} className="ec-input font-mono" />
            </FormField>
            <FormField label="Category">
              <input value={bookForm.category || ''} onChange={(e) => setBookForm((p) => ({ ...p, category: e.target.value }))} className="ec-input" />
            </FormField>
            <FormField label="Quantity" required>
              <input type="number" required min={1} value={bookForm.quantity ?? 1} onChange={(e) => setBookForm((p) => ({ ...p, quantity: Number(e.target.value) }))} className="ec-input" />
            </FormField>
            <FormField label="Shelf Location">
              <input value={bookForm.shelfLocation || ''} onChange={(e) => setBookForm((p) => ({ ...p, shelfLocation: e.target.value }))} className="ec-input" />
            </FormField>
            <FormField label="Publisher">
              <input value={bookForm.publisher || ''} onChange={(e) => setBookForm((p) => ({ ...p, publisher: e.target.value }))} className="ec-input" />
            </FormField>
          </div>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setBookOpen(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Save Book</button>
          </div>
        </form>
      </Modal>

      {/* Issue Book Modal */}
      <Modal
        open={Boolean(issueBookTarget)}
        onClose={() => setIssueBookTarget(null)}
        title={issueBookTarget && issueBookTarget.availableQuantity > 0 ? `Issue: ${issueBookTarget.title}` : `Reserve: ${issueBookTarget?.title || ''}`}
        size="md"
      >
        <form onSubmit={handleIssueBook} className="space-y-4">
          <Tabs
            value={borrowerType}
            onChange={(t) => {
              setBorrowerType(t);
              setBorrowerId('');
            }}
            items={[
              { key: 'student', label: 'Student' },
              { key: 'employee', label: 'Faculty / Staff' },
            ]}
          />
          <FormField label="Borrower" required>
            <select required value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)} className="ec-select">
              <option value="">Select {borrowerType}...</option>
              {(borrowerType === 'student' ? students : employees).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Due Date" required>
            <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="ec-input" />
          </FormField>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setIssueBookTarget(null)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Confirm</button>
          </div>
        </form>
      </Modal>

      {/* Return Book Modal */}
      <Modal open={Boolean(returnTarget)} onClose={() => setReturnTarget(null)} title="Process Book Return" size="sm">
        <form onSubmit={handleReturnBook} className="space-y-4">
          <FormField label="Condition / Status">
            <select value={returnStatus} onChange={(e) => setReturnStatus(e.target.value as 'returned' | 'lost' | 'damaged')} className="ec-select">
              <option value="returned">Returned in Good Condition</option>
              <option value="damaged">Damaged</option>
              <option value="lost">Lost</option>
            </select>
          </FormField>
          <FormField label={`Fine Amount (${currency})`}>
            <input type="number" min={0} step="0.01" value={returnFine} onChange={(e) => setReturnFine(e.target.value)} className="ec-input font-mono" />
          </FormField>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setReturnTarget(null)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Complete Return</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
