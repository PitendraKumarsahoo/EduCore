export type RoleKey =
  | 'super_admin'
  | 'institution_admin'
  | 'principal'
  | 'vice_principal'
  | 'hod'
  | 'teacher'
  | 'accountant'
  | 'librarian'
  | 'receptionist'
  | 'student'
  | 'parent';

export type ModuleKey =
  | 'dashboard'
  | 'setup_wizard'
  | 'admissions'
  | 'students'
  | 'faculty'
  | 'staff'
  | 'academics'
  | 'departments'
  | 'programs'
  | 'classes'
  | 'subjects'
  | 'attendance'
  | 'timetable'
  | 'examinations'
  | 'results'
  | 'assignments'
  | 'fees'
  | 'accounting'
  | 'library'
  | 'transport'
  | 'hostel'
  | 'leave'
  | 'communication'
  | 'notices'
  | 'calendar'
  | 'reports'
  | 'documents'
  | 'users_roles'
  | 'audit_logs'
  | 'settings';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export type ModulePermissionMap = Partial<Record<ModuleKey, PermissionAction[]>>;

export interface GradingRule {
  grade: string;
  minPercent: number;
  maxPercent: number;
  gpaPoint: number;
  remarks?: string;
}

export interface Institution {
  id: string;
  name: string;
  type: 'school' | 'college' | 'university' | 'k12_and_college';
  code?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  timezone: string;
  currency: string;
  currentAcademicYearId?: string;
  workingDays?: string[];
  gradingScale?: GradingRule[];
  attendanceRules?: {
    minPercentage?: number;
    allowTeacherEditPastDays?: number;
  };
  feeRules?: {
    allowPartialPayment?: boolean;
    allowOverpayment?: boolean;
    receiptPrefix?: string;
    onlineGatewayConfigured?: boolean;
    onlineGatewayName?: string;
  };
  staffCategories?: string[];
  documentTypes?: string[];
  setupCompleted?: boolean;
  setupStep?: number;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  photoUrl?: string;
  activeInstitutionId?: string;
  notificationPrefs?: {
    inApp?: boolean;
    emailDigest?: boolean;
    feeAlerts?: boolean;
    examAlerts?: boolean;
  };
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionMember {
  uid: string;
  institutionId: string;
  email: string;
  displayName?: string;
  role: RoleKey;
  permissions?: ModulePermissionMap;
  linkedStudentIds?: string[];
  linkedEmployeeId?: string;
  assignedClassIds?: string[];
  assignedSubjectIds?: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface UserInvite {
  id: string;
  email: string;
  institutionId: string;
  institutionName?: string;
  role: RoleKey;
  displayName?: string;
  linkedStudentIds?: string[];
  linkedEmployeeId?: string;
  status: 'pending' | 'accepted' | 'revoked';
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermissionMatrix {
  id?: string;
  role: RoleKey;
  institutionId: string;
  modules: ModulePermissionMap;
  updatedAt: string;
}

export interface AcademicYear {
  id: string;
  institutionId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  hodEmployeeId?: string;
  hodName?: string;
  description?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Program {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  degreeType?: string;
  departmentId?: string;
  durationYears?: number;
  semesterCount?: number;
  creditStructure?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface AcademicClass {
  id: string;
  institutionId: string;
  academicYearId?: string;
  departmentId?: string;
  programId?: string;
  name: string;
  code?: string;
  semesterNumber?: number;
  levelType?: 'school_class' | 'college_semester';
  capacity?: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  institutionId: string;
  academicYearId?: string;
  classId: string;
  name: string;
  batchName?: string;
  roomNumber?: string;
  capacity?: number;
  classTeacherId?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  departmentId?: string;
  programId?: string;
  classId?: string;
  sectionId?: string;
  credits?: number;
  subjectType?: 'theory' | 'practical' | 'both';
  maxMarks: number;
  passingMarks: number;
  facultyId?: string;
  facultyName?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Admission {
  id: string;
  institutionId: string;
  applicationNumber: string;
  academicYearId?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dob?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  previousInstitution?: string;
  previousScore?: string;
  targetProgramId?: string;
  targetClassId?: string;
  targetSectionId?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  interviewDate?: string;
  interviewNotes?: string;
  verificationStatus?: 'pending' | 'verified' | 'flagged';
  status: 'draft' | 'submitted' | 'under_review' | 'documents_pending' | 'approved' | 'rejected' | 'enrolled';
  enrolledStudentId?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DisciplineRecord {
  date: string;
  category: string;
  description: string;
  actionTaken: string;
  recordedBy: string;
}

export interface Student {
  id: string;
  institutionId: string;
  studentCode: string;
  admissionNumber?: string;
  rollNumber?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  photoUrl?: string;
  admissionDate?: string;
  academicYearId?: string;
  departmentId?: string;
  programId?: string;
  classId?: string;
  sectionId?: string;
  status: 'active' | 'inactive' | 'graduated' | 'transferred' | 'suspended' | 'withdrawn';
  previousInstitution?: string;
  transferInfo?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  userUid?: string;
  parentUid?: string;
  disciplineRecords?: DisciplineRecord[];
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  institutionId: string;
  employeeCode: string;
  staffType: 'faculty' | 'staff';
  category?: string;
  firstName: string;
  lastName: string;
  photoUrl?: string;
  email?: string;
  phone?: string;
  joiningDate?: string;
  departmentId?: string;
  designation?: string;
  qualification?: string;
  experienceYears?: number;
  employmentType?: 'full_time' | 'part_time' | 'contract' | 'visiting';
  assignedSubjectIds?: string[];
  assignedClassIds?: string[];
  salaryMonthly?: number;
  userUid?: string;
  status: 'active' | 'on_leave' | 'inactive' | 'resigned';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  institutionId: string;
  academicYearId?: string;
  targetType: 'student' | 'employee';
  targetId: string;
  targetName?: string;
  studentUserUid?: string;
  parentUserUid?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
  remarks?: string;
  markedByUid: string;
  markedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableSlot {
  id: string;
  institutionId: string;
  academicYearId?: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  subjectName?: string;
  facultyId?: string;
  facultyName?: string;
  room?: string;
  dayOfWeek: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string;
  endTime: string;
  status: 'active' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface ExamSubjectSchedule {
  subjectId: string;
  subjectName: string;
  examDate: string;
  startTime: string;
  endTime: string;
  room: string;
  invigilatorId?: string;
  invigilatorName?: string;
  maxMarks: number;
  passingMarks: number;
}

export interface Examination {
  id: string;
  institutionId: string;
  academicYearId?: string;
  name: string;
  examType: 'internal' | 'mid_term' | 'semester' | 'final' | 'practical' | 'viva';
  classId?: string;
  programId?: string;
  semesterNumber?: number;
  startDate?: string;
  endDate?: string;
  enableRanking?: boolean;
  status: 'draft' | 'scheduled' | 'ongoing' | 'completed' | 'published';
  subjects?: ExamSubjectSchedule[];
  createdAt: string;
  updatedAt: string;
}

export interface MarkChangeHistory {
  marksObtained: number;
  isAbsent: boolean;
  changedByUid: string;
  changedByName: string;
  changedAt: string;
}

export interface ExamMark {
  id: string;
  institutionId: string;
  examId: string;
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  subjectId: string;
  studentId: string;
  studentName?: string;
  studentUserUid?: string;
  parentUserUid?: string;
  rollNumber?: string;
  maxMarks: number;
  passingMarks?: number;
  marksObtained: number;
  isAbsent: boolean;
  grade?: string;
  remarks?: string;
  enteredByUid: string;
  enteredByName?: string;
  history?: MarkChangeHistory[];
  isPublished?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeeCategory {
  id: string;
  institutionId: string;
  name: string;
  code?: string;
  description?: string;
  isRecurring?: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructure {
  id: string;
  institutionId: string;
  academicYearId?: string;
  name: string;
  classId?: string;
  programId?: string;
  categoryId: string;
  categoryName?: string;
  amount: number;
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'semester' | 'annual';
  dueDate?: string;
  lateFeePerDay?: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface StudentFee {
  id: string;
  institutionId: string;
  invoiceNumber: string;
  academicYearId?: string;
  studentId: string;
  studentName?: string;
  studentUserUid?: string;
  parentUserUid?: string;
  classId?: string;
  categoryId?: string;
  categoryName?: string;
  title: string;
  amount: number;
  discountAmount?: number;
  lateFeeAmount?: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate?: string;
  status: 'unpaid' | 'partial' | 'paid' | 'waived' | 'overdue';
  waiverReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  institutionId: string;
  receiptNumber: string;
  academicYearId?: string;
  studentFeeId: string;
  studentId: string;
  studentName?: string;
  studentUserUid?: string;
  parentUserUid?: string;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'card_terminal' | 'online_gateway';
  transactionRef?: string;
  paymentOrderId?: string;
  gatewayStatus: 'not_configured' | 'recorded' | 'refunded' | 'failed';
  recordedByUid: string;
  recordedByName?: string;
  notes?: string;
  paidAt: string;
  refundedAt?: string;
  refundReason?: string;
  createdAt: string;
}

export interface AccountingEntry {
  id: string;
  institutionId: string;
  academicYearId?: string;
  entryType: 'income' | 'expense';
  category: string;
  title: string;
  amount: number;
  paymentMethod?: string;
  referenceNumber?: string;
  entryDate: string;
  relatedPaymentId?: string;
  recordedByUid: string;
  recordedByName?: string;
  notes?: string;
  createdAt: string;
}

export interface LibraryBook {
  id: string;
  institutionId: string;
  isbn?: string;
  title: string;
  author: string;
  publisher?: string;
  category?: string;
  edition?: string;
  quantity: number;
  availableQuantity: number;
  shelfLocation?: string;
  status: 'available' | 'out_of_stock' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface LibraryTransaction {
  id: string;
  institutionId: string;
  bookId: string;
  bookTitle?: string;
  borrowerType: 'student' | 'employee';
  borrowerId: string;
  borrowerName?: string;
  borrowerUid?: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: 'issued' | 'returned' | 'reserved' | 'lost' | 'damaged';
  fineAmount?: number;
  finePaid?: boolean;
  renewCount?: number;
  remarks?: string;
  issuedByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransportStop {
  stopName: string;
  pickupTime: string;
  dropTime: string;
}

export interface TransportRoute {
  id: string;
  institutionId: string;
  routeName: string;
  vehicleNumber: string;
  vehicleType?: string;
  capacity: number;
  driverName?: string;
  driverPhone?: string;
  stops?: TransportStop[];
  monthlyFee?: number;
  assignedStudentIds?: string[];
  status: 'active' | 'maintenance' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Hostel {
  id: string;
  institutionId: string;
  name: string;
  buildingCode?: string;
  wardenName?: string;
  wardenPhone?: string;
  totalFloors?: number;
  totalRooms: number;
  totalBeds: number;
  monthlyFee?: number;
  status: 'active' | 'maintenance' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface HostelAllocation {
  id: string;
  institutionId: string;
  hostelId: string;
  hostelName?: string;
  floor?: string;
  roomNumber: string;
  bedNumber: string;
  studentId: string;
  studentName?: string;
  checkInDate: string;
  checkOutDate?: string;
  status: 'occupied' | 'checked_out';
  createdAt: string;
  updatedAt: string;
}

export interface Assignment {
  id: string;
  institutionId: string;
  academicYearId?: string;
  title: string;
  description?: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  subjectName?: string;
  facultyUid: string;
  facultyName?: string;
  dueDate: string;
  maxMarks?: number;
  attachmentName?: string;
  attachmentDataUrl?: string;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentSubmission {
  id: string;
  institutionId: string;
  assignmentId: string;
  studentId: string;
  studentName?: string;
  studentUid: string;
  notes?: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
  submittedAt: string;
  status: 'submitted' | 'graded' | 'late';
  marksAwarded?: number;
  feedback?: string;
  gradedByUid?: string;
  updatedAt: string;
}

export interface LeaveRequest {
  id: string;
  institutionId: string;
  applicantType: 'employee' | 'student';
  applicantId: string;
  applicantName?: string;
  applicantUid: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedByUid?: string;
  reviewedByName?: string;
  reviewRemarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notice {
  id: string;
  institutionId: string;
  title: string;
  content: string;
  targetAudience: 'all' | 'faculty' | 'staff' | 'students' | 'parents' | 'department' | 'class';
  targetId?: string;
  publishDate?: string;
  expiryDate?: string;
  attachmentName?: string;
  status: 'draft' | 'published' | 'archived';
  authorUid: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  institutionId: string;
  academicYearId?: string;
  title: string;
  eventType: 'academic' | 'exam' | 'holiday' | 'meeting' | 'parent_meeting' | 'deadline' | 'other';
  startDate: string;
  endDate?: string;
  audience: 'all' | 'faculty' | 'students' | 'parents';
  description?: string;
  location?: string;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  institutionId: string;
  ownerType: 'student' | 'employee' | 'institution';
  ownerId: string;
  ownerName?: string;
  documentType: string;
  title: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  dataUrl?: string;
  verified?: boolean;
  uploadedByUid: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  institutionId: string;
  recipientUid: string;
  type: 'fee_due' | 'payment' | 'attendance' | 'exam' | 'result' | 'assignment' | 'notice' | 'leave' | 'announcement';
  title: string;
  message: string;
  isRead: boolean;
  linkModule?: string;
  createdAt: string;
}

export interface MessageItem {
  id: string;
  institutionId: string;
  senderUid: string;
  senderName?: string;
  recipientUid?: string;
  recipientName?: string;
  targetAudience?: string;
  subject: string;
  body: string;
  channel: 'in_app' | 'email_queued' | 'sms_queued';
  isRead?: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  institutionId: string;
  userUid: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  action: string;
  module: string;
  recordId?: string;
  summary: string;
  deviceInfo?: string;
  createdAt: string;
}
