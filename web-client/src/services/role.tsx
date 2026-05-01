import { resourceSeparator, templateClusterResourceRolePrefix } from "../constants";
import { ClusterRoleBinding, RoleBinding } from "../hooks/useRbac";

type MixedRoleBindings = RoleBinding | ClusterRoleBinding


interface NormalizedRoleBinding {
  readonly template: string;
  readonly namespace: string | 'ALL_NAMESPACES';
  readonly name: string;
}

/**
 * contains a list of the namespace or 'ALL_NAMESPACES'
 */
export type AggregatedRoleBindingNamespace = string[] | "ALL_NAMESPACES"

/**
 * normalized rolebindings. This is required because clusterRoleBindings do not have namespace
 * @see ClusterRoleBinding
 * @see RoleBinding
 */
export interface AggregatedRoleBinding {
  /**
   * uuid v4
   */
  readonly id: string,

  readonly namespaces: AggregatedRoleBindingNamespace
  /**
   * DO NOT REFACTOR THIS NAME
   * example: template-namespaced-resources___developer
   */
  readonly template: string
}


export interface ExtractedUserRoles {
  readonly rbs: RoleBinding[],
  readonly crbs: ClusterRoleBinding[],
  readonly extractedPairItems: AggregatedRoleBinding[]
}

/**
 * extractUsersRoles encapsulates the common logic needed to extract the roles of a given user or group
 * @param roleBindings
 * @param clusterRoleBindings
 * @param name
 * @param type
 */
export function extractUsersRoles(roleBindings: RoleBinding[], clusterRoleBindings: ClusterRoleBinding[], name: string, type: 'user' | 'group' = 'user'): ExtractedUserRoles {
  const rbs = (roleBindings || []).filter(rb => {
    if (type === 'group') {
      return rb.metadata.labels?.['generated_for_group'] === name
    }
    const separatedResourceName = rb.metadata.name.split(resourceSeparator);
    if (separatedResourceName.length === 0) return false
    return separatedResourceName[0] === name
  })

  const crbs = (clusterRoleBindings || []).filter(crb => {
    if (type === 'group') {
      return crb.metadata.labels?.['generated_for_group'] === name
    }
    const separatedResourceName = crb.metadata.name.split(resourceSeparator);
    if (separatedResourceName.length === 0) return false
    return separatedResourceName[0] === name
  })

  const normalizedRoleBindings: NormalizedRoleBinding[] = [...rbs, ...crbs]
    .filter(
      crb => !crb.metadata.name.includes(templateClusterResourceRolePrefix)
    )
    .map(v => {
      const mixedRoleBinding: MixedRoleBindings = v
      const name = mixedRoleBinding.metadata.name
      const template = mixedRoleBinding.roleRef.name
      const namespace = mixedRoleBinding.metadata['namespace'] || 'ALL_NAMESPACES'
      return { template, namespace, name }
    })

  const extractedPairItems: AggregatedRoleBinding[] = normalizedRoleBindings.reduce((acc, item) => {
    const has = acc.find(x => x.template === item.template)

    if (has) {
      if (has.namespaces !== 'ALL_NAMESPACES') {
        if (item.namespace === 'ALL_NAMESPACES') {
          has.namespaces = 'ALL_NAMESPACES'
        } else {
          has.namespaces.push(item.namespace)
        }
      }
    } else {
      const tpl = item.template
      const nss = item.namespace === 'ALL_NAMESPACES' ? 'ALL_NAMESPACES' : [item.namespace]
      const id = tpl + '-' + (nss === 'ALL_NAMESPACES' ? 'all' : nss.join('-'))

      acc.push({
        id: id,
        namespaces: nss,
        template: tpl,
      })
    }

    return acc
  }, [])

  return { rbs, crbs, extractedPairItems };
}
