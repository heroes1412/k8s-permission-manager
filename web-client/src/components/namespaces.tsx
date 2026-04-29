import React, { useEffect, useState } from 'react';
import { httpRequests } from '../services/httpRequests';
import { FullScreenLoader } from './Loader';

export default function Namespaces() {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [newNamespace, setNewNamespace] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchNamespaces = async () => {
    setIsLoading(true);
    try {
      const { data } = await httpRequests.namespaceList();
      setNamespaces(data.namespaces || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNamespaces();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNamespace.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      await httpRequests.namespaceCreate(newNamespace.trim());
      setNewNamespace('');
      setShowForm(false);
      await fetchNamespaces();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message);
      setIsLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    const isConfirmed = window.confirm(`Are you sure you want to delete namespace "${name}"?\nPermission Manager will first check if any pods are still running inside.`);
    if (!isConfirmed) return;

    setIsLoading(true);
    setError(null);
    try {
      await httpRequests.namespaceDelete(name);
      await fetchNamespaces();
    } catch (err: any) {
      if (err?.response?.data?.errorMsg) {
        window.alert(`Cannot delete namespace:\n${err.response.data.errorMsg}`);
      } else {
        setError(err?.response?.data?.message || err.message);
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-200 pt-16 min-h-screen">
      <div className="max-w-3xl mx-auto px-4">
        {isLoading && <FullScreenLoader />}
        <div className="bg-white shadow-xl rounded-xl p-8 mb-4">
          <div className="flex justify-between items-center mb-6 border-b pb-6">
            <h2 className="text-2xl text-gray-800 font-black flex items-center tracking-tight">
              <svg className="w-8 h-8 mr-3 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              Namespaces
            </h2>
            {!showForm && (
              <button 
                onClick={() => setShowForm(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white font-black py-2.5 px-6 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center text-sm tracking-widest uppercase"
              >
                <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-60H6"></path></svg>
                CREATE NAMESPACE
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 bg-red-100 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest" role="alert">
              {error}
            </div>
          )}

          {showForm ? (
            <form onSubmit={handleCreate} className="mb-8 p-8 bg-gray-50 border-2 border-teal-100 rounded-2xl shadow-inner">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight">Setup New Namespace</h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-red-500 font-black text-xs uppercase underline tracking-tight transition-colors">Cancel</button>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-grow">
                  <label className="block text-gray-700 text-xs font-black uppercase mb-2 ml-1 tracking-widest">
                    Namespace Name
                  </label>
                  <input
                    type="text"
                    className="shadow-sm border-2 border-gray-100 rounded-xl w-full py-3.5 px-6 text-gray-700 leading-tight focus:outline-none focus:ring-4 focus:ring-teal-100 focus:border-teal-500 transition-all font-bold text-base bg-gray-50 focus:bg-white"
                    placeholder="e.g. production-api"
                    value={newNamespace}
                    onChange={(e) => {
                      const filtered = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      setNewNamespace(filtered);
                    }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-black py-3 px-10 rounded-xl shadow-lg transition-all transform active:scale-95 text-sm tracking-widest"
                  disabled={!newNamespace.trim() || isLoading}
                >
                  CREATE
                </button>
              </div>
            </form>
          ) : (
            <div className="my-6">
              <table className="text-left w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest">
                      Namespace Identity
                    </th>
                    <th className="py-4 px-6 font-black uppercase text-xs text-gray-500 tracking-widest text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {namespaces.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-12 text-center text-gray-400 italic font-medium text-base">
                        No active namespaces found.
                      </td>
                    </tr>
                  ) : (
                    namespaces.map((ns) => (
                      <tr key={ns} className="hover:bg-gray-50/50 border-b border-gray-100 last:border-0 transition-colors">
                        <td className="py-4 px-6 text-gray-800 font-bold text-base">
                          {ns}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {['default', 'kube-system', 'kube-public', 'kube-node-lease', 'permission-manager'].includes(ns) ? (
                            <span className="text-[10px] text-gray-300 font-black uppercase tracking-tighter">System Protected</span>
                          ) : (
                            <button
                              onClick={() => handleDelete(ns)}
                              className="text-red-500 hover:text-red-700 font-black text-xs uppercase tracking-tighter"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
