# Generic Go project template - Project Structure
_SOURCE: go Directory Structure_
# go Directory Structure
###  
```
└── cmd/ [1,433 chars]
    ├── run-server.go [1,433 chars]
└── internal/ [71,807 chars]
    └── config/ [1,508 chars]
        ├── config.go [983 chars]
        ├── config_test.go [525 chars]
    └── crd/ [2,047 chars]
        ├── v1alpha1/ [2,047 chars]
        │   └── permissionmanagergroup_types.go [994 chars]
        │   └── permissionmanageruser_types.go [1,053 chars]
    └── resources/ [39,900 chars]
        ├── certificate.go [668 chars]
        ├── clusterrole.go [1,246 chars]
        ├── clusterrolebinding.go [4,646 chars]
        ├── deployment.go [512 chars]
        ├── kubeclient.go [619 chars]
        ├── manager.go [1,072 chars]
        ├── namespace.go [1,111 chars]
        ├── namespace_test.go [607 chars]
        ├── role.go [434 chars]
        ├── rolebinding.go [5,967 chars]
        ├── secrets.go [654 chars]
        ├── serviceaccount.go [4,502 chars]
        ├── serviceaccount_test.go [945 chars]
        ├── sync.go [6,186 chars]
        ├── v1alpha1_permissionmanagergroup.go [3,910 chars]
        ├── v1alpha1_permissionmanageruser.go [6,449 chars]
        ├── v1alpha1_permissionmanageruser_test.go [372 chars]
    └── server/ [28,352 chars]
        └── appcontext.go [1,171 chars]
        └── clusterrole.go [1,437 chars]
        └── clusterrolebinding.go [1,967 chars]
        └── fallbackresponse.go [1,651 chars]
        └── groups.go [2,857 chars]
        └── handlers.go [4,715 chars]
        └── handlers_test.go [386 chars]
        └── role.go [2,971 chars]
        └── server.go [4,044 chars]
        └── settings.go [1,867 chars]
        └── users.go [4,219 chars]
        └── validation.go [1,067 chars]

```
---
**File Statistics**
- **Size**: 1.98 KB
- **Lines**: 48
File: `docs/go-structure.md`
