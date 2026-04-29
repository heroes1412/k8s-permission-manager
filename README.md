# Permission manager

![flow](./docs/assets/flow.gif)

Welcome to the **Permission Manager**! :tada: :tada:

Permission Manager is an application developed by [SIGHUP](https://sighup.io) that enables a super-easy and user-friendly **RBAC management for Kubernetes**. If you are looking for a simple and intuitive way of managing your users within a Kubernetes cluster, this is the right place.

With Permission Manager, you can create users, assign namespaces/permissions, and distribute Kubeconfig YAML files via a nice&easy web UI.

The lastest image is: h2372/permission-manager:v1

## Changelog tags:
v1: fix some minor bugs, add support for k8s v1.35
v2: fix this, fix that, optimize this, optimize that
v3: fix this, fix that, optimize this, optimize that

docker buildx build --push --platform=linux/arm64,linux/amd64 --tag h2372/permission-manager:v3 .

## Screenshots

### First Page

![First Page](docs/assets/first-page.png)

### Creating a user

![Creating a user](docs/assets/create-user.png)

### Creating a user - Summary

![Create user Sumary](docs/assets/create-user-summary.png)

### User's Kubeconfig

![User's Kubeconfig](docs/assets/users-kubeconfig.png)

### Deleting a user

![Deleting a user](docs/assets/delete-user.png)

## Installation

To deploy and run the Permission Manager on your cluster, follow the [installation guide](docs/installation.md)

