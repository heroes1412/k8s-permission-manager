import { useUsers } from '../hooks/useUsers'
import React, { useState } from 'react'
import { FullScreenLoader } from './Loader'
import { useHistory } from 'react-router-dom'
import { User } from "../types"
import { httpRequests } from "../services/httpRequests"
import CreateKubeconfigButton from "./CreateKubeconfigButton"
import GroupMultiSelect from "./GroupMultiSelect"
import { useSettings } from '../hooks/useSettings'
import ConfirmModal from './ConfirmModal'
import Toast from './Toast'

interface EditUserParameters {
  readonly user: User;
}

type ToastState = { message: string; type: 'success' | 'error' | 'info' }

export default function EditUser({ user }: EditUserParameters) {
  const { settings } = useSettings()
  const [showLoader, setShowLoader] = useState<boolean>(false)
  const username = user.name
  const history = useHistory()
  const { refreshUsers } = useUsers()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toastState, setToastState] = useState<ToastState | null>(null)

  const calculateDaysLeft = () => {
    if (!user.maxDays || user.maxDays <= 0 || !user.createdAt) return 0;
    const createdAt = new Date(user.createdAt).getTime();
    const expiresAt = createdAt + user.maxDays * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();
    const left = Math.round((expiresAt - now) / (24 * 60 * 60 * 1000));
    return left > 0 ? left : 0;
  }

  const [maxDays, setMaxDays] = useState<number>(user.maxDays > 0 ? calculateDaysLeft() : 0)
  const [groups, setGroups] = useState<string[]>(user.groups || [])

  async function handleUserDeletion() {
    setShowLoader(true)
    await httpRequests.userRequests.delete(username)
  }

  async function handleSubmit(e: any, reloadAfterSubmit = true) {
    e.preventDefault()
    setShowLoader(true)
    try {
      let newTotalMaxDays = 0;
      if (maxDays > 0) {
        const now = new Date().getTime();
        const createdAt = new Date(user.createdAt || now).getTime();
        const wantedExpiresAt = now + maxDays * 24 * 60 * 60 * 1000;
        newTotalMaxDays = Math.round((wantedExpiresAt - createdAt) / (24 * 60 * 60 * 1000));
      }

      await httpRequests.userRequests.update(username, newTotalMaxDays, groups, user.resources || [])
      if (reloadAfterSubmit) {
        await refreshUsers()
        history.push('/')
      }
    } catch (err: any) {
      console.error(err)
      setToastState({ message: 'Failed to save user.', type: 'error' })
      setShowLoader(false)
    }
  }

  return (
    <div className="bg-apple-lightGray min-h-screen py-16 flex flex-col items-center px-4">
      {showLoader && <FullScreenLoader />}
      {toastState && <Toast message={toastState.message} type={toastState.type} onDismiss={() => setToastState(null)} />}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete User"
        message={`Confirm deletion of User ${username}?`}
        confirmLabel="Delete"
        onConfirm={() => {
          handleUserDeletion().then(async () => {
            await refreshUsers()
            history.push('/')
          })
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <div className="w-full max-w-[980px]">
        <h2 className="text-apple-nearBlack text-[40px] md:text-[56px] font-display font-semibold leading-[1.07] tracking-[-0.28px] text-center mb-12">
          User: <span className="text-apple-blue">{user.friendlyName || username}</span>
        </h2>

        <div className="bg-white rounded-[12px] p-6 md:p-10 max-w-[600px] mx-auto shadow-apple">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="w-full mb-8">
              <CreateKubeconfigButton user={user} />
            </div>

            <div>
              <label className="block text-[17px] font-text font-semibold text-apple-nearBlack mb-2 tracking-[-0.374px]">Days to Expire (0 = Never)</label>
              <input
                className="w-full bg-apple-buttonLight border-[3px] border-[rgba(0,0,0,0.04)] rounded-[11px] py-3 px-4 text-[17px] font-text text-apple-nearBlack focus:outline-none focus:border-apple-blue transition-all"
                type="number"
                min="0"
                value={maxDays}
                onChange={e => setMaxDays(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <p className="mt-1 text-[12px] text-apple-textTertiaryLight font-medium italic">User will expire in {maxDays} days from now.</p>
            </div>

            {settings.GROUPS_ENABLED === 'true' && (
              <div>
                <label className="block text-[17px] font-text font-semibold text-apple-nearBlack mb-2 tracking-[-0.374px]">Assigned Groups</label>
                <GroupMultiSelect
                  value={groups}
                  onSelect={setGroups}
                  placeholder="Select or create groups..."
                />
              </div>
            )}

            <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button
                tabIndex={-1}
                type="button"
                className="w-full sm:w-auto bg-transparent text-[#ff3b30] border border-[#ff3b30] rounded-pill px-[15px] py-[8px] text-[17px] font-text hover:bg-[#ff3b30] hover:text-white transition-all flex items-center justify-center"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete User
              </button>

              <button
                className="w-full sm:w-auto bg-apple-blue text-white rounded-[8px] px-[15px] py-[8px] text-[17px] font-text hover:bg-apple-brightBlue transition-all flex items-center justify-center"
                type="submit"
              >
                Save User
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
