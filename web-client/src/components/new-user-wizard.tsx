import React, { useCallback, useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { FullScreenLoader } from './Loader'
import { useUsers } from '../hooks/useUsers'
import { httpRequests } from "../services/httpRequests"
import GroupMultiSelect from "./GroupMultiSelect"

export default function NewUserWizard() {
  const history = useHistory()

  const [username, setUsername] = useState<string>('')
  const [maxDays, setMaxDays] = useState<number>(0)
  const [groups, setGroups] = useState<string[]>([])
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [formTouched, setFormTouched] = useState<boolean>(false)
  const [showLoader, setShowLoader] = useState<boolean>(false)
  const { users } = useUsers()

  const validateUsername = useCallback(() => {
    if (username.length < 1 || username.length > 32) {
      setUsernameError('Required to be between 1 and 32 characters long')
      return false
    }

    if (
      !username.match(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?([@\.-][a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/)) {
      setUsernameError(`username must be lowercase alphanumeric, and can contain "-", ".", or "@" for emails, and must start and end with an alphanumeric character`)
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

  const saveButtonDisabled = usernameError !== null

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
      const createdUser = await httpRequests.userRequests.create(username, maxDays, groups)
      history.push(`/users/${createdUser.name}`)
    } catch (err: any) {
      console.error(err)
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
      window.alert(`Error creating user: ${errorMsg}`);
    } finally {
      setShowLoader(false)
    }
  }

  return (
    <div className="bg-apple-lightGray min-h-screen py-16 flex flex-col items-center px-4">
      {showLoader && <FullScreenLoader />}
      <div className="w-full max-w-[980px]">
        <h2 className="text-apple-nearBlack text-[40px] md:text-[56px] font-display font-semibold leading-[1.07] tracking-[-0.28px] text-center mb-12">
          Create User
        </h2>

        <form
          className="bg-white rounded-[12px] p-6 md:p-10 max-w-[600px] mx-auto shadow-apple"
          onSubmit={e => {
            e.preventDefault()
            setShowLoader(true)
            handleSubmit(e)
          }}
        >
          <div className="space-y-6">
            <div>
              <label className="block text-[17px] font-text font-semibold text-apple-nearBlack mb-2 tracking-[-0.374px]">Username / Email</label>
              <input
                autoFocus
                placeholder="e.g. apple.seed@company.com"
                className={`w-full bg-apple-buttonLight border-[3px] rounded-[11px] py-3 px-4 text-[17px] font-text text-apple-nearBlack focus:outline-none focus:border-apple-blue transition-all ${usernameError && formTouched ? 'border-red-500' : 'border-[rgba(0,0,0,0.04)]'
                  }`}
                required
                type="text"
                value={username}
                onChange={e => {
                  if (!formTouched) {
                    setFormTouched(true)
                  }
                  const filtered = e.target.value.toLowerCase().replace(/[^a-z0-9-@.]/g, '');
                  setUsername(filtered.slice(0, 32))
                }}
              />
              {usernameError && formTouched && (
                <p className="text-red-500 text-[14px] font-text mt-2 tracking-[-0.224px]">{usernameError}</p>
              )}
            </div>

            <div>
              <label className="block text-[17px] font-text font-semibold text-apple-nearBlack mb-2 tracking-[-0.374px]">Days to Expire (0 = Never)</label>
              <input
                placeholder="e.g. 30"
                className="w-full bg-apple-buttonLight border-[3px] border-[rgba(0,0,0,0.04)] rounded-[11px] py-3 px-4 text-[17px] font-text text-apple-nearBlack focus:outline-none focus:border-apple-blue transition-all"
                type="number"
                min="0"
                value={maxDays}
                onChange={e => setMaxDays(parseInt(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="block text-[17px] font-text font-semibold text-apple-nearBlack mb-2 tracking-[-0.374px]">Assigned Groups</label>
              <GroupMultiSelect
                value={groups}
                onSelect={setGroups}
                placeholder="Select or create groups..."
              />
            </div>

            <div className="pt-6 flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => history.push('/')}
                className="bg-transparent text-apple-darkBlue border border-apple-darkBlue rounded-pill px-[15px] py-[8px] text-[17px] font-text hover:underline transition-all"
              >
                Discard
              </button>
              <button
                className={`bg-apple-blue text-white rounded-[8px] px-[15px] py-[8px] text-[17px] font-text transition-all ${saveButtonDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-apple-brightBlue'
                  }`}
                disabled={saveButtonDisabled}
                type="submit"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
