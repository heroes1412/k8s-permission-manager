import React, { useCallback, useEffect, useState } from 'react'
import Select, { components } from 'react-select'
import { useRbac } from '../hooks/useRbac'
import { useUsers } from '../hooks/useUsers'
import { FullScreenLoader } from '../components/Loader'
import Templates from '../components/Templates'
import Summary from '../components/Summary'
import ClusterAccessRadio from '../components/ClusterAccessRadio'
import { AggregatedRoleBinding } from "../services/role"
import { ClusterAccess } from "../components/types"
import { httpRequests } from "../services/httpRequests"
import { templateClusterResourceRolePrefix } from '../constants'
import { useSettings } from '../hooks/useSettings'
import GroupDryRunModal from '../components/GroupDryRunModal'
import { useNamespaceList } from '../hooks/useNamespaceList'

type SubjectType = 'user' | 'group'

interface OptionType {
  value: string
  label: string
  type: SubjectType
  originalObject: any
}

export default function Permissions() {
  const { settings } = useSettings()
  const { clusterRoleBindings, refreshRbacData } = useRbac()
  const { users, refreshUsers } = useUsers()
  
  const [groups, setGroups] = useState<any[]>([])
  const [options, setOptions] = useState<OptionType[]>([])
  const [selectedSubject, setSelectedSubject] = useState<OptionType | null>(null)
  
  const [showLoader, setShowLoader] = useState<boolean>(false)
  const [clusterAccess, setClusterAccess] = useState<ClusterAccess>('none')
  const [aggregatedRoleBindings, setAggregatedRoleBindings] = useState<AggregatedRoleBinding[]>([])
  const [inheritedRoleBindings, setInheritedRoleBindings] = useState<AggregatedRoleBinding[]>([])

  // Dry-Run State
  const [showDryRun, setShowDryRun] = useState(false);
  const [dryRunData, setDryRunData] = useState<{ affectedUsers: string[], updatedResources: any[], name: string } | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Test Permissions State
  const { namespaceList } = useNamespaceList();
  const [testNamespace, setTestNamespace] = useState<string>('default');
  const [testResource, setTestResource] = useState<string>('pods');
  const [testVerb, setTestVerb] = useState<string>('get');
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (settings.GROUPS_ENABLED !== 'true') return
    try {
      const { data } = await httpRequests.groupList()
      if (data) {
        setGroups(data)
      }
    } catch (err) {
      console.error(err)
    }
  }, [settings.GROUPS_ENABLED])

  useEffect(() => {
    refreshRbacData()
    fetchGroups()
  }, [refreshRbacData, fetchGroups])

  useEffect(() => {
    const userOptions: OptionType[] = users.map(u => ({
      value: `user:${u.name}`,
      label: u.friendlyName || u.name,
      type: 'user',
      originalObject: u
    }))
    
    const groupOptions: OptionType[] = settings.GROUPS_ENABLED === 'true' ? groups.map(g => ({
      value: `group:${g.name}`,
      label: g.friendlyName || g.name,
      type: 'group',
      originalObject: g
    })) : []
    
    setOptions([...userOptions, ...groupOptions])
  }, [users, groups, settings.GROUPS_ENABLED])

  const loadSubjectPermissions = useCallback((subject: OptionType) => {
    const directResources = subject.originalObject.resources || []
    
    const namespaceResources = directResources.filter((r: any) => 
      !(r.template.includes(templateClusterResourceRolePrefix) && r.namespaces.includes('ALL_NAMESPACES'))
    ).map((r: any) => ({
      id: Math.random().toString(36).substring(7),
      template: r.template,
      namespaces: r.namespaces
    }))
    
    setAggregatedRoleBindings(namespaceResources.length > 0 ? namespaceResources : [{ id: Math.random().toString(36).substring(7), namespaces: [], template: '' }])

    const clusterAccessResource = directResources.find((r: any) => 
      r.template.includes(templateClusterResourceRolePrefix) && r.namespaces.includes('ALL_NAMESPACES')
    )
    
    if (clusterAccessResource) {
      if (clusterAccessResource.template.endsWith('admin')) {
        setClusterAccess('write')
      } else if (clusterAccessResource.template.endsWith('read-only')) {
        setClusterAccess('read')
      } else {
        setClusterAccess('none')
      }
    } else {
      setClusterAccess('none')
    }

    if (subject.type === 'user' && settings.GROUPS_ENABLED === 'true') {
      const userGroups = subject.originalObject.groups || []
      let inherited: AggregatedRoleBinding[] = []
      
      userGroups.forEach((g: string) => {
        const groupObj = groups.find(group => group.name === g)
        if (groupObj && groupObj.resources) {
          const groupResources = groupObj.resources.map((r: any) => ({
            id: Math.random().toString(36).substring(7),
            template: r.template,
            namespaces: r.namespaces
          }))
          inherited = [...inherited, ...groupResources]
        }
      })
      
      const mergedInherited = inherited.reduce((acc: AggregatedRoleBinding[], item) => {
        const has = acc.find(x => x.template === item.template)
        if (has) {
          if (has.namespaces !== 'ALL_NAMESPACES') {
            if (item.namespaces === 'ALL_NAMESPACES') {
              has.namespaces = 'ALL_NAMESPACES'
            } else {
              const itemNs = Array.isArray(item.namespaces) ? item.namespaces : [item.namespaces]
              has.namespaces = Array.from(new Set([...has.namespaces as string[], ...itemNs]))
            }
          }
        } else {
          acc.push({ ...item })
        }
        return acc
      }, [])
      
      setInheritedRoleBindings(mergedInherited)
    } else {
      setInheritedRoleBindings([])
    }
    
  }, [groups, settings.GROUPS_ENABLED])

  useEffect(() => {
    if (selectedSubject) {
      loadSubjectPermissions(selectedSubject)
      setTestResult(null); // Reset test results when subject changes
    } else {
      setAggregatedRoleBindings([])
      setInheritedRoleBindings([])
      setClusterAccess('none')
      setTestResult(null);
    }
  }, [selectedSubject, loadSubjectPermissions])

  const savePair = useCallback((p: AggregatedRoleBinding) => {
    setAggregatedRoleBindings(state => {
      if (state.find(x => x.id === p.id)) {
        return state.map(x => x.id === p.id ? p : x)
      }
      return [...state, p]
    })
  }, [])

  const addEmptyPair = useCallback(() => {
    setAggregatedRoleBindings(state => [...state, { id: Math.random().toString(36).substring(7), namespaces: [], template: '' }])
  }, [])

  async function handleSubmit(e: any) {
    e.preventDefault()
    if (!selectedSubject) return
    
    try {
      const name = selectedSubject.originalObject.name
      const type = selectedSubject.type

      const validBindings = aggregatedRoleBindings.filter(rb => rb.template && rb.template.trim() !== '')

      let updatedResources: any[] = [];

      if (type === 'user') {
        setShowLoader(true);
        updatedResources = validBindings.map(rb => ({
          template: rb.template,
          namespaces: Array.isArray(rb.namespaces) ? rb.namespaces : [rb.namespaces]
        }))

        if (clusterAccess !== 'none') {
          const roleName = clusterAccess === 'read' ? 'template-cluster-resources___read-only' : 'template-cluster-resources___admin'

          updatedResources.push({
            template: roleName,
            namespaces: ['ALL_NAMESPACES']
          })
        }
        
        await httpRequests.userRequests.update(name, selectedSubject.originalObject.maxDays, selectedSubject.originalObject.groups, updatedResources)
        
        window.alert("Permissions saved successfully")
        await fetchGroups()
        await refreshUsers()
        
        setSelectedSubject((prev: any) => ({
          ...prev,
          originalObject: {
            ...prev.originalObject,
            resources: updatedResources
          }
        }))
        setShowLoader(false);
      } else {
        // GROUP: Initialize Dry-Run instead of saving immediately
        updatedResources = validBindings.map(rb => ({
          template: rb.template,
          namespaces: Array.isArray(rb.namespaces) ? rb.namespaces : [rb.namespaces]
        }))
        
        const affectedUsers = users
          .filter(u => u.groups && u.groups.includes(name))
          .map(u => u.friendlyName || u.name);

        setDryRunData({ affectedUsers, updatedResources, name });
        setShowDryRun(true);
      }
      
    } catch (err) {
      console.error(err)
      window.alert("Failed to prepare permissions")
      setShowLoader(false)
    }
  }

  const handleConfirmGroupSave = async () => {
    if (!dryRunData) return;
    
    setIsSavingGroup(true);
    try {
      await httpRequests.groupUpdate(dryRunData.name, dryRunData.updatedResources);
      window.alert("Group permissions saved successfully");
      
      await fetchGroups();
      await refreshUsers();
      
      setSelectedSubject((prev: any) => ({
        ...prev,
        originalObject: {
          ...prev.originalObject,
          resources: dryRunData.updatedResources
        }
      }));
      
      setShowDryRun(false);
    } catch (err) {
      console.error(err);
      window.alert("Failed to save group permissions");
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleTestPermission = async () => {
    if (!selectedSubject || selectedSubject.type !== 'user') return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const { data } = await httpRequests.httpClient.post('/api/check-permission', {
        username: selectedSubject.originalObject.name,
        namespace: testNamespace,
        resource: testResource,
        verb: testVerb
      });
      setTestResult(data.allowed);
    } catch (err) {
      console.error(err);
      window.alert("Failed to test permission");
    } finally {
      setIsTesting(false);
    }
  };

  const CustomOption = (props: any) => (
    <components.Option {...props}>
      <div className="flex flex-col">
        <span className="font-semibold text-[17px]">{props.data.label}</span>
        {settings.GROUPS_ENABLED === 'true' && (
           <span className="text-[12px] uppercase tracking-widest text-apple-textTertiaryLight">{props.data.type}</span>
        )}
      </div>
    </components.Option>
  )

  const saveButtonDisabled = !selectedSubject || aggregatedRoleBindings.some(p => p.namespaces.length === 0)

  return (
    <div className="bg-apple-lightGray min-h-screen py-16 flex flex-col items-center px-4">
      {showLoader && <FullScreenLoader />}
      {dryRunData && (
        <GroupDryRunModal
          isOpen={showDryRun}
          onDismiss={() => setShowDryRun(false)}
          onConfirm={handleConfirmGroupSave}
          groupName={dryRunData.name}
          affectedUsers={dryRunData.affectedUsers}
          isSaving={isSavingGroup}
        />
      )}
      
      <div className="w-full max-w-[980px]">
        <h2 className="text-apple-nearBlack text-[40px] md:text-[56px] font-display font-semibold leading-[1.07] tracking-[-0.28px] text-center mb-12">
          Permissions
        </h2>

        <div className="bg-white rounded-[12px] p-6 md:p-10 max-w-[800px] mx-auto shadow-apple">
          <div className="mb-10 w-full">
            <label className="block text-[17px] font-text font-semibold text-apple-nearBlack mb-2 tracking-[-0.374px]">
                {settings.GROUPS_ENABLED === 'true' ? 'Select User or Group' : 'Select User'}
            </label>
            <Select
              options={options}
              value={selectedSubject}
              onChange={setSelectedSubject}
              placeholder="Start typing to search..."
              components={{ Option: CustomOption }}
              styles={{
                control: (base, state) => ({
                  ...base,
                  border: state.isFocused ? '2px solid #0071e3' : '2px solid rgba(0, 0, 0, 0.04)',
                  borderRadius: '11px',
                  padding: '4px',
                  boxShadow: 'none',
                  backgroundColor: '#fafafc',
                  '&:hover': {
                    borderColor: state.isFocused ? '#0071e3' : 'rgba(0, 0, 0, 0.1)',
                  },
                  width: '100%'
                }),
                option: (base, state) => ({
                  ...base,
                  backgroundColor: state.isSelected ? '#0071e3' : state.isFocused ? '#f5f5f7' : 'transparent',
                  color: state.isSelected ? 'white' : 'rgba(0, 0, 0, 0.8)',
                  cursor: 'pointer',
                }),
                menu: (base) => ({
                    ...base,
                    width: '100%',
                    zIndex: 50
                })
              }}
            />
          </div>

          {selectedSubject && (
            <form onSubmit={handleSubmit} className="space-y-10 animate-fade-in w-full">
              <div className="w-full">
                <h3 className="text-[21px] font-display font-semibold text-apple-nearBlack mb-4">
                  Direct Permissions for <span className="text-apple-blue break-all">{selectedSubject.label}</span>
                </h3>
                <div className="w-full">
                  <Templates
                    pairItems={aggregatedRoleBindings}
                    savePair={savePair}
                    setPairItems={setAggregatedRoleBindings}
                    addEmptyPair={addEmptyPair}
                  />
                </div>
              </div>

              {selectedSubject.type === 'user' && (
                <div className="w-full">
                  <h3 className="text-[21px] font-display font-semibold text-apple-nearBlack mb-4">Cluster Access</h3>
                  <ClusterAccessRadio
                    clusterAccess={clusterAccess}
                    setClusterAccess={setClusterAccess}
                  />
                </div>
              )}

              <div className={`pt-6 flex justify-end w-full ${selectedSubject.type === 'user' ? 'border-b border-[rgba(0,0,0,0.1)] pb-10' : ''}`}>
                <button
                  className={`w-full sm:w-auto bg-apple-blue text-white rounded-[8px] px-[20px] py-[10px] text-[17px] font-text transition-all flex items-center justify-center ${saveButtonDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-apple-brightBlue'}`}
                  disabled={saveButtonDisabled}
                  type="submit"
                >
                  Save Permissions
                </button>
              </div>

              {selectedSubject.type === 'user' && (
                <div className="w-full">
                  <h3 className="text-[21px] font-display font-semibold text-apple-nearBlack mb-4">Test Access (Can-I)</h3>
                  <div className="bg-[rgba(0,0,0,0.02)] p-4 sm:p-6 rounded-[11px] border border-[rgba(0,0,0,0.05)]">
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                      <div className="flex-1">
                        <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Verb</label>
                        <select value={testVerb} onChange={e => setTestVerb(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none">
                          <option value="get">get</option>
                          <option value="list">list</option>
                          <option value="create">create</option>
                          <option value="update">update</option>
                          <option value="delete">delete</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Resource</label>
                        <select value={testResource} onChange={e => setTestResource(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none">
                          <option value="configmaps">configmaps</option>
                          <option value="daemonsets">daemonsets</option>
                          <option value="deployments">deployments</option>
                          <option value="endpoints">endpoints</option>
                          <option value="events">events</option>
                          <option value="horizontalpodautoscalers">horizontalpodautoscalers</option>
                          <option value="httproutes">httproutes</option>
                          <option value="ingresses">ingresses</option>
                          <option value="persistentvolumeclaims">persistentvolumeclaims</option>
                          <option value="poddisruptionbudgets">poddisruptionbudgets</option>
                          <option value="pods">pods</option>
                          <option value="pods/log">pods/log</option>
                          <option value="replicasets">replicasets</option>
                          <option value="replicationcontrollers">replicationcontrollers</option>
                          <option value="secrets">secrets</option>
                          <option value="services">services</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Namespace</label>
                        <select value={testNamespace} onChange={e => setTestNamespace(e.target.value)} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none">
                          <option value="">(Cluster-scoped)</option>
                          {namespaceList.map(ns => <option key={ns.metadata.name} value={ns.metadata.name}>{ns.metadata.name}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button type="button" onClick={handleTestPermission} disabled={isTesting} className="w-full sm:w-auto bg-gray-800 text-white rounded-lg px-6 py-2 text-sm font-bold tracking-widest uppercase hover:bg-gray-700 transition-colors disabled:opacity-50 h-[38px]">
                          {isTesting ? '...' : 'TEST'}
                        </button>
                      </div>
                    </div>
                    {testResult !== null && (
                      <div className={`p-3 rounded-lg border ${testResult ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'} flex items-center`}>
                        {testResult ? (
                          <><svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> <strong className="mr-1">YES.</strong> User is allowed.</>
                        ) : (
                          <><svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg> <strong className="mr-1">NO.</strong> User is forbidden.</>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {((aggregatedRoleBindings.length > 0 && aggregatedRoleBindings.some(p => p.namespaces.length > 0)) || inheritedRoleBindings.length > 0) && (
                <div className="pt-10 border-t border-[rgba(0,0,0,0.1)] w-full">
                   <h3 className="text-[21px] font-display font-semibold text-apple-nearBlack mb-6">Effective Permissions Summary</h3>
                   
                   {settings.GROUPS_ENABLED === 'true' && inheritedRoleBindings.length > 0 && (
                     <div className="mb-6 bg-[rgba(0,113,227,0.05)] p-4 sm:p-6 rounded-[11px] border border-[rgba(0,113,227,0.2)] overflow-x-auto">
                        <div className="min-w-[600px]">
                          <h4 className="text-[14px] font-text font-semibold text-apple-blue mb-4 uppercase tracking-widest">Inherited from Groups</h4>
                          <Summary pairItems={inheritedRoleBindings} />
                        </div>
                     </div>
                   )}

                   <div className="mb-6 overflow-x-auto">
                      <div className="min-w-[600px]">
                        <h4 className="text-[14px] font-text font-semibold text-apple-nearBlack mb-4 uppercase tracking-widest">Directly Assigned</h4>
                        <Summary pairItems={aggregatedRoleBindings} />
                      </div>
                   </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
