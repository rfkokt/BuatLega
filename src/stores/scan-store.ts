import { create } from 'zustand';
import type { ScanResult, ScanProgress, FileNode } from '../types';

interface ScanStore {
  scanResult: ScanResult | null;
  isScanning: boolean;
  progress: ScanProgress | null;
  error: string | null;
  selectedPaths: Set<string>;

  setScanResult: (result: ScanResult) => void;
  setScanning: (scanning: boolean) => void;
  setProgress: (progress: ScanProgress) => void;
  setError: (error: string | null) => void;
  toggleSelected: (path: string) => void;
  selectAllSafe: (nodes: FileNode[]) => void;
  clearSelection: () => void;
  removeItems: (paths: string[]) => void;
  reset: () => void;
}

export const useScanStore = create<ScanStore>((set, get) => ({
  scanResult: null,
  isScanning: false,
  progress: null,
  error: null,
  selectedPaths: new Set(),

  setScanResult: (result) => set({
    scanResult: result,
    isScanning: false,
    progress: null,
    error: null,
    selectedPaths: new Set(),
  }),
  setScanning: (isScanning) => set(
    isScanning
      ? { isScanning, error: null }
      : { isScanning, error: null, progress: null }
  ),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error, isScanning: false, progress: null }),

  toggleSelected: (path) => {
    const current = new Set(get().selectedPaths);
    if (current.has(path)) {
      current.delete(path);
    } else {
      current.add(path);
    }
    set({ selectedPaths: current });
  },

  selectAllSafe: (nodes) => {
    const safePaths = new Set<string>();
    const collect = (items: FileNode[]) => {
      for (const item of items) {
        if (item.safety_level === 'Safe') {
          safePaths.add(item.path);
          // If a directory is Safe, we'll delete it entirely. 
          // No need to individually select its thousands of children.
          continue; 
        }
        if (item.children) collect(item.children);
      }
    };
    collect(nodes);
    set({ selectedPaths: safePaths });
  },

  clearSelection: () => set({ selectedPaths: new Set() }),

  removeItems: (paths: string[]) => {
    const currentResult = get().scanResult;
    if (!currentResult) return;

    const pathsSet = new Set(paths);

    // Recursive function to filter out deleted nodes and subtract their size
    const filterTree = (node: FileNode): { node: FileNode | null; freedSize: number; removedCount: number; removedDirs: number } => {
      if (pathsSet.has(node.path)) {
        // This entire node is deleted
        const countFilesAndDirs = (n: FileNode): { files: number, dirs: number } => {
          let f = n.is_dir ? 0 : 1;
          let d = n.is_dir ? 1 : 0;
          if (n.children) {
            for (const child of n.children) {
              const res = countFilesAndDirs(child);
              f += res.files;
              d += res.dirs;
            }
          }
          return { files: f, dirs: d };
        };
        const counts = countFilesAndDirs(node);
        return { node: null, freedSize: node.size, removedCount: counts.files, removedDirs: counts.dirs };
      }

      if (!node.children || node.children.length === 0) {
        return { node, freedSize: 0, removedCount: 0, removedDirs: 0 };
      }

      let totalFreed = 0;
      let totalRemovedFiles = 0;
      let totalRemovedDirs = 0;
      const newChildren: FileNode[] = [];

      for (const child of node.children) {
        const { node: updatedChild, freedSize, removedCount, removedDirs } = filterTree(child);
        if (updatedChild) {
          newChildren.push(updatedChild);
        }
        totalFreed += freedSize;
        totalRemovedFiles += removedCount;
        totalRemovedDirs += removedDirs;
      }

      if (totalFreed > 0) {
        return {
          node: {
            ...node,
            size: node.size - totalFreed,
            children: newChildren
          },
          freedSize: totalFreed,
          removedCount: totalRemovedFiles,
          removedDirs: totalRemovedDirs
        };
      }

      return { node, freedSize: 0, removedCount: 0, removedDirs: 0 };
    };

    const { node: newRoot, freedSize, removedCount, removedDirs } = filterTree(currentResult.root);

    if (newRoot && freedSize > 0) {
      set({
        scanResult: {
          ...currentResult,
          root: newRoot,
          total_size: currentResult.total_size - freedSize,
          file_count: currentResult.file_count - removedCount,
          dir_count: currentResult.dir_count - removedDirs
        }
      });
    }
  },

  reset: () => set({
    scanResult: null,
    isScanning: false,
    progress: null,
    error: null,
    selectedPaths: new Set(),
  }),
}));
