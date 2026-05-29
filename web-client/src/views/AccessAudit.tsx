import React, { useEffect, useState } from 'react'
import { httpRequests } from '../services/httpRequests'
import { FullScreenLoader } from '../components/Loader'
import { useNamespaceList } from '../hooks/useNamespaceList'

interface AuditRecord {
  subjectKind: string
  subjectName: string
  roleName: string
  managedBy: string
}

export default function AccessAudit() {
  const { namespaceList, loading } = useNamespaceList()
  const [selectedNamespace, setSelectedNamespace] = useState<string>('')
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

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
        const { data } = await httpRequests.httpClient.get(`/api/access-audit?namespace=${selectedNamespace}`)
        setRecords(data || [])
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

          <div className="mb-4 flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">
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
                  <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">Subject Kind</th>
                  <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">Identity Name</th>
                  <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">Assigned Role/ClusterRole</th>
                  <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">Source Policy</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-gray-400 italic font-medium text-base">
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
                            'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {r.subjectKind}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-800 font-mono text-xs">{r.subjectName}</td>
                      <td className="py-4 px-6 text-gray-700 font-bold">
                        <div className="flex flex-col">
                            <span className="text-sm tracking-tight">{r.roleName.replace('template-namespaced-resources___', '').replace('template-cluster-resources___', '')}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border-2 ${
                            r.managedBy === 'PermissionManager' 
                            ? 'bg-teal-50 text-teal-600 border-teal-100' 
                            : 'bg-orange-50 text-orange-600 border-orange-100'
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
    </div>
  )
}
