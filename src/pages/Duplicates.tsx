import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowClockwise,
  ArrowSquareOut,
  CaretDown,
  CaretRight,
  CheckCircle,
  Clock,
  CopySimple,
  File,
  FunnelSimple,
  Spinner,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { ConfirmDialog } from '../components/cleanup/ConfirmDialog';
import { useDuplicates } from '../hooks/use-duplicates';
import { formatBytes, formatRelativeTime, getCategoryColor, getSafetyColor } from '../lib/format';
import { openInFinder } from '../services/tauri';
import { useCleanupStore } from '../stores/cleanup-store';
import type { DuplicateFile, DuplicateGroup, FileNode } from '../types';

function chooseKeepFile(group: DuplicateGroup) {
  return group.files[0];
}

function isSuggestedExtra(group: DuplicateGroup, file: DuplicateFile) {
  const keepFile = chooseKeepFile(group);
  return file.path !== keepFile.path && file.safety_level !== 'Caution';
}

export default function Duplicates() {
  const {
    groups,
    isScanning,
    error,
    progress,
    scan,
    threshold,
    setThreshold,
    thresholds,
    totalWasted,
    totalFiles,
  } = useDuplicates();

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [showThresholdMenu, setShowThresholdMenu] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  const scanWithThreshold = useCallback(async (minSizeBytes: number) => {
    setSelectedPaths(new Set());
    setHasScanned(true);
    const root = await import('@tauri-apps/api/path').then((m) => m.homeDir()).catch(() => '/');
    const result = await scan(root, minSizeBytes);
    setExpandedGroups(new Set(result.slice(0, 4).map((group) => group.id)));
  }, [scan]);

  const handleScan = useCallback(() => {
    scanWithThreshold(threshold);
  }, [scanWithThreshold, threshold]);

  const suggestedPaths = useMemo(() => {
    const paths = new Set<string>();
    groups.forEach((group) => {
      group.files.forEach((file) => {
        if (isSuggestedExtra(group, file)) {
          paths.add(file.path);
        }
      });
    });
    return paths;
  }, [groups]);

  const selectedItems: FileNode[] = useMemo(() => {
    return groups.flatMap((group) =>
      group.files
        .filter((file) => selectedPaths.has(file.path))
        .map((file) => ({
          name: file.name,
          path: file.path,
          size: file.allocated_size || file.size,
          is_dir: false,
          file_type: file.file_type,
          children: undefined,
          last_accessed: file.last_accessed,
          last_modified: file.last_modified,
          safety_level: file.safety_level,
        })),
    );
  }, [groups, selectedPaths]);

  const selectedSize = useMemo(
    () => selectedItems.reduce((total, item) => total + item.size, 0),
    [selectedItems],
  );

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const toggleSelect = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectSuggested = useCallback(() => {
    setSelectedPaths(new Set(suggestedPaths));
  }, [suggestedPaths]);

  const selectGroupExtras = useCallback((group: DuplicateGroup) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      group.files.forEach((file) => {
        if (isSuggestedExtra(group, file)) {
          next.add(file.path);
        }
      });
      return next;
    });
  }, []);

  const clearGroupSelection = useCallback((group: DuplicateGroup) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      group.files.forEach((file) => next.delete(file.path));
      return next;
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="h-full flex flex-col"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Duplicates</h1>
          <p className="text-sm text-text-secondary mt-1">
            {groups.length > 0
              ? `${groups.length} groups • ${formatBytes(totalWasted)} extra copies`
              : `Find duplicate files larger than ${formatBytes(threshold)}`
            }
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedPaths.size > 0 && (
            <>
              <button
                onClick={() => setSelectedPaths(new Set())}
                className="px-4 py-2 rounded-full text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-all border border-white/10"
              >
                Clear ({selectedPaths.size})
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium text-white bg-gradient-to-r from-red-500/80 to-rose-600/80 hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(225,29,72,0.4)]"
              >
                <Trash size={14} />
                Clean {formatBytes(selectedSize)}
              </button>
            </>
          )}

          <button
            onClick={selectSuggested}
            disabled={suggestedPaths.size === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-[#0D9488] bg-[#0D9488]/10 hover:bg-[#0D9488]/20 border border-[#0D9488]/30 transition-all disabled:opacity-40"
          >
            <CheckCircle size={14} />
            Select Extras
          </button>

          <div className="relative">
            <button
              onClick={() => setShowThresholdMenu(!showThresholdMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <FunnelSimple size={14} />
              Min: {formatBytes(threshold)}
              <CaretDown size={12} />
            </button>
            {showThresholdMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowThresholdMenu(false)} />
                <div className="absolute right-0 top-full mt-2 z-20 w-32 py-2 rounded-2xl glass border border-white/10 shadow-xl overflow-hidden">
                  {thresholds.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setThreshold(value);
                        setShowThresholdMenu(false);
                        scanWithThreshold(value);
                      }}
                      className={`w-full px-3 py-2 text-xs text-left transition-colors ${
                        threshold === value
                          ? 'bg-accent-primary/10 text-accent-primary'
                          : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-[#0D9488] to-[#0EA5E9] shadow-[0_0_20px_rgba(13,148,136,0.4)] hover:shadow-[0_0_30px_rgba(13,148,136,0.6)] transition-all disabled:opacity-50"
          >
            {isScanning ? (
              <>
                <Spinner size={16} className="animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <ArrowClockwise size={16} />
                Scan
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl glass border-red-500/20 bg-red-500/10 mt-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {isScanning && groups.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center text-center -mt-12"
        >
          <div className="relative mb-8">
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#FF9F0A] blur-3xl opacity-30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="relative w-40 h-40 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.26) 0%, rgba(255, 159, 10, 0.14) 100%)',
                boxShadow: `
                  inset 0 8px 32px rgba(255, 255, 255, 0.2),
                  inset 0 -8px 32px rgba(0, 0, 0, 0.1),
                  0 20px 60px rgba(0, 240, 255, 0.25),
                  0 0 0 1px rgba(255, 255, 255, 0.15)
                `,
                backdropFilter: 'blur(20px)',
              }}
              animate={{ y: [0, -8, 0], rotateX: [0, 3, 0], rotateY: [0, -3, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <motion.div
                className="absolute inset-4 rounded-full border-2 border-[#00F0FF]/30 border-dashed"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative z-10 text-[#00F0FF] drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">
                <Spinner size={48} className="animate-spin" />
              </div>
            </motion.div>
          </div>

          <h2 className="text-3xl font-semibold text-text-primary mb-3">
            Finding Duplicates...
          </h2>
          <p className="text-base text-text-secondary max-w-md leading-relaxed">
            {progress?.phase === 'hashing'
              ? `Hashing ${progress.candidate_files} candidate files`
              : `Indexed ${progress?.scanned_files ?? 0} files`
            }
          </p>
        </motion.div>
      )}

      {groups.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4 mt-6 pb-6">
          <div className="grid grid-cols-4 gap-4 shrink-0">
            {[
              { label: 'Reclaimable', value: formatBytes(totalWasted), color: '#22c55e' },
              { label: 'Groups', value: groups.length.toString(), color: '#00F0FF' },
              { label: 'Files', value: totalFiles.toString(), color: '#BF5AF2' },
              { label: 'Selected', value: formatBytes(selectedSize), color: '#FF2E93' },
            ].map(({ label, value, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-2xl p-5 border border-white/5"
              >
                <p className="text-xs text-white/60">{label}</p>
                <p className="text-xl font-bold mt-1" style={{ color }}>
                  {value}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-3">
            {groups.map((group, index) => {
              const isExpanded = expandedGroups.has(group.id);
              const keepFile = chooseKeepFile(group);
              const groupSelectedCount = group.files.filter((file) => selectedPaths.has(file.path)).length;
              const suggestedCount = group.files.filter((file) => isSuggestedExtra(group, file)).length;

              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="glass rounded-2xl border border-white/5 overflow-hidden"
                >
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="text-text-muted shrink-0">
                      {isExpanded ? <CaretDown size={16} /> : <CaretRight size={16} />}
                    </span>
                    <CopySimple size={18} weight="duotone" className="text-[#00F0FF] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary">
                        {group.files.length} copies of {formatBytes(group.content_size)}
                      </p>
                      <p className="text-xs text-text-muted truncate">
                        Keep: {keepFile.path.replace(/^\/Users\/[^/]+\//, '~/')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-[#22c55e] tabular-nums">
                        {formatBytes(group.wasted_bytes)}
                      </p>
                      <p className="text-xs text-text-muted">extra storage</p>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/5">
                      <div className="flex items-center justify-between px-5 py-2 bg-white/[0.03]">
                        <p className="text-xs text-text-muted">
                          {groupSelectedCount > 0
                            ? `${groupSelectedCount} selected`
                            : `${suggestedCount} suggested extra copies`
                          }
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => selectGroupExtras(group)}
                            className="text-xs text-[#0D9488] hover:text-[#14b8a6] transition-colors"
                          >
                            Select extras
                          </button>
                          <button
                            onClick={() => clearGroupSelection(group)}
                            className="text-xs text-text-muted hover:text-text-primary transition-colors"
                          >
                            Clear group
                          </button>
                        </div>
                      </div>

                      {group.files.map((file) => {
                        const isKeep = file.path === keepFile.path;
                        const isSelected = selectedPaths.has(file.path);
                        const catColor = getCategoryColor(file.file_type);
                        const safetyColor = getSafetyColor(file.safety_level);
                        const lastSeen = file.last_accessed ?? file.last_modified;

                        return (
                          <div
                            key={file.path}
                            className={`group flex items-center gap-3 px-5 py-3 border-t border-white/5 hover:bg-white/5 transition-colors ${
                              isSelected ? 'bg-[#FF2E93]/10' : ''
                            }`}
                          >
                            <button
                              onClick={() => toggleSelect(file.path)}
                              className="w-8 flex items-center justify-center shrink-0"
                              title={isKeep ? 'This is the suggested copy to keep' : 'Select duplicate'}
                            >
                              <div className={`w-4 h-4 rounded border transition-all ${
                                isSelected
                                  ? 'bg-accent-primary border-accent-primary'
                                  : 'border-bg-tertiary group-hover:border-bg-tertiary'
                              }`}>
                                {isSelected && (
                                  <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="none">
                                    <path d="M4 8L7 11L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  </svg>
                                )}
                              </div>
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <File size={14} weight="duotone" className="text-text-muted shrink-0" />
                                <span className="text-sm text-text-primary truncate">{file.name}</span>
                                {isKeep && (
                                  <span className="px-1.5 py-0.5 bg-[#22c55e]/10 text-[#22c55e] text-[10px] font-medium shrink-0">
                                    Keep
                                  </span>
                                )}
                                {file.safety_level === 'Caution' && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-caution/10 text-caution text-[10px] font-medium shrink-0">
                                    <WarningCircle size={10} />
                                    Caution
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-text-muted truncate mt-0.5">
                                {file.path.replace(/^\/Users\/[^/]+\//, '~/')}
                              </p>
                            </div>

                            <span className="w-24 text-right text-sm font-semibold text-text-primary tabular-nums">
                              {formatBytes(file.allocated_size || file.size)}
                            </span>

                            <span className="w-24">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs"
                                style={{ backgroundColor: `${catColor}15`, color: catColor }}
                              >
                                {file.file_type}
                              </span>
                            </span>

                            <span
                              className="w-20 text-xs font-medium"
                              style={{ color: safetyColor }}
                            >
                              {file.safety_level}
                            </span>

                            <span className="w-28 text-right text-xs text-text-muted tabular-nums">
                              {lastSeen ? (
                                <span className="inline-flex items-center justify-end gap-1">
                                  <Clock size={10} />
                                  {formatRelativeTime(lastSeen)}
                                </span>
                              ) : '—'}
                            </span>

                            <button
                              onClick={() => openInFinder(file.path)}
                              className="w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-text-primary"
                              title="Open in Finder"
                            >
                              <ArrowSquareOut size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {!isScanning && groups.length === 0 && !error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex-1 flex flex-col items-center justify-center text-center -mt-12"
        >
          <div className="relative mb-8">
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#22C55E] blur-3xl opacity-30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="relative w-40 h-40 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.24) 0%, rgba(34, 197, 94, 0.14) 100%)',
                boxShadow: `
                  inset 0 8px 32px rgba(255, 255, 255, 0.2),
                  inset 0 -8px 32px rgba(0, 0, 0, 0.1),
                  0 20px 60px rgba(0, 240, 255, 0.25),
                  0 0 0 1px rgba(255, 255, 255, 0.15)
                `,
                backdropFilter: 'blur(20px)',
              }}
              animate={{ y: [0, -8, 0], rotateX: [0, 3, 0], rotateY: [0, -3, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <CopySimple size={52} weight="fill" className="text-[#00F0FF] drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]" />
            </motion.div>
          </div>

          <h2 className="text-3xl font-semibold text-text-primary mb-3">
            {hasScanned ? 'No Duplicates Found' : 'Find Duplicate Files'}
          </h2>
          <p className="text-base text-text-secondary max-w-md leading-relaxed mb-10">
            {hasScanned
              ? `No duplicate files larger than ${formatBytes(threshold)} were found.`
              : 'Compare content hashes and keep one copy from each duplicate group.'
            }
          </p>

          <motion.button
            onClick={handleScan}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center gap-3 px-10 py-4 rounded-full text-lg font-semibold text-white overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0D9488 0%, #0EA5E9 100%)',
              boxShadow: '0 8px 32px rgba(13, 148, 136, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
            }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              }}
            />
            <CopySimple size={24} weight="fill" className="relative z-10" />
            <span className="relative z-10">Scan Duplicates</span>
          </motion.button>
        </motion.div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        items={selectedItems}
        totalSize={selectedSize}
        onConfirm={async (permanent, cleanablePaths) => {
          const paths = cleanablePaths ?? Array.from(selectedPaths);
          setShowConfirm(false);
          setSelectedPaths(new Set());
          await useCleanupStore.getState().startCleanup(paths, permanent);
          handleScan();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </motion.div>
  );
}
