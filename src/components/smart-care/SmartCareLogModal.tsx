import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserMinus, 
  FileText, 
  Gear, 
  ChatTeardropText, 
  Clock, 
  Envelope, 
  HardDrive, 
  Globe,
  Check,
  Folder
} from '@phosphor-icons/react';
import { useScanStore } from '../../stores/scan-store';
import { formatBytes, getCategoryLabel } from '../../lib/format';

interface SmartCareLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'Log': return <FileText size={24} weight="fill" />;
    case 'Cache': return <Clock size={24} weight="fill" />;
    case 'System': return <Gear size={24} weight="fill" />;
    case 'Application': return <HardDrive size={24} weight="fill" />;
    case 'Trash': return <UserMinus size={24} weight="fill" />;
    default: return <Folder size={24} weight="fill" />;
  }
}

function getCategoryColorClass(category: string) {
  switch (category) {
    case 'Log': return 'text-green-500';
    case 'Cache': return 'text-orange-400';
    case 'System': return 'text-red-400';
    case 'Application': return 'text-blue-400';
    default: return 'text-green-400';
  }
}

export function SmartCareLogModal({ isOpen, onClose }: SmartCareLogModalProps) {
  const { scanResult } = useScanStore();
  
  // Transform real categories to log items
  const realItems = scanResult && scanResult.categories 
    ? Object.entries(scanResult.categories).map(([cat, size], index) => ({
        id: cat + index,
        label: getCategoryLabel(cat),
        size: formatBytes(size),
        icon: getCategoryIcon(cat),
        iconColor: getCategoryColorClass(cat),
      })).filter(item => item.size !== '0 B')
    : [];

  // Fallback items if no scan has been performed yet
  const displayItems = realItems.length > 0 ? realItems : [
    { id: '1', label: 'System Ready', size: '', icon: <Check size={24} weight="bold" />, iconColor: 'text-green-400' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-50"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-[400px] max-w-full z-50 shadow-2xl flex flex-col border-l border-white/5"
            style={{
              background: 'linear-gradient(145deg, #7c3a96 0%, #472175 100%)'
            }}
          >
            {/* Header */}
            <div className="px-10 pt-12 pb-8">
              <h2 className="text-[32px] font-medium text-white tracking-tight">Smart Care Log</h2>
              <p className="text-white/60 mt-1">{realItems.length > 0 ? 'Recently scanned items' : 'No items found yet'}</p>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto px-10 pb-32 custom-scrollbar">
              <div className="space-y-7">
                {displayItems.map((item, index) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 + 0.2 }}
                    className="flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-5">
                      <div className={`relative flex items-center justify-center w-10 h-10`}>
                         <div className={`absolute inset-0 bg-current opacity-20 blur-md rounded-full ${item.iconColor}`}></div>
                         <div className={`relative z-10 ${item.iconColor} drop-shadow-md`}>
                           {item.icon}
                         </div>
                      </div>
                      <span className="text-white font-semibold text-[15px]">{item.label}</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {item.size && (
                        <span className="text-white/80 font-medium text-[15px]">{item.size}</span>
                      )}
                      <div className="text-white/90">
                        <Check weight="bold" size={20} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Footer with Done Button */}
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#36175e] to-transparent pointer-events-none flex justify-end">
              <button
                onClick={onClose}
                className="pointer-events-auto bg-white text-black font-semibold px-6 py-2 rounded-xl hover:bg-white/90 transition-colors shadow-lg active:scale-95 text-[15px]"
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
