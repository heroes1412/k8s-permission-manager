import React from 'react'
import TemplatePairSelect from './TemplatePairSelect'
import { AggregatedRoleBinding } from "../services/role";

interface TemplatesParameters {
  readonly pairItems: AggregatedRoleBinding[]
  savePair: (p: AggregatedRoleBinding) => void
  setPairItems: (p: AggregatedRoleBinding[] | ((prev: AggregatedRoleBinding[]) => AggregatedRoleBinding[])) => void
  addEmptyPair: () => void
}

export default function Templates({ pairItems, savePair, setPairItems, addEmptyPair }: TemplatesParameters) {
  const lastPair = pairItems[pairItems.length - 1]
  const addButtonDisabled =
    lastPair && lastPair.template && lastPair.namespaces.length === 0

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <label className="block text-[17px] font-text font-semibold text-apple-nearBlack tracking-[-0.374px]">Namespace Permissions</label>
        <button
          type="button"
          onClick={() => addEmptyPair()}
          disabled={addButtonDisabled}
          className={`bg-apple-buttonLight border-[3px] border-[rgba(0,0,0,0.04)] text-apple-nearBlack font-text py-[6px] px-[12px] rounded-[11px] text-[14px] transition-all flex items-center ${addButtonDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[rgba(0,0,0,0.1)]'}`}
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Add Permission
        </button>
      </div>

      <div className="space-y-6">
        {pairItems.map((p, index) => {
          return (
            <div key={p.id} className="relative bg-[rgba(0,0,0,0.02)] p-4 rounded-[11px] border border-[rgba(0,0,0,0.05)]">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[12px] font-text font-semibold text-apple-textTertiaryLight uppercase tracking-widest">
                  Permission Rule #{index + 1}
                </span>
                <button
                  tabIndex={-1}
                  type="button"
                  className="text-apple-textTertiaryLight hover:text-[#ff3b30] p-1 transition-colors"
                  onClick={() => setPairItems((state: AggregatedRoleBinding[]) => state.filter(x => x.id !== p.id))}
                  title="Remove Rule"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>

              <TemplatePairSelect
                index={index + 1}
                onSave={savePair}
                initialValues={p}
              />
            </div>
          )
        })}

        {pairItems.length === 0 && (
          <div className="text-center py-10 bg-[rgba(0,0,0,0.02)] rounded-[11px] border-2 border-dashed border-[rgba(0,0,0,0.1)]">
             <p className="text-[14px] font-text text-[rgba(0,0,0,0.48)]">No specific namespace permissions assigned.</p>
          </div>
        )}
      </div>
    </div>
  )
}
