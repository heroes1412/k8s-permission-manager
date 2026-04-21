import React, {useEffect, useState} from 'react'
import {Dialog} from '@reach/dialog'
import copy from 'copy-to-clipboard'
import Editor from 'react-simple-code-editor'
import {ClusterRoleBinding, RoleBinding, useRbac} from "../hooks/useRbac";
import {extractUsersRoles} from "../services/role";
import {User} from "../types";
import {httpRequests} from "../services/httpRequests";

/**
 * getValidNamespaces extracts the valid kubeconfig namespace values
 */
function getValidNamespaces(roleBindings: RoleBinding[], clusterRoleBindings: ClusterRoleBinding[], user: User): string[] {
  const {extractedPairItems} = extractUsersRoles(roleBindings, clusterRoleBindings, user.name);

  const uniqueNamespaces = extractedPairItems.length === 0 ? [] : [...new Set(extractedPairItems.map(i => i.namespaces).flat(1))];

  // we remove the invalid namespaces from the array
  const validNamespaces = uniqueNamespaces.filter(i => i !== "ALL_NAMESPACES");

  //a) If no elements are present we add the default namespace to the extracted namespaces.
  if (validNamespaces.length === 0) {
    validNamespaces.push("default");
  }
  return validNamespaces;
}

interface CreateKubeconfigButtonParameters {
  user: User;
}

export default function CreateKubeconfigButton({user}: CreateKubeconfigButtonParameters) {

  const [showModal, setShowModal] = useState<boolean>(false)
  const [kubeconfig, setKubeconfig] = useState<string>('')
  const [copied, setCopied] = useState<boolean>(false);
  const {clusterRoleBindings, roleBindings} = useRbac()
  const validNamespaces = getValidNamespaces(roleBindings, clusterRoleBindings, user);

  //b) we generate an array of unique namespaces.
  const [chosenNamespace, setChosenNamespace] = useState<string>(validNamespaces[0]);

  useEffect(() => {
    // !kubeconfig.includes(chosenNamespace) is needed to remake the API request if the chosenNamespace changed
    if (showModal && (kubeconfig === '' || !kubeconfig.includes("namespace: " + chosenNamespace))) {
      httpRequests.kubeconfigCreate(user.name, chosenNamespace)
        .then(({data}) => {
          setKubeconfig(data.kubeconfig)
        })
    }

    // needed for properly refresh the state if the user has selected a namespace that doesn't exist anymore
    if (!validNamespaces.find(n => n === chosenNamespace)) {
      setChosenNamespace(validNamespaces[0])
    }

  }, [kubeconfig, showModal, user.name, chosenNamespace, validNamespaces])

  return (
    <span className="flex">
      <Dialog
        className="max-w-4xl	mx-auto bg-white shadow-md rounded px-8 pt-4 pb-8 mb-4"
        isOpen={showModal}
        onDismiss={() => setShowModal(false)}
      >
        <div>
          <div>
            <div className="flex justify-between">
              <h2 className="text-3xl mb-4 text-gray-800">
                kubeconfig for {user.name}
              </h2>
              <button
                className="text-lg close-button"
                onClick={() => setShowModal(false)}
              >
                <span aria-hidden>×</span>
              </button>
            </div>

            <div className="flex flex-row-reverse w-full mb-2">
              <button
                className="bg-transparent hover:bg-teal-500 text-teal-700 font-semibold hover:text-white py-2 px-4 border border-teal-500 hover:border-transparent rounded"
                type="button"
                onClick={() => {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(kubeconfig).then(
                      function () {
                        setCopied(true)
                      },
                      function (err) {
                        console.error('Async err, trying fallback... ', err)
                        const success = copy(kubeconfig)
                        if (success) setCopied(true)
                      }
                    )
                  } else {
                    const success = copy(kubeconfig)
                    if (success) setCopied(true)
                  }
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {kubeconfig ? (
              <div data-testid="yaml">
                <Editor
                  autoFocus
                  onValueChange={code => code}
                  value={kubeconfig}
                  highlight={code => code}
                  padding={10}
                  style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    fontSize: 12
                  }}
                />
              </div>
            ) : (
              '...loading'
            )}
          </div>
        </div>
      </Dialog>
      <button
        className="bg-transparent hover:bg-teal-500 text-teal-700 font-semibold hover:text-white py-2 px-4 border border-teal-500 hover:border-transparent rounded whitespace-no-wrap"
        onClick={() => setShowModal(true)}
        type="button"
      >
        show kubeconfig for {user.name}
      </button>
      <div className="relative ml-4 inline-block shadow">
        <select
          defaultValue={chosenNamespace}
          onChange={e => setChosenNamespace(e.target.value)}
          className="block appearance-none w-full bg-white border border-gray-400 hover:border-gray-500 px-4 py-2 pr-8 rounded leading-tight focus:outline-none focus:shadow-outline text-gray-700"
        >
              {validNamespaces.map((ns) => {
                return (
                  <option key={ns} value={ns}>
                    {ns}
                  </option>
                )
              })}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
        </div>
      </div>
    </span>
  )
}
