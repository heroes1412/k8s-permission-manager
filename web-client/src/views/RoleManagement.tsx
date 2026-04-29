import React, { useState } from 'react';
import { useRbac, Rule } from '../hooks/useRbac';
import { httpRequests } from '../services/httpRequests';
import { FullScreenLoader } from '../components/Loader';
import { RESOURCE_TYPES_NAMESPACED, templateNamespacedResourceRolePrefix, resourceSeparator } from '../constants';

export default function RoleManagement() {
  const { clusterRoles, refreshRbacData } = useRbac();
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [newRoleName, setNewRoleName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingRoleName, setEditingRoleName] = useState('');
  const [permissions, setPermissions] = useState<Record<string, { read: boolean; write: boolean }>>(
    RESOURCE_TYPES_NAMESPACED.reduce((acc, resource) => ({
      ...acc,
      [resource]: { read: false, write: false }
    }), {})
  );

  const templates = (clusterRoles || []).filter(cr => 
    cr.metadata.name.startsWith(templateNamespacedResourceRolePrefix)
  );

  const handlePermissionChange = (resource: string, type: 'read' | 'write') => {
    setPermissions(prev => ({
      ...prev,
      [resource]: {
        ...prev[resource],
        [type]: !prev[resource][type]
      }
    }));
  };

  const toggleAll = (type: 'read' | 'write') => {
    const allChecked = RESOURCE_TYPES_NAMESPACED.every(res => permissions[res][type]);
    const nextValue = !allChecked;
    
    setPermissions(prev => {
      const next = { ...prev };
      RESOURCE_TYPES_NAMESPACED.forEach(res => {
        next[res] = { ...next[res], [type]: nextValue };
      });
      return next;
    });
  };

  const resetForm = () => {
    setNewRoleName('');
    setIsEditing(false);
    setEditingRoleName('');
    setShowForm(false);
    setPermissions(RESOURCE_TYPES_NAMESPACED.reduce((acc, resource) => ({
      ...acc,
      [resource]: { read: false, write: false }
    }), {}));
  };

  const handleRoleNameChange = (val: string) => {
    const filtered = val.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setNewRoleName(filtered);
  };

  const mapRulesToPermissions = (rules: Rule[]) => {
    const newPermissions = RESOURCE_TYPES_NAMESPACED.reduce((acc, resource) => ({
      ...acc,
      [resource]: { read: false, write: false }
    }), {} as Record<string, { read: boolean; write: boolean }>);

    rules.forEach(rule => {
      const isRead = rule.verbs.includes('*') || rule.verbs.includes('get') || rule.verbs.includes('list') || rule.verbs.includes('watch');
      const isWrite = rule.verbs.includes('*') || rule.verbs.includes('create') || rule.verbs.includes('update') || rule.verbs.includes('patch') || rule.verbs.includes('delete');

      rule.resources.forEach(res => {
        if (newPermissions[res]) {
          if (isRead) newPermissions[res].read = true;
          if (isWrite) newPermissions[res].write = true;
        }
      });
    });

    return newPermissions;
  };

  const handleEditInitiate = (role: any) => {
    const shortName = role.metadata.name.replace(templateNamespacedResourceRolePrefix, '');
    setNewRoleName(shortName);
    setIsEditing(true);
    setEditingRoleName(role.metadata.name);
    setPermissions(mapRulesToPermissions(role.rules));
    setShowForm(true);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    if (newRoleName.includes(resourceSeparator)) {
      alert(`Role name cannot contain "${resourceSeparator}" as it is a reserved separator.`);
      return;
    }

    const roleFullName = isEditing ? editingRoleName : (templateNamespacedResourceRolePrefix + newRoleName.trim().toLowerCase());
    
    const readResources = Object.entries(permissions)
      .filter(([_, p]) => p.read)
      .map(([r]) => r);
    
    const writeResources = Object.entries(permissions)
      .filter(([_, p]) => p.write)
      .map(([r]) => r);

    const rules = [];
    if (readResources.length > 0) {
      rules.push({
        apiGroups: ["*"],
        resources: readResources,
        verbs: ["get", "list", "watch"]
      });
    }
    if (writeResources.length > 0) {
      rules.push({
        apiGroups: ["*"],
        resources: writeResources,
        verbs: ["create", "update", "patch", "delete"]
      });
    }

    if (rules.length === 0) {
      alert("Please select at least one permission.");
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing) {
        await httpRequests.clusterRoleUpdate(roleFullName, rules);
      } else {
        await httpRequests.clusterRoleCreate(roleFullName, rules);
      }
      resetForm();
      refreshRbacData();
    } catch (err: any) {
      alert(`Error ${isEditing ? 'updating' : 'creating'} role: ${err?.response?.data?.error || err?.response?.data?.message || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (roleName: string) => {
    if (!window.confirm(`Are you sure you want to delete template "${roleName}"?`)) return;

    setIsLoading(true);
    try {
      await httpRequests.clusterRoleDelete(roleName);
      if (isEditing && editingRoleName === roleName) {
        resetForm();
      }
      refreshRbacData();
    } catch (err: any) {
      alert(`Error deleting role: ${err?.response?.data?.error || err?.response?.data?.message || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-200 pt-16 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 pb-12">
        {isLoading && <FullScreenLoader />}
        
        <div className="bg-white shadow-xl rounded-xl p-8 mb-4">
          <div className="flex justify-between items-center mb-6 border-b pb-6">
            <h2 className="text-2xl text-gray-800 font-black flex items-center tracking-tight">
              <svg className="w-8 h-8 mr-3 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              Role Templates
            </h2>
            
            {!showForm && (
              <button 
                onClick={() => setShowForm(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white font-black py-2.5 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center text-sm tracking-widest uppercase"
              >
                <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-60H6"></path></svg>
                CREATE TEMPLATE
              </button>
            )}
          </div>
          
          {!showForm ? (
            <div className="my-6">
              <table className="text-left w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">
                      Role Name
                    </th>
                    <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {templates.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-12 text-center text-gray-400 italic font-medium text-base">
                        No custom templates found.
                      </td>
                    </tr>
                  ) : (
                    templates.map(cr => {
                      const name = cr.metadata.name.replace(templateNamespacedResourceRolePrefix, '');
                      return (
                        <tr key={cr.metadata.name} className="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                          <td className="py-3 px-6">
                            <button 
                                onClick={() => handleEditInitiate(cr)}
                                className="underline text-teal-700 hover:text-teal-900 font-black tracking-tight text-base text-left block"
                            >
                                {name}
                            </button>
                            <div className="text-[11px] text-gray-400 font-mono italic">Internal ID: {cr.metadata.name}</div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button 
                              onClick={() => handleDelete(cr.metadata.name)}
                              className="text-red-500 hover:text-red-700 font-black text-xs uppercase tracking-tighter"
                              title="Delete Template"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <form onSubmit={handleCreateOrUpdate} className="bg-gray-50 p-8 rounded-2xl border-2 border-teal-100 shadow-inner">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-800 tracking-tight">{isEditing ? 'Edit Template' : 'New Template'}</h3>
                </div>
                <button 
                  type="button"
                  onClick={resetForm}
                  className="flex items-center text-gray-400 hover:text-red-500 font-black text-xs uppercase tracking-tight transition-colors underline"
                >
                  <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                  Cancel & Return
                </button>
              </div>
              
              <div className="mb-8">
                <label className="block text-gray-700 text-xs font-black mb-2 uppercase tracking-widest ml-1">
                  Template Friendly Name
                </label>
                <input 
                  type="text"
                  placeholder="e.g. cluster-viewer"
                  className={`shadow-sm appearance-none border-2 rounded-xl w-full py-3.5 px-6 text-gray-800 leading-tight focus:outline-none focus:ring-4 transition-all font-bold text-base ${isEditing ? 'bg-gray-100 cursor-not-allowed border-gray-300' : 'focus:ring-teal-100 border-gray-200 focus:border-teal-500'}`}
                  value={newRoleName}
                  onChange={e => handleRoleNameChange(e.target.value)}
                  required
                  disabled={isEditing}
                />
              </div>

              <div className="mb-8">
                <div className="flex justify-between items-center mb-4 ml-1">
                  <label className="block text-gray-700 text-xs font-black uppercase tracking-widest">
                    Permissions Matrix
                  </label>
                  <div className="flex space-x-2">
                    <button 
                      type="button" 
                      onClick={() => toggleAll('read')}
                      className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-cyan-100 text-cyan-700 rounded-lg hover:bg-cyan-200 transition-colors"
                    >
                      Toggle Read
                    </button>
                    <button 
                      type="button" 
                      onClick={() => toggleAll('write')}
                      className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"
                    >
                      Toggle Write
                    </button>
                  </div>
                </div>
                <div className="border-2 border-gray-100 rounded-2xl bg-white overflow-hidden shadow-lg max-h-[500px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-gray-50 z-20 shadow-md border-b-2 border-gray-100">
                      <tr>
                        <th className="py-4 px-8 text-gray-600 font-black uppercase text-xs tracking-widest">Resource</th>
                        <th className="py-4 px-8 text-gray-600 font-black uppercase text-xs text-center border-l-2 border-gray-100 tracking-widest bg-cyan-50/20">READ</th>
                        <th className="py-4 px-8 text-gray-600 font-black uppercase text-xs text-center border-l-2 border-gray-100 tracking-widest bg-rose-50/20">WRITE</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {RESOURCE_TYPES_NAMESPACED.map(resource => (
                        <tr key={resource} className="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                          <td className="py-3 px-8 text-sm font-black text-gray-700">{resource}</td>
                          <td className="py-3 px-8 text-center border-l-2 border-gray-100 bg-cyan-50/5">
                            <input 
                              type="checkbox" 
                              className="w-6 h-6 rounded-lg border-gray-300 text-teal-600 focus:ring-teal-500 accent-teal-600 transition-transform active:scale-90"
                              checked={permissions[resource].read}
                              onChange={() => handlePermissionChange(resource, 'read')}
                            />
                          </td>
                          <td className="py-3 px-8 text-center border-l-2 border-gray-100 bg-rose-50/5">
                            <input 
                              type="checkbox" 
                              className="w-6 h-6 rounded-lg border-gray-300 text-teal-600 focus:ring-teal-500 accent-teal-600 transition-transform active:scale-90"
                              checked={permissions[resource].write}
                              onChange={() => handlePermissionChange(resource, 'write')}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-4 space-x-4">
                <button 
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-black py-3 px-10 rounded-xl shadow-lg transform active:scale-95 transition-all flex items-center text-sm tracking-widest"
                  disabled={!newRoleName.trim() || isLoading}
                >
                  {isEditing ? 'UPDATE TEMPLATE' : 'CREATE ROLE TEMPLATE'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
