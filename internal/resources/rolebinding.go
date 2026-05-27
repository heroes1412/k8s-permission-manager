package resources

import (
	rbacv1 "k8s.io/api/rbac/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type RoleBindingRequirements struct {
	RoleKind        string
	RoleName        string
	RolebindingName string
	Subjects        []rbacv1.Subject
}

func (r *Manager) RoleBindingCreate(namespace, username string, rbReq RoleBindingRequirements) (*rbacv1.RoleBinding, error) {
	username = SanitizeUsername(username)
	roleBindingName := SanitizeUsername(rbReq.RolebindingName)

	rb, err := r.kubeclient.RbacV1().RoleBindings(namespace).Create(r.context,
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      roleBindingName,
				Namespace: namespace,
				Labels:    map[string]string{"generated_for_user": username},
			},
			RoleRef: rbacv1.RoleRef{
				Kind:     rbReq.RoleKind,
				Name:     rbReq.RoleName,
				APIGroup: "rbac.authorization.k8s.io",
			},
			Subjects: rbReq.Subjects,
		}, metav1.CreateOptions{})

	if apierrors.IsAlreadyExists(err) {
		return r.kubeclient.RbacV1().RoleBindings(namespace).Get(r.context, roleBindingName, metav1.GetOptions{})
	}

	if err != nil {
		return nil, err
	}

	return rb, nil
}

func (r *Manager) RoleBindingCreateForGroup(namespace, groupname string, rbReq RoleBindingRequirements) (*rbacv1.RoleBinding, error) {
	groupname = SanitizeUsername(groupname)
	roleBindingName := SanitizeUsername(rbReq.RolebindingName)

	rb, err := r.kubeclient.RbacV1().RoleBindings(namespace).Create(r.context,
		&rbacv1.RoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:      roleBindingName,
				Namespace: namespace,
				Labels:    map[string]string{"generated_for_group": groupname},
			},
			RoleRef: rbacv1.RoleRef{
				Kind:     rbReq.RoleKind,
				Name:     rbReq.RoleName,
				APIGroup: "rbac.authorization.k8s.io",
			},
			Subjects: rbReq.Subjects,
		}, metav1.CreateOptions{})

	if apierrors.IsAlreadyExists(err) {
		return r.kubeclient.RbacV1().RoleBindings(namespace).Get(r.context, roleBindingName, metav1.GetOptions{})
	}

	if err != nil {
		return nil, err
	}

	return rb, nil
}

func (r *Manager) RoleBindingListByUser(namespace, username string) (*rbacv1.RoleBindingList, error) {
	return r.kubeclient.RbacV1().RoleBindings(namespace).List(r.context, metav1.ListOptions{
		LabelSelector: "generated_for_user=" + username,
	})
}

// RoleBindingDeleteAllForUser deletes all role bindings for the given user across all namespaces.
// It fetches the namespace list itself; prefer roleBindingDeleteAllForUserInNamespaces when
// the namespace list has already been retrieved (e.g. during a sync operation).
func (r *Manager) RoleBindingDeleteAllForUser(username string) error {
	namespaces, err := r.NamespaceList()
	if err != nil {
		return err
	}
	return r.roleBindingDeleteAllForUserInNamespaces(username, namespaces)
}

// roleBindingDeleteAllForUserInNamespaces is the internal implementation that accepts a
// pre-fetched namespace list to avoid redundant NamespaceList() API calls during sync.
// Fix #4: Uses LabelSelector instead of listing ALL bindings per namespace and filtering in-memory.
func (r *Manager) roleBindingDeleteAllForUserInNamespaces(username string, namespaces []string) error {
	username = SanitizeUsername(username)
	for _, ns := range namespaces {
		rbs, err := r.kubeclient.RbacV1().RoleBindings(ns).List(r.context, metav1.ListOptions{
			LabelSelector: "generated_for_user=" + username,
		})
		if err != nil {
			continue
		}
		for _, rb := range rbs.Items {
			_ = r.RoleBindingDelete(ns, rb.Name)
		}
	}
	return nil
}

// RoleBindingDeleteAllForGroup deletes all role bindings for the given group across all namespaces.
// It fetches the namespace list itself; prefer roleBindingDeleteAllForGroupInNamespaces when
// the namespace list has already been retrieved (e.g. during a sync operation).
func (r *Manager) RoleBindingDeleteAllForGroup(groupname string) error {
	namespaces, err := r.NamespaceList()
	if err != nil {
		return err
	}
	return r.roleBindingDeleteAllForGroupInNamespaces(groupname, namespaces)
}

// roleBindingDeleteAllForGroupInNamespaces is the internal implementation that accepts a
// pre-fetched namespace list to avoid redundant NamespaceList() API calls during sync.
// Fix #4: Uses LabelSelector instead of listing ALL bindings per namespace and filtering in-memory.
func (r *Manager) roleBindingDeleteAllForGroupInNamespaces(groupname string, namespaces []string) error {
	groupname = SanitizeUsername(groupname)
	for _, ns := range namespaces {
		rbs, err := r.kubeclient.RbacV1().RoleBindings(ns).List(r.context, metav1.ListOptions{
			LabelSelector: "generated_for_group=" + groupname,
		})
		if err != nil {
			continue
		}
		for _, rb := range rbs.Items {
			_ = r.RoleBindingDelete(ns, rb.Name)
		}
	}
	return nil
}

func (r *Manager) RoleBindingDelete(namespace, roleBindingName string) error {
	return r.kubeclient.RbacV1().RoleBindings(namespace).Delete(r.context, roleBindingName, metav1.DeleteOptions{})
}

func (r *Manager) RoleBindingList(namespace string) (*rbacv1.RoleBindingList, error) {
	return r.kubeclient.RbacV1().RoleBindings(namespace).List(r.context, metav1.ListOptions{})
}

func (r *Manager) RoleBindingListByGroup(namespace, groupname string) (*rbacv1.RoleBindingList, error) {
	return r.kubeclient.RbacV1().RoleBindings(namespace).List(r.context, metav1.ListOptions{
		LabelSelector: "generated_for_group=" + groupname,
	})
}

func (r *Manager) RoleBindingLegacyCheck(namespace string, username string) (roleBindingToMigrate *rbacv1.RoleBinding, err error) {
	roleBindings, err := r.RoleBindingList(namespace)

	if err != nil {
		return nil, err
	}

	for _, roleBinding := range (*roleBindings).Items {
		for _, rbSubjects := range roleBinding.Subjects {
			if (rbSubjects.Name == username || rbSubjects.Name == SanitizeUsername(username)) && rbSubjects.Kind == "User" {
				roleBindingToMigrate = &roleBinding
			}
		}
	}

	return roleBindingToMigrate, nil
}
