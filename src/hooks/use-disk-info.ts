import { useCallback } from 'react';
import { useAppStore } from '../stores/app-store';
import { getDiskInfo, checkFDAStatus } from '../services/tauri';

export function useDiskInfo() {
  const { diskInfo, hasFDA, isLoadingDisk, setDiskInfo, setFDA, setLoadingDisk } = useAppStore();

  const refreshFDA = useCallback(async () => {
    const fda = await checkFDAStatus();
    setFDA(fda);
    return fda;
  }, [setFDA]);

  const refresh = useCallback(async () => {
    setLoadingDisk(true);
    try {
      const [info, fda] = await Promise.all([getDiskInfo(), checkFDAStatus()]);
      setDiskInfo(info);
      setFDA(fda);
    } catch (error) {
      console.error('Failed to get disk info:', error);
      setLoadingDisk(false);
    }
  }, [setDiskInfo, setFDA, setLoadingDisk]);

  return { diskInfo, hasFDA, isLoading: isLoadingDisk, refresh, refreshFDA };
}
