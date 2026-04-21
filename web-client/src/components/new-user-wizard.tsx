import React, { useCallback, useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import ClusterAccessRadio from './ClusterAccessRadio'
import Templates from './Templates'
import { FullScreenLoader } from './Loader'
import Summary from './Summary'
import { useUsers } from '../hooks/useUsers'
import { AggregatedRoleBinding } from "../services/role";
import { ClusterAccess } from "./types";
import { httpRequests } from "../services/httpRequests";


export interface AggregatedRoleBindingManager {
  savePair(aggregatedRoleBinding: AggregatedRoleBinding): void

  setPairItems(aggregatedRoleBindings: AggregatedRoleBinding[]): void

  addEmptyPair(): void
}

export default function NewUserWizard() {
  const history = useHistory()

  const [username, setUsername] = useState<string>('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [aggregatedRoleBindings, setAggregatedRoleBindings] = useState<AggregatedRoleBinding[]>([])
  const [clusterAccess, setClusterAccess] = useState<ClusterAccess>('none')
  const [formTouched, setFormTouched] = useState<boolean>(false)
  const [showLoader, setShowLoader] = useState<boolean>(false)
  const { users } = useUsers()

  const validateUsername = useCallback(() => {
    if (username.length < 3) {
      setUsernameError('Required to be at least 3 characters long')
      return false
    }

    if (
      !username.match(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?([@\.-][a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/)) {
      setUsernameError(`username must be lowercase alphanumeric, and can contain "-", ".", or "@" for emails, and must start and end with an alphanumeric character (e.g. 'tester@gmail.com')`)
      return false
    }

    if (users.map(u => u.name).includes(username)) {
      setUsernameError(`user ${username} already exists`)
      return false
    }

    setUsernameError(null)
    return true

  }, [username, users])

  useEffect(
    function validateUsernameOnChange() {
      validateUsername()
    },
    [username.length, validateUsername]
  )

  const saveButtonDisabled =
    aggregatedRoleBindings.length === 0 ||
    usernameError !== null ||
    aggregatedRoleBindings.some(p => p.namespaces.length === 0)

  async function handleSubmit(e: any) {
    e.preventDefault()

    if (!formTouched) {
      setFormTouched(true)
    }

    const valid = validateUsername()

    if (!valid) {
      setShowLoader(false)
      return
    }

    try {
      const createdUser = await httpRequests.userRequests.create(username)

      await httpRequests.rolebindingRequests.create.fromAggregatedRolebindings(
        aggregatedRoleBindings,
        createdUser.name,
        clusterAccess
      )

      history.push(`/users/${createdUser.name}`)

    } catch (err: any) {
      console.error(err)
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      window.alert(`Error creating user permissions: ${errorMsg}`);
    } finally {
      setShowLoader(false)
    }
  }

  const savePair: (p: AggregatedRoleBinding) => void = useCallback(p => {
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

  useEffect(addEmptyPair, [])

  return (
    <div className="p-6">
      {showLoader && <FullScreenLoader />}
      <div className="flex items-center mb-8">
        <div className="p-3 bg-teal-100 rounded-2xl mr-4">
           <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-30h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
        </div>
        <h2 className="text-2xl font-black text-gray-800 tracking-tighter">Setup New User</h2>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault()
          setShowLoader(true)
          handleSubmit(e)
        }}
      >
        <div className="space-y-8">
          <div className="bg-white p-8 border border-gray-100 rounded-2xl shadow-sm">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">
              <span className="text-red-500 mr-2">*</span> Identification
            </label>
            <input
              autoFocus
              placeholder="e.g. employee.name@company.com"
              className={`appearance-none block w-full bg-gray-50 text-gray-800 border-2 rounded-2xl py-4 px-6 leading-tight focus:outline-none focus:bg-white focus:border-teal-500 transition-all font-bold text-lg ${usernameError && formTouched ? 'border-red-500 bg-red-50' : 'border-gray-50'
                }`}
              required
              type="text"
              value={username}
              onChange={e => {
                if (!formTouched) {
                  setFormTouched(true)
                }
                setUsername(e.target.value)
              }}
            />

            {usernameError && formTouched ? (
              <div className="mt-3 flex items-center text-red-500 text-xs font-black uppercase tracking-tight ml-1 animate-pulse">
                <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path></svg>
                {usernameError}
              </div>
            ) : <p className="mt-3 text-[11px] text-gray-300 font-medium italic ml-1 leading-relaxed">System handles conversion of special characters automatically for Kubernetes compliance.</p>}
          </div>

          <div className="bg-white p-8 border border-gray-100 rounded-2xl shadow-sm">
            <Templates
              pairItems={aggregatedRoleBindings}
              savePair={savePair}
              setPairItems={setAggregatedRoleBindings}
              addEmptyPair={addEmptyPair}
            />
          </div>

          <div className="bg-white p-8 border border-gray-100 rounded-2xl shadow-sm">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-6 ml-1">Optional System Access</label>
            <ClusterAccessRadio
              clusterAccess={clusterAccess}
              setClusterAccess={setClusterAccess}
            />
          </div>

          <div className="flex items-center justify-end space-x-6 pt-6">
             <button
               type="button"
               onClick={() => history.push('/')}
               className="text-gray-400 hover:text-gray-600 font-black text-xs uppercase underline tracking-widest"
             >
               Discard
             </button>
             <button
               className={`bg-teal-600 hover:bg-teal-700 text-white font-black py-4 px-12 rounded-2xl shadow-2xl transition-all transform active:scale-95 text-base tracking-widest ${saveButtonDisabled ? ' opacity-30 cursor-not-allowed grayscale' : 'shadow-teal-200'
                 }`}
               disabled={saveButtonDisabled}
               type="submit"
             >
               SAVE USER IDENTITY
             </button>
          </div>
        </div>
      </form>

      {aggregatedRoleBindings.length > 0 && aggregatedRoleBindings.some(p => p.namespaces.length > 0) ? (
        <div className="mt-16 pt-8 border-t-2 border-dashed border-gray-100">
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Configuration Preview</label>
          <Summary pairItems={aggregatedRoleBindings} />
        </div>
      ) : null}
    </div>
  )
}
