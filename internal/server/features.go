package server

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"sighupio/permission-manager/internal/resources"
	authorizationv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/yaml"
)

// 1. GitOps Export Feature
func exportGitOps(c echo.Context) error {
	ac := c.(*AppContext)
	var output bytes.Buffer

	// Export Users
	users, err := ac.ResourceManager.V1Alpha1PermissionManagerUser.List()
	if err == nil {
		for _, u := range users {
			obj := map[string]interface{}{
				"apiVersion": "permissionmanager.user/v1alpha1",
				"kind":       "PermissionManagerUser",
				"metadata": map[string]interface{}{
					"name": u.Name,
				},
				"spec": map[string]interface{}{
					"maxDays":   u.MaxDays,
					"groups":    u.Groups,
					"resources": u.Resources,
				},
			}
			y, _ := yaml.Marshal(obj)
			output.WriteString("---\n")
			output.Write(y)
		}
	}

	// Export Groups
	groups, err := ac.ResourceManager.V1Alpha1PermissionManagerGroup.List()
	if err == nil {
		for _, g := range groups {
			obj := map[string]interface{}{
				"apiVersion": "permissionmanager.group/v1alpha1",
				"kind":       "PermissionManagerGroup",
				"metadata": map[string]interface{}{
					"name": g.Name,
				},
				"spec": map[string]interface{}{
					"resources": g.Resources,
				},
			}
			y, _ := yaml.Marshal(obj)
			output.WriteString("---\n")
			output.Write(y)
		}
	}

	// Export Role Templates
	roles, err := ac.ResourceManager.ClusterRoleList()
	if err == nil {
		for _, r := range roles.Items {
			if strings.HasPrefix(r.Name, "template-namespaced-resources___") || strings.HasPrefix(r.Name, "template-cluster-resources___") {
				obj := map[string]interface{}{
					"apiVersion": "rbac.authorization.k8s.io/v1",
					"kind":       "ClusterRole",
					"metadata": map[string]interface{}{
						"name": r.Name,
					},
					"rules": r.Rules,
				}
				y, _ := yaml.Marshal(obj)
				output.WriteString("---\n")
				output.Write(y)
			}
		}
	}

	c.Response().Header().Set("Content-Type", "text/yaml")
	c.Response().Header().Set("Content-Disposition", "attachment; filename=permission-manager-gitops.yaml")
	return c.String(http.StatusOK, output.String())
}

// 2. Reverse Lookup (Access Audit) Feature - REAL-TIME K8S SCAN
func getAccessAudit(c echo.Context) error {
	ac := c.(*AppContext)
	namespace := c.QueryParam("namespace")
	if namespace == "" {
		return ac.errorResponse("Namespace is required")
	}

	type AuditRecord struct {
		SubjectKind string `json:"subjectKind"`
		SubjectName string `json:"subjectName"`
		RoleName    string `json:"roleName"`
		ManagedBy   string `json:"managedBy"` // "PermissionManager" or "Manual/External"
	}
	records := make([]AuditRecord, 0)

	// 1. Scan RoleBindings in the specific namespace
	rbs, err := ac.ResourceManager.GetKubeClient().RbacV1().RoleBindings(namespace).List(context.Background(), metav1.ListOptions{})
	if err == nil {
		for _, rb := range rbs.Items {
			managedBy := "Manual/External"
			if rb.Labels != nil {
				if _, ok := rb.Labels["generated_for_user"]; ok {
					managedBy = "PermissionManager"
				} else if _, ok := rb.Labels["generated_for_group"]; ok {
					managedBy = "PermissionManager"
				}
			}

			for _, sub := range rb.Subjects {
				records = append(records, AuditRecord{
					SubjectKind: sub.Kind,
					SubjectName: sub.Name,
					RoleName:    getShortTemplateName(rb.RoleRef.Name),
					ManagedBy:   managedBy,
				})
			}
		}
	}

	// 2. Scan ClusterRoleBindings (these affect ALL namespaces)
	crbs, err := ac.ResourceManager.GetKubeClient().RbacV1().ClusterRoleBindings().List(context.Background(), metav1.ListOptions{})
	if err == nil {
		for _, crb := range crbs.Items {
			managedBy := "Manual/External"
			if crb.Labels != nil {
				if _, ok := crb.Labels["generated_for_user"]; ok {
					managedBy = "PermissionManager"
				} else if _, ok := crb.Labels["generated_for_group"]; ok {
					managedBy = "PermissionManager"
				}
			}

			for _, sub := range crb.Subjects {
				records = append(records, AuditRecord{
					SubjectKind: sub.Kind,
					SubjectName: sub.Name,
					RoleName:    getShortTemplateName(crb.RoleRef.Name) + " (Cluster-wide)",
					ManagedBy:   managedBy,
				})
			}
		}
	}

	return ac.okResponseWithData(records)
}

func getShortTemplateName(fullName string) string {
	// Be more aggressive: split by ___ and take the last part if it exists
	if strings.Contains(fullName, "___") {
		parts := strings.Split(fullName, "___")
		return parts[len(parts)-1]
	}
	// Fallback to old behavior
	name := strings.ReplaceAll(fullName, "template-namespaced-resources___", "")
	name = strings.ReplaceAll(name, "template-cluster-resources___", "")
	return name
}

// 3. Test Permissions Feature
func checkPermission(c echo.Context) error {
	ac := c.(*AppContext)
	type Request struct {
		Username  string `json:"username"`
		Namespace string `json:"namespace"`
		Resource  string `json:"resource"`
		Verb      string `json:"verb"`
	}
	r := new(Request)
	if err := ac.validateAndBindRequest(r); err != nil {
		return err
	}

	sar := &authorizationv1.SubjectAccessReview{
		Spec: authorizationv1.SubjectAccessReviewSpec{
			User: fmt.Sprintf("system:serviceaccount:%s:%s", ac.Config.Cluster.Namespace, resources.SanitizeUsername(r.Username)),
			ResourceAttributes: &authorizationv1.ResourceAttributes{
				Namespace: r.Namespace,
				Verb:      r.Verb,
				Resource:  r.Resource,
			},
		},
	}

	res, err := ac.ResourceManager.GetKubeClient().AuthorizationV1().SubjectAccessReviews().Create(context.Background(), sar, metav1.CreateOptions{})
	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponseWithData(map[string]bool{"allowed": res.Status.Allowed})
}
