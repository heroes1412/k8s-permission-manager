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

	_, err = r.kubeclient.Discovery().RESTClient().Post().AbsPath(v1alpha1.ResourceURL).Body(jsonPayload).DoRaw(r.context)

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
