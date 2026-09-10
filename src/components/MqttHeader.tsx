import { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, Radio, Terminal, Plus, Settings2, ShieldCheck, Activity } from 'lucide-react';
import { MqttStatus } from '../types';

interface MqttHeaderProps {
  status: MqttStatus;
  deviceCount: number;
  onlineCount: number;
  onOpenSettings: () => void;
  onToggleLogs: () => void;
  isLogsOpen: boolean;
  onSimulateMessage: () => void;
  onAddSimulatedDevice: () => void;
}

export function MqttHeader({
  status,
  deviceCount,
  onlineCount,
  onOpenSettings,
  onToggleLogs,
  isLogsOpen,
  onSimulateMessage,
  onAddSimulatedDevice,
}: MqttHeaderProps) {
  const [simulating, setSimulating] = useState(false);

  const handleQuickSimulate = async () => {
    setSimulating(true);
    await onSimulateMessage();
    setTimeout(() => setSimulating(false), 500);
  };

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Radio className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">ESP32 MQTT 设备监控中心</h1>
                <span className="text-[11px] font-medium bg-cyan-950 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                  v1.0
                </span>
                {status.mode === 'browser' ? (
                  <span className="text-[10px] font-medium bg-blue-950 text-blue-300 border border-blue-700/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    WSS 前端直连
                  </span>
                ) : (
                  <span className="text-[10px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    服务端代理
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span>Broker:</span>
                <code className="text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  {status.broker.replace('mqtt://', '')}
                </code>
                <span className="text-slate-500">•</span>
                <span>主题:</span>
                <code className="text-cyan-300 bg-cyan-950/60 border border-cyan-900/50 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  {status.topic}
                </code>
              </p>
            </div>
          </div>

          {/* MQTT Connection Status Pill */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Status indicator */}
            <div
              id="mqtt-connection-status-pill"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium backdrop-blur-sm transition-colors ${
                status.connected
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : status.connecting
                  ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
              }`}
            >
              {status.connected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>已连接</span>
                </>
              ) : status.connecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>正在连接...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>已断开 / 重试中</span>
                </>
              )}
              <span className="text-slate-500">|</span>
              <span className="text-slate-300">收包: {status.messageCount}</span>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-1.5">
              <button
                id="btn-simulate-payload"
                onClick={handleQuickSimulate}
                disabled={simulating}
                title="模拟ESP32上报数据（符合用户提供JSON格式）"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg transition-all"
              >
                <Activity className={`w-3.5 h-3.5 text-cyan-400 ${simulating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">模拟数据上报</span>
              </button>

              <button
                id="btn-add-sim-device"
                onClick={onAddSimulatedDevice}
                title="添加新测试设备MAC"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-lg transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">添加测试设备</span>
              </button>

              <button
                id="btn-toggle-logs"
                onClick={onToggleLogs}
                title="查看 MQTT 实时收发报文日志"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  isLogsOpen
                    ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">报文日志</span>
              </button>

              <button
                id="btn-open-settings"
                onClick={onOpenSettings}
                title="配置 MQTT 服务器与主题"
                className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
