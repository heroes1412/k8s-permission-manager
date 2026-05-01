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
