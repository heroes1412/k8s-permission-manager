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
