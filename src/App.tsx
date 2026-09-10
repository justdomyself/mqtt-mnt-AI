import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Server, 
  Search, 
  SlidersHorizontal, 
  Power, 
  RefreshCw, 
  Radio, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  Plus, 
  Zap,
  Activity,
  Layers,
  Thermometer,
  Droplets,
  Terminal,
  ShieldCheck,
  Globe,
  Play,
  Pause,
  Clock,
  Sparkles,
  Code2,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { DeviceInfo, MqttStatus, MessageLog } from './types';
import { MqttHeader } from './components/MqttHeader';
import { DeviceCard } from './components/DeviceCard';
import { DeviceDetailModal } from './components/DeviceDetailModal';
import { MessageLogPanel } from './components/MessageLogPanel';
import { BrokerConfigModal } from './components/BrokerConfigModal';
import { AddDeviceModal } from './components/AddDeviceModal';
import { InstallAppModal } from './components/InstallAppModal';
import { BrowserMqttManager } from './lib/browserMqtt';

interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'error';
  title: string;
  detail?: string;
}

export default function App() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>({
    connected: false,
    connecting: true,
    broker: 'mqtt://www.lxlee.top:1883',
    topic: '/esp32/mnt',
    messageCount: 0,
    lastMessageAt: null,
    lastError: null,
    mode: 'server',
  });
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [isBrowserMode, setIsBrowserMode] = useState<boolean>(false);
  const browserMqttRef = useRef<BrowserMqttManager | null>(null);
  
  // UI state
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'online' | 'valve_on' | 'valve_off'>('all');
  const [isAutoSimulating, setIsAutoSimulating] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isInstallOpen, setIsInstallOpen] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Catch PWA native installation event (Android Chrome / Edge)
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Add toast helper
  const addToast = (type: 'success' | 'info' | 'error', title: string, detail?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, title, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Fetch full state from backend (for server mode)
  const fetchInitialData = useCallback(async () => {
    try {
      const [statusRes, devicesRes, logsRes] = await Promise.all([
        fetch('/api/mqtt/status'),
        fetch('/api/devices'),
        fetch('/api/logs'),
      ]);

      if (statusRes.ok) {
        const s = await statusRes.json();
        setMqttStatus((prev) => ({ ...prev, ...s, mode: 'server' }));
      }
      if (devicesRes.ok) {
        const d = await devicesRes.json();
        setDevices(d.devices || []);
      }
      if (logsRes.ok) {
        const l = await logsRes.json();
        setLogs(l.logs || []);
      }
    } catch (e) {
      console.warn('Error fetching initial MQTT state:', e);
    }
  }, []);

  // Dual-mode initialization: Automatically detects if running on fullstack Node.js or static hosting (Netlify/Vercel)
  useEffect(() => {
    let isMounted = true;
    let eventSource: EventSource | null = null;
    let pollTimer: any = null;

    async function detectEnvironmentAndInit() {
      let hasBackend = false;
      try {
        const ping = await fetch('/api/health', {
          method: 'GET',
          signal: AbortSignal.timeout(2000),
        });
        if (ping.ok) {
          const data = await ping.json();
          if (data && data.status === 'ok') {
            hasBackend = true;
          }
        }
      } catch {
        hasBackend = false;
      }

      if (!isMounted) return;

      if (hasBackend) {
        // Fullstack mode (Server running with Express + Node MQTT)
        setIsBrowserMode(false);
        fetchInitialData();

        try {
          eventSource = new EventSource('/api/stream');

          eventSource.addEventListener('init', (e) => {
            try {
              const payload = JSON.parse(e.data);
              if (payload.status) setMqttStatus({ ...payload.status, mode: 'server' });
              if (payload.devices) setDevices(payload.devices);
              if (payload.logs) setLogs(payload.logs);
            } catch (err) {
              console.error('Error parsing SSE init payload', err);
            }
          });

          eventSource.addEventListener('status', (e) => {
            try {
              const s = JSON.parse(e.data);
              setMqttStatus({ ...s, mode: 'server' });
            } catch (err) {
              console.error('Error parsing SSE status payload', err);
            }
          });

          eventSource.addEventListener('device_update', (e) => {
            try {
              const dev: DeviceInfo = JSON.parse(e.data);
              setDevices((prev) => {
                const idx = prev.findIndex((d) => d.mac === dev.mac);
                if (idx >= 0) {
                  const updated = [...prev];
                  updated[idx] = dev;
                  return updated;
                } else {
                  return [dev, ...prev];
                }
              });
              setSelectedDevice((curr) => (curr && curr.mac === dev.mac ? dev : curr));
            } catch (err) {
              console.error('Error parsing SSE device_update', err);
            }
          });

          eventSource.addEventListener('device_removed', (e) => {
            try {
              const { mac } = JSON.parse(e.data);
              setDevices((prev) => prev.filter((d) => d.mac !== mac));
              setSelectedDevice((curr) => (curr && curr.mac === mac ? null : curr));
            } catch (err) {
              console.error('Error parsing SSE device_removed', err);
            }
          });

          eventSource.addEventListener('log', (e) => {
            try {
              const logItem: MessageLog = JSON.parse(e.data);
              setLogs((prev) => [logItem, ...prev.slice(0, 199)]);
            } catch (err) {
              console.error('Error parsing SSE log item', err);
            }
          });

          eventSource.addEventListener('clear_logs', () => {
            setLogs([]);
          });

          eventSource.onerror = () => {
            // Reconnect handled automatically by EventSource
          };
        } catch (err) {
          console.warn('SSE connection failed:', err);
        }

        pollTimer = setInterval(fetchInitialData, 8000);
      } else {
        // Static Hosting Mode (Netlify, Vercel, GitHub Pages) -> Browser Direct MQTT (WSS / WS)
        setIsBrowserMode(true);
        const mgr = new BrowserMqttManager({
          defaultTopic: '/esp32/mnt',
          onStatusChange: (s) => setMqttStatus(s),
          onDeviceUpdate: (dev) => {
            setDevices((prev) => {
              const idx = prev.findIndex((d) => d.mac === dev.mac);
              if (idx >= 0) {
                const updated = [...prev];
                updated[idx] = dev;
                return updated;
              } else {
                return [dev, ...prev];
              }
            });
            setSelectedDevice((curr) => (curr && curr.mac === dev.mac ? dev : curr));
          },
          onLog: (item) => {
            setLogs((prev) => [item, ...prev.slice(0, 199)]);
          },
        });

        browserMqttRef.current = mgr;
        setDevices(mgr.getDevices());
        mgr.connect();
      }
    }

    detectEnvironmentAndInit();

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
      if (pollTimer) clearInterval(pollTimer);
      if (browserMqttRef.current) {
        browserMqttRef.current.disconnect();
        browserMqttRef.current = null;
      }
    };
  }, [fetchInitialData]);

  // Command handler: ON (fc012c2db628-ON) / OF (fc012c2db628-OF)
  const handleControlDevice = async (mac: string, action: 'ON' | 'OF') => {
    const commandStr = `${mac}-${action}`;

    if (isBrowserMode && browserMqttRef.current) {
      try {
        await browserMqttRef.current.publishCommand(mac, action);
        addToast(
          'success',
          `已发送控制指令: ${commandStr}`,
          `[浏览器直连 WSS] 目标主题: ${mqttStatus.topic}`
        );
      } catch (err: any) {
        addToast('error', `发送失败: ${commandStr}`, err?.message || '直连发布超时');
      }
      return;
    }

    try {
      const res = await fetch(`/api/devices/${mac}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (res.ok) {
        addToast(
          'success',
          `已发送控制指令: ${commandStr}`,
          `目标主题: ${mqttStatus.topic}`
        );
      } else {
        addToast('error', `发送失败: ${commandStr}`, data.error || '未知错误');
      }
    } catch (e: any) {
      addToast('error', `网络请求失败`, e.message);
    }
  };

  // Custom command send from modal
  const handleCustomCommand = async (mac: string, command: string) => {
    if (isBrowserMode && browserMqttRef.current) {
      try {
        const action = command.endsWith('-ON') ? 'ON' : 'OF';
        await browserMqttRef.current.publishCommand(mac, action);
        addToast('success', `已发送指令 (WSS直连)`, command);
      } catch (e: any) {
        addToast('error', '发送失败', e.message);
      }
      return;
    }

    try {
      const res = await fetch(`/api/devices/${mac}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: command.endsWith('-ON') ? 'ON' : 'OF', customCommand: command }),
      });
      if (res.ok) {
        addToast('success', `已发送自定义指令`, command);
      } else {
        addToast('error', `发送失败`, command);
      }
    } catch (e: any) {
      addToast('error', '发送异常', e.message);
    }
  };

  // Update device nickname
  const handleUpdateNickname = async (mac: string, name: string) => {
    if (isBrowserMode && browserMqttRef.current) {
      browserMqttRef.current.updateDeviceName(mac, name);
      addToast('info', '已更新设备备注');
      return;
    }

    try {
      const res = await fetch(`/api/devices/${mac}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        addToast('info', '已更新设备名称', name);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  // Simulate data payload
  const handleSimulatePayload = async (customPayload?: any) => {
    if (isBrowserMode && browserMqttRef.current) {
      const payload = customPayload || {
        mac: 'fc012c2db628',
        fc012c2db628: {
          temp: Number((26 + Math.random() * 6).toFixed(1)),
          humi: Number((50 + Math.random() * 15).toFixed(1)),
          bootupTimes: 4,
          tick: 1552662 + Math.floor(Math.random() * 10000),
          bon: 11,
          boff: 15,
          onSecs: 244 + Math.floor(Math.random() * 50),
          onTimes: 11,
          valveStatus: Math.random() > 0.5 ? 1 : 0,
        },
      };
      (browserMqttRef.current as any).handleMessage(mqttStatus.topic, JSON.stringify(payload));
      addToast('success', '已模拟 ESP32 数据上报', `MAC: ${payload.mac}`);
      return;
    }

    try {
      const res = await fetch('/api/devices/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customPayload || {}),
      });
      const resData = await res.json();
      if (res.ok) {
        addToast('success', '已模拟 ESP32 数据上报', `MAC: ${resData.payload?.mac}`);
      }
    } catch (e: any) {
      addToast('error', '模拟失败', e.message);
    }
  };

  // Add another simulated test device
  const handleAddSimulatedDevice = async () => {
    const randomHex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    const newMac = `fc012c${randomHex}`;
    const payload = {
      mac: newMac,
      [newMac]: {
        temp: Number((24 + Math.random() * 8).toFixed(1)),
        humi: Number((45 + Math.random() * 20).toFixed(1)),
        bootupTimes: Math.floor(Math.random() * 10) + 1,
        tick: Math.floor(Math.random() * 2000000),
        bon: 10 + Math.floor(Math.random() * 5),
        boff: 12 + Math.floor(Math.random() * 5),
        onSecs: Math.floor(Math.random() * 500),
        onTimes: Math.floor(Math.random() * 30),
        valveStatus: Math.random() > 0.5 ? 1 : 0,
      },
    };
    await handleSimulatePayload(payload);
  };

  // Simulate specific device update
  const handleSimulateSpecificDevice = (targetMac: string) => {
    const currentDev = devices.find(d => d.mac === targetMac);
    const prevData = currentDev?.data;
    const payload = {
      mac: targetMac,
      [targetMac]: {
        temp: Number(((prevData ? prevData.temp : 26) + (Math.random() * 1.6 - 0.8)).toFixed(1)),
        humi: Number(((prevData ? prevData.humi : 52) + (Math.random() * 2 - 1)).toFixed(1)),
        bootupTimes: prevData ? prevData.bootupTimes : 4,
        tick: (prevData ? prevData.tick : 1552662) + Math.floor(Math.random() * 120) + 1,
        bon: prevData ? prevData.bon : 11,
        boff: prevData ? prevData.boff : 15,
        onSecs: (prevData ? prevData.onSecs : 244) + 5,
        onTimes: prevData ? prevData.onTimes : 11,
        valveStatus: prevData ? (prevData.valveStatus === 1 ? 0 : 1) : 1,
      },
    };
    handleSimulatePayload(payload);
  };

  // Continuous auto simulation stream (every 3s)
  useEffect(() => {
    if (!isAutoSimulating) return;
    const interval = setInterval(() => {
      const devList = devices.length > 0 ? devices : [{ mac: 'fc012c2db628', data: {} as any }];
      const chosen = devList[Math.floor(Math.random() * devList.length)];
      const targetMac = chosen.mac;
      const prevData = (chosen as any).data;

      const payload = {
        mac: targetMac,
        [targetMac]: {
          temp: Number(((prevData?.temp ?? 26) + (Math.random() * 0.8 - 0.4)).toFixed(1)),
          humi: Number(((prevData?.humi ?? 52) + (Math.random() * 1.2 - 0.6)).toFixed(1)),
          bootupTimes: prevData?.bootupTimes ?? 4,
          tick: (prevData?.tick ?? 1552662) + Math.floor(Math.random() * 50) + 1,
          bon: prevData?.bon ?? 11,
          boff: prevData?.boff ?? 15,
          onSecs: (prevData?.onSecs ?? 244) + 3,
          onTimes: prevData?.onTimes ?? 11,
          valveStatus: prevData?.valveStatus ?? 0,
        },
      };
      handleSimulatePayload(payload);
    }, 3000);

    return () => clearInterval(interval);
  }, [isAutoSimulating, devices]);

  // Update MQTT config
  const handleUpdateConfig = async (broker: string, topic: string) => {
    if (isBrowserMode && browserMqttRef.current) {
      browserMqttRef.current.connect(broker, topic);
      addToast('info', '已更新 MQTT 直连参数', `Broker: ${broker}, 主题: ${topic}`);
      return;
    }

    try {
      const res = await fetch('/api/mqtt/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker, topic }),
      });
      if (res.ok) {
        addToast('info', '已更新 MQTT 参数', `Broker: ${broker}, 主题: ${topic}`);
      }
    } catch (e: any) {
      addToast('error', '更新失败', e.message);
    }
  };

  // Add custom device
  const handleAddCustomDevice = async (mac: string, name?: string) => {
    if (isBrowserMode && browserMqttRef.current) {
      browserMqttRef.current.addDevice(mac, name);
      setDevices(browserMqttRef.current.getDevices());
      addToast('success', '已登记设备 (本地持久化)', `MAC: ${mac}`);
      return;
    }

    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '添加失败');
      }
      addToast('success', '已成功添加/登记设备', `MAC: ${mac}`);
      await fetchInitialData();
    } catch (e: any) {
      addToast('error', '添加失败', e.message);
      throw e;
    }
  };

  // Clear logs
  const handleClearLogs = async () => {
    if (isBrowserMode) {
      setLogs([]);
      addToast('info', '已清空报文日志');
      return;
    }

    try {
      await fetch('/api/logs', { method: 'DELETE' });
      setLogs([]);
      addToast('info', '已清空报文日志');
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered devices
  const filteredDevices = devices.filter((dev) => {
    const isOnline = Date.now() - dev.lastUpdated < 60000;
    const isValveOpen = Number(dev.data.valveStatus) === 1;

    if (filterMode === 'online' && !isOnline) return false;
    if (filterMode === 'valve_on' && !isValveOpen) return false;
    if (filterMode === 'valve_off' && isValveOpen) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchMac = dev.mac.toLowerCase().includes(q);
      const matchName = (dev.name || '').toLowerCase().includes(q);
      return matchMac || matchName;
    }
    return true;
  });

  const onlineCount = devices.filter((d) => Date.now() - d.lastUpdated < 60000).length;
  const valveOpenCount = devices.filter((d) => Number(d.data.valveStatus) === 1).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-cyan-500 selection:text-white">
      
      {/* Toast Notifications */}
      <div className="fixed top-16 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-xl shadow-xl border text-xs backdrop-blur-md animate-in slide-in-from-top-2 duration-200 max-w-sm ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <Radio className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold">{toast.title}</p>
              {toast.detail && <p className="text-[11px] opacity-80 mt-0.5 font-mono">{toast.detail}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Main Top Header */}
      <MqttHeader
        status={mqttStatus}
        deviceCount={devices.length}
        onlineCount={onlineCount}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleLogs={() => setIsLogsOpen(!isLogsOpen)}
        isLogsOpen={isLogsOpen}
        onSimulateMessage={() => handleSimulatePayload()}
        onAddSimulatedDevice={handleAddSimulatedDevice}
        onOpenInstallModal={() => setIsInstallOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Statistics & Overview Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>已发现设备总数</span>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {devices.length} <span className="text-xs text-slate-500 font-normal">台</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>在线: {onlineCount} 台</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>电磁阀开启数量</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">
              {valveOpenCount} <span className="text-xs text-slate-500 font-normal">台开启</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              占全网设备的 {devices.length > 0 ? Math.round((valveOpenCount / devices.length) * 100) : 0}%
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>平均监测温度</span>
              <Thermometer className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {devices.length > 0
                ? (devices.reduce((acc, cur) => acc + (cur.data.temp || 0), 0) / devices.length).toFixed(1)
                : '--'}
              <span className="text-xs text-rose-300 font-normal ml-1">℃</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              各 ESP32 传感器实时均值
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>平均监测湿度</span>
              <Droplets className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {devices.length > 0
                ? (devices.reduce((acc, cur) => acc + (cur.data.humi || 0), 0) / devices.length).toFixed(1)
                : '--'}
              <span className="text-xs text-cyan-300 font-normal ml-1">%</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              相对湿度均值
            </div>
          </div>

        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
          
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-mac"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="按 12位 MAC 地址或设备名称搜索 (如 fc012c...)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              id="filter-all"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                filterMode === 'all'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              全部 ({devices.length})
            </button>
            <button
              id="filter-online"
              onClick={() => setFilterMode('online')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                filterMode === 'online'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              在线 ({onlineCount})
            </button>
            <button
              id="filter-valve-on"
              onClick={() => setFilterMode('valve_on')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                filterMode === 'valve_on'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              阀门已开启 ({valveOpenCount})
            </button>
            <button
              id="filter-valve-off"
              onClick={() => setFilterMode('valve_off')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                filterMode === 'valve_off'
                  ? 'bg-rose-700 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              阀门已关闭 ({devices.length - valveOpenCount})
            </button>

            {/* Quick Add Device Button */}
            <button
              id="btn-add-device"
              onClick={() => setIsAddDeviceOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-cyan-950/40 flex items-center gap-1.5 shrink-0 ml-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加设备 MAC</span>
            </button>
          </div>

        </div>

        {/* Netlify / Browser WSS Self-Signed Certificate Guide */}
        {isBrowserMode && !mqttStatus.connected && (
          <div className="mb-6 bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-500/50 rounded-2xl p-4 sm:p-5 text-amber-200 shadow-xl shadow-amber-950/30 animate-in fade-in duration-200">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-2.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-bold text-sm text-amber-300 flex items-center gap-2">
                    <span>为什么一直显示【正在连接...】？</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      浏览器安全策略限制
                    </span>
                  </h3>
                </div>
                <p className="text-amber-100/90 leading-relaxed">
                  检测到您当前在 Netlify (HTTPS 网站) 运行。网页正尝试直连 <code className="bg-slate-950 px-1.5 py-0.5 rounded font-mono text-cyan-300 border border-slate-800">wss://www.lxlee.top:8084/mqtt</code>。
                  经服务器证书检测：您的 EMQX 8084 端口使用的是 <strong>默认自签名测试证书</strong>（CN: localhost）。现代浏览器出于安全规范，会<strong>静默拦截</strong>未经受信的自签名 WSS 连接。
                </p>

                <div className="p-3.5 bg-slate-950/90 rounded-xl border border-amber-600/30 space-y-2 text-slate-300">
                  <p className="font-bold text-white flex items-center gap-1.5 text-xs">
                    <span>⚡ 1 步快速解决（点击一次信任证书即可永久直连）：</span>
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <a
                      href="https://www.lxlee.top:8084"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl transition-all shadow-md active:scale-95 text-xs shrink-0"
                    >
                      <span>第 1 步：在新标签页打开 8084 端口信任证书</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <span className="text-[11px] text-slate-400 leading-tight">
                      在新打开的页面上，点击【<strong>高级</strong>】→【<strong>继续前往 www.lxlee.top (不安全)</strong>】
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-400 font-medium">
                    ✓ 第 2 步：信任完毕后，回到本页面<strong>按 F5 刷新</strong>，WSS 即可瞬间连接并开始接收真实 ESP32 报文！
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Data Stream & Monitoring Status Banner */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-300">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${mqttStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="font-semibold text-white">MQTT 实时监控:</span>
              <span className="text-slate-400">
                {mqttStatus.connected ? (isBrowserMode ? '浏览器 WSS 直连监听中' : '服务端 TCP 长连接监听中') : '正在连接 Broker...'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400 font-mono">
              <span>主题:</span>
              <code className="text-cyan-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-[11px]">
                {mqttStatus.topic} (已通配 /esp32/# 及 esp32/mnt)
              </code>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>最新报文:</span>
              <span className="font-mono text-cyan-300 font-medium">
                {mqttStatus.lastMessageAt ? new Date(mqttStatus.lastMessageAt).toLocaleTimeString() : '等待硬件上报...'}
              </span>
              <span className="text-slate-500">
                (已接收 {mqttStatus.messageCount} 条)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAutoSimulating(!isAutoSimulating)}
              className={`px-3 py-1.5 rounded-xl font-medium text-xs transition-all flex items-center gap-1.5 shadow-sm ${
                isAutoSimulating
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/40 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="每 3 秒自动模拟产生一条 ESP32 遥测报文并推送刷新"
            >
              {isAutoSimulating ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-white" />
                  <span>暂停动态数据流 (3秒/次)</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>开启动态数据流 (3秒/次)</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleSimulatePayload()}
              className="px-3 py-1.5 bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/80 font-medium text-xs rounded-xl transition-colors flex items-center gap-1.5"
              title="模拟上报一条 fc012c2db628 设备的最新遥测数据"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>模拟推送 1 条</span>
            </button>
          </div>
        </div>

        {/* Device Cards Grid */}
        {filteredDevices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
            {filteredDevices.map((device) => (
              <DeviceCard
                key={device.mac}
                device={device}
                onControl={handleControlDevice}
                onViewDetails={(dev) => setSelectedDevice(dev)}
                onUpdateNickname={handleUpdateNickname}
                onSimulateThisDevice={(mac) => handleSimulateSpecificDevice(mac)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
              <Cpu className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-base font-bold text-white">暂未发现匹配的 ESP32 设备</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                正在监听主题 <code className="text-cyan-400 font-mono">{mqttStatus.topic}</code>。
                当 ESP32 发布其 12 位 MAC 与传感器遥测 JSON 时，卡片将自动实时呈现在此处。
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => handleSimulatePayload()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-cyan-950/40 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>立即模拟上报数据 (fc012c2db628)</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Footer information */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            ESP32 MQTT 智能监控控制系统 • 协议约定：开发送 <code>[MAC]-ON</code>，关发送 <code>[MAC]-OF</code>
          </p>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <span>Broker: {mqttStatus.broker}</span>
            <span>•</span>
            <span>Topic: {mqttStatus.topic}</span>
          </div>
        </div>
      </footer>

      {/* Modals & Panels */}
      <DeviceDetailModal
        device={selectedDevice}
        onClose={() => setSelectedDevice(null)}
        onControl={handleControlDevice}
        onCustomSend={handleCustomCommand}
      />

      <BrokerConfigModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        status={mqttStatus}
        onUpdateConfig={handleUpdateConfig}
        onSimulatePayload={handleSimulatePayload}
      />

      <MessageLogPanel
        logs={logs}
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        onClearLogs={handleClearLogs}
      />

      <AddDeviceModal
        isOpen={isAddDeviceOpen}
        onClose={() => setIsAddDeviceOpen(false)}
        onAdd={handleAddCustomDevice}
      />

      <InstallAppModal
        isOpen={isInstallOpen}
        onClose={() => setIsInstallOpen(false)}
        deferredPrompt={deferredPrompt}
        onInstallPromptSuccess={() => {
          setDeferredPrompt(null);
          addToast('success', '已添加到手机桌面！', '您可以像使用独立手机App一样随时打开');
        }}
      />

    </div>
  );
}
