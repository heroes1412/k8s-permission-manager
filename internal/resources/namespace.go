package resources

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetAllNamespaces lists all the Namespaces available in the K8s cluster.
func (r *Manager) NamespaceList() (names []string, err error) {
	namespaces, err := r.kubeclient.CoreV1().Namespaces().List(r.context, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	for _, ns := range namespaces.Items {
		names = append(names, ns.Name)
	}

	return names, nil
}

func (r *Manager) NamespaceCreate(name string) error {
	ns := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
	}
	_, err := r.kubeclient.CoreV1().Namespaces().Create(r.context, ns, metav1.CreateOptions{})
	return err
}

func (r *Manager) NamespaceDelete(name string) error {
	pods, err := r.kubeclient.CoreV1().Pods(name).List(r.context, metav1.ListOptions{})
	if err != nil {
		return err
	}
	if len(pods.Items) > 0 {
		return fmt.Errorf("namespace %s has %d running/existing pods", name, len(pods.Items))
	}
	return r.kubeclient.CoreV1().Namespaces().Delete(r.context, name, metav1.DeleteOptions{})
}
