import React, { useState } from 'react';
import { 
  X, 
  Power, 
  Thermometer, 
  Droplets, 
  Zap, 
  RotateCcw, 
  Heart, 
  Copy, 
  Check, 
  Send,
  Code2,
  TrendingUp,
  Clock
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { DeviceInfo } from '../types';

interface DeviceDetailModalProps {
  device: DeviceInfo | null;
  onClose: () => void;
  onControl: (mac: string, action: 'ON' | 'OF') => Promise<void>;
  onCustomSend: (mac: string, command: string) => Promise<void>;
}

export function DeviceDetailModal({
  device,
  onClose,
  onControl,
  onCustomSend,
}: DeviceDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'chart' | 'json' | 'commands'>('chart');
  const [copied, setCopied] = useState(false);
  const [customCmd, setCustomCmd] = useState('');
  const [isSending, setIsSending] = useState(false);

  if (!device) return null;

  const { mac, data, history, lastUpdated, online } = device;
  const isValveOpen = Number(data.valveStatus) === 1;

  const handleCopyJson = () => {
    const rawObject = {
      mac,
      [mac]: data,
    };
    navigator.clipboard.writeText(JSON.stringify(rawObject, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCmd.trim()) return;
    setIsSending(true);
    try {
      await onCustomSend(mac, customCmd.trim());
      setCustomCmd('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        id="device-detail-modal"
        className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isValveOpen ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
            }`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {device.name || `ESP32-${mac.slice(-4).toUpperCase()}`}
                </h2>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                  online ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800' : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {online ? '在线' : '离线'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                <span>MAC: {mac}</span>
                <span>•</span>
                <span>更新于: {new Date(lastUpdated).toLocaleTimeString()}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action Bar in modal */}
        <div className="px-5 py-3 bg-slate-950/30 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">阀门快速控制:</span>
            <button
              onClick={() => onControl(mac, 'ON')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                isValveOpen
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-emerald-600 hover:text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              开 (ON) - 发送 {mac}-ON
            </button>
            <button
              onClick={() => onControl(mac, 'OF')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                !isValveOpen
                  ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-rose-600 hover:text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              关 (OF) - 发送 {mac}-OF
            </button>
          </div>

          {/* Navigation tabs */}
          <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              onClick={() => setActiveTab('chart')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'chart' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              趋势图表
            </button>
            <button
              onClick={() => setActiveTab('json')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'json' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              原始报文 (JSON)
            </button>
            <button
              onClick={() => setActiveTab('commands')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'commands' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              指令调试
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Key Metrics row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                当前温度
              </span>
              <div className="text-2xl font-bold text-white mt-1">
                {data.temp} <span className="text-sm text-rose-300 font-normal">℃</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                当前湿度
              </span>
              <div className="text-2xl font-bold text-white mt-1">
                {data.humi} <span className="text-sm text-cyan-300 font-normal">%</span>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                开启时长
              </span>
              <div className="text-2xl font-bold text-white mt-1">
                {data.onSecs} <span className="text-sm text-slate-400 font-normal">秒</span>
              </div>
              <span className="text-[11px] text-slate-500">累计动作 {data.onTimes} 次</span>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                心跳 Tick
              </span>
              <div className="text-lg font-mono font-bold text-white mt-1 truncate">
                {data.tick.toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-500">复位次数: {data.bootupTimes} 次</span>
            </div>
          </div>

          {/* Tab 1: Chart */}
          {activeTab === 'chart' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  温湿度实时历史曲线 ({history.length} 个数据点)
                </h4>
                <span className="text-xs text-slate-500">自动随 MQTT 上报追加</span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 h-64 sm:h-72">
                {history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="timeStr" stroke="#94a3b8" fontSize={11} tickMargin={5} />
                      <YAxis stroke="#94a3b8" fontSize={11} domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                      <Line 
                        type="monotone" 
                        dataKey="temp" 
                        name="温度 (℃)" 
                        stroke="#f43f5e" 
                        strokeWidth={2.5} 
                        dot={{ r: 3 }} 
                        activeDot={{ r: 6 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="humi" 
                        name="湿度 (%)" 
                        stroke="#06b6d4" 
                        strokeWidth={2.5} 
                        dot={{ r: 3 }} 
                        activeDot={{ r: 6 }} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                    暂无历史数据点
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Raw JSON */}
          {activeTab === 'json' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  Payload: {`{ "mac": "${mac}", "${mac}": { ... } }`}
                </span>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded border border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '已复制' : '复制 JSON'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-emerald-300 font-mono overflow-x-auto leading-relaxed">
                {JSON.stringify(
                  {
                    mac,
                    [mac]: data,
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}

          {/* Tab 3: Command Test */}
          {activeTab === 'commands' && (
            <div className="space-y-4">
              <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-semibold text-white">指定指令发布</h4>
                <p className="text-xs text-slate-400">
                  按照协议，开电磁阀发送 <code className="text-cyan-400 font-mono">{mac}-ON</code>，
                  关电磁阀发送 <code className="text-rose-400 font-mono">{mac}-OF</code>。
                  也可以输入其他自定义指令直接发送至 MQTT 主题：
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onControl(mac, 'ON')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-bold"
                  >
                    发送 {mac}-ON
                  </button>
                  <button
                    onClick={() => onControl(mac, 'OF')}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-bold"
                  >
                    发送 {mac}-OF
                  </button>
                </div>

                <form onSubmit={handleCustomSubmit} className="flex gap-2 pt-2 border-t border-slate-800">
                  <input
                    type="text"
                    value={customCmd}
                    onChange={(e) => setCustomCmd(e.target.value)}
                    placeholder={`自定义指令 (例如: ${mac}-ON 或 GET_STATUS)`}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !customCmd.trim()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    发送
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Full telemetry table */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              全部字段参数详情
            </h4>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-2.5 font-medium">字段 Key</th>
                    <th className="p-2.5 font-medium">字段描述</th>
                    <th className="p-2.5 font-medium">当前数值</th>
                    <th className="p-2.5 font-medium">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  <tr>
                    <td className="p-2.5 text-cyan-300">temp</td>
                    <td className="p-2.5 text-slate-300 font-sans">当前环境温度</td>
                    <td className="p-2.5 text-white font-bold">{data.temp} ℃</td>
                    <td className="p-2.5 text-slate-400 font-sans">摄氏度</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-cyan-300">humi</td>
                    <td className="p-2.5 text-slate-300 font-sans">当前环境湿度</td>
                    <td className="p-2.5 text-white font-bold">{data.humi} %</td>
                    <td className="p-2.5 text-slate-400 font-sans">相对湿度 %RH</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-cyan-300">valveStatus</td>
                    <td className="p-2.5 text-slate-300 font-sans">电磁阀状态</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        isValveOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {data.valveStatus} ({isValveOpen ? '已开启' : '已关闭'})
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-400 font-sans">0=关闭, 1=开启</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-cyan-300">bootupTimes</td>
                    <td className="p-2.5 text-slate-300 font-sans">设备启动次数</td>
                    <td className="p-2.5 text-white">{data.bootupTimes}</td>
                    <td className="p-2.5 text-slate-400 font-sans">累计重启/上电复位次数</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-cyan-300">tick</td>
                    <td className="p-2.5 text-slate-300 font-sans">心跳计数 / 时钟</td>
                    <td className="p-2.5 text-white">{data.tick}</td>
                    <td className="p-2.5 text-slate-400 font-sans">ESP32 运行时钟周期/心跳</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-cyan-300">onSecs</td>
                    <td className="p-2.5 text-slate-300 font-sans">阀门开启时长</td>
                    <td className="p-2.5 text-white">{data.onSecs} 秒</td>
                    <td className="p-2.5 text-slate-400 font-sans">开阀累计工作秒数</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-cyan-300">onTimes</td>
                    <td className="p-2.5 text-slate-300 font-sans">开阀动作次数</td>
                    <td className="p-2.5 text-white">{data.onTimes}</td>
                    <td className="p-2.5 text-slate-400 font-sans">电磁阀动作开关总计数</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-cyan-300">bon</td>
                    <td className="p-2.5 text-slate-300 font-sans">开阀参数</td>
                    <td className="p-2.5 text-white">{data.bon}</td>
                    <td className="p-2.5 text-slate-400 font-sans">控制逻辑 bon 阈值/标志</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-cyan-300">boff</td>
                    <td className="p-2.5 text-slate-300 font-sans">关阀参数</td>
                    <td className="p-2.5 text-white">{data.boff}</td>
                    <td className="p-2.5 text-slate-400 font-sans">控制逻辑 boff 阈值/标志</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
