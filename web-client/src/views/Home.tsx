import React, { useState } from 'react'
import {useUsers} from '../hooks/useUsers'
import {Link} from 'react-router-dom'
import { httpRequests } from '../services/httpRequests'
import { FullScreenLoader } from '../components/Loader'

export default function Home() {
  const { users, loading, loaded, refreshUsers } = useUsers()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async (username: string) => {
    const isConfirmed = window.confirm(`Are you sure you want to delete user "${username}"?`)
    if (!isConfirmed) return

    setIsDeleting(true)
    try {
      await httpRequests.userRequests.delete(username)
      await refreshUsers()
    } catch (err: any) {
      window.alert(`Failed to delete user: ${err?.response?.data?.error || err?.response?.data?.message || err.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className=" bg-gray-200  pt-16 min-h-screen">
      <div className="max-w-4xl mx-auto px-4">
        {(loading || isDeleting) && <FullScreenLoader />}
        <div className=" bg-white shadow-xl rounded-xl p-8 mb-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl text-gray-800 font-black flex items-center tracking-tight">
              <svg className="w-8 h-8 mr-3 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              Users
            </h2>
            <Link to="/new-user">
              <button className="bg-teal-600 hover:bg-teal-700 text-white font-black py-2.5 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center text-sm tracking-widest uppercase">
                <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-60H6"></path></svg>
                CREATE NEW USER
              </button>
            </Link>
          </div>

          <div className="my-6 border-t pt-4">
            <table className="text-left w-full border-collapse">
              <thead>
                <tr>
                  <th className="py-4 px-6 bg-gray-50 font-black uppercase text-xs text-gray-500 border-b border-gray-100 tracking-widest">
                    User Identity
                  </th>
                  <th className="py-4 px-6 bg-gray-50 font-black uppercase text-xs text-gray-500 border-b border-gray-100 text-right tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {!loaded && loading ? (
                  <tr>
                    <td colSpan={2} className="py-12 border-b border-gray-100 text-center text-gray-400 font-medium italic">
                      Fetching users from cluster...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-12 border-b border-gray-100 text-center text-gray-400 font-medium italic">
                      No users found. Start by creating one.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.name} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100 last:border-0">
                      <td className="py-3 px-6 text-gray-800">
                        <Link to={`/users/${u.name}`} className="underline text-teal-700 hover:text-teal-900 font-black tracking-tight text-base">
                          {u.friendlyName || u.name}
                        </Link>
                        {u.friendlyName && <div className="text-[11px] text-gray-400 font-mono italic">Internal ID: {u.name}</div>}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleDelete(u.name)}
                          className="text-red-500 hover:text-red-700 font-black text-xs uppercase tracking-tighter"
                          title="Delete User"
                        >
                          Delete
                        </button>
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
