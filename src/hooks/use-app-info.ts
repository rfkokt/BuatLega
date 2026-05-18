import { useCallback, useEffect } from 'react';
import { getAppInfo } from '../services/tauri';
import { useAppStore } from '../stores/app-store';
import type { AppInfo } from '../types';

let appInfoRequest: Promise<AppInfo> | null = null;

function loadAppInfoOnce() {
  if (!appInfoRequest) {
    appInfoRequest = getAppInfo().catch((error) => {
      appInfoRequest = null;
      throw error;
    });
  }
  return appInfoRequest;
}

export function useAppInfo() {
  const { appInfo, setAppInfo } = useAppStore();

  const refreshAppInfo = useCallback(async () => {
    const info = await loadAppInfoOnce();
    setAppInfo(info);
    return info;
  }, [setAppInfo]);

  useEffect(() => {
    if (!appInfo) {
      refreshAppInfo().catch(console.error);
    }
  }, [appInfo, refreshAppInfo]);

  return { appInfo, refreshAppInfo };
}
