package resources

import (
	"strings"
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func (r *Manager) ClusterRoleBindingList() (*rbacv1.ClusterRoleBindingList, error) {
	return r.kubeclient.RbacV1().ClusterRoleBindings().List(r.context, metav1.ListOptions{})
}

func (r *Manager) ClusterRoleBindingCreate(clusterRoleBindingName, username, roleName string, subjects []rbacv1.Subject) (*rbacv1.ClusterRoleBinding, error) {
	username = SanitizeUsername(username)
	clusterRoleBindingName = SanitizeUsername(clusterRoleBindingName)

	rb, err := r.kubeclient.RbacV1().ClusterRoleBindings().Create(r.context,
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:   clusterRoleBindingName,
				Labels: map[string]string{"generated_for_user": username},
			},
			RoleRef: rbacv1.RoleRef{
				Kind:     "ClusterRole",
				Name:     roleName,
				APIGroup: "rbac.authorization.k8s.io",
			},
			Subjects: subjects,
		}, metav1.CreateOptions{})

	if apierrors.IsAlreadyExists(err) {
		return r.kubeclient.RbacV1().ClusterRoleBindings().Get(r.context, clusterRoleBindingName, metav1.GetOptions{})
	}

	return rb, err
}

func (r *Manager) ClusterRoleBindingListByGroup(groupname string) (*rbacv1.ClusterRoleBindingList, error) {
	return r.kubeclient.RbacV1().ClusterRoleBindings().List(r.context, metav1.ListOptions{
		LabelSelector: "generated_for_group=" + groupname,
	})
}

func (r *Manager) ClusterRoleBindingCreateForGroup(clusterRoleBindingName, groupname, roleName string, subjects []rbacv1.Subject) (*rbacv1.ClusterRoleBinding, error) {
	groupname = SanitizeUsername(groupname)
	clusterRoleBindingName = SanitizeUsername(clusterRoleBindingName)

	rb, err := r.kubeclient.RbacV1().ClusterRoleBindings().Create(r.context,
		&rbacv1.ClusterRoleBinding{
			ObjectMeta: metav1.ObjectMeta{
				Name:   clusterRoleBindingName,
				Labels: map[string]string{"generated_for_group": groupname},
			},
			RoleRef: rbacv1.RoleRef{
				Kind:     "ClusterRole",
				Name:     roleName,
				APIGroup: "rbac.authorization.k8s.io",
			},
			Subjects: subjects,
		}, metav1.CreateOptions{})

	if apierrors.IsAlreadyExists(err) {
		return r.kubeclient.RbacV1().ClusterRoleBindings().Get(r.context, clusterRoleBindingName, metav1.GetOptions{})
	}

	return rb, err
}

func (r *Manager) ClusterRoleBindingListByUser(username string) (*rbacv1.ClusterRoleBindingList, error) {
	return r.kubeclient.RbacV1().ClusterRoleBindings().List(r.context, metav1.ListOptions{
		LabelSelector: "generated_for_user=" + username,
	})
}

func (r *Manager) ClusterRoleBindingDeleteAllForUser(username string) error {
	username = SanitizeUsername(username)
	crbs, err := r.ClusterRoleBindingList()
	if err != nil {
		return err
	}

	prefix1 := username + "___"
	prefix2 := username + "-"

	for _, crb := range crbs.Items {
		if strings.HasPrefix(crb.Name, prefix1) || strings.HasPrefix(crb.Name, prefix2) || crb.Labels["generated_for_user"] == username {
			_ = r.ClusterRoleBindingDelete(crb.Name)
		}
	}
	return nil
}

func (r *Manager) ClusterRoleBindingDeleteAllForGroup(groupname string) error {
	groupname = SanitizeUsername(groupname)
	crbs, err := r.ClusterRoleBindingList()
	if err != nil {
		return err
	}

	prefix := "group___" + groupname + "___"

	for _, crb := range crbs.Items {
		if strings.HasPrefix(crb.Name, prefix) || crb.Labels["generated_for_group"] == groupname {
			_ = r.ClusterRoleBindingDelete(crb.Name)
		}
	}
	return nil
}

func (r *Manager) ClusterRoleBindingDelete(roleBindingName string) error {
	return r.kubeclient.RbacV1().ClusterRoleBindings().Delete(r.context, roleBindingName, metav1.DeleteOptions{})
}

func (r *Manager) ClusterRoleBindingLegacyCheck(username string) (clusterRoleBindingToMigrate *rbacv1.ClusterRoleBinding, err error) {
	clusterRoleBindings, err := r.ClusterRoleBindingList()

	if err != nil {
		return nil, err
	}

	for _, clusterRoleBinding := range (*clusterRoleBindings).Items {
		for _, crbSubjects := range clusterRoleBinding.Subjects {
			if (crbSubjects.Name == username || crbSubjects.Name == SanitizeUsername(username)) && crbSubjects.Kind == "User" {
				clusterRoleBindingToMigrate = &clusterRoleBinding
			}
		}
	}

	return clusterRoleBindingToMigrate, nil
}
