import { create } from 'zustand';
import type { AppInfo, DiskInfo } from '../types';

interface AppStore {
  appInfo: AppInfo | null;
  diskInfo: DiskInfo | null;
  hasFDA: boolean | null;
  isLoadingDisk: boolean;

  setAppInfo: (info: AppInfo) => void;
  setDiskInfo: (info: DiskInfo) => void;
  setFDA: (has: boolean) => void;
  setLoadingDisk: (loading: boolean) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  appInfo: null,
  diskInfo: null,
  hasFDA: null,
  isLoadingDisk: false,

  setAppInfo: (appInfo) => set({ appInfo }),
  setDiskInfo: (diskInfo) => set({ diskInfo, isLoadingDisk: false }),
  setFDA: (hasFDA) => set({ hasFDA }),
  setLoadingDisk: (isLoadingDisk) => set({ isLoadingDisk }),
}));
