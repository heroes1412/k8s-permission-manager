import React from 'react'
import {ClusterAccess} from "./types";

interface ClusterAccessRadioParameters {
  readonly clusterAccess: ClusterAccess,
  setClusterAccess(clusterAccess: ClusterAccess): void
}

export default function ClusterAccessRadio({clusterAccess, setClusterAccess}: ClusterAccessRadioParameters) {
  
  const options: { value: ClusterAccess, label: string, description: string }[] = [
    { value: 'none', label: 'None', description: 'Restricted to selected namespaces only.' },
    { value: 'read', label: 'Read Only', description: 'Can view resources across the entire cluster.' },
    { value: 'write', label: 'Admin (Write)', description: 'Full administrative access across the entire cluster.' }
  ]

  return (
    <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
      {options.map((option) => (
        <label 
          key={option.value}
          className={`flex-1 flex flex-col p-4 rounded-[11px] border-[3px] cursor-pointer transition-all ${
            clusterAccess === option.value 
              ? 'border-apple-blue bg-[rgba(0,113,227,0.05)]' 
              : 'border-[rgba(0,0,0,0.04)] bg-apple-buttonLight hover:border-[rgba(0,0,0,0.1)]'
          }`}
        >
          <div className="flex items-center mb-2">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${
              clusterAccess === option.value ? 'border-apple-blue' : 'border-[rgba(0,0,0,0.2)]'
            }`}>
              {clusterAccess === option.value && <div className="w-2.5 h-2.5 bg-apple-blue rounded-full"></div>}
            </div>
            <span className={`text-[17px] font-text font-semibold ${
              clusterAccess === option.value ? 'text-apple-blue' : 'text-apple-nearBlack'
            }`}>{option.label}</span>
          </div>
          <span className="text-[14px] font-text text-apple-textTertiaryLight pl-8 leading-tight">{option.description}</span>
          <input
            type="radio"
            className="hidden"
            value={option.value}
            checked={clusterAccess === option.value}
            onChange={e => setClusterAccess(e.target.value as ClusterAccess)}
          />
        </label>
      ))}
    </div>
  )
}
