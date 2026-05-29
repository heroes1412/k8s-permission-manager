import React from 'react'
import { Dialog } from '@reach/dialog'

interface GroupDryRunModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  groupName: string;
  affectedUsers: string[];
  isSaving: boolean;
}

export default function GroupDryRunModal({ isOpen, onDismiss, onConfirm, groupName, affectedUsers, isSaving }: GroupDryRunModalProps) {
  return (
    <Dialog
      className="max-w-[600px] w-[90vw] mx-auto bg-white shadow-apple rounded-[12px] p-6 sm:p-10 outline-none"
      isOpen={isOpen}
      onDismiss={isSaving ? () => {} : onDismiss}
    >
      <div>
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-xl sm:text-2xl font-black text-gray-800 tracking-tight flex items-center">
            <svg className="w-6 h-6 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            Review Changes
          </h2>
          <button
            className="text-gray-400 hover:text-red-500 transition-colors"
            onClick={onDismiss}
            disabled={isSaving}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="mb-6 space-y-4">
          <p className="text-sm text-gray-600">
            You are about to update the permissions for the group <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">{groupName}</span>.
          </p>
          
          <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
            <h3 className="text-sm font-black text-orange-800 mb-2 uppercase tracking-widest">Impact Analysis</h3>
            <p className="text-sm text-orange-700 mb-2">
              This change will immediately affect <strong className="text-lg">{affectedUsers.length}</strong> users.
            </p>
            {affectedUsers.length > 0 && (
              <div className="max-h-[150px] overflow-y-auto bg-white p-3 rounded-lg border border-orange-100 shadow-inner">
                <ul className="list-disc pl-4 text-xs text-gray-700 space-y-1">
                  {affectedUsers.map(u => (
                    <li key={u} className="font-mono">{u}</li>
                  ))}
                </ul>
              </div>
            )}
            {affectedUsers.length === 0 && (
              <p className="text-xs italic text-orange-600">No users are currently assigned to this group.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-black text-sm tracking-widest uppercase hover:bg-gray-50 transition-colors"
            onClick={onDismiss}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm tracking-widest uppercase shadow-lg transition-all active:scale-95 flex items-center justify-center"
            onClick={onConfirm}
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : 'Confirm & Apply'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
