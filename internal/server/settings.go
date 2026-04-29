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
