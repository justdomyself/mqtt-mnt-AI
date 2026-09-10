import React, { useState } from 'react';
import { X, Server, RefreshCw, Check, AlertTriangle, Play, HelpCircle } from 'lucide-react';
import { MqttStatus } from '../types';

interface BrokerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: MqttStatus;
  onUpdateConfig: (broker: string, topic: string) => Promise<void>;
  onSimulatePayload: (payloadJson?: any) => Promise<void>;
}

export function BrokerConfigModal({
  isOpen,
  onClose,
  status,
  onUpdateConfig,
  onSimulatePayload,
}: BrokerConfigModalProps) {
  const [broker, setBroker] = useState(status.broker);
  const [topic, setTopic] = useState(status.topic);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simMac, setSimMac] = useState('fc012c2db628');
  const [simTemp, setSimTemp] = useState('28.6');
  const [simHumi, setSimHumi] = useState('55.4');
  const [simValve, setSimValve] = useState<0 | 1>(0);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdateConfig(broker.trim(), topic.trim());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mac = simMac.trim().toLowerCase();
    const payload = {
      mac,
      [mac]: {
        temp: parseFloat(simTemp) || 28.6,
        humi: parseFloat(simHumi) || 55.4,
        bootupTimes: 4,
        tick: 1552662 + Math.floor(Math.random() * 500),
        bon: 11,
        boff: 15,
        onSecs: 244 + Math.floor(Math.random() * 50),
        onTimes: 11,
        valveStatus: simValve,
      },
    };
    await onSimulatePayload(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        id="broker-config-modal"
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">MQTT Broker 设置与调试</h2>
              <p className="text-xs text-slate-400">配置服务器连接与测试上报报文</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* Connection form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                MQTT 连接配置
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {status.mode === 'browser' ? '静态托管 (WSS直连)' : '服务端代理 (TCP)'}
              </span>
            </div>

            {/* Hosting platform deployment notice */}
            <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-3 text-xs text-blue-200/90 leading-relaxed">
              <p className="font-semibold text-blue-300 flex items-center gap-1.5 mb-1">
                <span>💡 托管平台 (如 Netlify / 静态网站) 连接说明:</span>
              </p>
              <p className="text-[11px] text-slate-300">
                浏览器因网页安全规范（HTTPS 混合内容与 TCP 限制）无法直接连 1883 裸端口，系统已自动启用 <strong>WSS 8084 安全 WebSocket 直连</strong>（<code className="text-cyan-300 font-mono">wss://www.lxlee.top:8084/mqtt</code>），无需后端即可实时收发。
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Broker 地址 (TCP 或 WebSocket)
              </label>
              <input
                type="text"
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                placeholder="wss://www.lxlee.top:8084/mqtt 或 mqtt://www.lxlee.top:1883"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-cyan-500"
                required
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setBroker('wss://www.lxlee.top:8084/mqtt')}
                  className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors"
                >
                  填入 WSS (Netlify/HTTPS): 8084
                </button>
                <button
                  type="button"
                  onClick={() => setBroker('mqtt://www.lxlee.top:1883')}
                  className="text-[11px] font-mono px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  填入 TCP (完整服务器): 1883
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                订阅的主题 (Topic)
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="/esp32/mnt"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white outline-none focus:border-cyan-500"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                默认订阅主题：<code>/esp32/mnt</code>（自动通配 <code>esp32/mnt</code>、<code>/esp32/#</code> 与 <code>esp32/#</code>）
              </p>
            </div>

            {status.lastError && (
              <div className="bg-rose-950/40 border border-rose-800/60 p-3 rounded-xl flex items-start gap-2 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">连接提示:</span> {status.lastError}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-cyan-950/40"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span>保存配置并重新连接</span>
            </button>
          </form>

          {/* Data Injector / Simulator */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                硬件数据模拟器 (离线/测试专用)
              </h3>
              <span className="text-[10px] text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800">
                符合题目 JSON 格式
              </span>
            </div>

            <p className="text-xs text-slate-400">
              如果实体 ESP32 当前未上电或网络受限，可使用模拟器一键上报符合用户协议的完整报文：
            </p>

            <form onSubmit={handleSimulateSubmit} className="space-y-3 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">12位 MAC</label>
                  <input
                    type="text"
                    value={simMac}
                    onChange={(e) => setSimMac(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 outline-none"
                    placeholder="fc012c2db628"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">电磁阀状态</label>
                  <select
                    value={simValve}
                    onChange={(e) => setSimValve(Number(e.target.value) as 0 | 1)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                  >
                    <option value={0}>0 (已关闭)</option>
                    <option value={1}>1 (已开启)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">温度 (℃)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={simTemp}
                    onChange={(e) => setSimTemp(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">湿度 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={simHumi}
                    onChange={(e) => setSimHumi(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>上报此模拟报文至系统</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
