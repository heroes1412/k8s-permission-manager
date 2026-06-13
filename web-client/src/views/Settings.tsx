import React, { useEffect, useState } from 'react';
import { httpRequests } from '../services/httpRequests';
import { FullScreenLoader } from '../components/Loader';
import NamespaceMultiSelect from '../components/NamespaceMultiSelect';

export default function Settings() {
  const [settings, setSettings] = useState({
    CLUSTER_NAME: '',
    CONTROL_PLANE_ADDRESS: '',
    BASIC_AUTH_PASSWORD: '',
    GROUPS_ENABLED: 'true',
    EXPIRED_USER_ACTION: 'DELETE',
    WEBHOOK_URL: '',
    WEBHOOK_PROXY_URL: '',
    WEBHOOK_PROXY_USER: '',
    WEBHOOK_PROXY_PASSWORD: '',
    SYSTEM_PROTECTED_NAMESPACES: 'default,kube-system,kube-public,kube-node-lease,permission-manager'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const { data } = await httpRequests.getSettings();
        setSettings({
          CLUSTER_NAME: data.CLUSTER_NAME || '',
          CONTROL_PLANE_ADDRESS: data.CONTROL_PLANE_ADDRESS || '',
          BASIC_AUTH_PASSWORD: data.BASIC_AUTH_PASSWORD || '',
          GROUPS_ENABLED: data.GROUPS_ENABLED !== undefined ? data.GROUPS_ENABLED : 'true',
          EXPIRED_USER_ACTION: data.EXPIRED_USER_ACTION || 'DELETE',
          WEBHOOK_URL: data.WEBHOOK_URL || '',
          WEBHOOK_PROXY_URL: data.WEBHOOK_PROXY_URL || '',
          WEBHOOK_PROXY_USER: data.WEBHOOK_PROXY_USER || '',
          WEBHOOK_PROXY_PASSWORD: data.WEBHOOK_PROXY_PASSWORD || '',
          SYSTEM_PROTECTED_NAMESPACES: data.SYSTEM_PROTECTED_NAMESPACES || 'default,kube-system,kube-public,kube-node-lease,permission-manager'
        });
      } catch (err: any) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      await httpRequests.updateSettings(settings);
      setMessage({ type: 'success', text: 'Settings updated successfully! Changes may require a restart to take full effect.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed to update settings: ${err?.response?.data?.error || err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await httpRequests.httpClient.get('/api/export-gitops', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'permission-manager-gitops.yaml');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to download GitOps export.' });
    }
  };

  const handleRestart = async () => {
    if (!window.confirm("Are you sure you want to restart the application? This will trigger a rollout restart of the Permission Manager deployment.")) return;
    
    setIsRestarting(true);
    setMessage(null);
    try {
      await httpRequests.restartApp();
      setMessage({ type: 'success', text: 'Application restart triggered successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Failed to trigger restart: ${err?.response?.data?.error || err.message}` });
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <div className="bg-gray-200 pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-4 pb-12">
        {(isLoading || isSaving || isRestarting) && <FullScreenLoader />}
        <div className="bg-white shadow-xl rounded-xl p-8 mb-4">
          <div className="flex justify-between items-center mb-6 border-b pb-6">
            <h2 className="text-2xl text-gray-800 font-black flex items-center tracking-tight">
              <svg className="w-8 h-8 mr-3 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              System Settings
            </h2>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-black uppercase tracking-widest border-2 ${message.type === 'success' ? 'bg-teal-50 border-teal-100 text-teal-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-8">
            <div>
              <label className="block text-gray-700 text-xs font-black uppercase mb-2 ml-1 tracking-widest">
                Cluster Name
              </label>
              <input
                type="text"
                className="shadow-sm border-2 border-gray-100 rounded-xl w-full py-3.5 px-6 text-gray-700 leading-tight focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all font-bold text-base bg-gray-50 focus:bg-white"
                placeholder="e.g. production-cluster"
                value={settings.CLUSTER_NAME}
                onChange={e => setSettings({ ...settings, CLUSTER_NAME: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 text-xs font-black uppercase mb-2 ml-1 tracking-widest">
                Control Plane Address
              </label>
              <input
                type="text"
                className="shadow-sm border-2 border-gray-100 rounded-xl w-full py-3.5 px-6 text-gray-700 leading-tight focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all font-bold text-base bg-gray-50 focus:bg-white"
                placeholder="e.g. https://1.2.3.4:6443"
                value={settings.CONTROL_PLANE_ADDRESS}
                onChange={e => setSettings({ ...settings, CONTROL_PLANE_ADDRESS: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 text-xs font-black uppercase mb-2 ml-1 tracking-widest">
                Admin Password (BASIC_AUTH_PASSWORD)
              </label>
              <input
                type="password"
                className="shadow-sm border-2 border-gray-100 rounded-xl w-full py-3.5 px-6 text-gray-700 leading-tight focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all font-bold text-base bg-gray-50 focus:bg-white"
                placeholder="Enter new password"
                value={settings.BASIC_AUTH_PASSWORD}
                onChange={e => setSettings({ ...settings, BASIC_AUTH_PASSWORD: e.target.value })}
                required
              />
              <p className="mt-2 text-[10px] text-gray-400 italic font-medium ml-1">Leave as ******** to keep current password. Warning: Changing this will affect your next login session.</p>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-100 shadow-sm transition-all hover:border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1">Group Management</h4>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed max-w-md">
                    Enable or disable group assignment and group-based permission features throughout the application.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.GROUPS_ENABLED === 'true'}
                    onChange={e => setSettings({ ...settings, GROUPS_ENABLED: e.target.checked ? 'true' : 'false' })}
                  />
                  <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-100 shadow-sm transition-all hover:border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1">Expired User Action</h4>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed max-w-md">
                    Choose what happens to users when their expiration date passes. "Keep" will retain the user but mark them as expired. "Delete" will automatically remove them from the cluster.
                  </p>
                </div>
                <div>
                  <select
                    className="shadow-sm border-2 border-gray-200 rounded-xl py-2 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all font-bold text-sm bg-white cursor-pointer"
                    value={settings.EXPIRED_USER_ACTION}
                    onChange={e => setSettings({ ...settings, EXPIRED_USER_ACTION: e.target.value })}
                  >
                    <option value="DELETE">Delete</option>
                    <option value="KEEP">Keep</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-100 shadow-sm transition-all hover:border-gray-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1">Webhook Notifications</h4>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed max-w-md">
                    Send a notification to Slack/Discord when users are created, updated, deleted, or expired.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-[10px] font-black uppercase mb-1 ml-1 tracking-widest">
                    Webhook URL
                  </label>
                  <input
                    type="text"
                    className="shadow-sm border-2 border-gray-200 rounded-xl w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all font-mono text-sm bg-white"
                    placeholder="https://hooks.slack.com/services/..."
                    value={settings.WEBHOOK_URL || ''}
                    onChange={e => setSettings({ ...settings, WEBHOOK_URL: e.target.value })}
                  />
                </div>
                
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-gray-700 text-xs font-black uppercase tracking-widest">
                      Use Webhook Proxy
                    </label>
                    <label className="relative inline-flex items-center cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={!!settings.WEBHOOK_PROXY_URL}
                        onChange={e => {
                          if (!e.target.checked) {
                            setSettings({ ...settings, WEBHOOK_PROXY_URL: '', WEBHOOK_PROXY_USER: '', WEBHOOK_PROXY_PASSWORD: '' })
                          } else {
                            setSettings({ ...settings, WEBHOOK_PROXY_URL: 'http://my-proxy:8080' })
                          }
                        }}
                      />
                      <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  {!!settings.WEBHOOK_PROXY_URL && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-inner">
                      <div className="sm:col-span-2">
                        <label className="block text-gray-500 text-[10px] font-bold uppercase mb-1 ml-1">
                          Proxy Host/URL (Required)
                        </label>
                        <input
                          type="text"
                          className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="http://proxy.internal:3128"
                          value={settings.WEBHOOK_PROXY_URL}
                          onChange={e => setSettings({ ...settings, WEBHOOK_PROXY_URL: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 text-[10px] font-bold uppercase mb-1 ml-1">
                          Proxy Username (Optional)
                        </label>
                        <input
                          type="text"
                          className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="admin"
                          value={settings.WEBHOOK_PROXY_USER || ''}
                          onChange={e => setSettings({ ...settings, WEBHOOK_PROXY_USER: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-gray-500 text-[10px] font-bold uppercase mb-1 ml-1">
                          Proxy Password (Optional)
                        </label>
                        <input
                          type="password"
                          className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          placeholder="Leave blank or enter password"
                          value={settings.WEBHOOK_PROXY_PASSWORD || ''}
                          onChange={e => setSettings({ ...settings, WEBHOOK_PROXY_PASSWORD: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-100 shadow-sm transition-all hover:border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1">GitOps Export</h4>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed max-w-md">
                    Download all custom roles, users, and groups as a Kubernetes YAML file for GitOps backup.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  className="bg-white hover:bg-gray-100 text-gray-800 border-2 border-gray-300 font-black py-2.5 px-6 rounded-xl shadow-sm transition-all transform active:scale-95 text-xs tracking-widest flex items-center justify-center whitespace-nowrap"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  EXPORT YAML
                </button>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-100 shadow-sm transition-all hover:border-gray-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-1">System Protected Namespaces</h4>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed max-w-md">
                    Select namespaces that cannot be deleted from the Permission Manager UI.
                  </p>
                </div>
              </div>
              <NamespaceMultiSelect
                value={settings.SYSTEM_PROTECTED_NAMESPACES ? settings.SYSTEM_PROTECTED_NAMESPACES.split(',') : []}
                onSelect={(ns: string[]) => setSettings({ ...settings, SYSTEM_PROTECTED_NAMESPACES: ns.join(',') })}
                placeholder="Select namespaces to protect..."
                disabled={false}
              />
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                className="w-full sm:w-auto flex-grow bg-teal-600 hover:bg-teal-700 text-white font-black py-3 px-10 rounded-xl shadow-lg transition-all transform active:scale-95 text-sm tracking-widest flex items-center justify-center"
                disabled={isSaving}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                SAVE CONFIGURATION
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="w-full sm:w-auto bg-white hover:bg-teal-50 text-teal-700 border-2 border-teal-600 font-black py-3 px-10 rounded-xl shadow-lg transition-all transform active:scale-95 text-sm tracking-widest flex items-center justify-center"
                disabled={isRestarting}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                RESTART APP
              </button>
            </div>
          </form>
        </div>
        
        <div className="bg-orange-50 border-l-4 border-orange-400 p-4 sm:p-6 rounded-r-xl shadow-sm">
           <div className="flex flex-col sm:flex-row">
             <div className="flex-shrink-0 mb-3 sm:mb-0">
               <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
             </div>
             <div className="sm:ml-4">
               <p className="text-sm font-black text-orange-800 uppercase tracking-tight mb-1">Architecture Notice</p>
               <p className="text-xs text-orange-700 leading-relaxed">
                 These settings are stored in the <code className="bg-orange-100 px-1 rounded break-all">permission-manager</code> secret within the <code className="bg-orange-100 px-1 rounded break-all">permission-manager</code> namespace. 
                 Updating them here directly modifies the cluster state. <strong>You must click "RESTART APP" to apply new configurations after saving.</strong>
               </p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
