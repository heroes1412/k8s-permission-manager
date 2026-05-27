package resources

import (
	"fmt"
	"log"
	"strings"
	"time"

	"sighupio/permission-manager/internal/crd/v1alpha1"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func getShortTemplateName(fullName string) string {
	name := strings.ReplaceAll(fullName, "template-namespaced-resources___", "")
	name = strings.ReplaceAll(name, "template-cluster-resources___", "")
	return name
}

// SyncGroup reconciles all RBAC bindings for the given group and re-syncs every member user.
func (r *Manager) SyncGroup(groupname string) error {
	groupname = SanitizeUsername(groupname)
	group, err := r.V1Alpha1PermissionManagerGroup.Get(groupname)
	if err != nil {
		return err
	}

	users, err := r.V1Alpha1PermissionManagerUser.ListByGroup(groupname)
	if err != nil {
		return err
	}

	// Fix #5: Fetch namespaces ONCE for the entire group sync operation.
	// This list is reused for deletion, recreation, and per-user syncs below,
	// avoiding O(users) redundant NamespaceList() API calls.
	namespaces, err := r.NamespaceList()
	if err != nil {
		return fmt.Errorf("failed to list namespaces for group sync: %w", err)
	}

	var subjects []rbacv1.Subject
	for _, u := range users {
		// Fix #9 (part 1): Only add user to group subjects if NOT expired
		if u.MaxDays > 0 {
			createdAt, err := time.Parse(time.RFC3339, u.CreatedAt)
			if err == nil {
				expirationTime := createdAt.AddDate(0, 0, u.MaxDays)
				if time.Now().After(expirationTime) {
					continue // Skip expired user in group bindings
				}
			}
		}

		subjects = append(subjects, rbacv1.Subject{
			Kind:      "ServiceAccount",
			Name:      SanitizeUsername(u.Name),
			Namespace: r.ClusterNamespace,
		})
	}

	// Clean up old group rolebindings using pre-fetched namespace list.
	if err := r.roleBindingDeleteAllForGroupInNamespaces(groupname, namespaces); err != nil {
		return fmt.Errorf("failed to delete old role bindings for group %s: %w", groupname, err)
	}
	if err := r.ClusterRoleBindingDeleteAllForGroup(groupname); err != nil {
		return fmt.Errorf("failed to delete old cluster role bindings for group %s: %w", groupname, err)
	}

	// If no active subjects left in group, we just stop after cleanup
	if len(subjects) == 0 {
		return nil
	}

	for _, res := range group.Spec.Resources {
		roleName := res.Template
		shortRoleName := getShortTemplateName(roleName)
		isClusterRole := false

		cr, err := r.kubeclient.RbacV1().ClusterRoles().Get(r.context, roleName, metav1.GetOptions{})
		if err == nil && cr != nil {
			isClusterRole = true
		}

		isAllNamespaces := false
		for _, ns := range res.Namespaces {
			if ns == "ALL_NAMESPACES" {
				isAllNamespaces = true
				break
			}
		}

		if isAllNamespaces {
			rbName := fmt.Sprintf("group___%s___%s-all", groupname, shortRoleName)
			_, _ = r.ClusterRoleBindingCreateForGroup(rbName, groupname, roleName, subjects)
		} else {
			for _, ns := range res.Namespaces {
				rbName := fmt.Sprintf("group___%s___%s", groupname, shortRoleName)
				roleKind := "Role"
				if isClusterRole {
					roleKind = "ClusterRole"
				}
				_, _ = r.RoleBindingCreateForGroup(ns, groupname, RoleBindingRequirements{
					RoleKind:        roleKind,
					RoleName:        roleName,
					RolebindingName: rbName,
					Subjects:        subjects,
				})
			}
		}
	}

	// Re-sync each member user using the already-fetched namespace list to avoid
	// per-user NamespaceList() calls.
	for _, u := range users {
		_ = r.syncUserWithNamespaces(u.Name, namespaces)
	}

	return nil
}

// SyncUser reconciles all RBAC bindings for the given user.
// It fetches the namespace list once and delegates to the internal implementation.
func (r *Manager) SyncUser(username string) error {
	// Fix #5: Fetch namespaces once here rather than letting each sub-call fetch independently.
	namespaces, err := r.NamespaceList()
	if err != nil {
		return fmt.Errorf("failed to list namespaces for user sync: %w", err)
	}
	return r.syncUserWithNamespaces(username, namespaces)
}

// syncUserWithNamespaces is the internal implementation of SyncUser that accepts a pre-fetched
// namespace list. This allows SyncGroup to call it for each member without triggering additional
// NamespaceList() API calls per user.
func (r *Manager) syncUserWithNamespaces(username string, namespaces []string) error {
	username = SanitizeUsername(username)
	user, err := r.V1Alpha1PermissionManagerUser.Get(username)
	if err != nil {
		return err
	}

	// Fix #9 (part 2): Prevent syncing permissions for expired users.
	if user.Spec.MaxDays > 0 {
		createdAt := user.Metadata.CreationTimestamp.Time
		expirationTime := createdAt.AddDate(0, 0, user.Spec.MaxDays)
		if time.Now().After(expirationTime) {
			log.Printf("SyncUser: User %s is expired. Cleaning up direct permissions and skipping sync.", username)
			_ = r.roleBindingDeleteAllForUserInNamespaces(username, namespaces)
			_ = r.ClusterRoleBindingDeleteAllForUser(username)
			return nil
		}
	}

	// Collect direct permissions only (group permissions are handled by SyncGroup).
	allResources := []v1alpha1.PermissionManagerUserResource{}
	allResources = append(allResources, user.Spec.Resources...)

	// Clean up old user bindings using the pre-fetched namespace list.
	if err := r.roleBindingDeleteAllForUserInNamespaces(username, namespaces); err != nil {
		return fmt.Errorf("failed to delete old role bindings for user %s: %w", username, err)
	}
	if err := r.ClusterRoleBindingDeleteAllForUser(username); err != nil {
		return fmt.Errorf("failed to delete old cluster role bindings for user %s: %w", username, err)
	}

	subjects := []rbacv1.Subject{
		{
			Kind:      "ServiceAccount",
			Name:      username,
			Namespace: r.ClusterNamespace,
		},
	}

	for _, res := range allResources {
		roleName := res.Template
		shortRoleName := getShortTemplateName(roleName)
		isClusterRole := false

		cr, err := r.kubeclient.RbacV1().ClusterRoles().Get(r.context, roleName, metav1.GetOptions{})
		if err == nil && cr != nil {
			isClusterRole = true
		}

		isAllNamespaces := false
		for _, ns := range res.Namespaces {
			if ns == "ALL_NAMESPACES" {
				isAllNamespaces = true
				break
			}
		}

		if isAllNamespaces {
			if isClusterRole {
				rbName := fmt.Sprintf("%s___%s-all", username, shortRoleName)
				_, _ = r.ClusterRoleBindingCreate(rbName, username, roleName, subjects)
			} else {
				// Role in all namespaces — use pre-fetched namespace list (Fix #5).
				for _, ns := range namespaces {
					rbName := fmt.Sprintf("%s___%s", username, shortRoleName)
					_, _ = r.RoleBindingCreate(ns, username, RoleBindingRequirements{
						RoleKind:        "Role",
						RoleName:        roleName,
						RolebindingName: rbName,
						Subjects:        subjects,
					})
				}
			}
		} else {
			for _, ns := range res.Namespaces {
				rbName := fmt.Sprintf("%s___%s", username, shortRoleName)
				roleKind := "Role"
				if isClusterRole {
					roleKind = "ClusterRole"
				}
				_, _ = r.RoleBindingCreate(ns, username, RoleBindingRequirements{
					RoleKind:        roleKind,
					RoleName:        roleName,
					RolebindingName: rbName,
					Subjects:        subjects,
				})
			}
		}
	}

	return nil
}
