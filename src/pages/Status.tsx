import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowClockwise,
  BatteryCharging,
  Cpu,
  HardDrives,
  Memory,
  Pulse,
  Spinner,
} from '@phosphor-icons/react';
import { formatBytes } from '../lib/format';
import { getSystemStatus } from '../services/tauri';
import type { SystemStatus } from '../types';

export default function Status() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setStatus(await getSystemStatus());
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 8000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const healthColor = status
    ? status.health_score >= 85
      ? '#0D9488'
      : status.health_score >= 65
        ? '#FF9F0A'
        : '#E11D48'
    : '#94a3b8';

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
          <h1 className="text-2xl font-bold text-text-primary">Status</h1>
          <p className="text-sm text-text-secondary mt-1">
            {status ? hardwareLine(status) : 'Live system health, memory, disk, battery, and process activity'}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-[#0D9488] to-[#0EA5E9] shadow-[0_0_20px_rgba(13,148,136,0.4)] hover:shadow-[0_0_30px_rgba(13,148,136,0.6)] transition-all disabled:opacity-50"
        >
          {isLoading ? <Spinner size={16} className="animate-spin" /> : <ArrowClockwise size={16} />}
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl glass border-red-500/20 bg-red-500/10 mt-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!status && isLoading ? (
        <div className="flex-1 flex items-center justify-center text-white/50">
          <Spinner size={32} className="animate-spin" />
        </div>
      ) : status && (
        <div className="flex-1 min-h-0 mt-6 pb-6 space-y-4 overflow-y-auto pr-2 -mr-2">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
            <div className="glass rounded-3xl border border-white/5 p-6 min-h-[220px]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/45 font-medium">Health Score</p>
                  <h2 className="mt-2 text-5xl font-semibold" style={{ color: healthColor }}>
                    {status.health_score}
                  </h2>
                  <p className="mt-1 text-sm text-white/60">{status.health_label}</p>
                </div>
                <div className="relative h-32 w-32 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
                  <Pulse size={48} weight="duotone" style={{ color: healthColor }} />
                  <div className="absolute inset-3 rounded-full border-2" style={{ borderColor: `${healthColor}55` }} />
                </div>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3">
                <Metric label="Load 1m" value={status.load_average[0].toFixed(2)} />
                <Metric label="Load 5m" value={status.load_average[1].toFixed(2)} />
                <Metric label="Uptime" value={formatDuration(status.uptime_seconds)} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Metric label="CPU Cores" value={coreLine(status)} />
                <Metric label="Proxy" value={status.proxy.enabled ? `${status.proxy.proxy_type} ${status.proxy.host}` : 'Off'} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatusCard
                icon={<Memory size={22} weight="duotone" />}
                label="Memory"
                value={`${status.memory.used_percent.toFixed(0)}%`}
                detail={`avail ${formatBytes(status.memory.available)} · swap ${formatBytes(status.memory.swap_used)}/${formatBytes(status.memory.swap_total)}${status.memory.pressure ? ` · ${status.memory.pressure}` : ''}`}
                color={status.memory.used_percent > 85 ? '#FF9F0A' : '#00F0FF'}
                percent={status.memory.used_percent}
              />
              <StatusCard
                icon={<HardDrives size={22} weight="duotone" />}
                label="Disk"
                value={`${status.disk.used_percent.toFixed(0)}%`}
                detail={`${formatBytes(status.disk.used)} used · ${formatBytes(status.disk.available)} free`}
                color={status.disk.used_percent > 85 ? '#FF9F0A' : '#0D9488'}
                percent={status.disk.used_percent}
              />
              <StatusCard
                icon={<Cpu size={22} weight="duotone" />}
                label="CPU"
                value={`${status.cpu_usage_percent.toFixed(0)}%`}
                detail={`${status.logical_cpu_count} cores · load ${status.load_average[0].toFixed(2)} / ${status.load_average[1].toFixed(2)} / ${status.load_average[2].toFixed(2)}`}
                color="#BF5AF2"
                percent={status.cpu_usage_percent}
              />
              <StatusCard
                icon={<BatteryCharging size={22} weight="duotone" />}
                label="Battery"
                value={status.battery ? `${status.battery.percent}%` : 'N/A'}
                detail={status.battery ? batteryDetail(status) : 'No battery data'}
                color={status.battery && status.battery.percent < 20 ? '#E11D48' : '#22c55e'}
                percent={status.battery?.percent ?? 0}
              />
              <StatusCard
                icon={<HardDrives size={22} weight="duotone" />}
                label="Disk I/O"
                value={`${status.disk_io.read_rate.toFixed(1)} MB/s`}
                detail="sampled disk activity"
                color="#F59E0B"
                percent={Math.min(status.disk_io.read_rate + status.disk_io.write_rate, 100)}
              />
              <StatusCard
                icon={<Pulse size={22} weight="duotone" />}
                label="Network"
                value={`${status.network.down_rate.toFixed(1)} MB/s`}
                detail={`up ${status.network.up_rate.toFixed(1)} MB/s${status.network.ip ? ` · ${status.network.ip}` : ''}`}
                color="#38BDF8"
                percent={Math.min((status.network.down_rate + status.network.up_rate) * 20, 100)}
              />
            </div>
          </div>

          <div className="glass rounded-3xl overflow-hidden border border-white/5">
            <div className="px-5 py-4 border-b border-white/5 bg-white/5">
              <p className="text-xs uppercase tracking-wider text-white/45 font-medium">Disks</p>
            </div>
            <div className="divide-y divide-white/5">
              {status.disks.map((disk) => (
                <div key={`${disk.device}-${disk.mount}`} className="grid grid-cols-[1fr_auto] gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {disk.external ? 'External' : 'Internal'} · {disk.mount}
                    </p>
                    <p className="mt-1 text-xs text-white/45 truncate">{disk.device || 'unknown device'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white tabular-nums">{formatBytes(disk.used)} / {formatBytes(disk.total)}</p>
                    <p className="mt-1 text-xs text-white/45 tabular-nums">{disk.used_percent.toFixed(0)}% used</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-3xl overflow-hidden border border-white/5">
            <div className="px-5 py-4 border-b border-white/5 bg-white/5">
              <p className="text-xs uppercase tracking-wider text-white/45 font-medium">Top Processes</p>
            </div>
            <div className="max-h-[38vh] overflow-y-auto">
              {status.top_processes.map((process) => (
                <div key={`${process.pid}-${process.name}`} className="flex items-center gap-4 px-5 py-3 border-b border-white/5">
                  <div className="w-12 text-xs text-white/35 tabular-nums">{process.pid}</div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-white">{process.name}</p>
                  </div>
                  <div className="w-24 text-right text-sm text-[#00F0FF] tabular-nums">
                    {process.cpu.toFixed(1)}% CPU
                  </div>
                  <div className="w-24 text-right text-sm text-white/55 tabular-nums">
                    {process.memory.toFixed(1)}% MEM
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  detail,
  color,
  percent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  color: string;
  percent: number;
}) {
  return (
    <div className="glass rounded-3xl border border-white/5 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-full border border-white/10 bg-white/5 p-2" style={{ color }}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-white/45">{label}</p>
          <p className="text-2xl font-semibold" style={{ color }}>{value}</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-white/50">{detail}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${Math.min(percent, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function hardwareLine(status: SystemStatus): string {
  return [
    status.hardware.model,
    status.hardware.cpu_model,
    status.hardware.total_ram,
    status.hardware.disk_size,
    status.hardware.refresh_rate,
    status.hardware.os_version,
    `up ${formatDuration(status.uptime_seconds)}`,
  ].filter(Boolean).join(' · ');
}

function coreLine(status: SystemStatus): string {
  if (status.cpu.p_core_count > 0 || status.cpu.e_core_count > 0) {
    return `${status.cpu.logical_cpu} logical · ${status.cpu.p_core_count}P+${status.cpu.e_core_count}E`;
  }
  return `${status.cpu.logical_cpu} logical · ${status.cpu.core_count} physical`;
}

function batteryDetail(status: SystemStatus): string {
  const battery = status.battery;
  if (!battery) return 'No battery data';
  const pieces = [battery.status];
  if (battery.time_remaining) pieces.push(battery.time_remaining);
  if (battery.health) pieces.push(battery.health);
  if (battery.capacity != null) pieces.push(`${battery.capacity}% health`);
  if (battery.cycle_count != null) pieces.push(`${battery.cycle_count} cycles`);
  if (status.thermal.battery_temp > 0) pieces.push(`${status.thermal.battery_temp.toFixed(1)}C`);
  if (status.thermal.adapter_power > 0) pieces.push(`${status.thermal.adapter_power.toFixed(0)}W adapter`);
  return pieces.join(' · ');
}
