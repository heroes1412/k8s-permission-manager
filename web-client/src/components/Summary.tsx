import React from 'react'
import {useRbac} from '../hooks/useRbac'
import TemplateInfo from './TemplateInfo'
import {AggregatedRoleBinding} from "../services/role";
import {RuleSet} from "./types";
import {templateNamespacedResourceRolePrefix} from '../constants'

interface SummaryParameters {
  readonly pairItems: AggregatedRoleBinding[];
}

export default function Summary({ pairItems }: SummaryParameters) {
  const { clusterRoles } = useRbac()

  if (!clusterRoles) {
    return null
  }

  const ruleSets: RuleSet[] = pairItems
    .reduce((acc, p) => {
      const crs = clusterRoles.filter(c => c.metadata.name === p.template)

      const rules = crs.reduce((acc, v) => {
        acc = acc.concat(v.rules)
        return acc
      }, [])

      const ruleset = {
        template: p.template,
        rules,
        namespaces: p.namespaces === 'ALL_NAMESPACES' ? [] : p.namespaces
      }

      const itemForSameTemplate = acc.find(rs => rs.template === p.template)
      if (itemForSameTemplate) {
        const templates = new Set([
          ...itemForSameTemplate.namespaces,
          ...ruleset.namespaces
        ])
        itemForSameTemplate.namespaces = Array.from(templates)
      } else {
        acc = acc.concat(ruleset)
      }

      return acc
    }, [])
    .filter(x => x.namespaces.length > 0)

  return (
    <div data-testid="summary">
      <h3 className="text-xl mb-2 font-black text-gray-800 uppercase tracking-tighter">Summary</h3>
      <div className="space-y-6">
        {ruleSets.map((rs, idx) => (
          <div key={idx} className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
            <h4 className="text-xs font-black text-teal-600 uppercase tracking-widest mb-4 flex items-center">
              <span className="bg-teal-100 p-1 rounded mr-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
              </span>
              Template: {rs.template.replace(templateNamespacedResourceRolePrefix, '')}
            </h4>
            <TemplateInfo ruleSets={[rs]} />
          </div>
        ))}
      </div>
    </div>
  )
}
