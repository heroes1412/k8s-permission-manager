package resources

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func (r *Manager) DeploymentRestart(namespace, name string) error {
	data := fmt.Sprintf(`{"spec": {"template": {"metadata": {"annotations": {"kubectl.kubernetes.io/restartedAt": "%s"}}}}}`, time.Now().Format(time.RFC3339))
	_, err := r.kubeclient.AppsV1().Deployments(namespace).Patch(r.context, name, types.StrategicMergePatchType, []byte(data), metav1.PatchOptions{})
	return err
}
