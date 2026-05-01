package resources

import (
	"fmt"
	"strings"
	"sighupio/permission-manager/internal/crd/v1alpha1"

	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func getShortTemplateName(fullName string) string {
	name := strings.ReplaceAll(fullName, "template-namespaced-resources___", "")
	name = strings.ReplaceAll(name, "template-cluster-resources___", "")
	return name
}

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

	var subjects []rbacv1.Subject
	for _, u := range users {
		subjects = append(subjects, rbacv1.Subject{
			Kind:      "ServiceAccount",
			Name:      SanitizeUsername(u.Name),
			Namespace: r.ClusterNamespace,
		})
	}

	// Clean up old manually created group rolebindings
	if err := r.RoleBindingDeleteAllForGroup(groupname); err != nil {
		return fmt.Errorf("failed to delete old role bindings for group %s: %w", groupname, err)
	}
	if err := r.ClusterRoleBindingDeleteAllForGroup(groupname); err != nil {
		return fmt.Errorf("failed to delete old cluster role bindings for group %s: %w", groupname, err)
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

	for _, u := range users {
		_ = r.SyncUser(u.Name)
	}

	return nil
}

func (r *Manager) SyncUser(username string) error {
	username = SanitizeUsername(username)
	user, err := r.V1Alpha1PermissionManagerUser.Get(username)
	if err != nil {
		return err
	}

	// 1. Collect direct permissions only (group permissions are now handled by SyncGroup)
	allResources := []v1alpha1.PermissionManagerUserResource{}
	allResources = append(allResources, user.Spec.Resources...)

	// 2. Clean up old user bindings
	if err := r.RoleBindingDeleteAllForUser(username); err != nil {
		return fmt.Errorf("failed to delete old role bindings for user %s: %w", username, err)
	}
	if err := r.ClusterRoleBindingDeleteAllForUser(username); err != nil {
		return fmt.Errorf("failed to delete old cluster role bindings for user %s: %w", username, err)
	}

	// 3. Apply new aggregated bindings
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

		// Check if it is a cluster role
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
			// Cluster level or across all namespaces
			if isClusterRole {
				rbName := fmt.Sprintf("%s___%s-all", username, shortRoleName)
				_, _ = r.ClusterRoleBindingCreate(rbName, username, roleName, subjects)
			} else {
				// Role in all namespaces
				namespaces, _ := r.NamespaceList()
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
			// Specific namespaces
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
