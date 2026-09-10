import React, { useState } from 'react';
import { 
  Power, 
  Thermometer, 
  Droplets, 
  Clock, 
  RotateCcw, 
  Heart, 
  Zap, 
  Copy, 
  Check, 
  ExternalLink,
  Edit2,
  CheckCircle2,
  Layers,
  ArrowUpRight,
  SlidersHorizontal
} from 'lucide-react';
import { DeviceInfo } from '../types';

interface DeviceCardProps {
  key?: string;
  device: DeviceInfo;
  onControl: (mac: string, action: 'ON' | 'OF') => Promise<void>;
  onViewDetails: (device: DeviceInfo) => void;
  onUpdateNickname: (mac: string, name: string) => void;
}

export function DeviceCard({
  device,
  onControl,
  onViewDetails,
  onUpdateNickname,
}: DeviceCardProps) {
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState<'ON' | 'OF' | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nickname, setNickname] = useState(device.name || `ESP32-${device.mac.slice(-4).toUpperCase()}`);

  const { mac, data, lastUpdated, online } = device;
  const isValveOpen = Number(data.valveStatus) === 1;

  const handleCopyMac = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(mac);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveNickname = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingName(false);
    onUpdateNickname(mac, nickname.trim());
  };

  const handleSendAction = async (action: 'ON' | 'OF', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsSending(action);
    try {
      await onControl(mac, action);
    } finally {
      setIsSending(null);
    }
  };

  // Format onSecs into readable string
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}分${secs > 0 ? `${secs}秒` : ''}`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}小时${remMins}分`;
  };

  // Relative time since last update
  const getRelativeTime = (timestamp: number) => {
    const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 5) return '刚刚';
    if (diffSec < 60) return `${diffSec}秒前`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}分钟前`;
    return `${Math.floor(diffMin / 60)}小时前`;
  };

  return (
    <div 
      id={`device-card-${mac}`}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
        isValveOpen
          ? 'bg-slate-900 border-emerald-500/50 shadow-emerald-950/20 ring-1 ring-emerald-500/20'
          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Header section */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/90">
        <div className="flex items-start justify-between gap-3">
          
          {/* Device identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <form onSubmit={handleSaveNickname} className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="bg-slate-800 text-white text-sm font-semibold px-2 py-0.5 rounded border border-cyan-500 outline-none w-36"
                    autoFocus
                  />
                  <button type="submit" className="p-1 text-emerald-400 hover:text-emerald-300">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <h3 className="text-base font-bold text-white truncate tracking-tight">
                    {device.name || `ESP32-${mac.slice(-4).toUpperCase()}`}
                  </h3>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-slate-500 hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="修改设备备注名"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Status pill */}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  online
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {online ? '在线' : '离线'}
              </span>
            </div>

            {/* MAC address pill with copy */}
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-slate-400">MAC:</span>
              <button
                id={`btn-copy-mac-${mac}`}
                onClick={handleCopyMac}
                title="点击复制 12 位 MAC 地址"
                className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/50 px-2 py-0.5 rounded transition-colors"
              >
                {mac}
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-cyan-400" />}
              </button>
              <span className="text-[11px] text-slate-500">• {getRelativeTime(lastUpdated)}</span>
            </div>
          </div>

          {/* Quick detail link */}
          <button
            id={`btn-view-details-${mac}`}
            onClick={() => onViewDetails(device)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
            title="查看温湿度图表与完整报文"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Valve Control Bar (The primary switch required by user prompt) */}
      <div className="px-4 sm:px-5 py-3.5 bg-slate-950/40 border-b border-slate-800/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Valve status badge */}
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm ${
                isValveOpen
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 ring-2 ring-emerald-500/20'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <Zap className={`w-5 h-5 ${isValveOpen ? 'animate-bounce text-emerald-400' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400">电磁阀状态:</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isValveOpen
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {isValveOpen ? '已开启 (ON)' : '已关闭 (OFF)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                开启时长: <span className="text-slate-300 font-medium">{formatDuration(data.onSecs)}</span>
                {' '}({data.onSecs}s)
              </p>
            </div>
          </div>

          {/* Dual Action Buttons: ON (mac-ON) and OF (mac-OF) */}
          <div className="flex items-center gap-2">
            <button
              id={`btn-valve-on-${mac}`}
              onClick={(e) => handleSendAction('ON', e)}
              disabled={isSending !== null}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                isValveOpen
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/40 ring-2 ring-emerald-400/30'
                  : 'bg-slate-800 text-slate-200 hover:bg-emerald-600 hover:text-white border border-slate-700'
              }`}
              title={`点击发送: ${mac}-ON`}
            >
              <Power className={`w-3.5 h-3.5 ${isSending === 'ON' ? 'animate-spin' : ''}`} />
              <span>{isSending === 'ON' ? '发送中...' : '开 (ON)'}</span>
            </button>

            <button
              id={`btn-valve-off-${mac}`}
              onClick={(e) => handleSendAction('OF', e)}
              disabled={isSending !== null}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                !isValveOpen
                  ? 'bg-rose-600/90 text-white hover:bg-rose-600 shadow-rose-950/30'
                  : 'bg-slate-800 text-slate-200 hover:bg-rose-600 hover:text-white border border-slate-700'
              }`}
              title={`点击发送: ${mac}-OF`}
            >
              <Power className={`w-3.5 h-3.5 ${isSending === 'OF' ? 'animate-spin' : ''}`} />
              <span>{isSending === 'OF' ? '发送中...' : '关 (OF)'}</span>
            </button>
          </div>

        </div>

        {/* Command indicator badge */}
        <div className="mt-2 pt-2 border-t border-slate-800/50 flex items-center justify-between text-[11px] text-slate-400">
          <span className="text-slate-500">发送指令格式:</span>
          <div className="flex items-center gap-2">
            <code className="bg-slate-900 px-1.5 py-0.5 rounded text-cyan-300 font-mono text-[10px] border border-slate-800">
              {mac}-ON
            </code>
            <span className="text-slate-600">/</span>
            <code className="bg-slate-900 px-1.5 py-0.5 rounded text-rose-300 font-mono text-[10px] border border-slate-800">
              {mac}-OF
            </code>
          </div>
        </div>
      </div>

      {/* Telemetry metrics grid */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          
          {/* Temperature */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                温度
              </span>
              <span className="text-[10px] text-slate-500 font-mono">temp</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-white">
                {data.temp}
              </span>
              <span className="text-xs text-rose-300 font-semibold">℃</span>
            </div>
            {/* Simple indicator bar */}
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-cyan-400 via-amber-400 to-rose-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, (data.temp / 50) * 100))}%` }}
              />
            </div>
          </div>

          {/* Humidity */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                湿度
              </span>
              <span className="text-[10px] text-slate-500 font-mono">humi</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-white">
                {data.humi}
              </span>
              <span className="text-xs text-cyan-300 font-semibold">%</span>
            </div>
            <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(5, data.humi))}%` }}
              />
            </div>
          </div>

          {/* Bootup Times */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                启动次数
              </span>
              <span className="text-[10px] text-slate-500 font-mono">bootup</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-white">
                {data.bootupTimes}
              </span>
              <span className="text-xs text-slate-400">次</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-2">开机复位计数</span>
          </div>

          {/* Open Times */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                开启次数
              </span>
              <span className="text-[10px] text-slate-500 font-mono">onTimes</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold tracking-tight text-white">
                {data.onTimes}
              </span>
              <span className="text-xs text-slate-400">次</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-2">累计动作次数</span>
          </div>

        </div>

        {/* Secondary Parameters row: Heartbeat Tick, bon, boff */}
        <div className="mt-3 pt-3 border-t border-slate-800/70 grid grid-cols-3 gap-2 text-xs">
          
          {/* Tick Heartbeat */}
          <div className="bg-slate-950/40 rounded-lg p-2 border border-slate-800/50">
            <div className="flex items-center gap-1 text-slate-400">
              <Heart className="w-3 h-3 text-rose-400 animate-pulse" />
              <span className="font-medium text-[11px]">心跳 Tick</span>
            </div>
            <div className="mt-1 font-mono font-semibold text-slate-200 text-xs truncate" title={`${data.tick} ticks`}>
              {data.tick.toLocaleString()}
            </div>
          </div>

          {/* bon */}
          <div className="bg-slate-950/40 rounded-lg p-2 border border-slate-800/50">
            <div className="flex items-center gap-1 text-slate-400">
              <Layers className="w-3 h-3 text-blue-400" />
              <span className="font-medium text-[11px]">开阀 bon</span>
            </div>
            <div className="mt-1 font-mono font-semibold text-slate-200 text-xs">
              {data.bon}
            </div>
          </div>

          {/* boff */}
          <div className="bg-slate-950/40 rounded-lg p-2 border border-slate-800/50">
            <div className="flex items-center gap-1 text-slate-400">
              <Layers className="w-3 h-3 text-purple-400" />
              <span className="font-medium text-[11px]">关阀 boff</span>
            </div>
            <div className="mt-1 font-mono font-semibold text-slate-200 text-xs">
              {data.boff}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
