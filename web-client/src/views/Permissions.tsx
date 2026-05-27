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
    } else {
      setAggregatedRoleBindings([])
      setInheritedRoleBindings([])
      setClusterAccess('none')
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
    
    setShowLoader(true)
    try {
      const name = selectedSubject.originalObject.name
      const type = selectedSubject.type

      const validBindings = aggregatedRoleBindings.filter(rb => rb.template && rb.template.trim() !== '')

      let updatedResources: any[] = [];

      if (type === 'user') {
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
      } else {
        updatedResources = validBindings.map(rb => ({
          template: rb.template,
          namespaces: Array.isArray(rb.namespaces) ? rb.namespaces : [rb.namespaces]
        }))
        
        await httpRequests.groupUpdate(name, updatedResources)
      }

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
      
    } catch (err) {
      console.error(err)
      window.alert("Failed to save permissions")
    } finally {
      setShowLoader(false)
    }
  }

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

              <div className="pt-6 flex justify-end w-full">
                <button
                  className={`w-full sm:w-auto bg-apple-blue text-white rounded-[8px] px-[20px] py-[10px] text-[17px] font-text transition-all flex items-center justify-center ${saveButtonDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-apple-brightBlue'}`}
                  disabled={saveButtonDisabled}
                  type="submit"
                >
                  Save Permissions
                </button>
              </div>

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
