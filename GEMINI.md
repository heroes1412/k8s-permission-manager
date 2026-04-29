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

## Development Commands
- `make run`: Run locally.
- `docker build -t h2372/permission-manager:latest .`: Build the unified image.
- `docker push h2372/permission-manager:latest`: Push to registry.
