import React, {useEffect} from 'react'
import EditUser from '../components/edit-user'
import CreateKubeconfigButton from '../components/CreateKubeconfigButton'
import {useUsers} from '../hooks/useUsers'
import {useParams} from 'react-router-dom'

export default function UserPage() {

  const { username }: {username: string} = useParams()

  const { users, refreshUsers } = useUsers()

  useEffect(refreshUsers, [])

  const user = users.find(u => u.name === username)

  return (
    <div className=" bg-gray-200  pt-16 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 pb-12">
        <div className=" bg-white shadow-xl rounded-2xl p-8 mb-4">
          {user ? <EditUser user={user} /> : (
            <div className="py-20 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
                <p className="text-gray-400 font-medium italic">Loading user data from cluster...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
