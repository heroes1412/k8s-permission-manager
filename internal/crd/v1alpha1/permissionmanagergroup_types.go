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
