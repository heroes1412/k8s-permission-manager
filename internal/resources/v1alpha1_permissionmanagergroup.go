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

	_, err = r.kubeclient.Discovery().RESTClient().Put().AbsPath(v1alpha1.GroupResourceURL + "/" + group.Metadata.Name).Body(jsonPayload).DoRaw(r.context)

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
