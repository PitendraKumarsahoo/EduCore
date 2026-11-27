# EduCore Firestore Security Specification

## 1. Data Invariants
1. **Multi-Institution Isolation**: Every tenant document under `/institutions/{institutionId}/...` must carry `institutionId == institutionId` and can only be read or modified by verified active members of that specific institution (or the platform Super Admin).
2. **No Self-Assigned Privilege Escalation**: A user cannot create or update their own `/institutions/{institutionId}/members/{uid}` document to assign themselves `super_admin`, `institution_admin`, `principal`, or any elevated role unless they are an existing admin, the verified owner creating their initial institution, or claiming a genuine admin-created `/user_invites/{inviteId}` matching their verified Google email (`request.auth.token.email_verified == true && request.auth.token.email == invite.email`).
3. **PII Isolation**: User profiles (`/users/{uid}`) containing emails and phones are readable only by the owner (`request.auth.uid == uid`) or Super Admin. Student and Employee records containing PII are readable only by authorized staff/administrators, or by the specific student (`userUid == request.auth.uid`) or linked parent (`parentUid == request.auth.uid`).
4. **Financial Immutability**: Payment receipts (`/institutions/{institutionId}/payments/{paymentId}`) and accounting ledger entries cannot be arbitrarily deleted by clients. Refunds update only `gatewayStatus`, `refundedAt`, and `refundReason` by an authorized Accountant or Administrator.
5. **Marks Integrity**: Exam marks must satisfy `0 <= marksObtained <= maxMarks` and can only be entered/updated by authorized Teachers or Academic Managers, never by Students or Parents.
6. **Audit Log Immutability**: Audit logs (`/institutions/{institutionId}/audit_logs/{logId}`) are append-only (`allow update, delete: if false`) and must record `userUid == request.auth.uid`.
7. **Path ID & Payload Size Bounds**: All document IDs are validated with `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, max 128 chars), and all string/array fields have explicit upper size bounds to prevent resource exhaustion.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: Reading `/institutions/inst1/students/stu1` with `request.auth == null`.
2. **Unverified Email Spoof**: Creating a document with `request.auth.token.email == 'pitendrakumarsahoo84@gmail.com'` when `request.auth.token.email_verified == false`.
3. **Cross-Tenant Hop**: Member of `inst1` reading or writing `/institutions/inst2/students/stu1`.
4. **Role Self-Escalation**: Student updating `/institutions/inst1/members/{studentUid}` with `{ role: 'institution_admin' }`.
5. **Shadow Field Injection**: Creating a student record with an unexpected extra key `{ ..., isAdmin: true }`.
6. **Student Marks Tampering**: Student updating `/institutions/inst1/marks/m1` with `{ marksObtained: 100 }`.
7. **Over-Max Marks Poisoning**: Teacher submitting `{ maxMarks: 100, marksObtained: 150 }`.
8. **Financial Receipt Deletion**: Any user attempting `delete` on `/institutions/inst1/payments/pay1`.
9. **Audit Log Tampering**: Even an Admin attempting `update` or `delete` on `/institutions/inst1/audit_logs/log1`.
10. **PII Blanket Scraping**: Student listing `/users` or reading another user's `/users/{otherUid}`.
11. **Invalid ID Poisoning**: Creating a document at `/institutions/inst1/students/invalid..id/..` or a 1KB key string.
12. **Cross-Student Fee Read**: Student A reading `/institutions/inst1/student_fees/{feeOfStudentB}`.
