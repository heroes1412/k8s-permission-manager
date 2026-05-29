# Gemini Implementation & Fixes Changelog

## 1. UI Redesign (Apple Design System)
- Completely revamped the UI to follow the `@DESIGN-apple.md` guidelines.
- Configured Tailwind (`tailwind.config.js`) with Apple-specific colors (`apple-blue`, `apple-lightGray`, `apple-nearBlack`, etc.), fonts (`SF Pro Display`, `SF Pro Text`), and border radii (`pill: 980px`).
- Updated components (`Header.tsx`, `new-user-wizard.tsx`, `edit-user.tsx`, `Permissions.tsx`, `CreateKubeconfigButton.tsx`, etc.) to use the light theme with cinematic contrast, soft shadows (`shadow-apple`), and pill-shaped CTAs.
- Made the interface fully responsive (adjusting `max-w` constraints, stacking flex items on mobile).

## 2. Structural & Workflow Changes
- **Separated User Creation from Permission Assignment**: 
  - `NewUserWizard` now only handles creating the user identity (username, expiration days) and group assignment.
  - Removed the old `Groups.tsx` and `EditGroup.tsx` routes.
- **New `Permissions.tsx` View**: 
  - Created a dedicated, unified view to handle RBAC for *both* Users and Groups.
  - Supports searching/selecting a User or Group, assigning direct namespace permissions, and cluster access.
  - Displays a read-only "Effective Permissions Summary" for users, showing both directly assigned permissions and those inherited from their groups.
- **Group Management**:
  - Replaced the standalone group management page with an inline `CreatableSelect` in `GroupMultiSelect.tsx`.
  - Users can now create (with `[a-z0-9.-]` validation) and delete groups directly from the dropdown during user creation or editing.

## 3. RBAC Syncing & Backend Fixes (Go)
- **Centralized Synchronization**: 
  - Shifted the responsibility of creating and deleting Kubernetes `RoleBindings` and `ClusterRoleBindings` entirely to the Go backend (`internal/resources/sync.go`). 
  - The React frontend now *only* updates the Custom Resource Definitions (CRDs) via `/api/update-user` or `/api/update-group`, and the backend reacts by reconciling the actual RBAC objects.
- **Group Permission Revocation Bug**: 
  - Fixed an issue where removing a user from a group didn't revoke their permissions. `updateUser` and `deleteUser` handlers (`internal/server/users.go`) now automatically trigger `SyncGroup()` for any previously or currently associated groups to clean up outdated rolebindings.
- **RoleBinding Naming Convention**: 
  - Standardized the separator used in rolebinding names to `___` (e.g., `user___role`) in the backend to exactly match the frontend's parsing logic.
- **Legacy RoleBinding Deletion Bug (Permissions not revoking for individual users)**:
  - Discovered that legacy RoleBindings (created before the introduction of the `generated_for_user` label or using the old `-` separator) were not being identified and deleted by the backend's `RoleBindingDeleteAllForUser` function during `SyncUser`.
  - Updated `RoleBindingDeleteAllForUser` and `ClusterRoleBindingDeleteAllForUser` in `internal/resources/rolebinding.go` and `internal/resources/clusterrolebinding.go` to search for bindings using *both* label selectors and strict name prefixes (`username___` and `username-`). This ensures that all historical orphan bindings are accurately identified and scrubbed from the cluster without needing manual frontend API calls.
  - Added comprehensive error logging to `SyncUser`, `SyncGroup`, `deleteUser`, and `deleteGroup` to surface synchronization failures to the console.

## 4. Kubernetes CRD Fixes
- **Missing Schema**: 
  - Fixed `deployments/kubernetes/seeds/crd.yml` and `helm_chart/templates/crd.yml`. 
  - The `Permissionmanageruser` and `Permissionmanagergroup` schemas were missing the `resources` array definition, causing Kube-apiserver to silently strip permission data when saving. Added the correct OpenAPI v3 schema for `resources`.
- **OmitEmpty JSON Marshaling Bug (Permissions not deleting)**:
  - Removed `omitempty` from `Groups` and `Resources` in the Go CRD structs (`internal/crd/v1alpha1/permissionmanageruser_types.go` and `internal/crd/v1alpha1/permissionmanagergroup_types.go`).
  - Added explicit slice initializations (`make([]..., 0)`) in `internal/server/users.go` and `internal/server/groups.go` when the client sends an empty list. 
  - **Why**: Previously, deleting all permissions sent an empty JSON array `[]`, but `omitempty` caused the Go JSON marshaler to omit the field entirely from the PUT payload to the K8s API. The API server ignored the missing field, leaving the old permissions active in the cluster. Now, empty arrays are explicitly sent and saved, effectively revoking permissions.

## 5. Frontend Data Parsing & Kubeconfig Fixes
- **Permission UI State**: 
  - `Permissions.tsx` now initializes its state directly from the CRD data (`subject.originalObject.resources`) rather than attempting to reverse-engineer existing K8s RoleBindings via regex. This fixed the bug where the permission view appeared empty despite roles being assigned.
- **Kubeconfig Namespace Dropdown**: 
  - `CreateKubeconfigButton.tsx` now extracts valid namespaces directly from the User's CRD `resources` instead of relying on the backend K8s bindings. This fixed the issue where the dropdown only showed `default`.
  - Expanded the Kubeconfig modal to `w-full` for a better layout, matching the Apple Design System.

## 7. Kubernetes Cleanup Script
- **`scripts/cleanup-all.sh`**:
  - Created a comprehensive shell script to securely and cleanly tear down all Permission Manager resources from a Kubernetes cluster.
  - Automatically handles the deletion of the `permission-manager` namespace, all Custom Resource Definitions (CRDs), Template ClusterRoles, and securely wipes out all dynamically generated `RoleBindings` and `ClusterRoleBindings` matching the application's labeling schema (`generated_for_user` and `generated_for_group`).

## Fixed "Failed to create group: the server rejected our request due to an error in our request"
- Added explicit `Content-Type: application/json` and `Accept: application/json` to `RESTClient().DoRaw()` requests in `internal/resources/v1alpha1_permissionmanagergroup.go` and `internal/resources/v1alpha1_permissionmanageruser.go` to prevent K8s API server from trying to decode JSON payloads as Protobuf (which causes intermittent 400 Bad Request errors on a shared kubeclient).
- Updated group creation validation in `web-client/src/components/GroupMultiSelect.tsx` to ensure `minLength: 2` validation is correctly enforced on the frontend before sending to the K8s API, preventing 422 errors when the name length is < 2.

## Author Attribution Cleanup
- Replaced all `sighup.io` URLs with `github.com/heroes1412/k8s-permission-manager` in `README.md`, `helm_chart/Chart.yaml`, and `helm_chart/templates/NOTES.txt`.
- Removed `sighup.io` logo and link completely from the frontend `web-client/src/components/Footer.tsx`.
- Removed old `sighup.io` support links and CI badges from `README.md`.

## Docker
- Cleaned Docker and Go mod cache to resolve `no space left on device`.
- Re-generated the `/vendor` directory using `go mod vendor`.
- Built the `h2372/permission-manager:latest` image successfully using `Dockerfile-cloudshell` with host networking.
- Pushed the image to Docker Hub successfully.
