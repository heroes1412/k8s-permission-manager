# Permission Manager - Features & Functionalities

This document outlines all the features and capabilities of the modern Permission Manager v6 application.

## 1. User Management & Authentication
* **Create & Delete Users:** Create new user identities in Kubernetes. The system validates usernames to ensure compliance with Kubernetes DNS label standards (must start with a lowercase letter, contain only lowercase alphanumeric characters and hyphens).
* **Expiration Control:** Assign a "Days to Expire" duration to users. 
* **Automated Expiration Worker:** A background process runs every 10 minutes to handle expired users based on the `EXPIRED_USER_ACTION` setting:
  * `DELETE`: Automatically deletes the user and all associated RBAC bindings from the cluster.
  * `KEEP`: Automatically revokes all access (deletes RoleBindings and ClusterRoleBindings) but keeps the user identity in a suspended/expired state.
* **Kubeconfig Generation:** Automatically generates a `kubeconfig` file for users, allowing them to access the cluster. For expired users, downloading or viewing the kubeconfig is blocked.

## 2. Group Management (Optional)
* **Enable/Disable Toggle:** Group management can be toggled on or off globally via the Settings page. When disabled, all group-related UI elements (menus, assignment fields, badges) are hidden to keep the interface clean for simpler deployments.
* **Group Creation:** Create groups and assign a set of permissions (Roles and Namespaces) to them.
* **User Assignment:** Add users to one or more groups. Users inherit all permissions assigned to their groups.
* **Safe Synchronization:** The application ensures that modifying a group correctly updates the permissions of all its members without causing API rate-limit issues.

## 3. RBAC & Permission Delegation
* **Role Templates:** The system abstracts complex Kubernetes RBAC into "Templates". Admins can create and edit these templates via the UI. Behind the scenes, these are stored as `ClusterRoles` with specific prefixes (`template-namespaced-resources___` or `template-cluster-resources___`).
* **Direct & Inherited Permissions:** Users can be granted direct permissions to specific namespaces, or they can inherit permissions by being part of a group.
* **Global Access (Cluster-wide):** Grant users or groups access to all namespaces (`ALL_NAMESPACES`). The backend automatically creates optimized `ClusterRoleBindings` instead of iterating through every namespace to prevent Kubernetes API overload (N+1 problem).
* **System Protected Namespaces:** Admins can define a list of protected namespaces in the Settings. These namespaces (like `kube-system`, `default`) cannot be deleted from the Permission Manager UI.

## 4. Enterprise Operations & Auditing
* **Bulk Operations Orchestrator:** Manage multiple users simultaneously from the Home page.
  * *Extend Expiry:* Add days to the expiration date of multiple selected users.
  * *Add to Group:* Add multiple users to a specific group at once.
  * *Delete:* Delete multiple users.
  * *Revoke Expired:* A quick-action button to instantly revoke permissions for all currently expired users.
  * *Progress Tracking:* A visual loader shows real-time progress during bulk operations.
* **RBAC Visualizer (Network Graph):** An interactive 2D force-directed graph that maps out the relationships between Users, Groups, Roles, and Namespaces. Hovering over a node highlights its entire permission path.
* **Access Audit (Real-time K8s Scan):** Perform a reverse lookup on any namespace. The system directly queries Kubernetes `RoleBindings` and `ClusterRoleBindings` to show exactly who has access to a namespace, distinguishing between rules created by Permission Manager ("Managed by App") and those created manually via kubectl ("External / Manual").
* **Test Access (Can-I):** A built-in tool within the User Permissions view that queries the Kubernetes `SubjectAccessReview` API. Admins can test if a user has permission to perform a specific action (e.g., `delete pods` in `production`) and get a definitive "YES" or "NO" response.
* **GitOps Export:** Download all Users, Groups, and Custom Role Templates as a standard Kubernetes YAML file for backup or GitOps integration (e.g., ArgoCD/Flux).
* **Group Dry-Run (Impact Analysis):** When modifying a Group's permissions, a "Review Changes" modal appears before saving. It displays an impact analysis showing exactly how many and which users will be affected by the change.

## 5. System Configurations & Notifications
* **Webhook Alerts:** Configure a webhook URL (e.g., Slack, Discord) to receive real-time notifications when users are created, updated, deleted, or when their permissions are automatically revoked by the Expiration Worker.
* **Proxy Support:** Enterprise environments can configure a Webhook Proxy (with optional username/password authentication). The proxy password is encrypted and masked (`********`) in the UI to prevent exposure.
* **UI/UX Virtualization:** The frontend utilizes `react-virtuoso` to render large lists of users smoothly without freezing the browser DOM.
