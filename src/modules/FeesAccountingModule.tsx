import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  DollarSign,
  FileText,
  Info,
  Landmark,
  Plus,
  Printer,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  createNotificationForUser,
  recordFeePaymentAtomic,
  refundPaymentAtomic,
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
import type { AccountingEntry, FeeCategory, FeeStructure, PaymentRecord, StudentFee } from '../types';

export function FeesAccountingModule() {
  const {
    institution,
    member,
    userAccount,
    activeYearId,
    activeModule,
    can,
    pushToast,
    classes,
    students,
    feeCategories,
    feeStructures,
    studentFees,
    payments,
    dataLoading,
  } = useApp();

  const isAccounting = activeModule === 'accounting';
  const isFinanceStaff = ['super_admin', 'institution_admin', 'principal', 'vice_principal', 'accountant'].includes(
    member?.role || '',
  );
  const canCreate = can(activeModule, 'create');
  const canExport = can(activeModule, 'export');

  const [accountingEntries, setAccountingEntries] = useState<AccountingEntry[]>([]);
  const [acctLoading, setAcctLoading] = useState(false);
  useEffect(() => {
    if (!institution?.id || !isFinanceStaff) {
      setAccountingEntries([]);
      setAcctLoading(false);
      return;
    }
    setAcctLoading(true);
    return subscribeInstCollection<AccountingEntry>(institution.id, 'accounting_entries', [], (rows) => {
      setAccountingEntries(rows);
      setAcctLoading(false);
    });
  }, [institution?.id, isFinanceStaff]);

  const [feeTab, setFeeTab] = useState<'invoices' | 'structures' | 'categories' | 'receipts'>('invoices');
  const [saving, setSaving] = useState(false);

  // Modals
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [structOpen, setStructOpen] = useState(false);
  const [structForm, setStructForm] = useState<Partial<FeeStructure>>({ frequency: 'annual', status: 'active' });

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<'individual' | 'bulk_class'>('individual');
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignStructureId, setAssignStructureId] = useState('');
  const [assignDiscount, setAssignDiscount] = useState('0');
  const [assignDueDate, setAssignDueDate] = useState(todayDateStr());

  const [payTargetFee, setPayTargetFee] = useState<StudentFee | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentRecord['paymentMethod']>('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const [receiptModal, setReceiptModal] = useState<PaymentRecord | null>(null);
  const [refundTarget, setRefundTarget] = useState<PaymentRecord | null>(null);
  const [refundReason, setRefundReason] = useState('');

  // Accounting entry modal
  const [acctOpen, setAcctOpen] = useState(false);
  const [acctType, setAcctType] = useState<'income' | 'expense'>('expense');
  const [acctCategory, setAcctCategory] = useState('Operations');
  const [acctTitle, setAcctTitle] = useState('');
  const [acctAmount, setAcctAmount] = useState('');
  const [acctDate, setAcctDate] = useState(todayDateStr());
  const [acctNotes, setAcctNotes] = useState('');

  const classMap = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);
  const currency = institution?.currency || 'USD';

  // ===================== FEE HANDLERS =====================
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !catName.trim()) return;
    setSaving(true);
    try {
      const ts = nowIso();
      const id = generateId('fcat');
      const payload: Omit<FeeCategory, 'id'> = {
        institutionId: institution.id,
        name: catName.trim(),
        code: catCode.trim() || undefined,
        description: catDesc.trim() || undefined,
        isRecurring: true,
        status: 'active',
        createdAt: ts,
        updatedAt: ts,
      };
      await saveInstDoc(institution.id, 'fee_categories', id, payload, true);
      pushToast('success', 'Fee category added.');
      setCatOpen(false);
      setCatName('');
      setCatCode('');
      setCatDesc('');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to save fee category.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !structForm.name?.trim() || !structForm.categoryId) {
      pushToast('error', 'Structure name and fee category are required.');
      return;
    }
    setSaving(true);
    try {
      const ts = nowIso();
      const id = generateId('fstr');
      const cat = feeCategories.find((c) => c.id === structForm.categoryId);
      const payload: Omit<FeeStructure, 'id'> = {
        institutionId: institution.id,
        academicYearId: activeYearId || undefined,
        name: structForm.name.trim(),
        classId: structForm.classId || undefined,
        categoryId: structForm.categoryId,
        categoryName: cat?.name,
        amount: Number(structForm.amount || 0),
        frequency: structForm.frequency || 'annual',
        dueDate: structForm.dueDate || undefined,
        lateFeePerDay: structForm.lateFeePerDay ? Number(structForm.lateFeePerDay) : undefined,
        status: 'active',
        createdAt: ts,
        updatedAt: ts,
      };
      await saveInstDoc(institution.id, 'fee_structures', id, payload, true);
      pushToast('success', 'Fee structure created.');
      setStructOpen(false);
      setStructForm({ frequency: 'annual', status: 'active' });
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to create fee structure.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAssignFeeInvoices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !assignStructureId) return;
    const structure = feeStructures.find((s) => s.id === assignStructureId);
    if (!structure) return;

    const targetList =
      assignMode === 'individual'
        ? students.filter((s) => s.id === assignStudentId)
        : students.filter((s) => s.status === 'active' && s.classId === assignClassId);

    if (targetList.length === 0) {
      pushToast('error', 'No matching students selected for invoice generation.');
      return;
    }

    const discount = Math.max(0, Number(assignDiscount || 0));
    const balance = Math.max(0, Number((structure.amount - discount).toFixed(2)));
    setSaving(true);
    try {
      const ts = nowIso();
      for (const stu of targetList) {
        const id = generateId('fee');
        const invNum = `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;
        const payload: Omit<StudentFee, 'id'> = {
          institutionId: institution.id,
          invoiceNumber: invNum,
          academicYearId: activeYearId || undefined,
          studentId: stu.id,
          studentName: `${stu.firstName} ${stu.lastName}`,
          studentUserUid: stu.userUid || undefined,
          parentUserUid: stu.parentUid || undefined,
          classId: stu.classId,
          categoryId: structure.categoryId,
          categoryName: structure.categoryName,
          title: structure.name,
          amount: structure.amount,
          discountAmount: discount,
          lateFeeAmount: 0,
          paidAmount: 0,
          balanceAmount: balance,
          dueDate: assignDueDate || structure.dueDate || undefined,
          status: balance === 0 ? 'waived' : 'unpaid',
          createdAt: ts,
          updatedAt: ts,
        };
        await saveInstDoc(institution.id, 'student_fees', id, payload, true);
        if (stu.userUid) {
          await createNotificationForUser(institution.id, {
            recipientUid: stu.userUid,
            type: 'fee_due',
            title: `New Fee Invoice: ${structure.name}`,
            message: `Invoice ${invNum} for ${formatCurrency(balance, currency)} is due ${assignDueDate || 'soon'}.`,
            linkModule: 'fees',
          });
        }
      }
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: 'create',
        module: 'fees',
        summary: `Assigned "${structure.name}" invoices to ${targetList.length} student(s)`,
      });
      pushToast('success', `Generated ${targetList.length} fee invoice(s).`);
      setAssignOpen(false);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to generate fee invoices.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !payTargetFee) return;
    if (payMethod === 'online_gateway' && !institution.feeRules?.onlineGatewayConfigured) {
      pushToast('error', 'Online payment gateway is not configured. Record offline payment or configure gateway in Settings.');
      return;
    }
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      pushToast('error', 'Enter a valid payment amount greater than zero.');
      return;
    }
    if (!institution.feeRules?.allowOverpayment && amt > payTargetFee.balanceAmount) {
      pushToast('error', `Payment exceeds remaining balance (${formatCurrency(payTargetFee.balanceAmount, currency)}).`);
      return;
    }

    setSaving(true);
    try {
      const rec = await recordFeePaymentAtomic({
        instId: institution.id,
        fee: payTargetFee,
        paymentAmount: amt,
        paymentMethod: payMethod,
        transactionRef: payRef,
        notes: payNotes,
        recordedByUid: userAccount.uid,
        recordedByName: userAccount.displayName,
        receiptPrefix: institution.feeRules?.receiptPrefix || 'REC',
      });
      if (payTargetFee.studentUserUid) {
        await createNotificationForUser(institution.id, {
          recipientUid: payTargetFee.studentUserUid,
          type: 'payment',
          title: `Payment Received (${rec.receiptNumber})`,
          message: `Received ${formatCurrency(amt, currency)} for ${payTargetFee.title}.`,
          linkModule: 'fees',
        });
      }
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: 'payment',
        module: 'fees',
        recordId: rec.id,
        summary: `Recorded payment ${rec.receiptNumber} (${formatCurrency(amt, currency)}) for ${payTargetFee.studentName}`,
      });
      pushToast('success', `Payment recorded (${rec.receiptNumber}).`);
      setPayTargetFee(null);
      setReceiptModal(rec);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Payment recording failed.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRefundPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !refundTarget || !refundReason.trim()) return;
    setSaving(true);
    try {
      const fee = studentFees.find((f) => f.id === refundTarget.studentFeeId);
      await refundPaymentAtomic({
        instId: institution.id,
        payment: refundTarget,
        fee,
        reason: refundReason.trim(),
        recordedByUid: userAccount.uid,
        recordedByName: userAccount.displayName,
      });
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: 'refund',
        module: 'fees',
        recordId: refundTarget.id,
        summary: `Refunded ${refundTarget.receiptNumber} (${formatCurrency(refundTarget.amount, currency)}): ${refundReason}`,
      });
      pushToast('success', 'Payment refunded and ledger updated.');
      setRefundTarget(null);
      setRefundReason('');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Refund failed.'));
    } finally {
      setSaving(false);
    }
  };

  // ===================== ACCOUNTING HANDLERS =====================
  const handleSaveAccountingEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution || !userAccount || !acctTitle.trim()) return;
    setSaving(true);
    try {
      const ts = nowIso();
      const id = generateId('acct');
      const payload: Omit<AccountingEntry, 'id'> = {
        institutionId: institution.id,
        academicYearId: activeYearId || undefined,
        entryType: acctType,
        category: acctCategory.trim() || 'General',
        title: acctTitle.trim(),
        amount: Number(acctAmount || 0),
        entryDate: acctDate,
        recordedByUid: userAccount.uid,
        recordedByName: userAccount.displayName,
        notes: acctNotes.trim() || undefined,
        createdAt: ts,
      };
      await saveInstDoc(institution.id, 'accounting_entries', id, payload, true);
      await writeAuditLog(institution.id, {
        userUid: userAccount.uid,
        userRole: member?.role,
        action: 'create',
        module: 'accounting',
        recordId: id,
        summary: `Recorded ${acctType} entry "${payload.title}" (${formatCurrency(payload.amount, currency)})`,
      });
      pushToast('success', 'Accounting entry recorded.');
      setAcctOpen(false);
      setAcctTitle('');
      setAcctAmount('');
      setAcctNotes('');
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Failed to record accounting entry.'));
    } finally {
      setSaving(false);
    }
  };

  // ===================== VIEW: ACCOUNTING =====================
  if (isAccounting) {
    const totalIncome = accountingEntries
      .filter((e) => e.entryType === 'income')
      .reduce((s, e) => s + e.amount, 0);
    const totalExpense = accountingEntries
      .filter((e) => e.entryType === 'expense')
      .reduce((s, e) => s + e.amount, 0);
    const netBalance = totalIncome - totalExpense;

    return (
      <div className="space-y-6">
        <PageHeader
          icon={Landmark}
          title="Accounting & Ledger"
          subtitle="Real-time institutional income, expenses, fee inflows, and printable financial statements."
          actions={
            <>
              <button
                type="button"
                onClick={() => window.print()}
                className="ec-btn-secondary"
              >
                <Printer className="w-4 h-4" />
                Print Summary
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => setAcctOpen(true)}
                  className="ec-btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Record Entry
                </button>
              )}
            </>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard accent="emerald" label="Total Income" value={formatCurrency(totalIncome, currency)} icon={TrendingUp} />
          <StatCard accent="rose" label="Total Expenses" value={formatCurrency(totalExpense, currency)} icon={TrendingDown} />
          <StatCard accent="indigo" label="Net Balance" value={formatCurrency(netBalance, currency)} icon={Landmark} />
        </div>

        <DataTable
          rows={accountingEntries}
          loading={acctLoading}
          searchPlaceholder="Search ledger by title, category, reference..."
          searchFilter={(r, q) =>
            `${r.title} ${r.category} ${r.referenceNumber || ''} ${r.entryType}`.toLowerCase().includes(q)
          }
          onExport={
            canExport
              ? (rows) =>
                  exportToCsv(
                    'accounting_ledger',
                    ['Date', 'Type', 'Category', 'Title', 'Amount', 'Reference', 'Recorded By'],
                    rows.map((r) => [
                      r.entryDate,
                      r.entryType,
                      r.category,
                      r.title,
                      r.amount,
                      r.referenceNumber || '',
                      r.recordedByName || '',
                    ]),
                  )
              : undefined
          }
          columns={[
            { key: 'date', header: 'Date', sortValue: (r) => r.entryDate, render: (r) => formatDate(r.entryDate) },
            {
              key: 'type',
              header: 'Type',
              render: (r) => <StatusBadge status={r.entryType} />,
            },
            { key: 'category', header: 'Category', render: (r) => r.category },
            { key: 'title', header: 'Description', render: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              sortValue: (r) => r.amount,
              render: (r) => (
                <span className={`font-mono font-semibold tabular-nums ${r.entryType === 'income' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {r.entryType === 'income' ? '+' : '-'}
                  {formatCurrency(r.amount, currency)}
                </span>
              ),
            },
          ]}
          emptyState={
            <EmptyState
              icon={Landmark}
              title="No accounting entries recorded yet"
              description="Fee payments automatically post here, or record institutional income and expenses manually."
              actionLabel={canCreate ? 'Record Entry' : undefined}
              onAction={canCreate ? () => setAcctOpen(true) : undefined}
            />
          }
        />

        <Modal open={acctOpen} onClose={() => setAcctOpen(false)} title="Record Financial Entry" size="md">
          <form onSubmit={handleSaveAccountingEntry} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Entry Type">
                <select
                  value={acctType}
                  onChange={(e) => setAcctType(e.target.value as 'income' | 'expense')}
                  className="ec-select"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </FormField>
              <FormField label="Entry Date" required>
                <input
                  type="date"
                  required
                  value={acctDate}
                  onChange={(e) => setAcctDate(e.target.value)}
                  className="ec-input"
                />
              </FormField>
            </div>
            <FormField label="Category" required>
              <input
                required
                value={acctCategory}
                onChange={(e) => setAcctCategory(e.target.value)}
                placeholder="e.g. Utilities, Payroll, Grants"
                className="ec-input"
              />
            </FormField>
            <FormField label="Title / Description" required>
              <input
                required
                value={acctTitle}
                onChange={(e) => setAcctTitle(e.target.value)}
                className="ec-input"
              />
            </FormField>
            <FormField label={`Amount (${currency})`} required>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={acctAmount}
                onChange={(e) => setAcctAmount(e.target.value)}
                className="ec-input font-mono"
              />
            </FormField>
            <FormField label="Notes">
              <textarea
                rows={2}
                value={acctNotes}
                onChange={(e) => setAcctNotes(e.target.value)}
                className="ec-textarea"
              />
            </FormField>
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => setAcctOpen(false)} className="ec-btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="ec-btn-primary">
                Save Entry
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ===================== VIEW: FEES & BILLING =====================
  const totalInvoiced = studentFees.reduce((s, f) => s + f.amount, 0);
  const totalCollected = studentFees.reduce((s, f) => s + f.paidAmount, 0);
  const totalOutstanding = studentFees.reduce((s, f) => s + f.balanceAmount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CreditCard}
        title="Fees & Billing"
        subtitle="Manage fee categories, structures, student invoices, payments, receipts, and refunds."
        actions={
          isFinanceStaff &&
          canCreate && (
            <>
              <button
                type="button"
                onClick={() => setCatOpen(true)}
                className="ec-btn-secondary"
              >
                + Fee Category
              </button>
              <button
                type="button"
                onClick={() => setStructOpen(true)}
                className="ec-btn-secondary"
              >
                + Fee Structure
              </button>
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                className="ec-btn-primary"
              >
                <Plus className="w-4 h-4" />
                Assign Fee Invoice
              </button>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard accent="blue" label="Total Billed" value={formatCurrency(totalInvoiced, currency)} icon={FileText} />
        <StatCard accent="emerald" label="Total Collected" value={formatCurrency(totalCollected, currency)} icon={CheckCircle2} />
        <StatCard accent="amber" label="Outstanding Balance" value={formatCurrency(totalOutstanding, currency)} icon={CreditCard} />
      </div>

      {!institution?.feeRules?.onlineGatewayConfigured && (
        <div className="ec-card p-4 bg-blue-50/50 border-blue-200/80 flex items-start gap-3 text-[14px] text-slate-700">
          <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900">Online payment gateway is not configured.</span>{' '}
            {isFinanceStaff
              ? 'Authorized staff can record Cash, Bank Transfer, Cheque, and Card Terminal payments with official receipts.'
              : 'Please pay at the institution finance office; receipts appear here immediately once recorded.'}
          </div>
        </div>
      )}

      <Tabs
        value={feeTab}
        onChange={setFeeTab}
        items={[
          { key: 'invoices', label: 'Student Invoices', count: studentFees.length },
          { key: 'receipts', label: 'Payment Receipts', count: payments.length },
          ...(isFinanceStaff
            ? [
                { key: 'structures' as const, label: 'Fee Structures', count: feeStructures.length },
                { key: 'categories' as const, label: 'Fee Categories', count: feeCategories.length },
              ]
            : []),
        ]}
      />

      {feeTab === 'invoices' && (
        <DataTable
          rows={studentFees}
          loading={dataLoading}
          searchPlaceholder="Search invoices by student, invoice no, title..."
          searchFilter={(f, q) =>
            `${f.invoiceNumber} ${f.studentName || ''} ${f.title} ${f.status}`.toLowerCase().includes(q)
          }
          onExport={
            canExport
              ? (rows) =>
                  exportToCsv(
                    'student_fees',
                    ['Invoice', 'Student', 'Title', 'Amount', 'Discount', 'Paid', 'Balance', 'Due Date', 'Status'],
                    rows.map((r) => [
                      r.invoiceNumber,
                      r.studentName || r.studentId,
                      r.title,
                      r.amount,
                      r.discountAmount || 0,
                      r.paidAmount,
                      r.balanceAmount,
                      r.dueDate || '',
                      r.status,
                    ]),
                  )
              : undefined
          }
          columns={[
            { key: 'inv', header: 'Invoice #', render: (f) => <span className="font-mono text-[13px] text-slate-700">{f.invoiceNumber}</span> },
            { key: 'stu', header: 'Student', sortValue: (f) => f.studentName || '', render: (f) => <span className="font-medium text-slate-900">{f.studentName || f.studentId}</span> },
            { key: 'title', header: 'Fee Item', render: (f) => f.title },
            { key: 'amt', header: 'Total', align: 'right', render: (f) => <span className="font-mono tabular-nums">{formatCurrency(f.amount, currency)}</span> },
            { key: 'bal', header: 'Balance', align: 'right', render: (f) => <span className="font-mono font-semibold tabular-nums">{formatCurrency(f.balanceAmount, currency)}</span> },
            { key: 'due', header: 'Due Date', render: (f) => formatDate(f.dueDate) },
            { key: 'status', header: 'Status', render: (f) => <StatusBadge status={f.status} /> },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (f) =>
                isFinanceStaff && f.balanceAmount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPayTargetFee(f);
                      setPayAmount(String(f.balanceAmount));
                      setPayMethod('cash');
                      setPayRef('');
                      setPayNotes('');
                    }}
                    className="ec-btn-primary !py-1.5 !px-3 !text-[13px]"
                  >
                    Record Payment
                  </button>
                ) : (
                  <span className="text-[13px] text-slate-400">—</span>
                ),
            },
          ]}
          emptyState={
            <EmptyState
              icon={CreditCard}
              title="No fee invoices assigned yet"
              description="Create a fee category and fee structure, then assign invoices individually or to a class."
              actionLabel={isFinanceStaff && canCreate ? 'Assign Fee Invoice' : undefined}
              onAction={isFinanceStaff && canCreate ? () => setAssignOpen(true) : undefined}
            />
          }
        />
      )}

      {feeTab === 'receipts' && (
        <DataTable
          rows={payments}
          loading={dataLoading}
          searchPlaceholder="Search receipts by receipt #, student, method..."
          searchFilter={(p, q) =>
            `${p.receiptNumber} ${p.studentName || ''} ${p.paymentMethod} ${p.transactionRef || ''}`.toLowerCase().includes(q)
          }
          columns={[
            { key: 'rec', header: 'Receipt #', render: (p) => <span className="font-mono text-[13px] text-slate-700">{p.receiptNumber}</span> },
            { key: 'stu', header: 'Student', render: (p) => <span className="font-medium text-slate-900">{p.studentName || p.studentId}</span> },
            { key: 'date', header: 'Paid Date', render: (p) => formatDate(p.paidAt) },
            { key: 'method', header: 'Method', render: (p) => <span className="capitalize">{p.paymentMethod.replace(/_/g, ' ')}</span> },
            { key: 'amt', header: 'Amount', align: 'right', render: (p) => <span className="font-mono font-semibold tabular-nums">{formatCurrency(p.amount, currency)}</span> },
            { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.gatewayStatus} /> },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (p) => (
                <div className="inline-flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReceiptModal(p)}
                    className="text-[13.5px] font-semibold text-blue-800 hover:underline"
                  >
                    Receipt
                  </button>
                  {isFinanceStaff && p.gatewayStatus !== 'refunded' && (
                    <button
                      type="button"
                      onClick={() => {
                        setRefundTarget(p);
                        setRefundReason('');
                      }}
                      className="p-1.5 text-slate-500 hover:text-red-700 rounded-[8px] hover:bg-red-50 transition-colors"
                      title="Refund Payment"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          emptyState={<EmptyState icon={DollarSign} title="No payments recorded yet" description="Recorded fee payments and receipts will appear here." />}
        />
      )}

      {feeTab === 'structures' && isFinanceStaff && (
        <DataTable
          rows={feeStructures}
          loading={dataLoading}
          columns={[
            { key: 'name', header: 'Fee Structure', render: (s) => <span className="font-medium text-slate-900">{s.name}</span> },
            { key: 'cat', header: 'Category', render: (s) => s.categoryName || '—' },
            { key: 'cls', header: 'Class', render: (s) => classMap.get(s.classId || '') || 'All Classes' },
            { key: 'freq', header: 'Frequency', render: (s) => <span className="capitalize">{s.frequency.replace(/_/g, ' ')}</span> },
            { key: 'amt', header: 'Amount', align: 'right', render: (s) => <span className="font-mono tabular-nums">{formatCurrency(s.amount, currency)}</span> },
            { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
          ]}
          emptyState={
            <EmptyState
              icon={Users}
              title="No fee structures configured"
              description="Define fee structures for tuition, lab, library, or hostel charges."
              actionLabel="Add Fee Structure"
              onAction={() => setStructOpen(true)}
            />
          }
        />
      )}

      {feeTab === 'categories' && isFinanceStaff && (
        <DataTable
          rows={feeCategories}
          loading={dataLoading}
          columns={[
            { key: 'name', header: 'Category Name', render: (c) => <span className="font-medium text-slate-900">{c.name}</span> },
            { key: 'code', header: 'Code', render: (c) => <span className="font-mono text-[13px]">{c.code || '—'}</span> },
            { key: 'desc', header: 'Description', render: (c) => c.description || '—' },
            { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          ]}
          emptyState={
            <EmptyState
              icon={CreditCard}
              title="No fee categories created"
              description="Add categories such as Tuition Fee, Exam Fee, Transport Fee, or Lab Fee."
              actionLabel="Add Fee Category"
              onAction={() => setCatOpen(true)}
            />
          }
        />
      )}

      {/* Fee Category Modal */}
      <Modal open={catOpen} onClose={() => setCatOpen(false)} title="New Fee Category" size="sm">
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <FormField label="Category Name" required>
            <input required value={catName} onChange={(e) => setCatName(e.target.value)} className="ec-input" />
          </FormField>
          <FormField label="Code">
            <input value={catCode} onChange={(e) => setCatCode(e.target.value)} placeholder="e.g. TUI" className="ec-input font-mono" />
          </FormField>
          <FormField label="Description">
            <input value={catDesc} onChange={(e) => setCatDesc(e.target.value)} className="ec-input" />
          </FormField>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setCatOpen(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      {/* Fee Structure Modal */}
      <Modal open={structOpen} onClose={() => setStructOpen(false)} title="Create Fee Structure" size="md">
        <form onSubmit={handleSaveStructure} className="space-y-4">
          <FormField label="Structure Name" required>
            <input
              required
              value={structForm.name || ''}
              onChange={(e) => setStructForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Grade 10 Annual Tuition"
              className="ec-input"
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Category" required>
              <select
                required
                value={structForm.categoryId || ''}
                onChange={(e) => setStructForm((p) => ({ ...p, categoryId: e.target.value }))}
                className="ec-select"
              >
                <option value="">Select Category</option>
                {feeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Class (optional)">
              <select
                value={structForm.classId || ''}
                onChange={(e) => setStructForm((p) => ({ ...p, classId: e.target.value }))}
                className="ec-select"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label={`Amount (${currency})`} required>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={structForm.amount ?? ''}
                onChange={(e) => setStructForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                className="ec-input font-mono"
              />
            </FormField>
            <FormField label="Frequency">
              <select
                value={structForm.frequency || 'annual'}
                onChange={(e) => setStructForm((p) => ({ ...p, frequency: e.target.value as FeeStructure['frequency'] }))}
                className="ec-select"
              >
                <option value="one_time">One-Time</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semester">Semester</option>
                <option value="annual">Annual</option>
              </select>
            </FormField>
          </div>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setStructOpen(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Save Structure</button>
          </div>
        </form>
      </Modal>

      {/* Assign Invoices Modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Fee Invoice" size="md">
        <form onSubmit={handleAssignFeeInvoices} className="space-y-4">
          <Tabs
            value={assignMode}
            onChange={setAssignMode}
            items={[
              { key: 'individual', label: 'Individual Student' },
              { key: 'bulk_class', label: 'Bulk by Class' },
            ]}
          />
          <FormField label="Fee Structure" required>
            <select
              required
              value={assignStructureId}
              onChange={(e) => setAssignStructureId(e.target.value)}
              className="ec-select"
            >
              <option value="">Select Fee Structure</option>
              {feeStructures.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({formatCurrency(s.amount, currency)})</option>
              ))}
            </select>
          </FormField>
          {assignMode === 'individual' ? (
            <FormField label="Student" required>
              <select
                required
                value={assignStudentId}
                onChange={(e) => setAssignStudentId(e.target.value)}
                className="ec-select"
              >
                <option value="">Select Student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.studentCode} · {s.firstName} {s.lastName}</option>
                ))}
              </select>
            </FormField>
          ) : (
            <FormField label="Class" required>
              <select
                required
                value={assignClassId}
                onChange={(e) => setAssignClassId(e.target.value)}
                className="ec-select"
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={`Discount / Waiver (${currency})`}>
              <input type="number" min={0} step="0.01" value={assignDiscount} onChange={(e) => setAssignDiscount(e.target.value)} className="ec-input font-mono" />
            </FormField>
            <FormField label="Due Date">
              <input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} className="ec-input" />
            </FormField>
          </div>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setAssignOpen(false)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Generate Invoice(s)</button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={Boolean(payTargetFee)}
        onClose={() => setPayTargetFee(null)}
        title={`Record Payment · ${payTargetFee?.invoiceNumber || ''}`}
        subtitle={payTargetFee ? `${payTargetFee.studentName} · Balance: ${formatCurrency(payTargetFee.balanceAmount, currency)}` : ''}
        size="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <FormField label={`Amount (${currency})`} required>
            <input
              type="number"
              required
              min={0.01}
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="ec-input font-mono"
            />
          </FormField>
          <FormField label="Payment Method" required>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentRecord['paymentMethod'])}
              className="ec-select"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="card_terminal">Card Terminal</option>
              <option value="online_gateway">Online Gateway (Requires Config)</option>
            </select>
          </FormField>
          <FormField label="Transaction Reference / Cheque No">
            <input value={payRef} onChange={(e) => setPayRef(e.target.value)} className="ec-input" />
          </FormField>
          <FormField label="Notes">
            <input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="ec-input" />
          </FormField>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setPayTargetFee(null)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-primary">Confirm Payment</button>
          </div>
        </form>
      </Modal>

      {/* Printable Fee Receipt Modal */}
      <Modal
        open={Boolean(receiptModal)}
        onClose={() => setReceiptModal(null)}
        title="Official Fee Payment Receipt"
        size="md"
        footer={
          <button
            type="button"
            onClick={() => window.print()}
            className="ec-btn-primary"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
        }
      >
        {receiptModal && (
          <div className="print-surface space-y-5 text-[14.5px] border border-slate-200 p-6 rounded-[12px] bg-white">
            <div className="flex justify-between items-start border-b border-slate-200 pb-4">
              <div>
                <div className="text-[18px] font-bold text-slate-900">{institution?.name}</div>
                <div className="text-[13px] text-slate-500 mt-0.5">{institution?.address || institution?.email || ''}</div>
              </div>
              <div className="text-right">
                <div className="text-[12.5px] text-slate-500">Receipt No</div>
                <div className="font-mono font-bold text-[15px] text-slate-900">{receiptModal.receiptNumber}</div>
              </div>
            </div>
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between"><span className="text-slate-500">Student:</span><span className="font-medium text-slate-900">{receiptModal.studentName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Payment Date:</span><span>{formatDate(receiptModal.paidAt)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Method:</span><span className="capitalize">{receiptModal.paymentMethod.replace(/_/g, ' ')}</span></div>
              {receiptModal.transactionRef && (
                <div className="flex justify-between"><span className="text-slate-500">Reference:</span><span className="font-mono">{receiptModal.transactionRef}</span></div>
              )}
              <div className="flex justify-between pt-3 border-t border-slate-200 text-[16px] font-bold">
                <span>Amount Paid:</span>
                <span className="font-mono tabular-nums">{formatCurrency(receiptModal.amount, currency)}</span>
              </div>
            </div>
            <div className="text-[12.5px] text-slate-500 pt-3 border-t border-slate-100">
              Recorded by: {receiptModal.recordedByName || 'Finance Office'} · Status: {receiptModal.gatewayStatus.toUpperCase()}
            </div>
          </div>
        )}
      </Modal>

      {/* Refund Modal */}
      <Modal open={Boolean(refundTarget)} onClose={() => setRefundTarget(null)} title="Refund Payment" size="sm">
        <form onSubmit={handleRefundPayment} className="space-y-4">
          <div className="text-[14.5px] text-slate-700 leading-relaxed">
            Refund <span className="font-mono font-bold text-slate-900">{refundTarget ? formatCurrency(refundTarget.amount, currency) : ''}</span> for receipt{' '}
            <span className="font-mono font-semibold">{refundTarget?.receiptNumber}</span>?
          </div>
          <FormField label="Refund Reason" required>
            <input required value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="ec-input" />
          </FormField>
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button type="button" onClick={() => setRefundTarget(null)} className="ec-btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="ec-btn-danger">Confirm Refund</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
