import { useCallback } from 'react';
import { useScanStore } from '../stores/scan-store';
import {
  cancelScan as cancelScanService,
  getCachedScan,
  onScanProgress,
  startScan as startScanService,
} from '../services/tauri';

interface ScanOptions {
  forceRefresh?: boolean;
}

export function useScanner() {
  const { setScanning, setProgress, setScanResult, setError } = useScanStore();

  const scan = useCallback(async (path: string, maxDepth?: number, options?: ScanOptions) => {
    if (!options?.forceRefresh) {
      try {
        const cached = await getCachedScan(path, maxDepth);
        if (cached) {
          setScanResult(cached);
          return cached;
        }
      } catch (error) {
        console.warn('Failed to load cached scan:', error);
      }
    }

    setScanning(true);

    const unlisten = await onScanProgress((progress) => {
      setProgress(progress);
    });

    try {
      const result = await startScanService(path, maxDepth);
      setScanResult(result);
      return result;
    } catch (error) {
      const message = String(error);
      if (message.toLowerCase().includes('cancelled')) {
        setError(null);
      } else {
        setError(message);
      }
      return null;
    } finally {
      unlisten();
    }
  }, [setScanning, setProgress, setScanResult, setError]);

  const cancel = useCallback(async () => {
    try {
      await cancelScanService();
    } catch (error) {
      setError(String(error));
    }
  }, [setError]);

  return { scan, cancel };
}
