import React, {useEffect, useState} from 'react'
import {Dialog} from '@reach/dialog'
import copy from 'copy-to-clipboard'
import Editor from 'react-simple-code-editor'
import {ClusterRoleBinding, RoleBinding, useRbac} from "../hooks/useRbac";
import {extractUsersRoles} from "../services/role";
import {User} from "../types";
import {httpRequests} from "../services/httpRequests";
import {useNamespaceList} from '../hooks/useNamespaceList'

/**
 * getValidNamespaces extracts the valid kubeconfig namespace values
 */
function getValidNamespaces(roleBindings: RoleBinding[], clusterRoleBindings: ClusterRoleBinding[], user: User, allAvailableNamespaces: string[]): string[] {
  const {extractedPairItems} = extractUsersRoles(roleBindings, clusterRoleBindings, user.name);

  const hasAllNamespaces = extractedPairItems.some(i => i.namespaces === "ALL_NAMESPACES");
  
  if (hasAllNamespaces) {
    return allAvailableNamespaces.length > 0 ? allAvailableNamespaces : ["default"];
  }

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
  const {namespaceList} = useNamespaceList();
  
  const allAvailableNamespaces = namespaceList.map(ns => ns.metadata.name);
  const validNamespaces = getValidNamespaces(roleBindings, clusterRoleBindings, user, allAvailableNamespaces);

  //b) we generate an array of unique namespaces.
  const [chosenNamespace, setChosenNamespace] = useState<string>(validNamespaces[0]);

  useEffect(() => {
    // Ensure chosenNamespace is valid when validNamespaces list changes (e.g. after loading)
    if (validNamespaces.length > 0) {
      if (!chosenNamespace || !validNamespaces.includes(chosenNamespace)) {
        setChosenNamespace(validNamespaces[0]);
      }
    }
  }, [validNamespaces]);

  useEffect(() => {
    // !kubeconfig.includes(chosenNamespace) is needed to remake the API request if the chosenNamespace changed
    if (showModal && chosenNamespace && (kubeconfig === '' || !kubeconfig.includes("namespace: " + chosenNamespace))) {
      httpRequests.kubeconfigCreate(user.name, chosenNamespace)
        .then(({data}) => {
          setKubeconfig(data.kubeconfig)
        })
    }
  }, [kubeconfig, showModal, user.name, chosenNamespace])

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([kubeconfig], {type: 'text/yaml'});
    element.href = URL.createObjectURL(file);
    element.download = `kubeconfig-${user.name}-${chosenNamespace}.yaml`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <span className="flex flex-col space-y-2 mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100 shadow-inner max-w-sm">
      <Dialog
        className="max-w-4xl	mx-auto bg-white shadow-2xl rounded-2xl px-8 pt-6 pb-8 mb-4 border-t-8 border-teal-500"
        isOpen={showModal}
        onDismiss={() => setShowModal(false)}
      >
        <div>
          <div>
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center">
                <svg className="w-6 h-6 mr-2 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Kubeconfig: <span className="ml-2 text-teal-600 font-mono">{user.name}</span>
              </h2>
              <button
                className="text-gray-400 hover:text-red-500 transition-colors"
                onClick={() => setShowModal(false)}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="flex justify-end w-full mb-4 space-x-3">
              <button
                className="bg-white hover:bg-gray-50 text-teal-600 border-2 border-teal-600 font-black py-2 px-6 rounded-xl shadow-sm transition-all transform active:scale-95 text-xs tracking-widest uppercase flex items-center"
                type="button"
                onClick={handleDownload}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Download Config
              </button>
              <button
                className="bg-teal-600 hover:bg-teal-700 text-white font-black py-2 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 text-xs tracking-widest uppercase"
                type="button"
                onClick={() => {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(kubeconfig).then(
                      function () {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      },
                      function (err) {
                        console.error('Async err, trying fallback... ', err)
                        const success = copy(kubeconfig)
                        if (success) {
                            setCopied(true)
                            setTimeout(() => setCopied(false), 2000)
                        }
                      }
                    )
                  } else {
                    const success = copy(kubeconfig)
                    if (success) {
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                    }
                  }
                }}
              >
                {copied ? 'Copied!' : 'Copy Config'}
              </button>
            </div>

            {kubeconfig ? (
              <div data-testid="yaml" className="bg-gray-900 rounded-xl p-4 shadow-inner border-4 border-gray-800">
                <Editor
                  autoFocus
                  onValueChange={code => code}
                  value={kubeconfig}
                  highlight={code => code}
                  padding={10}
                  style={{
                    fontFamily: '"Fira code", "Fira Mono", monospace',
                    fontSize: 12,
                    color: '#14b8a6', // teal-500
                    backgroundColor: 'transparent'
                  }}
                />
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 italic">Generating secure configuration...</div>
            )}
          </div>
        </div>
      </Dialog>
      
      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Namespace</span>
        <div className="relative">
            <select
            value={chosenNamespace}
            onChange={e => setChosenNamespace(e.target.value)}
            className="block appearance-none bg-white border border-gray-200 hover:border-teal-500 px-3 py-1 pr-8 rounded-lg leading-tight focus:outline-none focus:ring-2 focus:ring-teal-100 transition-all text-gray-700 text-xs font-bold"
            >
                {validNamespaces.map((ns) => {
                    return (
                    <option key={ns} value={ns}>
                        {ns}
                    </option>
                    )
                })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
      </div>

      <div className="flex space-x-2">
        <button
            className="flex-1 bg-white hover:bg-teal-50 text-teal-700 font-black py-2.5 px-4 border-2 border-teal-600 rounded-xl transition-all transform active:scale-95 text-xs uppercase tracking-widest shadow-sm"
            onClick={() => setShowModal(true)}
            type="button"
        >
            View Config
        </button>
        <button
            className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-black py-2.5 px-4 border-2 border-teal-600 rounded-xl transition-all transform active:scale-95 text-xs uppercase tracking-widest shadow-lg shadow-teal-100 flex items-center justify-center"
            onClick={handleDownload}
            type="button"
            disabled={!kubeconfig && showModal}
        >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Download
        </button>
      </div>
    </span>
  )
}
