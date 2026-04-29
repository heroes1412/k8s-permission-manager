import React, { useEffect, useState } from 'react';
import { httpRequests } from '../services/httpRequests';
import { FullScreenLoader } from '../components/Loader';

export default function Settings() {
  const [settings, setSettings] = useState({
    CLUSTER_NAME: '',
    CONTROL_PLANE_ADDRESS: '',
    BASIC_AUTH_PASSWORD: ''
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
          BASIC_AUTH_PASSWORD: data.BASIC_AUTH_PASSWORD || ''
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
      <div className="max-w-3xl mx-auto px-4 pb-12">
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
              <p className="mt-2 text-[10px] text-gray-400 italic font-medium ml-1">Warning: Changing this will affect your next login session.</p>
            </div>

            <div className="pt-4 flex space-x-4">
              <button
                type="submit"
                className="flex-grow bg-teal-600 hover:bg-teal-700 text-white font-black py-3 px-10 rounded-xl shadow-lg transition-all transform active:scale-95 text-sm tracking-widest flex items-center justify-center"
                disabled={isSaving}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                SAVE CONFIGURATION
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="bg-white hover:bg-teal-50 text-teal-700 border-2 border-teal-600 font-black py-3 px-10 rounded-xl shadow-lg transition-all transform active:scale-95 text-sm tracking-widest flex items-center justify-center"
                disabled={isRestarting}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                RESTART APP
              </button>
            </div>
          </form>
        </div>
        
        <div className="bg-orange-50 border-l-4 border-orange-400 p-6 rounded-r-xl shadow-sm">
           <div className="flex">
             <div className="flex-shrink-0">
               <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
             </div>
             <div className="ml-4">
               <p className="text-sm font-black text-orange-800 uppercase tracking-tight mb-1">Architecture Notice</p>
               <p className="text-xs text-orange-700 leading-relaxed">
                 These settings are stored in the <code className="bg-orange-100 px-1 rounded">permission-manager</code> secret within the <code className="bg-orange-100 px-1 rounded">permission-manager</code> namespace. 
                 Updating them here directly modifies the cluster state.
               </p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
