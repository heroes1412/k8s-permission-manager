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
