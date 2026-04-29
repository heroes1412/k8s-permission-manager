import React from 'react'
import {templateNamespacedResourceRolePrefix} from '../constants'
import {RuleSet} from "./types";

interface TemplateInfoParameters {
 readonly ruleSets: RuleSet[];
 readonly hideNamespaceCol?: boolean;
}

interface AggregatedPermission {
  read: boolean;
  write: boolean;
  namespaces: string[];
}

export default function TemplateInfo({ruleSets, hideNamespaceCol}: TemplateInfoParameters) {
  const aggregatedPermissions: Record<string, AggregatedPermission> = {};

  ruleSets.forEach(({ rules, namespaces }) => {
    rules.forEach(rule => {
      const isRead = rule.verbs.includes('*') || rule.verbs.includes('get') || rule.verbs.includes('list') || rule.verbs.includes('watch') || rule.verbs.includes('read');
      const isWrite = rule.verbs.includes('*') || rule.verbs.includes('create') || rule.verbs.includes('update') || rule.verbs.includes('patch') || rule.verbs.includes('delete');
      
      rule.resources.forEach(res => {
        if (!aggregatedPermissions[res]) {
          aggregatedPermissions[res] = { read: false, write: false, namespaces: [] };
        }
        if (isRead) aggregatedPermissions[res].read = true;
        if (isWrite) aggregatedPermissions[res].write = true;
        
        namespaces.forEach(ns => {
          if (!aggregatedPermissions[res].namespaces.includes(ns)) {
            aggregatedPermissions[res].namespaces.push(ns);
          }
        });
      });
    });
  });

  const resourceEntries = Object.entries(aggregatedPermissions).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <fieldset disabled={true} className="border border-gray-100 rounded-lg overflow-hidden shadow-inner bg-gray-50/50">
      <table className="text-left w-full border-collapse">
        <colgroup>
          <col width="160"/>
          <col width="60"/>
          <col width="60"/>
          {hideNamespaceCol ? null : <col/>}
        </colgroup>

        <thead className="bg-gray-100/80">
          <tr className="text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-gray-200">
            <th className="py-3 px-4">resource</th>
            <th className="py-3 px-4 text-center">read</th>
            <th className="py-3 px-4 text-center">write</th>
            {hideNamespaceCol ? null : <th className="py-3 px-4">namespaces</th>}
          </tr>
        </thead>

        <tbody className="text-gray-700 text-xs">
          {resourceEntries.length === 0 ? (
            <tr>
              <td colSpan={hideNamespaceCol ? 3 : 4} className="py-4 px-4 text-center text-gray-400 italic">
                No resource permissions defined.
              </td>
            </tr>
          ) : (
            resourceEntries.map(([res, perms], index) => {
              return (
                <tr
                  key={res}
                  className={`border-b border-gray-100 last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                >
                  <td className="py-2 px-4 font-bold text-gray-800">
                    {res}
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 accent-teal-600"
                        checked={perms.read}
                        readOnly
                      />
                    </div>
                  </td>

                  <td className="py-2 px-4">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 accent-teal-600"
                        checked={perms.write}
                        readOnly
                      />
                    </div>
                  </td>

                  {hideNamespaceCol ? null : (
                    <td className="py-2 px-4 text-[10px] text-gray-500 font-medium">
                      <div className="flex flex-wrap gap-1">
                        {perms.namespaces.length > 0 ? (
                          perms.namespaces.map(ns => (
                            <span key={ns} className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-600">{ns}</span>
                          ))
                        ) : (
                          <span className="text-gray-300 italic">None</span>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </fieldset>
  )
}
