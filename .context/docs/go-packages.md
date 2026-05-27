# Go Packages and Modules
<DOCUMENT_TAGS>
go, packages
</DOCUMENT_TAGS>
_SOURCE: Go Packages and Modules_
# Go Packages and Modules
```
// Structure of documents
└── cmd/
    ├── run-server.go
└── internal/
    └── config/
        ├── config.go
        ├── config_test.go
    └── crd/
        ├── v1alpha1/
        │   └── permissionmanagergroup_types.go
        │   └── permissionmanageruser_types.go
    └── resources/
        ├── certificate.go
        ├── clusterrole.go
        ├── deployment.go
        ├── kubeclient.go
        ├── manager.go
        ├── namespace.go
        ├── namespace_test.go
        ├── role.go
        ├── secrets.go
        ├── serviceaccount.go
        ├── serviceaccount_test.go
        ├── sync.go
        ├── v1alpha1_permissionmanagergroup.go
        ├── v1alpha1_permissionmanageruser.go
        ├── v1alpha1_permissionmanageruser_test.go
    └── server/
        └── appcontext.go
        └── clusterrole.go
        └── fallbackresponse.go
        └── groups.go
        └── handlers.go
        └── handlers_test.go
        └── role.go
        └── server.go
        └── settings.go
        └── users.go
        └── validation.go

```
###  Path: `/cmd/run-server.go`

```go
package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"sighupio/permission-manager/internal/config"
	"sighupio/permission-manager/internal/server"
)

func main() {
	cfg := config.New()

	s := server.New(*cfg)
	addr := ":" + cfg.Backend.Port

	// Fix #3: Set HTTP server timeouts to prevent resource exhaustion from slow/abusive clients.
	// WriteTimeout is generous to cover the worst-case kubeconfig polling path (~12s).
	s.Server.ReadTimeout = 30 * time.Second
	s.Server.WriteTimeout = 60 * time.Second
	s.Server.IdleTimeout = 120 * time.Second

	// Fix #7: Start server in a background goroutine so we can also listen for shutdown signals.
	go func() {
		if err := s.Start(addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			s.Logger.Fatal(err)
		}
	}()

	// Block until OS interrupt or SIGTERM.
	// Kubernetes sends SIGTERM when a pod is being deleted — graceful shutdown prevents
	// in-flight RBAC mutations from being aborted mid-way, which would leave bindings
	// in an inconsistent state.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	s.Logger.Info("Shutdown signal received, draining in-flight requests (max 30s)...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := s.Shutdown(ctx); err != nil {
		s.Logger.Fatal(err)
	}
	s.Logger.Info("Server stopped cleanly.")
}

```
###  Path: `/internal/config/config.go`

```go
package config

import (
	"log"
	"os"
)

type ClusterConfig struct {
	Name                string
	ControlPlaneAddress string
	Namespace           string
}

type BackendConfig struct {
	Port string
}

// Config contains PermissionManager cluster/server configuration
type Config struct {
	Cluster ClusterConfig
	Backend BackendConfig
}

func New() *Config {
	cfg := &Config{
		Cluster: ClusterConfig{
			Name:                os.Getenv("CLUSTER_NAME"),
			ControlPlaneAddress: os.Getenv("CONTROL_PLANE_ADDRESS"),
			Namespace:           os.Getenv("NAMESPACE"),
		},
		Backend: BackendConfig{
			Port: os.Getenv("PORT"),
		},
	}

	if cfg.Backend.Port == "" {
		log.Fatal("PORT env cannot be empty")
	}

	if cfg.Cluster.Name == "" {
		log.Fatal("CLUSTER_NAME env cannot be empty")
	}

	if cfg.Cluster.ControlPlaneAddress == "" {
		log.Fatal("CONTROL_PLANE_ADDRESS env cannot be empty")
	}

	if cfg.Cluster.Namespace == "" {
		log.Fatal("NAMESPACE env cannot be empty")
	}

	return cfg
}

```
###  Path: `/internal/config/config_test.go`

```go
package config_test

import (
	"fmt"
	"os"
	"sighupio/permission-manager/internal/config"
)

func ExampleNew() {
	os.Setenv("PORT", "4000")
	os.Setenv("CLUSTER_NAME", "my-cluster")
	os.Setenv("CONTROL_PLANE_ADDRESS", "https://192.168.64.33:8443")
	os.Setenv("NAMESPACE", "test")

	cfg := config.New()

	fmt.Println(cfg.Backend.Port)
	fmt.Println(cfg.Cluster.Name)
	fmt.Println(cfg.Cluster.ControlPlaneAddress)
	fmt.Println(cfg.Cluster.Namespace)

	// Output:
	// 4000
	// my-cluster
	// https://192.168.64.33:8443
	// test
}

```
###  Path: `/internal/crd/v1alpha1/permissionmanagergroup_types.go`

```go
package v1alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

const (
	GroupResourceURL = "apis/permissionmanager.user/v1alpha1/permissionmanagergroups"
	GroupPrefix      = "pmgroup-"
)

type PermissionManagerGroupSpec struct {
	Name         string   `json:"name"`
	FriendlyName string   `json:"friendlyname,omitempty"`
	Resources    []PermissionManagerUserResource `json:"resources"`
}

type PermissionManagerUserResource struct {
	Template   string   `json:"template"`
	Namespaces []string `json:"namespaces"`
}

// PermissionManagerGroup is the PermissionManager representation of a group of users
type PermissionManagerGroup struct {
	metav1.TypeMeta `json:",inline"`
	Metadata        metav1.ObjectMeta          `json:"metadata,omitempty"`
	Spec            PermissionManagerGroupSpec `json:"spec"`
}

type PermissionManagerGroupList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []PermissionManagerGroup `json:"items"`
}

```
###  Path: `/internal/crd/v1alpha1/permissionmanageruser_types.go`

```go
package v1alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

const (
	ResourceURL    = "apis/permissionmanager.user/v1alpha1/permissionmanagerusers"
	ResourcePrefix = "pmuser-"
)

type PermissionManagerUserSpec struct {
	Name         string                          `json:"name"`
	FriendlyName string                          `json:"friendlyname,omitempty"`
	MaxDays      int                             `json:"maxdays,omitempty"`
	Groups       []string                        `json:"groups"`
	Resources    []PermissionManagerUserResource `json:"resources"`
}

// PermissionManagerUser is the PermissionManager representation of an user of the managed K8s cluster
type PermissionManagerUser struct {
	metav1.TypeMeta `json:",inline"`
	Metadata        metav1.ObjectMeta         `json:"metadata,omitempty"`
	Spec            PermissionManagerUserSpec `json:"spec"`
}

type PermissionManagerUserList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`
	Items           []PermissionManagerUser `json:"items"`
}

```
###  Path: `/internal/resources/certificate.go`

```go
package resources

import (
	"encoding/base64"
	"io/ioutil"
	"log"
	runtime "sigs.k8s.io/controller-runtime"
)

// getCaBase64 returns the base64 encoding of the Kubernetes cluster api-server CA
func getCaBase64() string {

	kConfig, err := runtime.GetConfig()

	if err != nil {
		log.Fatalf("Unable to get kubeconfig.\n%v", err)
	}

	if len(kConfig.CAData) != 0 {
		return base64.StdEncoding.EncodeToString(kConfig.CAData)
	}

	// CAData len can be 0, so as a fallback we read from CAFile
	CAData, err := ioutil.ReadFile(kConfig.CAFile)
	if err != nil {
		log.Fatalf("Unable to read kubeconfig file.\n%v", err)
	}

	return base64.StdEncoding.EncodeToString(CAData)
}

```
###  Path: `/internal/resources/clusterrole.go`

```go
package resources

import (
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (r *Manager) ClusterRoleCreate(roleName string, rules []rbacv1.PolicyRule) (*rbacv1.ClusterRole, error) {
	return r.kubeclient.RbacV1().ClusterRoles().Create(r.context, &rbacv1.ClusterRole{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "rbac.authorization.k8s.io/v1",
			Kind:       "ClusterRole",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: roleName,
		},
		Rules: rules,
	}, metav1.CreateOptions{})

}

func (r *Manager) ClusterRoleUpdate(roleName string, rules []rbacv1.PolicyRule) (*rbacv1.ClusterRole, error) {
	return r.kubeclient.RbacV1().ClusterRoles().Update(r.context, &rbacv1.ClusterRole{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "rbac.authorization.k8s.io/v1",
			Kind:       "ClusterRole",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: roleName,
		},
		Rules: rules,
	}, metav1.UpdateOptions{})

}

func (r *Manager) ClusterRoleDelete(roleName string) error {
	return r.kubeclient.RbacV1().ClusterRoles().Delete(r.context, roleName, metav1.DeleteOptions{})
}

func (r *Manager) ClusterRoleList() (*rbacv1.ClusterRoleList, error) {
	return r.kubeclient.RbacV1().ClusterRoles().List(r.context, metav1.ListOptions{})
}

```
###  Path: `/internal/resources/deployment.go`

```go
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

```
###  Path: `/internal/resources/kubeclient.go`

```go
package resources

import (
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/fake"
	"log"
	runtime "sigs.k8s.io/controller-runtime"
)

// NewKubeClient returns a kubernetes client already configured
func NewKubeClient() kubernetes.Interface {
	config, err := runtime.GetConfig()

	if err != nil {
		log.Fatalf("Unable to get kubeconfig.\n%v", err)
	}

	client, err := kubernetes.NewForConfig(config)

	if err != nil {
		log.Fatalf("Unable to create a Kubernetes client from the kubeconfig.\n%v", err)
	}

	return client
}

func NewFakeKubeClient() kubernetes.Interface {
	return fake.NewSimpleClientset()
}

```
###  Path: `/internal/resources/manager.go`

```go
package resources

import (
	"context"
	k8sclient "k8s.io/client-go/kubernetes"
)

// Manager allows to list and manage the life-cycle of the various K8s cluster resources managed by the PermissionManager.
type Manager struct {
	kubeclient                     k8sclient.Interface
	context                        context.Context
	ClusterNamespace               string
	V1Alpha1PermissionManagerUser  V1Alpha1PermissionManagerUser
	V1Alpha1PermissionManagerGroup V1Alpha1PermissionManagerGroup
}

// NewManager returns a new instance of a ResourceService
// allowing to interact with a K8s cluster via the given K8s client interface.
func NewManager(kc k8sclient.Interface, ctx context.Context, clusterNamespace string) *Manager {
	return &Manager{
		kubeclient:                     kc,
		context:                        ctx,
		ClusterNamespace:               clusterNamespace,
		V1Alpha1PermissionManagerUser:  V1Alpha1PermissionManagerUser{kubeclient: kc, context: ctx},
		V1Alpha1PermissionManagerGroup: V1Alpha1PermissionManagerGroup{kubeclient: kc, context: ctx},
	}
}

```
###  Path: `/internal/resources/namespace.go`

```go
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

```
###  Path: `/internal/resources/namespace_test.go`

```go
package resources

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestListNamespaces(t *testing.T) {
	kc := NewFakeKubeClient()
	ctx := context.Background()

	svc := NewManager(kc, ctx, "permission-manager")

	names, err := svc.NamespaceList()

	got := names
	want := []string{}
	if assert.NoError(t, err) {
		assert.ElementsMatch(t, want, got)
	}

	// svc.UserCreate("jaga")
	// svc.UserCreate("jacopo")

	// names, err = svc.GetNamespaces()
	// got = names
	// want = []string{"jaga", "jacopo"}
	// if assert.NoError(t, err) {
	// assert.ElementsMatch(t, want, got)
	// }
}

```
###  Path: `/internal/resources/role.go`

```go
package resources

import (
	rbacv1 "k8s.io/api/rbac/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (r *Manager) RoleList(namespace string) (*rbacv1.RoleList, error) {
	return r.kubeclient.RbacV1().Roles(namespace).List(r.context, metav1.ListOptions{})
}
func (r *Manager) RoleDelete(namespace, roleName string) error {
	return r.kubeclient.RbacV1().Roles(namespace).Delete(r.context, roleName, metav1.DeleteOptions{})

}

```
###  Path: `/internal/resources/secrets.go`

```go
package resources

import (
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (r *Manager) SecretGet(namespace, name string) (*v1.Secret, error) {
	return r.kubeclient.CoreV1().Secrets(namespace).Get(r.context, name, metav1.GetOptions{})
}

func (r *Manager) SecretCreate(namespace string, secret *v1.Secret) (*v1.Secret, error) {
	return r.kubeclient.CoreV1().Secrets(namespace).Create(r.context, secret, metav1.CreateOptions{})
}

func (r *Manager) SecretUpdate(namespace string, secret *v1.Secret) (*v1.Secret, error) {
	return r.kubeclient.CoreV1().Secrets(namespace).Update(r.context, secret, metav1.UpdateOptions{})
}

```
###  Path: `/internal/resources/serviceaccount.go`

```go
package resources

import (
	b64 "encoding/base64"
	"fmt"
	"log"
	"sighupio/permission-manager/internal/config"
	"strings"
	"time"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (r *Manager) ServiceAccountGet(namespace, name string) (*v1.ServiceAccount, error) {
	return r.kubeclient.CoreV1().ServiceAccounts(namespace).Get(r.context, name, metav1.GetOptions{})
}

func (r *Manager) ServiceAccountCreate(namespace, name string) (*v1.ServiceAccount, error) {
	return r.kubeclient.CoreV1().ServiceAccounts(namespace).Create(r.context, &v1.ServiceAccount{
		ObjectMeta: metav1.ObjectMeta{
			Name: name,
		},
	}, metav1.CreateOptions{})
}

// ServiceAccountCreateKubeConfigForUser Creates a ServiceAccount for the user and returns the KubeConfig with its token
func (r *Manager) ServiceAccountCreateKubeConfigForUser(cluster config.ClusterConfig, username, kubeConfigNamespace string) (kubeconfigYAML string) {
	friendlyName := username
	username = SanitizeUsername(username)

	serviceAccountNamespace := cluster.Namespace

	var serviceAccount *v1.ServiceAccount = nil
	var accountSecret *v1.Secret = nil
	var err error

	/****  handle service account start ****/
	serviceAccount, err = r.ServiceAccountGet(serviceAccountNamespace, username)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			serviceAccount = nil
		} else {
			log.Printf("Inital get secret failed: %v", err)
		}
	}

	if serviceAccount == nil {
		serviceAccount, err = r.ServiceAccountCreate(serviceAccountNamespace, username)
		if err != nil {
			log.Printf("Service Account not created: %v", err)
		}
		// Fix #2: Give Kubernetes time to process the new service account before attempting
		// to create its token secret. Uses a context-aware select so the goroutine is freed
		// immediately if the HTTP request is cancelled or times out.
		select {
		case <-r.context.Done():
			return ""
		case <-time.After(2 * time.Second):
		}
	}
	/****  handle service account end ****/

	/****  handle service account's secret ****/
	accountSecret, err = r.SecretGet(serviceAccountNamespace, username)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			accountSecret = nil
		} else {
			log.Printf("Inital get secret failed: %v", err)
		}
	}

	// if user delete the secret of the account this will allow generate a new one as well)
	if accountSecret == nil {
		// create secrete for the service account
		var secret = new(v1.Secret)
		secret.SetName(username)
		// ensure the name and the uid match to the account name and account uid, which will be used for authentication by the k8s
		secret.SetAnnotations(map[string]string{
			"kubernetes.io/service-account.name": username,
			"kubernetes.io/service-account.uid":  string(serviceAccount.GetUID()),
		})

		// type kubernetes.io/service-account-token will automatically map the root.ca and create a token to the Data of service account
		secret.Type = "kubernetes.io/service-account-token"
		// create secreat
		_, err = r.SecretCreate(serviceAccountNamespace, secret)

		if err != nil {
			log.Printf("Account Secret not created: %v", err)
		}

		// Fix #2: Poll until Kubernetes populates the token into the secret.
		// Max wait: 20 × 500ms = 10 seconds. Each sleep is context-aware so the
		// goroutine is released immediately if the request is cancelled or times out.
		for i := 1; i <= 20; i++ {
			accountSecret, err = r.SecretGet(serviceAccountNamespace, username)
			if err != nil {
				log.Printf("Get Secret for account %v failed: %v", username, err)
				break
			}

			if accountSecret.Data["ca.crt"] != nil && len(accountSecret.Data["token"]) > 0 {
				break
			}
			// Context-aware sleep: exits early on client disconnect / timeout.
			select {
			case <-r.context.Done():
				return ""
			case <-time.After(500 * time.Millisecond):
			}
		}
	}
	/****  handle service account's end ****/

	certificateTpl := `---
apiVersion: v1
kind: Config
current-context: %s@%s
clusters:
  - cluster:
      certificate-authority-data: %s
      server: %s
    name: %s
contexts:
  - context:
      cluster: %s
      user: %s
      namespace: %s
    name: %s@%s
users:
  - name: %s
    user:
      token: %s`

	return fmt.Sprintf(certificateTpl,
		friendlyName,
		cluster.Name,
		b64.StdEncoding.EncodeToString(accountSecret.Data["ca.crt"]),
		cluster.ControlPlaneAddress,
		cluster.Name,
		cluster.Name,
		username,
		kubeConfigNamespace,
		friendlyName,
		cluster.Name,
		username,
		accountSecret.Data["token"],
	)
}

```
###  Path: `/internal/resources/serviceaccount_test.go`

```go
package resources

import (
	"context"
	"sighupio/permission-manager/internal/config"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCreateKubeconfig(t *testing.T) {
	t.Skip("needs refactor")

	clusterConfig := config.ClusterConfig{
		Name:                "My-cluster",
		ControlPlaneAddress: "https://100.200.10.200",
		Namespace:           "test",
	}

	rs := NewManager(NewFakeKubeClient(), context.TODO(), "permission-manager")

	got := rs.ServiceAccountCreateKubeConfigForUser(clusterConfig, "john.doe", "test")

	want := `---
apiVersion: v1
kind: Config
current-context: john.doe@My-cluster
clusters:
  - cluster:
      certificate-authority-data: CA_BASE64
      server: https://100.200.10.200
    name: My-cluster
contexts:
  - context:
      cluster: My-cluster
      user: john.doe
      namespace: test
    name: john.doe@My-cluster
users:
  - name: john.doe
    user:
      token: TOKEN`

	assert.Equal(t, want, got)
}

```
###  Path: `/internal/resources/sync.go`

```go
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

```
###  Path: `/internal/resources/v1alpha1_permissionmanagergroup.go`

```go
package resources

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sighupio/permission-manager/internal/crd/v1alpha1"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sclient "k8s.io/client-go/kubernetes"
)

type V1Alpha1PermissionManagerGroup struct {
	kubeclient k8sclient.Interface
	context    context.Context
}

type Group struct {
	Name         string                                  `json:"name"`
	FriendlyName string                                  `json:"friendlyName,omitempty"`
	Resources    []v1alpha1.PermissionManagerUserResource `json:"resources,omitempty"`
}

func (r *V1Alpha1PermissionManagerGroup) List() ([]Group, error) {
	groups := []Group{}

	rawResponse, err := r.kubeclient.Discovery().RESTClient().Get().AbsPath(v1alpha1.GroupResourceURL).DoRaw(r.context)

	if err != nil {
		log.Print("Failed to get groups from k8s CRUD api", err)
		return []Group{}, err
	}

	var getAllGroupResponse v1alpha1.PermissionManagerGroupList
	err = json.Unmarshal(rawResponse, &getAllGroupResponse)

	if err != nil {
		log.Print("Failed to decode groups from k8s CRUD api", err)
		return []Group{}, err
	}

	for _, v := range getAllGroupResponse.Items {
		g := Group{
			Name:      v.Spec.Name,
			Resources: v.Spec.Resources,
		}
		if v.Spec.FriendlyName != "" {
			g.FriendlyName = v.Spec.FriendlyName
		} else {
			g.FriendlyName = v.Spec.Name
		}
		groups = append(groups, g)
	}

	return groups, nil
}

func (r *V1Alpha1PermissionManagerGroup) Create(groupname string, resources []v1alpha1.PermissionManagerUserResource) (Group, error) {
	friendlyName := groupname
	name := SanitizeUsername(groupname)

	metadataName := v1alpha1.GroupPrefix + name

	createGroupRequest := v1alpha1.PermissionManagerGroup{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "permissionmanager.user/v1alpha1",
			Kind:       "Permissionmanagergroup",
		},
		Metadata: metav1.ObjectMeta{
			Name: metadataName,
		},
		Spec: v1alpha1.PermissionManagerGroupSpec{
			Name:         name,
			FriendlyName: friendlyName,
			Resources:    resources,
		},
	}
	jsonPayload, err := json.Marshal(createGroupRequest)

	if err != nil {
		return Group{}, err
	}

	_, err = r.kubeclient.Discovery().RESTClient().Post().AbsPath(v1alpha1.GroupResourceURL).Body(jsonPayload).DoRaw(r.context)

	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "already exists") {
			return Group{Name: name, FriendlyName: friendlyName, Resources: resources}, nil
		}
		return Group{}, err
	}

	return Group{Name: name, FriendlyName: friendlyName, Resources: resources}, nil
}

func (r *V1Alpha1PermissionManagerGroup) Get(groupname string) (v1alpha1.PermissionManagerGroup, error) {
	metadataName := v1alpha1.GroupPrefix + groupname

	rawResponse, err := r.kubeclient.Discovery().RESTClient().Get().AbsPath(v1alpha1.GroupResourceURL + "/" + metadataName).DoRaw(r.context)

	if err != nil {
		return v1alpha1.PermissionManagerGroup{}, err
	}

	var group v1alpha1.PermissionManagerGroup
	err = json.Unmarshal(rawResponse, &group)

	return group, err
}

func (r *V1Alpha1PermissionManagerGroup) Update(group v1alpha1.PermissionManagerGroup) (Group, error) {
	jsonPayload, err := json.Marshal(group)

	if err != nil {
		return Group{}, err
	}

	_, err = r.kubeclient.Discovery().RESTClient().Put().AbsPath(v1alpha1.GroupResourceURL + "/" + group.Metadata.Name).SetHeader("Content-Type", "application/json").SetHeader("Accept", "application/json").Body(jsonPayload).DoRaw(r.context)

	if err != nil {
		return Group{}, err
	}

	return Group{
		Name:         group.Spec.Name,
		FriendlyName: group.Spec.FriendlyName,
		Resources:    group.Spec.Resources,
	}, nil
}

func (r *V1Alpha1PermissionManagerGroup) Delete(groupname string) error {
	metadataName := v1alpha1.GroupPrefix + groupname

	_, err := r.kubeclient.Discovery().RESTClient().Delete().AbsPath(v1alpha1.GroupResourceURL + "/" + metadataName).DoRaw(r.context)

	return err
}

```
###  Path: `/internal/resources/v1alpha1_permissionmanageruser.go`

```go
package resources

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"time"
	"sighupio/permission-manager/internal/crd/v1alpha1"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sclient "k8s.io/client-go/kubernetes"
)

type V1Alpha1PermissionManagerUser struct {
	kubeclient k8sclient.Interface
	context    context.Context
}

// User is the API exposed data of a PermissionManagerUser resource. TODO deprecate.
type User struct {
	Name         string                                  `json:"name"`
	FriendlyName string                                  `json:"friendlyName,omitempty"`
	MaxDays      int                                     `json:"maxDays,omitempty"`
	Groups       []string                                `json:"groups,omitempty"`
	Resources    []v1alpha1.PermissionManagerUserResource `json:"resources,omitempty"`
	CreatedAt    string                                  `json:"createdAt,omitempty"`
}

// List returns the list of Users defined in the K8s cluster.
func (r *V1Alpha1PermissionManagerUser) List() ([]User, error) {
	//noinspection GoPreferNilSlice
	users := []User{}

	rawResponse, err := r.kubeclient.Discovery().RESTClient().Get().AbsPath(v1alpha1.ResourceURL).DoRaw(r.context)

	if err != nil {
		log.Print("Failed to get users from k8s CRUD api", err)
		return []User{}, err
	}

	// generated from the api-server JSON response, most of the fields are not used but useful as documentation
	var getAllUserResponse v1alpha1.PermissionManagerUserList
	err = json.Unmarshal(rawResponse, &getAllUserResponse)

	if err != nil {
		log.Print("Failed to decode users from k8s CRUD api", err)
		return []User{}, err
	}

	for _, v := range getAllUserResponse.Items {
		u := User{
			Name:      v.Spec.Name,
			MaxDays:   v.Spec.MaxDays,
			Groups:    v.Spec.Groups,
			Resources: v.Spec.Resources,
			CreatedAt: v.Metadata.CreationTimestamp.Format(time.RFC3339),
		}
		if v.Spec.FriendlyName != "" {
			u.FriendlyName = v.Spec.FriendlyName
		} else {
			u.FriendlyName = v.Spec.Name
		}
		users = append(users, u)
	}

	return users, nil
}

// ListByGroup returns the list of Users that belong to the given group.
func (r *V1Alpha1PermissionManagerUser) ListByGroup(groupname string) ([]User, error) {
	allUsers, err := r.List()
	if err != nil {
		return nil, err
	}

	users := []User{}
	for _, u := range allUsers {
		for _, g := range u.Groups {
			if g == groupname {
				users = append(users, u)
				break
			}
		}
	}

	return users, nil
}

// SanitizeUsername replaces characters not allowed in Kubernetes resource names (like @ and .) with dashes.
func SanitizeUsername(username string) string {
	name := strings.ReplaceAll(username, "@", "-")
	name = strings.ReplaceAll(name, ".", "-")
	return name
}

// Create adds a new User with the given username to the K8s cluster
// creating a new PermissionManagerUser CRD object. todo add error handling
func (r *V1Alpha1PermissionManagerUser) Create(username string, maxDays int, groups []string, resources []v1alpha1.PermissionManagerUserResource) (User, error) {
	friendlyName := username
	name := SanitizeUsername(username)

	metadataName := v1alpha1.ResourcePrefix + name

	createUserRequest := v1alpha1.PermissionManagerUser{
		TypeMeta: metav1.TypeMeta{
			APIVersion: "permissionmanager.user/v1alpha1",
			Kind:       "Permissionmanageruser",
		},
		Metadata: metav1.ObjectMeta{
			Name: metadataName,
		},
		Spec: v1alpha1.PermissionManagerUserSpec{
			Name:         name,
			FriendlyName: friendlyName,
			MaxDays:      maxDays,
			Groups:       groups,
			Resources:    resources,
		},
	}
	jsonPayload, err := json.Marshal(createUserRequest)

	if err != nil {
		log.Printf("failed to serialize data")
		return User{}, err
	}

	_, err = r.kubeclient.Discovery().RESTClient().Post().AbsPath(v1alpha1.ResourceURL).SetHeader("Content-Type", "application/json").SetHeader("Accept", "application/json").Body(jsonPayload).DoRaw(r.context)

	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "already exists") {
			return User{Name: name, FriendlyName: friendlyName, MaxDays: maxDays, Resources: resources}, nil
		}
		log.Printf("Failed to create PermissionManagerUser:%s\n %v\n", username, err)
		return User{}, err
	}

	return User{Name: name, FriendlyName: friendlyName, MaxDays: maxDays, Resources: resources}, nil
}

// Get returns a User with the given username from the K8s cluster
func (r *V1Alpha1PermissionManagerUser) Get(username string) (v1alpha1.PermissionManagerUser, error) {
	metadataName := v1alpha1.ResourcePrefix + username

	rawResponse, err := r.kubeclient.Discovery().RESTClient().Get().AbsPath(v1alpha1.ResourceURL + "/" + metadataName).DoRaw(r.context)

	if err != nil {
		log.Printf("Failed to get PermissionManagerUser:%s\n %v\n", username, err)
		return v1alpha1.PermissionManagerUser{}, err
	}

	var user v1alpha1.PermissionManagerUser
	err = json.Unmarshal(rawResponse, &user)

	if err != nil {
		log.Printf("Failed to decode PermissionManagerUser:%s\n %v\n", username, err)
		return v1alpha1.PermissionManagerUser{}, err
	}

	return user, nil
}

// Update updates an existing User in the K8s cluster
func (r *V1Alpha1PermissionManagerUser) Update(user v1alpha1.PermissionManagerUser) (User, error) {
	jsonPayload, err := json.Marshal(user)

	if err != nil {
		log.Printf("failed to serialize data")
		return User{}, err
	}

	_, err = r.kubeclient.Discovery().RESTClient().Put().AbsPath(v1alpha1.ResourceURL + "/" + user.Metadata.Name).Body(jsonPayload).DoRaw(r.context)

	if err != nil {
		log.Printf("Failed to update PermissionManagerUser:%s\n %v\n", user.Spec.Name, err)
		return User{}, err
	}

	return User{
		Name:         user.Spec.Name,
		FriendlyName: user.Spec.FriendlyName,
		MaxDays:      user.Spec.MaxDays,
		Groups:       user.Spec.Groups,
		Resources:    user.Spec.Resources,
		CreatedAt:    user.Metadata.CreationTimestamp.Format(time.RFC3339),
	}, nil
}

// Delete delete an existing User from the K8s cluster removing
// the PermissionManagerUser CRD object associated to the PermissionManagerUser with the given username.
func (r *V1Alpha1PermissionManagerUser) Delete(username string) error {
	metadataName := v1alpha1.ResourcePrefix + username

	_, err := r.kubeclient.Discovery().RESTClient().Delete().AbsPath(v1alpha1.ResourceURL + "/" + metadataName).DoRaw(r.context)

	if err == nil {
		return nil
	}

	log.Printf("Failed to delete PermissionManagerUser:%s\n %v\n", username, err)

	return err
}

```
###  Path: `/internal/resources/v1alpha1_permissionmanageruser_test.go`

```go
package resources

import (
	"testing"
)

/*
need to understand how to test CRD not created sdk

this might help: https://github.com/spotahome/service-level-operator/blob/master/pkg/service/client/kubernetes/fake.go#L14
*/
func TestUserService(t *testing.T) {
	// kc := fake.NewSimpleClientset()
	// svc := NewUserService(kc)
	// assert.Equal(t, svc.GetAll(), []User{})
}

```
###  Path: `/internal/server/appcontext.go`

```go
package server

import (
	"github.com/labstack/echo/v4"
	"net/http"
	"sighupio/permission-manager/internal/config"
	"sighupio/permission-manager/internal/resources"
)

// AppContext echo context extended with application specific fields
type AppContext struct {
	echo.Context
	ResourceManager *resources.Manager
	Config          config.Config
}

type ErrorRes struct {
	Error string `json:"error"`
}

// OkRes to deprecate. No reason in sending this struct, there is already HTTP Code 2xx for that
type OkRes struct {
	Ok bool `json:"ok"`
}

func (c *AppContext) validateAndBindRequest(r interface{}) error {

	if err := c.Bind(r); err != nil {
		return err
	}

	if err := c.Validate(r); err != nil {
		return c.errorResponse(err.Error())
	}

	return nil
}

// to deprecate. No reason in sending OkRes struct, there is already HTTP Code 2xx for that
func (c *AppContext) okResponse() error {
	return c.JSON(http.StatusOK, OkRes{Ok: true})
}

func (c *AppContext) okResponseWithData(response interface{}) error {
	return c.JSON(http.StatusOK, response)

}

func (c *AppContext) errorResponse(error string) error {
	return c.JSON(http.StatusBadRequest, ErrorRes{error})

}

```
###  Path: `/internal/server/clusterrole.go`

```go
package server

import (
	"github.com/labstack/echo/v4"
	rbacv1 "k8s.io/api/rbac/v1"
)

func createClusterRole(c echo.Context) error {
	type Request struct {
		RoleName string              `json:"roleName" validate:"required"`
		Rules    []rbacv1.PolicyRule `json:"rules" validate:"required"`
	}
	ac := c.(*AppContext)

	r := new(Request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	_, err = ac.ResourceManager.ClusterRoleCreate(r.RoleName, r.Rules)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponse()
}

func updateClusterRole(c echo.Context) error {
	type Request struct {
		RoleName string              `json:"roleName" validate:"required"`
		Rules    []rbacv1.PolicyRule `json:"rules" validate:"required"`
	}
	ac := c.(*AppContext)

	r := new(Request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	_, err = ac.ResourceManager.ClusterRoleUpdate(r.RoleName, r.Rules)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponse()
}


func deleteClusterRole(c echo.Context) error {
	ac := c.(*AppContext)
	type Request struct {
		RoleName string `json:"roleName" validate:"required"`
	}

	r := new(Request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	err = ac.ResourceManager.ClusterRoleDelete(r.RoleName)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponse()
}

```
###  Path: `/internal/server/fallbackresponse.go`

```go
package server

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
)

// FallbackResponseWriter wraps an http.Requesthandler and surpresses
// a 404 status code. In such case a given local file will be served.
type FallbackResponseWriter struct {
	WrappedResponseWriter http.ResponseWriter
	FileNotFound          bool
}

func addFallbackHandler(handler http.HandlerFunc, fs http.FileSystem) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		frw := FallbackResponseWriter{
			WrappedResponseWriter: w,
			FileNotFound:          false,
		}
		handler(&frw, r)
		if frw.FileNotFound {
			f, err := fs.Open("/index.html")
			if err != nil {
				log.Fatal("Failed to open index.html")
			}
			defer f.Close()
			content, err := ioutil.ReadAll(f)
			if err != nil {
				log.Fatal("Failed to read index.html")
			}

			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			fmt.Fprint(w, string(content))
		}
	}
}

// Header returns the header of the wrapped response writer
func (frw *FallbackResponseWriter) Header() http.Header {
	return frw.WrappedResponseWriter.Header()
}

// Write sends bytes to wrapped response writer, in case of FileNotFound
// It surpresses further writes (concealing the fact though)
func (frw *FallbackResponseWriter) Write(b []byte) (int, error) {
	if frw.FileNotFound {
		return len(b), nil
	}
	return frw.WrappedResponseWriter.Write(b)
}

// WriteHeader sends statusCode to wrapped response writer
func (frw *FallbackResponseWriter) WriteHeader(statusCode int) {

	if statusCode == http.StatusNotFound {
		frw.FileNotFound = true
		return
	}

	frw.WrappedResponseWriter.WriteHeader(statusCode)
}

```
###  Path: `/internal/server/groups.go`

```go
package server

import (
	"log"
	"sighupio/permission-manager/internal/crd/v1alpha1"
	"sighupio/permission-manager/internal/resources"

	"github.com/labstack/echo/v4"
)

func listGroups(c echo.Context) error {
	ac := c.(*AppContext)

	groups, err := ac.ResourceManager.V1Alpha1PermissionManagerGroup.List()

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponseWithData(groups)
}

func createGroup(c echo.Context) error {
	ac := c.(*AppContext)

	type request struct {
		Name      string                                   `json:"name" validate:"required"`
		Resources []v1alpha1.PermissionManagerUserResource `json:"resources"`
	}

	type response = resources.Group

	r := new(request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	if r.Resources == nil {
		r.Resources = make([]v1alpha1.PermissionManagerUserResource, 0)
	}

	g, err := ac.ResourceManager.V1Alpha1PermissionManagerGroup.Create(r.Name, r.Resources)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	if err := ac.ResourceManager.SyncGroup(r.Name); err != nil {
		log.Printf("Failed to sync group %s: %v", r.Name, err)
	}

	return ac.okResponseWithData(g)
}

func updateGroup(c echo.Context) error {
	ac := c.(*AppContext)

	type request struct {
		Name      string                                   `json:"name" validate:"required"`
		Resources []v1alpha1.PermissionManagerUserResource `json:"resources"`
	}

	r := new(request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	group, err := ac.ResourceManager.V1Alpha1PermissionManagerGroup.Get(r.Name)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	if r.Resources == nil {
		r.Resources = make([]v1alpha1.PermissionManagerUserResource, 0)
	}

	group.Spec.Resources = r.Resources

	g, err := ac.ResourceManager.V1Alpha1PermissionManagerGroup.Update(group)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	if err := ac.ResourceManager.SyncGroup(r.Name); err != nil {
		log.Printf("Failed to sync group %s: %v", r.Name, err)
	}

	return ac.okResponseWithData(g)
}

func deleteGroup(c echo.Context) error {
	ac := c.(*AppContext)

	type request struct {
		Name string `json:"name" validate:"required"`
	}

	r := new(request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	// Clean up group's bindings
	if err := ac.ResourceManager.RoleBindingDeleteAllForGroup(r.Name); err != nil {
		log.Printf("Failed to delete role bindings for group %s: %v", r.Name, err)
	}
	if err := ac.ResourceManager.ClusterRoleBindingDeleteAllForGroup(r.Name); err != nil {
		log.Printf("Failed to delete cluster role bindings for group %s: %v", r.Name, err)
	}

	err = ac.ResourceManager.V1Alpha1PermissionManagerGroup.Delete(r.Name)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponse()
}

```
###  Path: `/internal/server/handlers.go`

```go
package server

import (
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	rbacv1 "k8s.io/api/rbac/v1"
)

func ListNamespaces(c echo.Context) error {
	ac := c.(*AppContext)

	type Response struct {
		Namespaces []string `json:"namespaces"`
	}

	names, err := ac.ResourceManager.NamespaceList()

	if err != nil {
		return err
	}

	return ac.okResponseWithData(Response{
		Namespaces: names,
	})
}

func listRbac(c echo.Context) error {
	ac := c.(*AppContext)
	type Response struct {
		ClusterRoles        []rbacv1.ClusterRole        `json:"clusterRoles"`
		ClusterRoleBindings []rbacv1.ClusterRoleBinding `json:"clusterRoleBindings"`
		Roles               []rbacv1.Role               `json:"roles"`
		RoleBindings        []rbacv1.RoleBinding        `json:"roleBindings"`
	}

	clusterRoles, err := ac.ResourceManager.ClusterRoleList()

	if err != nil {
		return err
	}

	clusterRoleBindings, err := ac.ResourceManager.ClusterRoleBindingList()

	if err != nil {
		return err
	}

	roles, err := ac.ResourceManager.RoleList("")

	if err != nil {
		return err
	}

	roleBindings, err := ac.ResourceManager.RoleBindingList("")

	if err != nil {
		return err
	}

	return ac.okResponseWithData(Response{
		ClusterRoles:        clusterRoles.Items,
		ClusterRoleBindings: clusterRoleBindings.Items,
		Roles:               roles.Items,
		RoleBindings:        roleBindings.Items,
	})

}

func checkLegacyUser(c echo.Context) error {
	type Request struct {
		Username   string   `json:"username"`
		Namespaces []string `json:"namespaces"`
	}

	type Response struct {
		Ok                 bool `json:"ok"`
		LegacyUserDetected bool `json:"legacyUserDetected"`
	}

	ac := c.(*AppContext)
	r := new(Request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	// if no namespace is set we set the value ["default"]
	if len(r.Namespaces) == 0 {
		r.Namespaces = []string{"default"}
	}

	legacyRoleBindingFound := false

	for _, namespace := range r.Namespaces {
		legacyRoleBinding, err := ac.ResourceManager.RoleBindingLegacyCheck(namespace, r.Username)

		if err != nil {
			return err
		}

		if legacyRoleBinding != nil {
			legacyRoleBindingFound = true
			break
		}
	}

	legacyClusterRoleBinding, err := ac.ResourceManager.ClusterRoleBindingLegacyCheck(r.Username)

	if err != nil {
		return err
	}

	return c.JSON(http.StatusOK, Response{Ok: true, LegacyUserDetected: legacyRoleBindingFound || legacyClusterRoleBinding != nil})
}

func createKubeconfig(c echo.Context) error {
	type Request struct {
		Username  string `json:"username"`
		Namespace string `json:"namespace"`
	}
	type Response struct {
		Ok         bool   `json:"ok"`
		Kubeconfig string `json:"kubeconfig"`
		Error      string `json:"error,omitempty"`
	}

	ac := c.(*AppContext)
	r := new(Request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	// Check for user expiration
	user, err := ac.ResourceManager.V1Alpha1PermissionManagerUser.Get(r.Username)
	if err == nil && user.Spec.MaxDays > 0 {
		creationTime := user.Metadata.CreationTimestamp.Time
		expirationTime := creationTime.AddDate(0, 0, user.Spec.MaxDays)
		if time.Now().After(expirationTime) {
			return c.JSON(http.StatusForbidden, Response{
				Ok:    false,
				Error: fmt.Sprintf("User %s has expired on %s", r.Username, expirationTime.Format("2006-01-02")),
			})
		}
	}

	// if no namespace is set we set the value "default"
	if r.Namespace == "" {
		r.Namespace = "default"
	}

	kubeCfg := ac.ResourceManager.ServiceAccountCreateKubeConfigForUser(ac.Config.Cluster, r.Username, r.Namespace)

	return c.JSON(http.StatusOK, Response{Ok: true, Kubeconfig: kubeCfg})
}

func createNamespace(c echo.Context) error {
	type Request struct {
		Name string `json:"name"`
	}
	type Response struct {
		Ok bool `json:"ok"`
	}

	ac := c.(*AppContext)
	r := new(Request)

	if err := ac.validateAndBindRequest(r); err != nil {
		return err
	}

	if !isValidK8sName(r.Name) {
		return ac.errorResponse(invalidK8sNameError)
	}

	if err := ac.ResourceManager.NamespaceCreate(r.Name); err != nil {
		return err
	}

	return c.JSON(http.StatusOK, Response{Ok: true})
}

func deleteNamespace(c echo.Context) error {
	type Request struct {
		Name string `json:"name"`
	}
	type Response struct {
		Ok       bool   `json:"ok"`
		ErrorMsg string `json:"errorMsg,omitempty"`
	}

	ac := c.(*AppContext)
	r := new(Request)

	if err := ac.validateAndBindRequest(r); err != nil {
		return err
	}

	if err := ac.ResourceManager.NamespaceDelete(r.Name); err != nil {
		// Send the error message cleanly so the UI can display it
		return c.JSON(http.StatusBadRequest, Response{Ok: false, ErrorMsg: err.Error()})
	}

	return c.JSON(http.StatusOK, Response{Ok: true})
}

```
###  Path: `/internal/server/handlers_test.go`

```go
package server

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestUsernameValidation(t *testing.T) {
	assert.True(t, isValidUsername("gino"))
	assert.True(t, isValidUsername("gino-pino"))
	assert.True(t, isValidUsername("gino@pino"))  // @ is valid for email-style usernames
	assert.True(t, isValidUsername("gino.pino"))
	assert.False(t, isValidUsername("Gino"))
}

```
###  Path: `/internal/server/role.go`

```go
package server

import (
	"sighupio/permission-manager/internal/resources"

	"github.com/labstack/echo/v4"
	rbacv1 "k8s.io/api/rbac/v1"
)

func deleteRole(c echo.Context) error {
	ac := c.(*AppContext)

	type Request struct {
		RoleName  string `json:"roleName" validate:"required"`
		Namespace string `json:"namespace" validate:"required"`
	}

	r := new(Request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	err = ac.ResourceManager.RoleDelete(r.Namespace, r.RoleName)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponse()
}

func deleteRolebinding(c echo.Context) error {
	ac := c.(*AppContext)

	type Request struct {
		RolebindingName string `json:"rolebindingName" validate:"required"`
		Namespace       string `json:"namespace" validate:"required"`
	}

	r := new(Request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	err = ac.ResourceManager.RoleBindingDelete(r.Namespace, r.RolebindingName)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponse()
}

func createRoleBinding(c echo.Context) error {
	ac := c.(*AppContext)

	type Request struct {
		RolebindingName string           `json:"rolebindingName" validate:"required"`
		Namespace       string           `json:"namespace" validate:"required"`
		Username        string           `json:"generated_for_user"`
		GroupName       string           `json:"generated_for_group"`
		Subjects        []rbacv1.Subject `json:"subjects" validate:"required"`
		RoleKind        string           `json:"roleKind" validate:"required"`
		RoleName        string           `json:"roleName" validate:"required"`
	}
	r := new(Request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	// This is only a workaround: https://github.com/sighupio/permission-manager/issues/140
	var subjs []rbacv1.Subject
	for _, s := range r.Subjects {
		s.Namespace = ac.Config.Cluster.Namespace
		subjs = append(subjs, s)
	}

	if r.GroupName != "" {
		users, err := ac.ResourceManager.V1Alpha1PermissionManagerUser.ListByGroup(r.GroupName)
		if err != nil {
			return ac.errorResponse(err.Error())
		}
		
		subjs = []rbacv1.Subject{}
		for _, u := range users {
			subjs = append(subjs, rbacv1.Subject{
				Kind:      "ServiceAccount",
				Name:      u.Name,
				Namespace: ac.Config.Cluster.Namespace,
			})
		}

		_, err = ac.ResourceManager.RoleBindingCreateForGroup(r.Namespace, r.GroupName, resources.RoleBindingRequirements{
			RoleKind:        r.RoleKind,
			RoleName:        r.RoleName,
			RolebindingName: r.RolebindingName,
			Subjects:        subjs,
		})
	} else {
		_, err = ac.ResourceManager.RoleBindingCreate(r.Namespace, r.Username, resources.RoleBindingRequirements{
			RoleKind:        r.RoleKind,
			RoleName:        r.RoleName,
			RolebindingName: r.RolebindingName,
			Subjects:        subjs,
		})
	}

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponse()
}

```
###  Path: `/internal/server/server.go`

```go
package server

import (
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/go-playground/validator"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	k8sclient "k8s.io/client-go/kubernetes"

	"sighupio/permission-manager/internal/config"
	"sighupio/permission-manager/internal/resources"
	"sighupio/permission-manager/static"
)

func New(cfg config.Config) *echo.Echo {
	e := echo.New()

	e.Validator = &CustomValidator{validator: validator.New()}

	// Fix #1: Create a single shared Kubernetes client for the lifetime of the server.
	// The previous code called resources.NewKubeClient() inside a per-request middleware,
	// which allocates a new HTTP transport (with its own TLS dialer, connection pool, and
	// internal goroutines) for every request and never closes it — a goroutine and file
	// descriptor leak that compounds over time until OOM or "too many open files".
	kubeClient := resources.NewKubeClient()

	addMiddlewareStack(e, cfg, kubeClient)
	addRoutes(e)

	return e
}

// addMiddlewareStack configures global middleware.
// kubeClient is shared across all requests via the AppContext.
func addMiddlewareStack(e *echo.Echo, cfg config.Config, kubeClient k8sclient.Interface) {
	basicAuthPassword := os.Getenv("BASIC_AUTH_PASSWORD")

	if basicAuthPassword == "" {
		log.Fatal("BASIC_AUTH_PASSWORD env cannot be empty")
	}

	// Fix #6: Only enable CORS in local development.
	// In production the frontend is served from the same origin, so a permissive CORS
	// header is unnecessary overhead and a minor security risk. Set CORS_ENABLED=true
	// in your local .env / envrc to restore the previous behaviour during development.
	if os.Getenv("CORS_ENABLED") == "true" {
		e.Use(middleware.CORS())
	}

	e.Use(middleware.BasicAuth(func(username, password string, c echo.Context) (bool, error) {
		if username == "admin" && password == basicAuthPassword {
			return true, nil
		}
		return false, nil
	}))

	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: "method=${method}, uri=${uri}, status=${status}\n",
	}))

	fsys, err := fs.Sub(static.WebClient, "build")
	if err != nil {
		log.Fatal(err)
	}

	e.Group("/*", middleware.StaticWithConfig(middleware.StaticConfig{
		Root:       ".",
		Filesystem: http.FS(fsys),
		HTML5:      true,
	}))

	// Fix #1 (continued): NewManager is a cheap struct wrapper — safe to create per-request.
	// Only the underlying KubeClient (kubeClient) is shared and reused.
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			customContext := &AppContext{
				Context:         c,
				ResourceManager: resources.NewManager(kubeClient, c.Request().Context(), cfg.Cluster.Namespace),
				Config:          cfg,
			}
			return next(customContext)
		}
	})
}

func addRoutes(e *echo.Echo) {
	api := e.Group("/api")

	api.GET("/list-users", listUsers)
	api.GET("/list-groups", listGroups)
	api.GET("/list-namespace", ListNamespaces)
	api.GET("/rbac", listRbac)

	api.POST("/create-cluster-role", createClusterRole)
	api.POST("/update-cluster-role", updateClusterRole)
	api.POST("/create-user", createUser)
	api.POST("/update-user", updateUser)
	api.POST("/create-group", createGroup)
	api.POST("/update-group", updateGroup)
	api.POST("/create-rolebinding", createRoleBinding)
	api.POST("/create-cluster-rolebinding", createClusterRolebinding)

	/* should use DELETE method, using POST due to a weird bug that looks now resolved */
	api.POST("/delete-cluster-role", deleteClusterRole)
	api.POST("/delete-cluster-rolebinding", deleteClusterRolebinding)
	api.POST("/delete-rolebinding", deleteRolebinding)
	api.POST("/delete-role", deleteRole)
	api.POST("/delete-user", deleteUser)
	api.POST("/delete-group", deleteGroup)

	api.POST("/create-kubeconfig", createKubeconfig)
	api.POST("/check-legacy-user", checkLegacyUser)
	api.POST("/create-namespace", createNamespace)
	api.POST("/delete-namespace", deleteNamespace)

	api.GET("/settings", getSettings)
	api.POST("/settings", updateSettings)
	api.POST("/restart", restartApp)
}

```
###  Path: `/internal/server/settings.go`

```go
package server

import (
	"github.com/labstack/echo/v4"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func getSettings(c echo.Context) error {
	ac := c.(*AppContext)

	secret, err := ac.ResourceManager.SecretGet("permission-manager", "permission-manager")
	if err != nil {
		return ac.errorResponse(err.Error())
	}

	settings := make(map[string]string)
	for k, v := range secret.Data {
		settings[k] = string(v)
	}

	return ac.okResponseWithData(settings)
}

func updateSettings(c echo.Context) error {
	ac := c.(*AppContext)

	type Request struct {
		ClusterName         string `json:"CLUSTER_NAME"`
		ControlPlaneAddress string `json:"CONTROL_PLANE_ADDRESS"`
		BasicAuthPassword   string `json:"BASIC_AUTH_PASSWORD"`
	}

	r := new(Request)
	if err := ac.validateAndBindRequest(r); err != nil {
		return err
	}

	secret, err := ac.ResourceManager.SecretGet("permission-manager", "permission-manager")
	if err != nil {
		// If secret doesn't exist, create a new one
		secret = &v1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "permission-manager",
				Namespace: "permission-manager",
			},
			Data: make(map[string][]byte),
		}
	}

	if secret.Data == nil {
		secret.Data = make(map[string][]byte)
	}

	secret.Data["CLUSTER_NAME"] = []byte(r.ClusterName)
	secret.Data["CONTROL_PLANE_ADDRESS"] = []byte(r.ControlPlaneAddress)
	secret.Data["BASIC_AUTH_PASSWORD"] = []byte(r.BasicAuthPassword)

	// Update the secret in Kubernetes
	_, err = ac.ResourceManager.SecretUpdate("permission-manager", secret)
	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponse()
}

func restartApp(c echo.Context) error {
	ac := c.(*AppContext)

	err := ac.ResourceManager.DeploymentRestart("permission-manager", "permission-manager")
	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponse()
}

```
###  Path: `/internal/server/users.go`

```go
package server

import (
	"log"
	"sighupio/permission-manager/internal/crd/v1alpha1"
	"sighupio/permission-manager/internal/resources"

	"github.com/labstack/echo/v4"
)

func listUsers(c echo.Context) error {
	ac := c.(*AppContext)

	users, err := ac.ResourceManager.V1Alpha1PermissionManagerUser.List()

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponseWithData(users)
}

func createUser(c echo.Context) error {
	ac := c.(*AppContext)

	type request struct {
		Name      string                                   `json:"name" validate:"required"`
		MaxDays   int                                      `json:"maxDays"`
		Groups    []string                                 `json:"groups"`
		Resources []v1alpha1.PermissionManagerUserResource `json:"resources"`
	}

	type response = resources.User

	r := new(request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	if !isValidUsername(r.Name) {
		return ac.errorResponse(invalidUsernameError)
	}

	if r.Groups == nil {
		r.Groups = make([]string, 0)
	}
	if r.Resources == nil {
		r.Resources = make([]v1alpha1.PermissionManagerUserResource, 0)
	}

	u, err := ac.ResourceManager.V1Alpha1PermissionManagerUser.Create(r.Name, r.MaxDays, r.Groups, r.Resources)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	if err := ac.ResourceManager.SyncUser(r.Name); err != nil {
		log.Printf("Failed to sync user %s: %v", r.Name, err)
	}

	return ac.okResponseWithData(u)
}

func updateUser(c echo.Context) error {
	ac := c.(*AppContext)

	type request struct {
		Name      string                                   `json:"name" validate:"required"`
		MaxDays   int                                      `json:"maxDays"`
		Groups    []string                                 `json:"groups"`
		Resources []v1alpha1.PermissionManagerUserResource `json:"resources"`
	}

	r := new(request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	user, err := ac.ResourceManager.V1Alpha1PermissionManagerUser.Get(r.Name)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	oldGroups := user.Spec.Groups

	if r.Groups == nil {
		r.Groups = make([]string, 0)
	}
	if r.Resources == nil {
		r.Resources = make([]v1alpha1.PermissionManagerUserResource, 0)
	}

	user.Spec.MaxDays = r.MaxDays
	user.Spec.Groups = r.Groups
	user.Spec.Resources = r.Resources

	u, err := ac.ResourceManager.V1Alpha1PermissionManagerUser.Update(user)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	// Sync User Direct Bindings
	if err := ac.ResourceManager.SyncUser(r.Name); err != nil {
		log.Printf("Failed to sync user %s: %v", r.Name, err)
	}

	// Sync affected Group Bindings so the user is added/removed from them
	groupsToSync := make(map[string]bool)
	for _, g := range oldGroups {
		groupsToSync[g] = true
	}
	for _, g := range r.Groups {
		groupsToSync[g] = true
	}
	for g := range groupsToSync {
		if err := ac.ResourceManager.SyncGroup(g); err != nil {
			log.Printf("Failed to sync group %s: %v", g, err)
		}
	}

	return ac.okResponseWithData(u)
}

func deleteUser(c echo.Context) error {
	ac := c.(*AppContext)

	type Request struct {
		Username string `json:"username" validate:"required"`
	}

	r := new(Request)

	err := ac.validateAndBindRequest(r)

	if err != nil {
		return err
	}

	// We must get the user to know which groups to sync
	user, err := ac.ResourceManager.V1Alpha1PermissionManagerUser.Get(r.Username)
	if err == nil {
		for _, g := range user.Spec.Groups {
			defer func(group string) {
				if err := ac.ResourceManager.SyncGroup(group); err != nil {
					log.Printf("Failed to sync group %s: %v", group, err)
				}
			}(g)
		}
	}

	// Clean up user's bindings
	if err := ac.ResourceManager.RoleBindingDeleteAllForUser(r.Username); err != nil {
		log.Printf("Failed to delete role bindings for user %s: %v", r.Username, err)
	}
	if err := ac.ResourceManager.ClusterRoleBindingDeleteAllForUser(r.Username); err != nil {
		log.Printf("Failed to delete cluster role bindings for user %s: %v", r.Username, err)
	}

	err = ac.ResourceManager.V1Alpha1PermissionManagerUser.Delete(r.Username)

	if err != nil {
		return ac.errorResponse(err.Error())
	}

	return ac.okResponse()
}

```
###  Path: `/internal/server/validation.go`

```go
package server

import (
	"regexp"

	"github.com/go-playground/validator"
)

const validUsernameRegex = "^[a-z0-9]([-a-z0-9]*[a-z0-9])?([@\\.-][a-z0-9]([-a-z0-9]*[a-z0-9])?)*$"
const validK8sNameRegex = "^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"

var invalidUsernameError = `username must be lowercase alphanumeric, and can contain "-", ".", or "@" for emails, and must start and end with an alphanumeric character. regex used for validation is ` + validUsernameRegex
var invalidK8sNameError = `name must be lowercase alphanumeric and can contain "-", and must start and end with an alphanumeric character. regex used for validation is ` + validK8sNameRegex

func isValidUsername(username string) (valid bool) {
	re := regexp.MustCompile(validUsernameRegex)
	return re.MatchString(username)
}

func isValidK8sName(name string) (valid bool) {
	re := regexp.MustCompile(validK8sNameRegex)
	return re.MatchString(name)
}

type CustomValidator struct {
	validator *validator.Validate
}

func (cv *CustomValidator) Validate(i interface{}) error {
	return cv.validator.Struct(i)

}

```
---
**File Statistics**
- **Size**: 62.44 KB
- **Lines**: 2474
File: `docs/go-packages.md`
