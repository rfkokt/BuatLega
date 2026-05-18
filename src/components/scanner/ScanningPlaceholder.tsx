import { motion } from 'framer-motion';
import { FileDashed, FolderDashed, Cpu, Database, XCircle } from '@phosphor-icons/react';

interface ScanningPlaceholderProps {
  currentPath: string;
  onCancel?: () => void;
}

export function ScanningPlaceholder({ currentPath, onCancel }: ScanningPlaceholderProps) {
  const pathParts = currentPath.split('/').filter(Boolean);
  const activeFolder = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'System';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mt-6"
    >
      <div className="flex items-center justify-between gap-4 mb-4 text-xs font-medium text-text-muted uppercase tracking-widest border-b border-bg-tertiary pb-2">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-accent-primary animate-pulse" />
          <span>Deep Analysis Engine Active</span>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-caution hover:text-caution/80 transition-colors normal-case tracking-normal"
          >
            <XCircle size={14} />
            Cancel scan
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            className="glass p-4 relative overflow-hidden"
          >
            {/* Scanning radar sweep effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-primary/5 to-transparent border-t border-accent-primary/20 pointer-events-none"
              animate={{ y: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: i * 0.15 }}
            />
            
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="p-2 bg-bg-tertiary border border-bg-tertiary">
                {i % 3 === 0 ? <FolderDashed size={16} className="text-accent-secondary" /> : 
                 i % 2 === 0 ? <Database size={16} className="text-cat-system" /> : 
                 <FileDashed size={16} className="text-text-muted" />}
              </div>
              <div className="flex-1 space-y-2">
                <div className="h-1.5 w-full bg-bg-tertiary" />
                <div className="h-1.5 w-2/3 bg-bg-tertiary" />
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between text-[10px] text-text-muted font-mono relative z-10">
              <span className="truncate max-w-[80px]">
                {i === 0 ? activeFolder : `Sector ${i}x${Math.floor(Math.random() * 90 + 10)}`}
              </span>
              <span className="text-accent-primary animate-pulse">Analyzing</span>
            </div>
            
            <div className="mt-2 w-full h-[1px] bg-bg-tertiary overflow-hidden relative z-10">
              <motion.div
                className="h-full bg-accent-secondary"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.5 + Math.random(), repeat: Infinity, ease: 'circOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
