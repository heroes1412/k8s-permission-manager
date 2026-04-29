/**
 * class containing all the httpRequests
 */
import {AxiosInstance} from "axios";
import {httpClientFactory} from "./httpClient";
import {RolebindingCreateRequests} from "./rolebindingCreateRequests";
import {RolebindingDeleteRequests} from "./rolebindingDeleteRequests";
import {UserRequests} from "./userRequests";
import {AggregatedRoleBindingNamespace} from "./role";


/**
 * gateway for httpRequests to the permission-manager backend
 */
class HttpRequests {

  public readonly rolebindingRequests: {
    create: RolebindingCreateRequests,
    delete: RolebindingDeleteRequests,
  };

  public readonly userRequests: UserRequests;


  private httpClient: AxiosInstance;

  constructor(httpClientFactory: () => AxiosInstance) {

    this.httpClient = httpClientFactory();

    this.rolebindingRequests = {
      create: new RolebindingCreateRequests(httpClientFactory()),
      delete: new RolebindingDeleteRequests(httpClientFactory())
    }

    this.userRequests = new UserRequests(httpClientFactory());


  }

  public namespaceList() {
    return this.httpClient.get('/api/list-namespace');
  }

  public kubeconfigCreate(username: string, chosenNamespace: string) {
    return this.httpClient.post('/api/create-kubeconfig', {
      username: username, namespace: chosenNamespace
    })
  }

  public checkLegacyUser(username: string, namespaces: AggregatedRoleBindingNamespace) {
    if (namespaces === "ALL_NAMESPACES") {
      namespaces = []
    }

    return this.httpClient.post('/api/check-legacy-user', {
      username: username, namespaces: namespaces
    })
  }

  public namespaceCreate(name: string) {
    return this.httpClient.post('/api/create-namespace', {
      name: name
    })
  }

  public namespaceDelete(name: string) {
    return this.httpClient.post('/api/delete-namespace', {
      name: name
    })
  }

  public clusterRoleCreate(roleName: string, rules: any[]) {
    return this.httpClient.post('/api/create-cluster-role', {
      roleName: roleName,
      rules: rules
    })
  }

  public clusterRoleUpdate(roleName: string, rules: any[]) {
    return this.httpClient.post('/api/update-cluster-role', {
      roleName: roleName,
      rules: rules
    })
  }

  public clusterRoleDelete(roleName: string) {
    return this.httpClient.post('/api/delete-cluster-role', {
      roleName: roleName
    })
  }

  public getSettings() {
    return this.httpClient.get('/api/settings')
  }

  public updateSettings(settings: any) {
    return this.httpClient.post('/api/settings', settings)
  }

  public restartApp() {
    return this.httpClient.post('/api/restart')
  }
}


export const httpRequests = new HttpRequests(httpClientFactory)
