import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowClockwise,
  CheckCircle,
  Lightning,
  Spinner,
  Warning,
  Wrench,
} from '@phosphor-icons/react';
import { listOptimizeActions, runOptimizeActions } from '../services/tauri';
import type { OptimizeAction, OptimizeActionResult } from '../types';

export default function Optimize() {
  const [actions, setActions] = useState<OptimizeAction[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<OptimizeActionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [runningLabel, setRunningLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedActions = useMemo(
    () => actions.filter((action) => selected.has(action.id)),
    [actions, selected],
  );
  const hasDisruptiveAction = selectedActions.some((action) => action.requires_confirmation);

  const loadActions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const available = await listOptimizeActions();
      setActions(available);
      setSelected(new Set(available.filter((action) => !action.requires_confirmation).map((action) => action.id)));
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const runActionIds = useCallback(async (actionIds: string[], label: string) => {
    if (actionIds.length === 0) return;

    setIsRunning(true);
    setRunningLabel(label);
    setResults([]);
    setError(null);
    try {
      const output = await runOptimizeActions(actionIds);
      setResults(output);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsRunning(false);
      setRunningLabel(null);
    }
  }, []);

  const runSelected = useCallback(async () => {
    await runActionIds(Array.from(selected), `Running ${selected.size} selected actions`);
  }, [runActionIds, selected]);

  const runSingle = useCallback(async (action: OptimizeAction) => {
    await runActionIds([action.id], `Running ${action.label}`);
  }, [runActionIds]);

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
          <h1 className="text-2xl font-bold text-text-primary">Optimize</h1>
          <p className="text-sm text-text-secondary mt-1">
            Refresh macOS caches, services, and UI state without elevated privileges
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadActions}
            disabled={isLoading || isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50"
          >
            <ArrowClockwise size={14} />
            Refresh
          </button>
          <button
            onClick={runSelected}
            disabled={selected.size === 0 || isRunning}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-[#0D9488] to-[#0EA5E9] shadow-[0_0_20px_rgba(13,148,136,0.4)] hover:shadow-[0_0_30px_rgba(13,148,136,0.6)] transition-all disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Spinner size={16} className="animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Lightning size={16} weight="fill" />
                Run {selected.size} Actions
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

      {isRunning && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#00F0FF]/20 bg-[#00F0FF]/10 px-4 py-3">
          <Spinner size={18} className="animate-spin text-[#00F0FF] shrink-0" />
          <p className="text-sm text-[#00F0FF]/90">{runningLabel || 'Running optimization actions'}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 shrink-0 mt-6">
        <SummaryCard label="Actions" value={actions.length.toString()} color="#00F0FF" />
        <SummaryCard label="Selected" value={selected.size.toString()} color="#22c55e" />
        <SummaryCard label="Needs Restart UI" value={hasDisruptiveAction ? 'Yes' : 'No'} color="#FF9F0A" />
      </div>

      {hasDisruptiveAction && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#FF9F0A]/20 bg-[#FF9F0A]/10 px-4 py-3">
          <Warning size={18} className="text-[#FF9F0A] mt-0.5 shrink-0" />
          <p className="text-sm text-[#FF9F0A]/90">
            Selected actions can briefly restart Finder, Dock, or menu bar UI. Open apps and documents are not closed.
          </p>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4 mt-4 pb-6">
        <div className="glass rounded-3xl overflow-hidden border border-white/5">
          <div className="px-5 py-4 border-b border-white/5 bg-white/5">
            <p className="text-xs uppercase tracking-wider text-white/45 font-medium">Available Actions</p>
          </div>

          <div className="max-h-[58vh] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center gap-2 px-5 py-6 text-sm text-white/50">
                <Spinner size={16} className="animate-spin" />
                Loading actions...
              </div>
            ) : (
              actions.map((action, index) => {
                const checked = selected.has(action.id);
                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(index * 0.03, 0.2) }}
                    className={`w-full flex items-start gap-4 px-5 py-4 border-b border-white/5 text-left hover:bg-white/5 transition-colors ${
                      checked ? 'bg-[#0D9488]/10' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggle(action.id)}
                      disabled={isRunning}
                      className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 disabled:opacity-50 ${
                        checked ? 'bg-[#0D9488] border-[#0D9488]' : 'border-white/20'
                      }`}
                      title={checked ? 'Deselect' : 'Select'}
                    >
                      {checked && <CheckCircle size={14} weight="fill" className="text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Wrench size={16} className="text-white/45" />
                        <p className="text-sm font-semibold text-white">{action.label}</p>
                        {action.requires_confirmation && (
                          <span className="rounded-none bg-[#FF9F0A]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#FF9F0A]">
                            UI restart
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/45 mt-1 leading-relaxed">{action.description}</p>
                    </div>
                    <button
                      onClick={() => runSingle(action)}
                      disabled={isRunning}
                      className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/75 hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                      Run
                    </button>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        <div className="glass rounded-3xl overflow-hidden border border-white/5">
          <div className="px-5 py-4 border-b border-white/5 bg-white/5">
            <p className="text-xs uppercase tracking-wider text-white/45 font-medium">Run Results</p>
          </div>

          {isRunning ? (
            <div className="px-5 py-8 flex items-center gap-2 text-sm text-white/50">
              <Spinner size={16} className="animate-spin" />
              Waiting for command results...
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-[58vh] overflow-y-auto">
              {results.map((result) => (
                <div key={result.id} className="px-5 py-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle size={16} weight="fill" className="text-[#0D9488]" />
                    ) : (
                      <Warning size={16} weight="fill" className="text-[#FF9F0A]" />
                    )}
                    <p className="text-sm font-semibold text-white">{result.label}</p>
                  </div>
                  <p className={`text-xs mt-1 leading-relaxed ${result.success ? 'text-white/45' : 'text-[#FF9F0A]/85'}`}>
                    {result.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-sm text-white/45">
              Results appear here after running selected actions.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 border border-white/5"
    >
      <p className="text-xs text-white/50">{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color }}>
        {value}
      </p>
    </motion.div>
  );
}
