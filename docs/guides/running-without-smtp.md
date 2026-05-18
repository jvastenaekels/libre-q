# Running Qualis without SMTP / email

Qualis is fully usable without an SMTP server. When `SMTP_HOST`,
`SMTP_USER`, or `SMTP_PASSWORD` is unset, Qualis runs in **email-optional
mode**: outgoing emails are written to the application log, and every
account-recovery action has an in-product path that needs no email.

A startup log line confirms the mode and lists the consequences. For the
canonical list of email-related environment variables, see
[`deployment.md`](deployment.md#email-transport-auth-flows). For the
manual superuser recovery actions referenced below, see
[`admin-management.md`](admin-management.md).

---

## Capability matrix

| Flow | Without SMTP |
|---|---|
| Registration | ✅ Account is active immediately; no verification email needed. |
| Password reset (user clicks "forgot") | ⚙️ User contacts the operator. A superuser opens **Admin → Users → ⋯ → Generate password-reset link** and sends the link out of band. |
| Project invitation | ✅ The invite link is shown with a copy button right after inviting — no email involved. |
| Email change | ⚙️ Self-service is disabled. A superuser sets the address from **Admin → Users**. |
| Lost authenticator (2FA) | ⚙️ A superuser uses **Admin → Users → ⋯ → Reset 2FA**. |
| Email-based 2FA | 🚫 Disabled. Users must use an authenticator app. Existing email-2FA accounts are recovered via "Reset 2FA". |
| Memo mentions / notifications | ✅ Informational only; written to the log, never blocking. |

Legend: ✅ works unchanged · ⚙️ requires a manual superuser action · 🚫 disabled.

---

## Enabling email later

Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` (and `EMAILS_FROM_EMAIL`)
and restart. The startup banner disappears, the admin banner clears, the
forgot-password page reverts to the standard message, and the email-2FA
option reappears. No data migration is required.
