# Permission Manager Project Context

## Project Overview
Permission Manager is a web-based application for managing Kubernetes RBAC. It allows users to create users, assign namespaces/permissions, and distribute Kubeconfig files.

## Tech Stack
- **Backend:** Go (Echo framework)
- **Frontend:** React (TypeScript), Tailwind CSS
- **Infrastructure:** Docker, Kubernetes (CRDs for user management)

## UI Conventions
- **Theming:** Teal-based color scheme (#14b8a6).
- **Styling:** Tailwind CSS for layout and components.
- **Buttons:** 
  - Standard action buttons: `bg-teal-600 hover:bg-teal-700 text-white font-black py-2.5 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 text-xs tracking-widest uppercase`
  - Outline buttons: `bg-white hover:bg-teal-50 text-teal-700 border-2 border-teal-600`
- **Lists:** Table-based lists with hover effects, Internal IDs in monospace italic below friendly names.

## Key Components & Views
- `Home.tsx`: Main user list.
- `RoleManagement.tsx`: Custom role template management.
- `EditUser.tsx` / `edit-user.tsx`: User permission management.
- `CreateKubeconfigButton.tsx`: Kubeconfig generation and distribution (Copy/Download).
- `Settings.tsx`: System-wide settings management (Cluster name, Control Plane URL, Auth password).

## Workflows & Lessons Learned
- **Kubeconfig Generation:** Uses a backend API `/api/create-kubeconfig`. Frontend must ensure `chosenNamespace` is valid when `validNamespaces` updates (especially when "Global Access" is enabled and `useNamespaceList` is still loading).
- **Role Templates:** Roles starting with `template-namespaced-resources___` are treated as custom templates.
- **Settings:** Stored in the `permission-manager` secret in the `permission-manager` namespace. Backend handler in `internal/server/settings.go`.
- **Global Access:** Represented by `ALL_NAMESPACES` in the code. Avoid using cluttering tags like "Global Active" in the summary; instead, allow the absence of specific namespaces to imply global or handle it discreetly.
- **Group Feature Toggle:** A setting `GROUPS_ENABLED` (boolean-like string) is stored in the settings secret. It controls the visibility of all Group-related UI elements (e.g., Assigned Groups field, Inherited Permissions, Roles menu, Group badges). The frontend consumes this via the `useSettings` hook.
- **User Expiration Logic & Action:** "Days to Expire" represents days *from now*, not from the creation date. The UI computes the remaining days based on `createdAt` + `maxDays`. When a user updates the expiration duration in the UI, the frontend calculates a new relative `MaxDays` value (from original creation to new target date) and sends it to the backend. 
- **Auto-Deletion & Revocation:** A background worker runs every 10 minutes (`internal/server/expiration_worker.go`). 
    - If `EXPIRED_USER_ACTION` is `DELETE`, it removes the User and all bindings. 
    - If set to `KEEP`, it **revokes all permissions** by deleting all RoleBindings/ClusterRoleBindings while keeping the User CRD. 
    - The `SyncUser` and `SyncGroup` logic (`internal/resources/sync.go`) specifically **blocks** the creation of any new bindings for users whose expiration date has passed, ensuring "Hard Revocation" even if a manual sync is triggered.
- **Naming Conventions:** All created resources (Users, Groups, Namespaces) must follow a strict naming policy: lowercase alphanumeric, can contain `-`, but **MUST start with a letter `[a-z]`** to comply with Kubernetes DNS label standards. This is enforced by regex in both backend validation and frontend real-time checks.
- **Access Audit & Empty States:** The `/api/access-audit` endpoint performs a reverse lookup of users/groups per namespace. It explicitly returns an empty array `[]` (instead of `null`) if no records exist, preventing frontend crashes.
- **Webhook & Proxy:** Webhook notifications are sent on User Create/Update/Delete/Expiration. Proxy configurations (`WEBHOOK_PROXY_URL`, `WEBHOOK_PROXY_USER`, `WEBHOOK_PROXY_PASSWORD`) are stored in the settings secret. The proxy password is masked in API responses as `********` and only updated if a new value is provided.
- **UI UX Rules:** 
    - Hyperlinks in lists (Users, Roles) should not have underlines.
    - Group badges on the Home page must be prefixed with a "Groups:" label.
    - If `GROUPS_ENABLED` is false, all group-related UI elements and labels (including "Groups:") must be hidden.

## Development Commands
- `make run`: Run locally.
- `docker build -t h2372/permission-manager:latest .`: Build the unified image.
- `docker push h2372/permission-manager:latest`: Push to registry.
