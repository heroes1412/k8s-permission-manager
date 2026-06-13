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
		if k == "BASIC_AUTH_PASSWORD" || k == "WEBHOOK_PROXY_PASSWORD" {
			settings[k] = "********" // Mask the password
		} else {
			settings[k] = string(v)
		}
	}

	return ac.okResponseWithData(settings)
}

func updateSettings(c echo.Context) error {
	ac := c.(*AppContext)

	type Request struct {
		ClusterName               string `json:"CLUSTER_NAME"`
		ControlPlaneAddress       string `json:"CONTROL_PLANE_ADDRESS"`
		BasicAuthPassword         string `json:"BASIC_AUTH_PASSWORD"`
		GroupsEnabled             string `json:"GROUPS_ENABLED"`
		ExpiredUserAction         string `json:"EXPIRED_USER_ACTION"`
		WebhookURL                string `json:"WEBHOOK_URL"`
		WebhookProxyURL           string `json:"WEBHOOK_PROXY_URL"`
		WebhookProxyUser          string `json:"WEBHOOK_PROXY_USER"`
		WebhookProxyPass          string `json:"WEBHOOK_PROXY_PASSWORD"`
		SystemProtectedNamespaces string `json:"SYSTEM_PROTECTED_NAMESPACES"`
	}

	r := new(Request)
	if err := ac.validateAndBindRequest(r); err != nil {
		return err
	}

	if r.ClusterName == "" || r.ControlPlaneAddress == "" {
		return ac.errorResponse("CLUSTER_NAME and CONTROL_PLANE_ADDRESS cannot be empty")
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
	
	// Only update the password if a new one was provided
	if r.BasicAuthPassword != "" && r.BasicAuthPassword != "********" {
		secret.Data["BASIC_AUTH_PASSWORD"] = []byte(r.BasicAuthPassword)
	}

	secret.Data["GROUPS_ENABLED"] = []byte(r.GroupsEnabled)
	secret.Data["EXPIRED_USER_ACTION"] = []byte(r.ExpiredUserAction)
	secret.Data["WEBHOOK_URL"] = []byte(r.WebhookURL)
	secret.Data["WEBHOOK_PROXY_URL"] = []byte(r.WebhookProxyURL)
	secret.Data["WEBHOOK_PROXY_USER"] = []byte(r.WebhookProxyUser)
	secret.Data["SYSTEM_PROTECTED_NAMESPACES"] = []byte(r.SystemProtectedNamespaces)
	
	if r.WebhookProxyPass != "" && r.WebhookProxyPass != "********" {
		secret.Data["WEBHOOK_PROXY_PASSWORD"] = []byte(r.WebhookProxyPass)
	} else if r.WebhookProxyPass == "" {
		// If explicitly cleared in UI, remove it
		delete(secret.Data, "WEBHOOK_PROXY_PASSWORD")
	}

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
