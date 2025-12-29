# Admin & Team Management

This guide explains how to manage accounts, research teams, and study permissions in Open-Q.

---

## 👤 User Management

User accounts are managed by **Superusers**. A superuser can list all system users and create new accounts.

### Bootstrapping the First Admin

If your system is fresh, use the CLI to create your first superuser:

```bash
cd backend
python scripts/create_user.py
```

Follow the prompts to enter an email, password, and toggle the **Superuser** status to `y`.

### API Access

Once you have an account, you can manage users via the API at `GET /api/admin/users/`.

> [!CAUTION]
> Superusers have global visibility. Only grant this status to trusted platform administrators.

---

## 👥 Managing Study Teams

Study owners can invite other researchers to collaborate on their work.

### Adding a Collaborator

Invite a user by their email through the Admin API:

`POST /api/admin/studies/{slug}/collaborators`

```json
{
  "email": "colleague@example.com",
  "role": "editor"
}
```

### Roles and Permissions

Open-Q supports three roles with varying levels of access:

| Feature                            | Owner | Editor | Viewer |
| :--------------------------------- | :---: | :----: | :----: |
| View Configuration                 |  ✅   |   ✅   |   ✅   |
| Update Meta/Text (Active/Paused)   |  ✅   |   ✅   |   ❌   |
| Update Grid/Structure (Draft Only) |  ✅   |   ✅   |   ❌   |
| Export Study Data                  |  ✅   |   ✅   |   ✅   |
| Change Study State                 |  ✅   |   ✅   |   ❌   |
| Manage Collaborators               |  ✅   |   ❌   |   ❌   |
| Delete Study                       |  ✅   |   ❌   |   ❌   |

---

## 🔄 Study Lifecycle

Studies progress through several states:

1. **Draft**: All configuration is unlocked. Full structural changes allowed.
2. **Active**: The study is public. **Structural configuration is locked**. Only metadata and translations (text fixes) can be updated.
3. **Paused**: Public access is suspended. Participants cannot submit. Use this state for temporary maintenance or fixing urgent typos.
4. **Closed**: Public access is revoked. Exporting results is still possible.

> [!TIP]
> Use the **Paused** state if you need to fix a typo in a statement or instruction while the study is live, without deleting and recreating it.
