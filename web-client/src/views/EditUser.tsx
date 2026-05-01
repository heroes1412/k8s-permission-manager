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

  return user ? <EditUser user={user} /> : (
    <div className="bg-apple-lightGray min-h-screen py-16 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-transparent border-t-apple-blue mx-auto mb-4"></div>
        <p className="text-[17px] font-text text-apple-textTertiaryLight font-medium">Loading user data from cluster...</p>
    </div>
  )
}
