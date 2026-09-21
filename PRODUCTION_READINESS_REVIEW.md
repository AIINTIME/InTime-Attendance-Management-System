# Production Readiness Review

This document lists the main areas that need work before the application should be considered production ready, even for internal usage.

## High Priority

1. Add CSRF protection for cookie-based authentication.
   - The frontend sends credentialed requests with cookies.
   - Backend mutating routes accept cookie-authenticated requests without CSRF tokens or strict origin checks.
   - Add CSRF middleware, double-submit tokens, or strict `Origin` / `Referer` validation for all non-GET requests.

2. Fail startup when required secrets are missing.
   - `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` currently only produce warnings.
   - JWT signing can still run with empty secrets.
   - Production startup should fail fast if required environment variables are missing or weak.

3. Replace stateless refresh tokens with server-side session tracking.
   - Logout only clears browser cookies.
   - Refresh tokens are not stored, rotated, revoked, or checked for reuse.
   - Store hashed refresh tokens or session IDs server-side, rotate refresh tokens, revoke on logout/password change, and expire old sessions.

4. Remove hardcoded default employee passwords.
   - `Welcome@26INT` is hardcoded in backend and frontend.
   - Create/reset employee APIs return temporary passwords in the response.
   - Generate random one-time temporary passwords, expire them, force reset, and avoid duplicating secrets in frontend code.

5. Enforce HTTPS and production cookie settings in every shared environment.
   - Cookie `secure` and `sameSite` behavior depends on `NODE_ENV`.
   - Non-production CORS reflects almost any origin.
   - Any staging/internal demo exposed beyond localhost should use HTTPS, strict CORS, and production-grade cookies.

## Medium Priority

6. Add explicit CSRF-safe logout and cookie clearing.
   - Cookies are set with `secure` / `sameSite` options but cleared with only `path`.
   - Clear cookies using the same attributes used when setting them.
   - Ensure logout is protected against cross-site triggering.

7. Harden public upload handling.
   - `/uploads` serves user-controlled content publicly.
   - Uploaded files are stored locally or in `/tmp` on Vercel, which is not durable.
   - Move uploads to object storage, validate content, set safe response headers, and define retention/deletion behavior.

8. Restrict direct profile photo URL updates.
   - Employee and admin update flows accept `profilePhoto` from request bodies.
   - Users may store arbitrary external URLs or large data URLs.
   - Only allow server-issued upload paths or trusted object-storage keys.

9. Bound report exports.
   - Excel and PDF exports can query all matching attendance records without pagination.
   - Large exports can cause high memory/CPU usage.
   - Add max date ranges, max rows, streaming, background jobs, or export rate limits.

10. Strengthen passkey verification requirements.
    - Passkey registration and authentication use `userVerification: "preferred"`.
    - For attendance proof, consider `userVerification: "required"` so biometric/PIN verification is enforced.

11. Improve password policy.
    - Password changes only require a minimum length of 8 characters.
    - Add common-password checks, breached-password checks if possible, complexity guidance, and password reset auditing.

12. Add audit logging for sensitive actions.
    - Track admin login, employee creation, password reset, employee deactivation/reactivation, settings changes, report exports, and profile updates.
    - Include actor, target, timestamp, IP, user agent, and outcome.

13. Add account lockout or progressive throttling.
    - Auth endpoints have rate limits, but there is no per-account lockout or suspicious login tracking.
    - Add email/account-based throttling in addition to IP-based limits.

14. Revoke sessions after password changes and resets.
    - Existing refresh tokens remain valid after password change/reset unless they naturally expire.
    - Session versioning or stored sessions should invalidate old tokens after credential changes.

## Low Priority / Hardening

15. Minimize health-check and error-response information.
    - `/api/health` exposes product/API identity.
    - 404 responses echo method and route.
    - Keep production health responses minimal.

16. Add stricter security headers and CSP.
    - Helmet is enabled, but the frontend should also have a deliberate Content Security Policy.
    - Define allowed script, image, connect, and media sources.

17. Validate all query filters more strictly.
    - Some filters such as `department`, `loginType`, `status`, and `employeeIds` are loosely accepted.
    - Use enums and bounded string lengths to reduce malformed queries and accidental heavy database scans.

18. Add database indexes for common reporting filters.
    - Attendance queries filter by date, employee, department, login type, and status.
    - Review query plans and add indexes where needed before real usage grows.

19. Add production observability.
    - Add structured logs, request IDs, error tracking, metrics, uptime checks, and alerting.
    - Avoid logging secrets, passwords, tokens, or full personal data.

20. Add backup and recovery procedures.
    - Define database backup cadence, restore testing, and retention.
    - Document recovery steps for accidental employee deletion, corrupted attendance data, and lost admin access.

21. Add privacy/data-retention policy for attendance and location data.
    - Attendance records include location coordinates.
    - Define who can access this data, how long it is retained, and how exports are controlled.

22. Add automated security and regression checks.
    - Add tests for auth gates, role isolation, CSRF behavior, session refresh, logout, employee deactivation, passkey flow, upload validation, and report export limits.
    - Add dependency scanning and secret scanning in CI.

## Existing Strengths

1. Main admin, employee, attendance, passkey, and report route groups have backend role gates.
2. Access and refresh tokens are stored in `httpOnly` cookies.
3. Upload handling validates declared MIME type and file magic bytes.
4. Helmet is enabled and `x-powered-by` is disabled.
5. Login endpoints have rate limiting.
6. Passwords are hashed with bcrypt.

## Suggested Implementation Order

1. Fail startup on missing production secrets.
2. Add CSRF/origin protection for cookie-authenticated APIs.
3. Replace hardcoded temporary passwords.
4. Add server-side refresh-token/session storage and revocation.
5. Lock down CORS, HTTPS, and cookie behavior for staging/production.
6. Bound report exports and harden uploads.
7. Add audit logging and security-focused tests.
