package resources

import (
	"strings"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
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

func (r *Manager) RoleBindingDeleteAllForUser(username string) error {
	username = SanitizeUsername(username)
	namespaces, err := r.NamespaceList()
	if err != nil {
		return err
	}

	prefix1 := username + "___"
	prefix2 := username + "-"

	for _, ns := range namespaces {
		rbs, err := r.RoleBindingList(ns)
		if err != nil {
			continue
		}
		for _, rb := range rbs.Items {
			if strings.HasPrefix(rb.Name, prefix1) || strings.HasPrefix(rb.Name, prefix2) || rb.Labels["generated_for_user"] == username {
				_ = r.RoleBindingDelete(ns, rb.Name)
			}
		}
	}
	return nil
}

func (r *Manager) RoleBindingDeleteAllForGroup(groupname string) error {
	groupname = SanitizeUsername(groupname)
	namespaces, err := r.NamespaceList()
	if err != nil {
		return err
	}

	prefix := "group___" + groupname + "___"

	for _, ns := range namespaces {
		rbs, err := r.RoleBindingList(ns)
		if err != nil {
			continue
		}
		for _, rb := range rbs.Items {
			if strings.HasPrefix(rb.Name, prefix) || rb.Labels["generated_for_group"] == groupname {
				_ = r.RoleBindingDelete(ns, rb.Name)
			}
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
