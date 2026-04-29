import React, {useEffect, useState} from 'react'
import NamespaceMultiSelect from './NamespaceMultiSelect'
import TemplateSelect from './TemplateSelect'
import {AggregatedRoleBinding, AggregatedRoleBindingNamespace} from "../services/role";

interface TemplatePairSelectParameters {
  readonly index?: number;

  onSave(aggregatedRoleBinding: AggregatedRoleBinding): void;

  readonly initialValues: AggregatedRoleBinding;
}

export default function TemplatePairSelect({onSave, initialValues}: TemplatePairSelectParameters) {
  const [namespaces, setNamespaces] = useState<AggregatedRoleBindingNamespace>(initialValues.namespaces || [])
  const [allNamespace, setAllNamespaces] = useState<boolean>(initialValues.namespaces === 'ALL_NAMESPACES' ? true : null)
  const [template, setTemplate] = useState(initialValues.template)

  useEffect(() => {
    if (allNamespace === null) {
      return
    }

    if (allNamespace) {
      setNamespaces('ALL_NAMESPACES')
    } else {
      setNamespaces([])
    }
  }, [allNamespace])

  useEffect(() => {
    onSave({
      id: initialValues.id,
      namespaces,
      template: template
    })
  }, [initialValues.id, namespaces, onSave, template])

  return (
    <div className="flex flex-col md:flex-row md:space-x-6 space-y-4 md:space-y-0 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex-1" data-testid="template-select">
        <label className="block uppercase tracking-widest text-gray-400 text-[10px] font-black mb-2 ml-1">
          Select Role Template
        </label>
        <TemplateSelect
          onSelect={t => setTemplate(t)}
          initialValue={initialValues.template}
        />
      </div>
      <div className="flex-1" data-testid="namespaces-select">
        <div className="flex justify-between items-center mb-2 ml-1">
          <label className="block uppercase tracking-widest text-gray-400 text-[10px] font-black">
            <span className="text-red-500 mr-1">*</span> Target Namespaces
          </label>
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 accent-teal-600 transition-all"
              checked={!!allNamespace}
              onChange={e => setAllNamespaces(e.target.checked)}
            />
            <span className="ml-2 text-[10px] font-black uppercase text-gray-500 group-hover:text-teal-600 transition-colors">Apply to all</span>
          </label>
        </div>

        <div className="relative">
          <NamespaceMultiSelect
            value={allNamespace ? ['* ALL NAMESPACES *'] : (Array.isArray(namespaces) ? namespaces : [])}
            placeholder={allNamespace ? 'Global Access Enabled' : 'Search namespaces...'}
            disabled={allNamespace}
            onSelect={ns => {
              setNamespaces(ns)
            }}
          />
        </div>
        <p className="mt-2 text-[10px] text-gray-400 italic font-medium ml-1">
          {allNamespace ? 'User will have permissions across the entire cluster, including future namespaces.' : 'Select specific namespaces where this role will apply.'}
        </p>
      </div>
    </div>
  )
}
