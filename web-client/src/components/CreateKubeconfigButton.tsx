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
function getValidNamespaces(user: User, allAvailableNamespaces: string[]): string[] {
  const resources = user.resources || [];
  
  const hasAllNamespaces = resources.some(r => r.namespaces.includes("ALL_NAMESPACES"));
  
  if (hasAllNamespaces) {
    return allAvailableNamespaces.length > 0 ? allAvailableNamespaces : ["default"];
  }

  const uniqueNamespaces = resources.length === 0 ? [] : [...new Set(resources.map(r => r.namespaces).flat(1))];

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
  const {namespaceList} = useNamespaceList();
  
  const allAvailableNamespaces = namespaceList.map(ns => ns.metadata.name);
  const validNamespaces = getValidNamespaces(user, allAvailableNamespaces);

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
    <div className="flex flex-col space-y-3 bg-[rgba(0,0,0,0.02)] p-4 rounded-[11px] border border-[rgba(0,0,0,0.05)] w-full">
      <Dialog
        className="max-w-[800px] w-[90vw] mx-auto bg-white shadow-apple rounded-[12px] p-8 md:p-10 outline-none"
        isOpen={showModal}
        onDismiss={() => setShowModal(false)}
      >
        <div>
          <div>
            <div className="flex justify-between items-center mb-8 border-b border-[rgba(0,0,0,0.1)] pb-6">
              <h2 className="text-[28px] md:text-[34px] font-display font-semibold text-apple-nearBlack tracking-tight">
                Kubeconfig: <span className="text-apple-blue font-mono">{user.name}</span>
              </h2>
              <button
                className="text-apple-textTertiaryLight hover:text-[#ff3b30] transition-colors"
                onClick={() => setShowModal(false)}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row justify-end w-full mb-6 space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                className="bg-transparent hover:bg-[rgba(0,0,0,0.02)] text-apple-blue border-[2px] border-apple-blue font-text font-semibold py-[8px] px-[20px] rounded-[8px] transition-all text-[17px] flex items-center justify-center"
                type="button"
                onClick={handleDownload}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Download Config
              </button>
              <button
                className="bg-apple-blue hover:bg-apple-brightBlue text-white font-text font-semibold py-[8px] px-[20px] rounded-[8px] transition-all text-[17px]"
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
              <div data-testid="yaml" className="bg-[#1d1d1f] rounded-[11px] p-6 shadow-inner border border-[#000000] overflow-auto max-h-[50vh]">
                <Editor
                  autoFocus
                  onValueChange={code => code}
                  value={kubeconfig}
                  highlight={code => code}
                  padding={10}
                  style={{
                    fontFamily: 'SF Mono, ui-monospace, Menlo, Monaco, monospace',
                    fontSize: 14,
                    color: '#2997ff',
                    backgroundColor: 'transparent'
                  }}
                />
              </div>
            ) : (
              <div className="py-16 text-center text-apple-textTertiaryLight font-text text-[17px]">Generating secure configuration...</div>
            )}
          </div>
        </div>
      </Dialog>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2">
        <span className="text-[14px] font-text font-semibold text-apple-nearBlack tracking-tight mb-2 sm:mb-0">Cluster Access Config</span>
        <div className="relative w-full sm:w-auto min-w-[200px]">
            <select
              value={chosenNamespace}
              onChange={e => setChosenNamespace(e.target.value)}
              className="block appearance-none w-full bg-apple-buttonLight border-[2px] border-[rgba(0,0,0,0.04)] hover:border-apple-blue px-4 py-2 pr-10 rounded-[8px] leading-tight focus:outline-none focus:border-apple-blue transition-all text-apple-nearBlack font-text text-[14px]"
            >
                {validNamespaces.map((ns) => {
                    return (
                    <option key={ns} value={ns}>
                        {ns === 'ALL_NAMESPACES' ? 'Global Access' : ns}
                    </option>
                    )
                })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-apple-textTertiaryLight">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
        <button
            className="flex-1 bg-transparent hover:bg-[rgba(0,0,0,0.02)] text-apple-darkBlue font-text font-semibold py-[8px] px-[15px] border-[2px] border-apple-darkBlue rounded-[8px] transition-all text-[14px]"
            onClick={() => setShowModal(true)}
            type="button"
        >
            View Kubeconfig
        </button>
        <button
            className={`flex-1 bg-apple-blue hover:bg-apple-brightBlue text-white font-text font-semibold py-[8px] px-[15px] rounded-[8px] transition-all text-[14px] flex items-center justify-center ${!kubeconfig && showModal ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleDownload}
            type="button"
            disabled={!kubeconfig && showModal}
        >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Download Kubeconfig
        </button>
      </div>
    </div>
  )
}
