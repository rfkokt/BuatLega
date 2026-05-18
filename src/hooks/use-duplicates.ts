import { useCallback, useMemo, useState } from 'react';
import { findDuplicates, onDuplicateScanProgress } from '../services/tauri';
import type { DuplicateGroup, DuplicateScanProgress } from '../types';

const SIZE_THRESHOLDS = [
  { label: '1 MB', value: 1 * 1024 * 1024 },
  { label: '10 MB', value: 10 * 1024 * 1024 },
  { label: '100 MB', value: 100 * 1024 * 1024 },
  { label: '500 MB', value: 500 * 1024 * 1024 },
] as const;

export function useDuplicates() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(10 * 1024 * 1024);
  const [progress, setProgress] = useState<DuplicateScanProgress | null>(null);

  const totalWasted = useMemo(
    () => groups.reduce((total, group) => total + group.wasted_bytes, 0),
    [groups],
  );

  const totalFiles = useMemo(
    () => groups.reduce((total, group) => total + group.files.length, 0),
    [groups],
  );

  const scan = useCallback(async (path: string, minSizeBytes?: number) => {
    setIsScanning(true);
    setError(null);
    setProgress(null);

    const unlisten = await onDuplicateScanProgress((nextProgress) => {
      setProgress(nextProgress);
    });

    try {
      const result = await findDuplicates(path, minSizeBytes ?? threshold);
      setGroups(result);
      return result;
    } catch (err) {
      setError(String(err));
      return [];
    } finally {
      unlisten();
      setIsScanning(false);
    }
  }, [threshold]);

  return {
    groups,
    isScanning,
    error,
    progress,
    scan,
    threshold,
    setThreshold,
    thresholds: SIZE_THRESHOLDS,
    totalWasted,
    totalFiles,
  };
}
