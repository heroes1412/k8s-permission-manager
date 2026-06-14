import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { httpRequests } from '../services/httpRequests'
import { FullScreenLoader } from '../components/Loader'
import { useNamespaceList } from '../hooks/useNamespaceList'
import { useRbac } from '../hooks/useRbac'
import { templateNamespacedResourceRolePrefix, templateClusterResourceRolePrefix } from '../constants'

interface AuditRecord {
  subjectKind: string
  subjectName: string
  subjectNamespace?: string
  roleName: string
  roleRefName?: string
  managedBy: string
  isManaged: boolean
}

interface TooltipState {
  x: number
  y: number
  roleName: string
  roleRefName?: string
}

export default function AccessAudit() {
  const { namespaceList, loading } = useNamespaceList()
  const [selectedNamespace, setSelectedNamespace] = useState<string>('')
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const { clusterRoles } = useRbac()

  // Look up the ClusterRole object: prefer exact match by roleRefName, fall back to prefix reconstruction
  const getFullRoleName = (roleRefName?: string, roleName?: string) => {
    if (roleRefName && clusterRoles) {
      const direct = clusterRoles.find(cr => cr.metadata.name === roleRefName)
      if (direct) return direct
    }
    // Fallback: reconstruct from display name (strips " (Cluster-wide)" suffix first)
    const shortName = (roleName || '').replace(' (Cluster-wide)', '')
    if (!shortName) return null
    return clusterRoles?.find(cr =>
      cr.metadata.name === templateNamespacedResourceRolePrefix + shortName ||
      cr.metadata.name === templateClusterResourceRolePrefix + shortName
    ) ?? null
  }

  const getRolePerms = (roleRefName?: string, roleName?: string) => {
    const role = getFullRoleName(roleRefName, roleName)
    if (!role?.rules) return {}
    const perms: Record<string, { read: boolean; write: boolean }> = {}
    role.rules.forEach(rule => {
      const isRead = rule.verbs.includes('*') || rule.verbs.some(v => ['get', 'list', 'watch'].includes(v))
      const isWrite = rule.verbs.includes('*') || rule.verbs.some(v => ['create', 'update', 'patch', 'delete'].includes(v))
      rule.resources.forEach(res => {
        if (!perms[res]) perms[res] = { read: false, write: false }
        if (isRead) perms[res].read = true
        if (isWrite) perms[res].write = true
      })
    })
    return perms
  }

  // Only namespaced template roles have an edit page in /roles
  const isClickableRole = (r: AuditRecord) =>
    r.isManaged &&
    !r.roleName.endsWith(' (Cluster-wide)') &&
    (r.roleRefName
      ? r.roleRefName.startsWith(templateNamespacedResourceRolePrefix)
      : true)

  const getEditPath = (r: AuditRecord) => {
    const shortName = r.roleRefName
      ? r.roleRefName.replace(templateNamespacedResourceRolePrefix, '')
      : r.roleName
    return `/roles?edit=${encodeURIComponent(shortName)}`
  }

  useEffect(() => {
    if (namespaceList.length > 0 && !selectedNamespace) {
      setSelectedNamespace(namespaceList[0].metadata.name)
    }
  }, [namespaceList, selectedNamespace])

  useEffect(() => {
    if (!selectedNamespace) return
    const fetchAudit = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data } = await httpRequests.httpClient.get('/api/access-audit', { params: { namespace: selectedNamespace } })
        // Sort: Managed by App first, then External
        const sortedData = (data || []).sort((a: AuditRecord, b: AuditRecord) => {
          if (a.isManaged === b.isManaged) return 0;
          return a.isManaged ? -1 : 1;
        });
        setRecords(sortedData)
      } catch (err: any) {
        setError(err?.response?.data?.message || err.message)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAudit()
  }, [selectedNamespace])

  return (
    <div className="bg-gray-200 pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 pb-12">
        {(loading || isLoading) && <FullScreenLoader />}
        <div className="bg-white shadow-xl rounded-xl p-8 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-6 gap-4">
            <h2 className="text-2xl text-gray-800 font-black flex items-center tracking-tight">
              <svg className="w-8 h-8 mr-3 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              Cluster Access Audit
            </h2>
            <div className="w-full sm:w-auto flex items-center gap-3">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Target Namespace:</span>
              <select
                value={selectedNamespace}
                onChange={e => setSelectedNamespace(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 px-4 py-2.5 rounded-xl leading-tight focus:outline-none focus:border-teal-500 transition-all text-gray-800 font-bold text-sm"
              >
                {namespaceList.map(ns => (
                  <option key={ns.metadata.name} value={ns.metadata.name}>{ns.metadata.name}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-100 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest">
              {error}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                <span>Managed by App</span>
             </div>
             <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                <span>External / Manual</span>
             </div>
          </div>

          <div className="my-6 overflow-x-auto">
            <table className="text-left w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">Subject</th>
                  <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">Identity Name</th>
                  <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">Namespace</th>
                  <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">Assigned Role</th>
                  <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">Source Policy</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 italic font-medium text-base">
                      No RBAC bindings found for this namespace.
                    </td>
                  </tr>
                ) : (
                  records.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${
                            r.subjectKind === 'User' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 
                            r.subjectKind === 'Group' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 
                            r.subjectKind === 'ServiceAccount' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                            'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {r.subjectKind}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-800 font-mono text-xs">{r.subjectName}</td>
                      <td className="py-4 px-6 text-gray-500 font-mono text-xs italic">{r.subjectNamespace || '-'}</td>
                      <td className="py-4 px-6 text-gray-700 font-bold">
                        {isClickableRole(r) ? (
                          <Link
                            to={getEditPath(r)}
                            className="text-sm tracking-tight text-teal-700 hover:text-teal-900 hover:underline font-bold transition-colors"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              const x = Math.min(rect.left, window.innerWidth - 300)
                              setTooltip({ x, y: rect.bottom + 6, roleName: r.roleName, roleRefName: r.roleRefName })
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {r.roleName}
                          </Link>
                        ) : r.isManaged ? (
                          <span
                            className="text-sm tracking-tight cursor-default"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              const x = Math.min(rect.left, window.innerWidth - 300)
                              setTooltip({ x, y: rect.bottom + 6, roleName: r.roleName, roleRefName: r.roleRefName })
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {r.roleName}
                          </span>
                        ) : (
                          <span className="text-sm tracking-tight text-gray-500">
                            {r.roleName}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-normal border ${
                            r.isManaged 
                            ? 'bg-teal-50 text-teal-700 border-teal-200' 
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                        }`}>
                          {r.managedBy}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {tooltip && (() => {
        const perms = getRolePerms(tooltip.roleRefName, tooltip.roleName)
        const entries = Object.entries(perms)
        const isClickable = !tooltip.roleName.endsWith(' (Cluster-wide)') &&
          (tooltip.roleRefName
            ? tooltip.roleRefName.startsWith(templateNamespacedResourceRolePrefix)
            : true)
        const shortName = tooltip.roleName
        return (
          <div
            style={{ position: 'fixed', left: tooltip.x, top: tooltip.y, zIndex: 9999 }}
            className="bg-white border border-gray-200 shadow-2xl rounded-xl p-3 w-72 pointer-events-none"
          >
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
              <span className="text-xs font-black uppercase tracking-widest text-teal-700">{shortName}</span>
              {isClickable && (
                <span className="text-[10px] text-teal-500 font-bold ml-2 whitespace-nowrap">↗ click to edit</span>
              )}
            </div>
            {entries.length === 0 ? (
              <div className="text-xs text-gray-400 italic py-1">No permissions defined</div>
            ) : (
              <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-1">
                {entries.map(([res, p]) => (
                  <div key={res} className="flex items-center justify-between py-0.5">
                    <span className="text-gray-700 font-mono text-[11px] truncate mr-2">{res}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      {p.read && <span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded text-[10px] font-black">R</span>}
                      {p.write && <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded text-[10px] font-black">W</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
