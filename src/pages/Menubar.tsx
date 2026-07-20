import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion } from 'framer-motion';
import { 
  Laptop, 

  HardDrive, 
  Memory, 
  BatteryFull, 
  BatteryWarning,
  Cpu, 
  WifiSlash,
  WifiHigh,
  ArrowCircleUp,
  Desktop,
  Gear,
  CaretUp
} from '@phosphor-icons/react';

interface SystemStats {
  memory_used_percent: number;
  cpu_load_percent: number;
  disk_available_gb: number;
  battery_percent: number;
  battery_charging: boolean;
  is_connected: boolean;
  hostname: string;
}

const containerVariants: any = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function Menubar() {
  const handleNavigation = (route: string) => {
    invoke('show_main_window', { route }).catch(console.error);
  };

  const [stats, setStats] = useState<SystemStats>({
    memory_used_percent: 0,
    cpu_load_percent: 0,
    disk_available_gb: 0,
    battery_percent: 100,
    battery_charging: false,
    is_connected: true,
    hostname: "Mac",
  });

  let healthText = "Good";
  let healthColor = "text-cyan-400";
  let healthIconColor = "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]";
  
  if (stats.memory_used_percent > 90 || stats.cpu_load_percent > 90) {
    healthText = "Critical";
    healthColor = "text-red-400";
    healthIconColor = "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]";
  } else if (stats.memory_used_percent > 75 || stats.cpu_load_percent > 75) {
    healthText = "Fair";
    healthColor = "text-yellow-400";
    healthIconColor = "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]";
  }

  useEffect(() => {
    // Initial fetch
    invoke<SystemStats>('get_system_stats').then(setStats).catch(console.error);

    // Poll every 2 seconds
    const interval = setInterval(() => {
      invoke<SystemStats>('get_system_stats').then(setStats).catch(console.error);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="h-screen w-full bg-menubar-panel text-white overflow-hidden flex flex-col font-sans selection:bg-accent-primary/30"
    >
      
      {/* Scrollable Content */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-20 custom-scrollbar"
      >
        
        {/* Header Section */}
        <motion.div variants={itemVariants} className="flex justify-between items-start mb-2 px-1">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Mac Health: <span className={healthColor}>{healthText}</span></h1>
            <p className="text-sm text-white/60">{stats.hostname}</p>
          </div>
          <div className="relative">
            <div className={`absolute inset-0 bg-white/5 blur-xl rounded-full`}></div>
            <Laptop size={42} weight="duotone" className={healthIconColor} />
          </div>
        </motion.div>


        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          
          {/* Macintosh HD */}
          <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-default relative overflow-hidden group flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive size={20} weight="fill" className="text-white/80" />
              <span className="font-semibold text-sm">Macintosh HD</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-yellow-400 font-medium">Available: {stats.disk_available_gb} GB</p>
              </div>
              <button onClick={() => handleNavigation('/scan')} className="text-cyan-400 text-sm font-semibold hover:text-cyan-300">Free Up</button>
            </div>
          </motion.div>

          {/* Memory */}
          <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-default flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Memory size={20} weight="fill" className="text-white/80" />
              <span className="font-semibold text-sm">Memory</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-white/60">Pressure: {stats.memory_used_percent}%</p>
              </div>
              <button onClick={() => handleNavigation('/optimize')} className="text-cyan-400 text-sm font-semibold hover:text-cyan-300">Free Up</button>
            </div>
          </motion.div>

          {/* Battery */}
          <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-default">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {stats.battery_percent < 20 ? (
                   <BatteryWarning size={20} weight="fill" className="text-red-400" />
                ) : (
                   <BatteryFull size={20} weight="fill" className="text-white/80" />
                )}
                <span className="font-semibold text-sm">Battery</span>
              </div>
              <span className="text-sm font-bold">{stats.battery_percent}%</span>
            </div>
            <p className="text-xs text-white/60">{stats.battery_charging ? "Charging" : "Discharging"}</p>
          </motion.div>

          {/* CPU */}
          <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-default">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Cpu size={20} weight="fill" className="text-white/80" />
                <span className="font-semibold text-sm">CPU</span>
              </div>
            </div>
            <p className="text-xs text-white/60">Load: {stats.cpu_load_percent}%</p>
          </motion.div>

          {/* Network */}
          <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-default">
            <div className="flex items-center gap-2 mb-2">
              {stats.is_connected ? (
                <WifiHigh size={20} weight="fill" className="text-green-400" />
              ) : (
                <WifiSlash size={20} weight="fill" className="text-white/80" />
              )}
              <span className="font-semibold text-sm">Network</span>
            </div>
            <p className="text-xs text-white/60 mt-4 leading-tight">
              {stats.is_connected ? "Internet connection is active" : "Internet connection is missing"}
            </p>
          </motion.div>

          {/* Connected Devices */}
          <motion.div variants={itemVariants} className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-colors cursor-default flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold text-sm">Connected Devices</span>
            </div>
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-2 text-white/90">
                <HardDrive size={16} weight="fill" />
                <span className="text-sm">Internal</span>
              </div>
              <button className="text-cyan-400 hover:text-cyan-300">
                <CaretUp size={16} weight="bold" />
              </button>
            </div>
          </motion.div>

        </div>

        {/* Today's Recommendation */}
        <motion.div variants={itemVariants} className="mt-4">
          <h2 className="text-white/80 font-semibold text-sm px-1 mb-2">Today's Recommendation</h2>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/30 blur-md rounded-full"></div>
                  <ArrowCircleUp size={32} weight="fill" className="text-blue-400 relative z-10" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm mb-1">Clean up Large Files</h3>
                <p className="text-xs text-white/70 leading-relaxed mb-4">
                  Find and remove large files to free up significant storage space quickly.
                </p>
                <div className="flex justify-end">
                  <button onClick={() => handleNavigation('/large-files')} className="bg-white/10 hover:bg-white/20 border border-white/10 transition-colors px-4 py-1.5 rounded-lg text-sm font-semibold shadow-sm">
                    Review Large Files
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Bottom Bar */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 30 }}
        className="absolute bottom-0 left-0 right-0 h-12 bg-black/20 backdrop-blur-xl border-t border-white/5 flex items-center justify-between px-4 z-10"
      >
        <button onClick={() => handleNavigation('/')} className="text-white/60 hover:text-white transition-colors bg-white/5 p-1 rounded-md border border-white/5">
          <Desktop size={20} weight="fill" />
        </button>
        <button onClick={() => handleNavigation('/')} className="text-sm font-semibold text-white/90 hover:text-white transition-colors">
          Show BuatLega
        </button>
        <button onClick={() => handleNavigation('/settings')} className="text-white/60 hover:text-white transition-colors bg-white/5 p-1 rounded-md border border-white/5">
          <Gear size={20} weight="fill" />
        </button>
      </motion.div>

    </motion.div>
  );
}
