import React, {createContext, useContext, useEffect, useState} from 'react'
import {httpRequests} from "../services/httpRequests";

interface Settings {
    CLUSTER_NAME: string;
    CONTROL_PLANE_ADDRESS: string;
    BASIC_AUTH_PASSWORD: string;
    GROUPS_ENABLED: string;
    EXPIRED_USER_ACTION: string;
    WEBHOOK_URL?: string;
    WEBHOOK_PROXY_URL?: string;
    WEBHOOK_PROXY_USER?: string;
    WEBHOOK_PROXY_PASSWORD?: string;
    SYSTEM_PROTECTED_NAMESPACES: string;
}

interface SettingsProvider {
  readonly settings: Settings;
  refreshSettings(): void;
  readonly loading: boolean;
  readonly loaded: boolean;
}

const defaultSettings: Settings = {
    CLUSTER_NAME: '',
    CONTROL_PLANE_ADDRESS: '',
    BASIC_AUTH_PASSWORD: '',
    GROUPS_ENABLED: 'true',
    EXPIRED_USER_ACTION: 'DELETE',
    SYSTEM_PROTECTED_NAMESPACES: 'default,kube-system,kube-public,kube-node-lease,permission-manager'
};

function useSettingsFromApi(): SettingsProvider {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  function fetchSettings(): void {
    setLoading(true)
    httpRequests.getSettings().then(res => {
      setLoading(false)
      setLoaded(true)
      const data = res.data;
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
    }).catch(err => {
        setLoading(false);
        console.error("Failed to fetch settings", err);
    })
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  return {
    settings,
    refreshSettings: fetchSettings,
    loading,
    loaded
  }
}

const SettingsContext = createContext<SettingsProvider | null>(null)

export const SettingsProvider = ({children}: any) => {
  return (
    <SettingsContext.Provider value={useSettingsFromApi()}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsProvider {
  const context = useContext(SettingsContext);
  if (!context) {
      throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
