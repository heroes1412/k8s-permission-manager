import React, { useMemo, useState } from 'react'
import { useUsers } from '../hooks/useUsers'
import { Link } from 'react-router-dom'
import { httpRequests } from '../services/httpRequests'
import { FullScreenLoader } from '../components/Loader'
import { useSettings } from '../hooks/useSettings'
import { TableVirtuoso } from 'react-virtuoso'
import ConfirmModal from '../components/ConfirmModal'
import Toast from '../components/Toast'

type ConfirmState = { title: string; message: string; confirmLabel?: string; variant?: 'danger' | 'warning'; onConfirm: () => void }
type ToastState = { message: string; type: 'success' | 'error' | 'info' }

export default function Home() {
  const { users, loading, loaded, refreshUsers } = useUsers()
  const { settings } = useSettings()
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [toastState, setToastState] = useState<ToastState | null>(null)

  const [bulkAction, setBulkAction] = useState<string>('extend')
  const [bulkDays, setBulkDays] = useState<number>(30)
  const [bulkGroup, setBulkGroup] = useState<string>('')
  const [availableGroups, setAvailableGroups] = useState<any[]>([])

  React.useEffect(() => {
    if (settings.GROUPS_ENABLED === 'true') {
      httpRequests.groupList().then(res => {
        setAvailableGroups(res.data || [])
        if (res.data && res.data.length > 0) {
          setBulkGroup(res.data[0].name)
        }
      }).catch(err => console.error(err))
    }
  }, [settings.GROUPS_ENABLED])

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      (u.friendlyName || '').toLowerCase().includes(q)
    )
  }, [users, search])

  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedUsers.includes(u.name))

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUsers(prev => Array.from(new Set([...prev, ...filteredUsers.map(u => u.name)])))
    } else {
      const filtered = new Set(filteredUsers.map(u => u.name))
      setSelectedUsers(prev => prev.filter(n => !filtered.has(n)))
    }
  }

  const handleSelectUser = (name: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, name])
    } else {
      setSelectedUsers(prev => prev.filter(u => u !== name))
    }
  }

  const [progress, setProgress] = useState<{current: number, total: number, action: string} | null>(null)

  const handleDelete = (username: string) => {
    setConfirmState({
      title: 'Delete User',
      message: `Are you sure you want to delete user "${username}"?`,
      onConfirm: async () => {
        setIsProcessing(true)
        try {
          await httpRequests.userRequests.delete(username)
          await refreshUsers()
          setSelectedUsers(prev => prev.filter(u => u !== username))
        } catch (err: any) {
          setToastState({ message: `Failed to delete user: ${err?.response?.data?.error || err?.response?.data?.message || err.message}`, type: 'error' })
        } finally {
          setIsProcessing(false)
        }
      }
    })
  }

  const handleBulkOperation = () => {
    if (selectedUsers.length === 0) return
    const actionLabel = bulkAction === 'delete'
      ? 'delete'
      : bulkAction === 'extend'
        ? `extend expiry by ${bulkDays} days for`
        : `add to group "${bulkGroup}" for`
    setConfirmState({
      title: 'Bulk Operation',
      message: `Are you sure you want to ${actionLabel} ${selectedUsers.length} selected user(s)?`,
      variant: bulkAction === 'delete' ? 'danger' : 'warning',
      confirmLabel: 'Apply',
      onConfirm: async () => {
        setIsProcessing(true)
        setProgress({ current: 0, total: selectedUsers.length, action: bulkAction })
        let successCount = 0
        let failCount = 0
        let currentIdx = 0

        try {
          if (bulkAction === 'delete') {
            for (const username of selectedUsers) {
              try {
                setProgress({ current: ++currentIdx, total: selectedUsers.length, action: 'Deleting' })
                await httpRequests.userRequests.delete(username)
                successCount++
              } catch (e) {
                console.error(`Failed to delete ${username}`, e)
                failCount++
              }
            }
          } else if (bulkAction === 'extend') {
            for (const username of selectedUsers) {
              try {
                setProgress({ current: ++currentIdx, total: selectedUsers.length, action: 'Extending' })
                const user = users.find(u => u.name === username)
                if (!user) continue
                const now = new Date().getTime()
                const createdAt = new Date(user.createdAt || now).getTime()
                const wantedExpiresAt = now + bulkDays * 24 * 60 * 60 * 1000
                const newTotalMaxDays = Math.round((wantedExpiresAt - createdAt) / (24 * 60 * 60 * 1000))
                await httpRequests.userRequests.update(username, newTotalMaxDays, user.groups || [], user.resources || [])
                successCount++
              } catch (e) {
                console.error(`Failed to extend ${username}`, e)
                failCount++
              }
            }
          } else if (bulkAction === 'add_group') {
            if (!bulkGroup) throw new Error("No group selected")
            for (const username of selectedUsers) {
              try {
                setProgress({ current: ++currentIdx, total: selectedUsers.length, action: 'Adding to group' })
                const user = users.find(u => u.name === username)
                if (!user) continue
                const currentGroups = user.groups || []
                if (!currentGroups.includes(bulkGroup)) {
                  await httpRequests.userRequests.update(username, user.maxDays, [...currentGroups, bulkGroup], user.resources || [])
                }
                successCount++
              } catch (e) {
                console.error(`Failed to add ${username} to group`, e)
                failCount++
              }
            }
          }

          await refreshUsers()
          setSelectedUsers([])
          if (failCount > 0) {
            setToastState({ message: `Done. Success: ${successCount}, Failed: ${failCount}.`, type: 'error' })
          } else {
            setToastState({ message: `Successfully applied to ${successCount} user(s).`, type: 'success' })
          }
        } catch (err: any) {
          setToastState({ message: `Fatal error during bulk operation: ${err.message}`, type: 'error' })
        } finally {
          setIsProcessing(false)
          setProgress(null)
        }
      }
    })
  }

  const handleRevokeExpired = () => {
    const expiredUsers = users.filter(u => {
      if (!u.maxDays || u.maxDays <= 0 || !u.createdAt) return false
      return new Date().getTime() > new Date(u.createdAt).getTime() + u.maxDays * 24 * 60 * 60 * 1000
    }).map(u => u.name)

    if (expiredUsers.length === 0) {
      setToastState({ message: 'No expired users found.', type: 'info' })
      return
    }

    setConfirmState({
      title: 'Revoke Expired Permissions',
      message: `Found ${expiredUsers.length} expired user(s). Do you want to revoke ALL permissions for them now?`,
      confirmLabel: 'Revoke All',
      onConfirm: async () => {
        setIsProcessing(true)
        setProgress({ current: 0, total: expiredUsers.length, action: 'Revoking' })
        let successCount = 0
        let currentIdx = 0
        for (const username of expiredUsers) {
          try {
            setProgress({ current: ++currentIdx, total: expiredUsers.length, action: 'Revoking' })
            const user = users.find(u => u.name === username)
            if (user) {
              await httpRequests.userRequests.update(username, user.maxDays, [], [])
              successCount++
            }
          } catch (e) {
            console.error(`Failed to revoke ${username}`, e)
          }
        }
        await refreshUsers()
        setIsProcessing(false)
        setProgress(null)
        setToastState({ message: `Revoked permissions for ${successCount} expired user(s).`, type: 'success' })
      }
    })
  }

  return (
    <div className=" bg-gray-200  pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 h-[calc(100vh-100px)] flex flex-col pb-8">
        {(loading || isProcessing) && <FullScreenLoader text={progress ? `${progress.action} ${progress.current}/${progress.total}...` : undefined} />}

        {confirmState && (
          <ConfirmModal
            isOpen={true}
            title={confirmState.title}
            message={confirmState.message}
            confirmLabel={confirmState.confirmLabel}
            variant={confirmState.variant}
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(null)}
          />
        )}
        {toastState && <Toast message={toastState.message} type={toastState.type} onDismiss={() => setToastState(null)} />}

        <div className=" bg-white shadow-xl rounded-xl p-4 sm:p-8 flex-grow flex flex-col overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 flex-shrink-0">
            <h2 className="text-2xl text-gray-800 font-black flex items-center tracking-tight">
              <svg className="w-8 h-8 mr-3 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              Users
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {settings.EXPIRED_USER_ACTION === 'KEEP' && (
                <button onClick={handleRevokeExpired} className="w-full sm:w-auto bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200 font-black py-2.5 px-4 rounded-xl shadow-sm transition-all transform active:scale-95 flex items-center justify-center text-xs tracking-widest uppercase">
                  REVOKE EXPIRED
                </button>
              )}
              <Link to="/new-user" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-black py-2.5 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center text-sm tracking-widest uppercase">
                  <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-60H6"></path></svg>
                  CREATE NEW USER
                </button>
              </Link>
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in flex-shrink-0">
              <div className="text-sm font-bold text-teal-800">
                <span className="bg-teal-600 text-white px-2 py-0.5 rounded-md mr-2">{selectedUsers.length}</span>
                Users Selected
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <select
                  className="w-full sm:w-auto bg-white border border-teal-200 rounded-lg px-3 py-1.5 text-sm font-bold text-teal-800 outline-none focus:ring-2 focus:ring-teal-500"
                  value={bulkAction}
                  onChange={e => setBulkAction(e.target.value)}
                >
                  <option value="extend">Extend Expiry By (Days)</option>
                  {settings.GROUPS_ENABLED === 'true' && <option value="add_group">Add to Group</option>}
                  <option value="delete">Delete Selected</option>
                </select>

                {bulkAction === 'extend' && (
                  <input
                    type="number"
                    min="1"
                    value={bulkDays}
                    onChange={e => setBulkDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 bg-white border border-teal-200 rounded-lg px-3 py-1.5 text-sm font-bold text-teal-800 outline-none focus:ring-2 focus:ring-teal-500 text-center"
                  />
                )}

                {bulkAction === 'add_group' && (
                  <select
                    className="w-full sm:w-auto bg-white border border-teal-200 rounded-lg px-3 py-1.5 text-sm font-bold text-teal-800 outline-none focus:ring-2 focus:ring-teal-500"
                    value={bulkGroup}
                    onChange={e => setBulkGroup(e.target.value)}
                  >
                    {availableGroups.length === 0 ? (
                      <option value="" disabled>No groups available</option>
                    ) : (
                      availableGroups.map(g => (
                        <option key={g.name} value={g.name}>{g.friendlyName || g.name}</option>
                      ))
                    )}
                  </select>
                )}

                <button
                  onClick={handleBulkOperation}
                  className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-black py-1.5 px-6 rounded-lg shadow-sm transition-all transform active:scale-95 text-xs tracking-widest uppercase"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          <div className="mb-4 flex-shrink-0">
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-xs bg-gray-50 border-2 border-gray-100 px-4 py-2 rounded-xl text-sm font-bold text-gray-700 focus:outline-none focus:border-teal-500 transition-all"
            />
          </div>

          <div className="border-t pt-4 flex-grow overflow-hidden relative min-h-[300px]">
            {(!loaded && loading) ? (
              <div className="py-12 text-center text-gray-400 font-medium italic">
                Fetching users from cluster...
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-gray-400 font-medium italic">
                No users found. Start by creating one.
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-gray-400 font-medium italic">
                No users match your search.
              </div>
            ) : (
              <TableVirtuoso
                data={filteredUsers}
                useWindowScroll={false}
                className="w-full h-full border-collapse"
                components={{
                  Table: (props) => <table {...props} className="text-left w-full border-collapse min-w-[600px]" />,
                  TableHead: React.forwardRef((props, ref) => <thead {...props} ref={ref} className="bg-white sticky top-0 z-10" />),
                  TableRow: (props) => <tr {...props} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0" />
                }}
                fixedHeaderContent={() => (
                  <tr>
                    <th className="py-4 px-4 bg-gray-50 border-b border-gray-100 shadow-[0_1px_0_0_#f3f4f6] w-[40px]">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
                        checked={allFilteredSelected}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="py-4 px-2 bg-gray-50 font-black uppercase text-xs text-gray-500 border-b border-gray-100 tracking-widest shadow-[0_1px_0_0_#f3f4f6]">
                      User Identity
                    </th>
                    <th className="py-4 px-6 bg-gray-50 font-black uppercase text-xs text-gray-500 border-b border-gray-100 text-right tracking-widest w-1 whitespace-nowrap shadow-[0_1px_0_0_#f3f4f6]">
                      Actions
                    </th>
                  </tr>
                )}
                itemContent={(index, u) => {
                  const isExpired = u.maxDays && u.maxDays > 0 && u.createdAt &&
                    new Date().getTime() > new Date(u.createdAt).getTime() + u.maxDays * 24 * 60 * 60 * 1000

                  const daysLeft = u.maxDays && u.maxDays > 0 && u.createdAt ?
                    Math.round((new Date(u.createdAt).getTime() + u.maxDays * 24 * 60 * 60 * 1000 - new Date().getTime()) / (24 * 60 * 60 * 1000)) : null

                  return (
                    <>
                      <td className="py-3 px-4 w-[40px] align-middle">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
                          checked={selectedUsers.includes(u.name)}
                          onChange={(e) => handleSelectUser(u.name, e.target.checked)}
                        />
                      </td>
                      <td className="py-3 px-2 text-gray-800 break-all">
                        <div className="flex flex-wrap items-center">
                          <Link
                            to={`/users/${u.name}`}
                            className={`font-black tracking-tight text-base mr-2 ${isExpired && settings.EXPIRED_USER_ACTION === 'KEEP' ? 'line-through text-gray-400 hover:text-gray-500' : 'text-teal-700 hover:text-teal-900'}`}
                          >
                            {u.friendlyName || u.name}
                          </Link>
                          {isExpired ? (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] font-bold rounded border border-gray-200 mt-1 sm:mt-0">Expired</span>
                          ) : daysLeft !== null ? (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[11px] font-medium rounded border border-gray-200 mt-1 sm:mt-0">
                              {daysLeft <= 0 ? 'Expiring soon' : `${daysLeft}d left`}
                            </span>
                          ) : null}
                        </div>
                        {u.friendlyName && <div className={`text-[11px] font-mono italic mt-1 ${isExpired && settings.EXPIRED_USER_ACTION === 'KEEP' ? 'text-gray-300' : 'text-gray-400'}`}>Internal ID: {u.name}</div>}
                        {settings.GROUPS_ENABLED === 'true' && u.groups && u.groups.length > 0 && (
                          <div className={`flex flex-wrap items-center gap-1 mt-1.5 ${isExpired && settings.EXPIRED_USER_ACTION === 'KEEP' ? 'opacity-50' : ''}`}>
                            <span className="text-[11px] text-gray-500 font-medium mr-1">Groups:</span>
                            {u.groups.map(g => (
                              <span key={g} className="px-1.5 py-0.5 bg-gray-50 text-gray-600 text-[10px] font-bold rounded border border-gray-200">
                                {g}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right w-1 whitespace-nowrap align-middle">
                        <button
                          onClick={() => handleDelete(u.name)}
                          className="text-red-500 hover:text-red-700 font-black text-xs uppercase tracking-tighter"
                          title="Delete User"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
