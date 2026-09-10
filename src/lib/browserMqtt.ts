import mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';
import { DeviceInfo, MessageLog, MqttStatus, TelemetryData } from '../types';

export class BrowserMqttManager {
  private client: MqttClient | null = null;
  private brokerUrl: string;
  private currentTopic: string;
  private onStatusChange: (status: MqttStatus) => void;
  private onDeviceUpdate: (device: DeviceInfo) => void;
  private onLog: (log: MessageLog) => void;
  private messageCount = 0;
  private lastMessageAt: number | null = null;
  private lastError: string | null = null;
  private devicesMap: Map<string, DeviceInfo> = new Map();

  constructor(
    options: {
      onStatusChange: (status: MqttStatus) => void;
      onDeviceUpdate: (device: DeviceInfo) => void;
      onLog: (log: MessageLog) => void;
      defaultTopic?: string;
    }
  ) {
    this.onStatusChange = options.onStatusChange;
    this.onDeviceUpdate = options.onDeviceUpdate;
    this.onLog = options.onLog;
    this.currentTopic = options.defaultTopic || '/esp32/mnt';

    // In browser, if page is served over HTTPS (e.g. Netlify), must use WSS port 8084
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    this.brokerUrl = isHttps 
      ? 'wss://www.lxlee.top:8084/mqtt' 
      : 'ws://www.lxlee.top:8083/mqtt';

    // Load initial devices from localStorage or initial seed
    this.initInitialDevices();
  }

  private initInitialDevices() {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('esp32_stored_devices') : null;
    if (saved) {
      try {
        const parsed: DeviceInfo[] = JSON.parse(saved);
        parsed.forEach(d => this.devicesMap.set(d.mac, d));
      } catch (e) {
        console.warn('Failed to parse saved devices from localStorage', e);
      }
    }

    // Always ensure initial default devices: fc012c2db628 & 3c8427c81f04
    if (!this.devicesMap.has('fc012c2db628')) {
      const now = Date.now();
      const dev1: DeviceInfo = {
        mac: 'fc012c2db628',
        name: 'ESP32-B628',
        data: {
          temp: 28.6,
          humi: 55.4,
          bootupTimes: 4,
          tick: 1552662,
          bon: 11,
          boff: 15,
          onSecs: 244,
          onTimes: 11,
          valveStatus: 0,
        },
        lastUpdated: now,
        history: [{
          timestamp: now,
          timeStr: new Date(now).toLocaleTimeString('zh-CN', { hour12: false }),
          temp: 28.6,
          humi: 55.4,
          valveStatus: 0,
        }],
        online: true,
        totalReceived: 1,
      };
      this.devicesMap.set('fc012c2db628', dev1);
    }

    if (!this.devicesMap.has('3c8427c81f04')) {
      const now = Date.now();
      const dev2: DeviceInfo = {
        mac: '3c8427c81f04',
        name: 'ESP32-1F04',
        data: {
          temp: 26.8,
          humi: 58.2,
          bootupTimes: 6,
          tick: 1892304,
          bon: 10,
          boff: 14,
          onSecs: 310,
          onTimes: 14,
          valveStatus: 0,
        },
        lastUpdated: now,
        history: [{
          timestamp: now,
          timeStr: new Date(now).toLocaleTimeString('zh-CN', { hour12: false }),
          temp: 26.8,
          humi: 58.2,
          valveStatus: 0,
        }],
        online: true,
        totalReceived: 1,
      };
      this.devicesMap.set('3c8427c81f04', dev2);
    }
  }

  private saveDevices() {
    if (typeof window !== 'undefined') {
      try {
        const list = Array.from(this.devicesMap.values());
        localStorage.setItem('esp32_stored_devices', JSON.stringify(list));
      } catch (e) {
        console.warn('Failed to save devices to localStorage', e);
      }
    }
  }

  public getDevices(): DeviceInfo[] {
    return Array.from(this.devicesMap.values());
  }

  public connect(url?: string, topic?: string) {
    if (url) this.brokerUrl = url;
    if (topic) this.currentTopic = topic;

    if (this.client) {
      try {
        this.client.end(true);
      } catch {}
      this.client = null;
    }

    this.emitStatus(false, true, null);
    this.addLog('sys', this.currentTopic, `正在直连 WebSocket MQTT Broker: ${this.brokerUrl}...`);

    try {
      const connectFn = (mqtt as any).connect || (mqtt as any).default?.connect || mqtt;
      this.client = connectFn(this.brokerUrl, {
        connectTimeout: 8000,
        reconnectPeriod: 4000,
        keepalive: 60,
        clientId: `browser_esp32_${Math.random().toString(16).slice(2, 8)}`,
      });

      this.client.on('connect', () => {
        this.lastError = null;
        this.emitStatus(true, false, null);
        this.addLog('sys', this.currentTopic, `成功连接到 WebSocket Broker (${this.brokerUrl}) [纯前端直连]`);

        const norm = this.currentTopic.replace(/^\/+/, '');
        const subTopics = Array.from(new Set([
          this.currentTopic,
          `/${norm}`,
          norm,
          `/${norm}/#`,
          `${norm}/#`,
          '/esp32/#',
          'esp32/#',
          '/mnt/#',
          'mnt/#'
        ]));
        this.client?.subscribe(subTopics, { qos: 0 }, (err) => {
          if (err) {
            this.lastError = `订阅失败: ${err.message}`;
            this.addLog('sys', this.currentTopic, `订阅主题失败: ${err.message}`);
          } else {
            this.addLog('sys', this.currentTopic, `已订阅主题: ${subTopics.join(', ')}`);
          }
          this.emitStatus(true, false, this.lastError);
        });
      });

      this.client.on('message', (topic, payload) => {
        const rawMsg = payload.toString();
        this.messageCount++;
        this.lastMessageAt = Date.now();
        this.handleMessage(topic, rawMsg);
      });

      this.client.on('error', (err) => {
        console.error('Browser MQTT error:', err);
        this.lastError = err.message || '连接错误';
        this.emitStatus(false, false, this.lastError);
        this.addLog('sys', this.currentTopic, `MQTT 错误: ${err.message}`);
      });

      this.client.on('reconnect', () => {
        this.emitStatus(false, true, null);
      });

      this.client.on('close', () => {
        this.emitStatus(false, false, this.lastError);
      });
    } catch (err: any) {
      this.lastError = err?.message || '初始化 MQTT 失败';
      this.emitStatus(false, false, this.lastError);
      this.addLog('sys', this.currentTopic, `MQTT 异常: ${this.lastError}`);
    }
  }

  private handleMessage(topic: string, rawMsg: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(rawMsg);
    } catch {
      this.addLog('rx', topic, rawMsg);
      return;
    }

    let mac: string | null = parsed.mac || (typeof parsed.device === 'string' ? parsed.device : null);
    
    // Check topic segments for 12-char hex MAC
    const topicSegments = topic.split('/');
    for (const seg of topicSegments) {
      if (/^[0-9a-fA-F]{12}$/.test(seg)) {
        if (!mac) mac = seg;
      }
    }

    let devData: any = null;

    if (mac) {
      const macLower = String(mac).toLowerCase();
      for (const k of Object.keys(parsed)) {
        if (k.toLowerCase() === macLower && typeof parsed[k] === 'object' && parsed[k] !== null) {
          devData = parsed[k];
          break;
        }
      }
      if (!devData && ('temp' in parsed || 'humi' in parsed)) {
        devData = parsed;
      }
    } else {
      for (const key of Object.keys(parsed)) {
        if (/^[0-9a-fA-F]{12}$/.test(key) && typeof parsed[key] === 'object' && parsed[key] !== null) {
          mac = key;
          devData = parsed[key];
          break;
        }
        if (typeof parsed[key] === 'object' && parsed[key] !== null && ('temp' in parsed[key] || 'humi' in parsed[key])) {
          mac = key;
          devData = parsed[key];
          break;
        }
      }
    }

    this.addLog('rx', topic, rawMsg, mac || undefined);

    if (!mac || !devData) return;

    mac = String(mac).toLowerCase().trim();
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const temp = Number(devData.temp ?? 0);
    const humi = Number(devData.humi ?? 0);
    const valveStatusNum = Number(devData.valveStatus ?? 0);

    const telemetry: TelemetryData = {
      temp: isNaN(temp) ? 0 : Number(temp.toFixed(1)),
      humi: isNaN(humi) ? 0 : Number(humi.toFixed(1)),
      bootupTimes: Number(devData.bootupTimes ?? 0),
      tick: Number(devData.tick ?? 0),
      bon: Number(devData.bon ?? 0),
      boff: Number(devData.boff ?? 0),
      onSecs: Number(devData.onSecs ?? 0),
      onTimes: Number(devData.onTimes ?? 0),
      valveStatus: devData.valveStatus ?? 0,
    };

    const existing = this.devicesMap.get(mac);
    const history = existing ? [...existing.history] : [];
    history.push({
      timestamp: now,
      timeStr,
      temp: telemetry.temp,
      humi: telemetry.humi,
      valveStatus: valveStatusNum,
    });

    if (history.length > 40) {
      history.shift();
    }

    const record: DeviceInfo = {
      mac,
      name: existing?.name || `ESP32-${mac.slice(-4).toUpperCase()}`,
      data: telemetry,
      lastUpdated: now,
      history,
      online: true,
      totalReceived: (existing?.totalReceived || 0) + 1,
    };

    this.devicesMap.set(mac, record);
    this.saveDevices();
    this.onDeviceUpdate(record);
  }

  public publishCommand(mac: string, action: 'ON' | 'OF', targetTopic?: string): Promise<{ success: boolean; command: string }> {
    return new Promise((resolve, reject) => {
      const command = `${mac}-${action}`;
      const topic = targetTopic || this.currentTopic;

      if (!this.client || !this.client.connected) {
        // Still apply optimistically in browser
        const dev = this.devicesMap.get(mac);
        if (dev) {
          dev.data.valveStatus = action === 'ON' ? 1 : 0;
          this.onDeviceUpdate({ ...dev });
        }
        this.addLog('tx', topic, `[离线模拟] ${command}`, mac);
        resolve({ success: true, command });
        return;
      }

      const altTopic = topic.startsWith('/') ? topic.slice(1) : `/${topic}`;
      this.client.publish(topic, command, { qos: 0 }, (err) => {
        if (err) {
          this.addLog('tx', topic, `[发送失败] ${command}: ${err.message}`, mac);
          reject(err);
          return;
        }

        if (altTopic !== topic && this.client) {
          this.client.publish(altTopic, command, { qos: 0 });
        }

        this.addLog('tx', topic, command, mac);
        const dev = this.devicesMap.get(mac);
        if (dev) {
          dev.data.valveStatus = action === 'ON' ? 1 : 0;
          this.onDeviceUpdate({ ...dev });
          this.saveDevices();
        }
        resolve({ success: true, command });
      });
    });
  }

  public addDevice(mac: string, name?: string): DeviceInfo {
    const cleanMac = mac.toLowerCase().trim().replace(/[:-]/g, '');
    const existing = this.devicesMap.get(cleanMac);
    if (existing) {
      if (name) {
        existing.name = name;
        this.saveDevices();
        this.onDeviceUpdate({ ...existing });
      }
      return existing;
    }

    const now = Date.now();
    const newDev: DeviceInfo = {
      mac: cleanMac,
      name: name || `ESP32-${cleanMac.slice(-4).toUpperCase()}`,
      data: {
        temp: 26.5,
        humi: 58.0,
        bootupTimes: 1,
        tick: 100000,
        bon: 10,
        boff: 15,
        onSecs: 0,
        onTimes: 0,
        valveStatus: 0,
      },
      lastUpdated: now,
      history: [{
        timestamp: now,
        timeStr: new Date(now).toLocaleTimeString('zh-CN', { hour12: false }),
        temp: 26.5,
        humi: 58.0,
        valveStatus: 0,
      }],
      online: true,
      totalReceived: 0,
    };

    this.devicesMap.set(cleanMac, newDev);
    this.saveDevices();
    this.onDeviceUpdate(newDev);
    this.addLog('sys', this.currentTopic, `已添加并登记设备 [${cleanMac}]`, cleanMac);
    return newDev;
  }

  public updateDeviceName(mac: string, name: string) {
    const dev = this.devicesMap.get(mac);
    if (dev) {
      dev.name = name;
      this.saveDevices();
      this.onDeviceUpdate({ ...dev });
    }
  }

  private addLog(type: 'rx' | 'tx' | 'sys', topic: string, content: string, mac?: string) {
    const log: MessageLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      topic,
      content,
      timestamp: Date.now(),
      mac,
    };
    this.onLog(log);
  }

  private emitStatus(connected: boolean, connecting: boolean, lastError: string | null) {
    this.onStatusChange({
      connected,
      connecting,
      broker: this.brokerUrl,
      topic: this.currentTopic,
      messageCount: this.messageCount,
      lastMessageAt: this.lastMessageAt,
      lastError,
      mode: 'browser',
    });
  }

  public disconnect() {
    if (this.client) {
      try {
        this.client.end(true);
      } catch {}
      this.client = null;
    }
  }
}
