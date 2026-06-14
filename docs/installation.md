# Installation

this guide refer to installing the permission manager on a running cluster

## Install with kubectl

``` shell
kubectl apply -f k8s-kubernetes-deployment/seed/
kubectl apply -f k8s-kubernetes-deployment/
```

### Visit the application

`kubectl port-forward svc/permission-manager 4000 --namespace permission-manager`

> the application can now be accessed by <http://localhost:4000>

## Install with Helm

It is also possible to deploy Permission Manager using the [provided Helm Chart](/helm_chart).

First create a values file, for example `my-values.yaml`, with your custom values for the release. See the [chart's readme](/helm_chart/README.md) and the [default values.yaml](/helm_chart/values.yaml) for more information.

Then, execute:

``` shell
helm repo add permission-manager https://sighupio.github.io/permission-manager
helm upgrade --install --namespace permission-manager --set image.tag=v1.9.0 --values my-values.yaml permission-manager permission-manager/permission-manager
```

> don't forget to replace `my-values.yaml` with the path to your values file.
