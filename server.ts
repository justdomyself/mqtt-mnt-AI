import express, { Request, Response } from 'express';
import path from 'path';
import mqtt, { MqttClient } from 'mqtt';
import { createServer as createViteServer } from 'vite';

interface TelemetryData {
  temp: number;
  humi: number;
  bootupTimes: number;
  tick: number;
  bon: number;
  boff: number;
  onSecs: number;
  onTimes: number;
  valveStatus: number | string;
}

interface HistoryPoint {
  timestamp: number;
  timeStr: string;
  temp: number;
  humi: number;
  valveStatus: number;
}

interface DeviceRecord {
  mac: string;
  name?: string;
  data: TelemetryData;
  lastUpdated: number;
  history: HistoryPoint[];
  online: boolean;
  totalReceived: number;
}

interface MessageLog {
  id: string;
  type: 'rx' | 'tx' | 'sys';
  topic: string;
  content: string;
  timestamp: number;
  mac?: string;
}

const PORT = 3000;
let brokerUrl = 'mqtt://www.lxlee.top:1883';
let currentTopic = '/mnt/esp32';

let mqttClient: MqttClient | null = null;
let isConnected = false;
let isConnecting = false;
let lastError: string | null = null;
let lastMessageAt: number | null = null;
let messageCount = 0;

const devices: Map<string, DeviceRecord> = new Map();
const messageLogs: MessageLog[] = [];
const sseClients: Set<Response> = new Set();

function addLog(type: 'rx' | 'tx' | 'sys', topic: string, content: string, mac?: string) {
  const log: MessageLog = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    topic,
    content,
    timestamp: Date.now(),
    mac,
  };
  messageLogs.unshift(log);
  if (messageLogs.length > 200) {
    messageLogs.pop();
  }
  broadcastSSE('log', log);
}

function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function initMqtt() {
  if (mqttClient) {
    try {
      mqttClient.end(true);
    } catch (e) {
      console.error('Error closing previous MQTT client', e);
    }
    mqttClient = null;
  }

  isConnecting = true;
  isConnected = false;
  lastError = null;
  broadcastSSE('status', getStatus());

  console.log(`Connecting to MQTT broker: ${brokerUrl}, topic: ${currentTopic}`);
  addLog('sys', currentTopic, `正在连接 MQTT Broker: ${brokerUrl}...`);

  try {
    mqttClient = mqtt.connect(brokerUrl, {
      connectTimeout: 10000,
      reconnectPeriod: 5000,
      keepalive: 60,
      clientId: `esp32_monitor_${Math.random().toString(16).slice(2, 8)}`,
    });

    mqttClient.on('connect', () => {
      isConnected = true;
      isConnecting = false;
      lastError = null;
      console.log(`Connected to MQTT broker: ${brokerUrl}`);
      addLog('sys', currentTopic, `成功连接到 MQTT Broker (${brokerUrl})`);

      // Subscribe to both currentTopic and wildcard subtopics so no message is missed
      const subTopics = [currentTopic, `${currentTopic}/#`, '/mnt/#'];
      mqttClient?.subscribe(subTopics, { qos: 0 }, (err) => {
        if (err) {
          console.error(`Subscription error for ${subTopics}:`, err);
          lastError = `订阅失败: ${err.message}`;
          addLog('sys', currentTopic, `订阅主题失败: ${err.message}`);
        } else {
          console.log(`Subscribed to ${subTopics.join(', ')}`);
          addLog('sys', currentTopic, `已订阅主题: ${subTopics.join(', ')}`);
        }
        broadcastSSE('status', getStatus());
      });
      broadcastSSE('status', getStatus());
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT connection error:', err.message);
      lastError = err.message;
      isConnecting = false;
      addLog('sys', currentTopic, `MQTT 错误: ${err.message}`);
      broadcastSSE('status', getStatus());
    });

    mqttClient.on('reconnect', () => {
      isConnecting = true;
      console.log('MQTT reconnecting...');
      broadcastSSE('status', getStatus());
    });

    mqttClient.on('offline', () => {
      isConnected = false;
      console.log('MQTT offline');
      broadcastSSE('status', getStatus());
    });

    mqttClient.on('close', () => {
      isConnected = false;
      broadcastSSE('status', getStatus());
    });

    mqttClient.on('message', (topic, payloadBuffer) => {
      const rawMsg = payloadBuffer.toString();
      messageCount++;
      lastMessageAt = Date.now();
      handleIncomingMessage(topic, rawMsg);
    });
  } catch (err: any) {
    isConnecting = false;
    isConnected = false;
    lastError = err?.message || '初始化 MQTT 失败';
    addLog('sys', currentTopic, `MQTT 异常: ${lastError}`);
    broadcastSSE('status', getStatus());
  }
}

function handleIncomingMessage(topic: string, rawMsg: string) {
  let parsed: any;
  try {
    parsed = JSON.parse(rawMsg);
  } catch (e) {
    addLog('rx', topic, rawMsg);
    return;
  }

  // Extract MAC: could be in parsed.mac, or topic, or as an object key
  let mac: string | null = parsed.mac || (typeof parsed.device === 'string' ? parsed.device : null);

  // Check if topic contains a 12-char hex MAC address
  const topicSegments = topic.split('/');
  for (const seg of topicSegments) {
    if (/^[0-9a-fA-F]{12}$/.test(seg)) {
      if (!mac) mac = seg;
    }
  }

  let devData: any = null;

  if (mac) {
    const macLower = String(mac).toLowerCase();
    // Try finding matching key case-insensitively
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
    // Look for any key that is a 12-char hex mac address
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

  addLog('rx', topic, rawMsg, mac || undefined);

  if (!mac || !devData) {
    return;
  }

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

  const existing = devices.get(mac);
  const history = existing ? [...existing.history] : [];
  history.push({
    timestamp: now,
    timeStr,
    temp: telemetry.temp,
    humi: telemetry.humi,
    valveStatus: valveStatusNum,
  });

  // Keep last 40 history points
  if (history.length > 40) {
    history.shift();
  }

  const record: DeviceRecord = {
    mac,
    name: existing?.name || `ESP32-${mac.slice(-4).toUpperCase()}`,
    data: telemetry,
    lastUpdated: now,
    history,
    online: true,
    totalReceived: (existing?.totalReceived || 0) + 1,
  };

  devices.set(mac, record);
  broadcastSSE('device_update', record);
}

function getStatus() {
  return {
    connected: isConnected,
    connecting: isConnecting,
    broker: brokerUrl,
    topic: currentTopic,
    messageCount,
    lastMessageAt,
    lastError,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API: Health
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // API: MQTT Status
  app.get('/api/mqtt/status', (req: Request, res: Response) => {
    res.json(getStatus());
  });

  // API: MQTT Reconnect / Config
  app.post('/api/mqtt/config', (req: Request, res: Response) => {
    const { broker, topic } = req.body;
    if (broker && typeof broker === 'string') {
      brokerUrl = broker.trim();
    }
    if (topic && typeof topic === 'string') {
      currentTopic = topic.trim();
    }
    initMqtt();
    res.json({ success: true, status: getStatus() });
  });

  // API: Get all devices
  app.get('/api/devices', (req: Request, res: Response) => {
    const list = Array.from(devices.values()).map((d) => {
      // Mark as offline if no message received for > 60 seconds
      const isOnline = Date.now() - d.lastUpdated < 60000;
      return {
        ...d,
        online: isOnline,
      };
    });
    res.json({ devices: list });
  });

  // API: Add or register a device MAC
  app.post('/api/devices', (req: Request, res: Response) => {
    let { mac, name } = req.body;
    if (!mac || typeof mac !== 'string') {
      res.status(400).json({ error: '请提供有效的 MAC 地址' });
      return;
    }
    mac = mac.toLowerCase().trim().replace(/[:-]/g, '');
    if (!/^[0-9a-fA-F]{12}$/.test(mac)) {
      res.status(400).json({ error: 'MAC 地址必须为 12 位十六进制字符（例如 3c8427c81f04）' });
      return;
    }
    const existing = devices.get(mac);
    if (existing) {
      if (name) existing.name = name;
      res.json({ success: true, device: existing });
      return;
    }
    const now = Date.now();
    const newRecord: DeviceRecord = {
      mac,
      name: name || `ESP32-${mac.slice(-4).toUpperCase()}`,
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
      history: [
        {
          timestamp: now,
          timeStr: new Date(now).toLocaleTimeString('zh-CN', { hour12: false }),
          temp: 26.5,
          humi: 58.0,
          valveStatus: 0,
        },
      ],
      online: true,
      totalReceived: 0,
    };
    devices.set(mac, newRecord);
    broadcastSSE('device_update', newRecord);
    addLog('sys', currentTopic, `已添加设备 [${mac}]`, mac);
    res.json({ success: true, device: newRecord });
  });

  // API: Delete device
  app.delete('/api/devices/:mac', (req: Request, res: Response) => {
    const mac = req.params.mac.toLowerCase();
    const existed = devices.delete(mac);
    if (existed) {
      broadcastSSE('device_removed', { mac });
      addLog('sys', currentTopic, `已移除设备 [${mac}]`, mac);
    }
    res.json({ success: true, removed: existed });
  });

  // API: Update device custom name
  app.patch('/api/devices/:mac', (req: Request, res: Response) => {
    const mac = req.params.mac.toLowerCase();
    const { name } = req.body;
    const device = devices.get(mac);
    if (device) {
      device.name = name;
      broadcastSSE('device_update', device);
      res.json({ success: true, device });
    } else {
      res.status(404).json({ error: 'Device not found' });
    }
  });

  // API: Publish command to device
  // Click ON sends: ${mac}-ON (e.g. fc012c2db628-ON)
  // Click OFF sends: ${mac}-OF (e.g. fc012c2db628-OF)
  app.post('/api/devices/:mac/control', (req: Request, res: Response) => {
    const mac = req.params.mac.toLowerCase();
    const { action, targetTopic } = req.body;

    if (action !== 'ON' && action !== 'OF') {
      res.status(400).json({ error: 'Action must be "ON" or "OF"' });
      return;
    }

    const command = `${mac}-${action}`;
    const pubTopic = targetTopic || currentTopic;

    console.log(`Sending command to MQTT: topic=${pubTopic}, message=${command}`);

    if (mqttClient && isConnected) {
      mqttClient.publish(pubTopic, command, { qos: 0 }, (err) => {
        if (err) {
          console.error('MQTT publish error:', err);
          addLog('tx', pubTopic, `[发送失败] ${command}: ${err.message}`, mac);
          res.status(500).json({ success: false, error: err.message });
          return;
        }
        addLog('tx', pubTopic, command, mac);

        // Optimistically update device valve status if device is known
        const dev = devices.get(mac);
        if (dev) {
          dev.data.valveStatus = action === 'ON' ? 1 : 0;
          broadcastSSE('device_update', dev);
        }

        res.json({ success: true, command, topic: pubTopic });
      });
    } else {
      // MQTT not connected, still log the attempt and update mock state if desired
      addLog('tx', pubTopic, `[本地未联网发送] ${command}`, mac);
      const dev = devices.get(mac);
      if (dev) {
        dev.data.valveStatus = action === 'ON' ? 1 : 0;
        broadcastSSE('device_update', dev);
      }
      res.json({
        success: true,
        command,
        topic: pubTopic,
        warning: 'MQTT Broker 未连接，命令已记录并更新前端预期状态',
      });
    }
  });

  // API: Simulate message payload (matches user's specified format)
  app.post('/api/devices/simulate', (req: Request, res: Response) => {
    const customPayload = req.body;
    let payloadStr = '';

    if (customPayload && customPayload.mac) {
      payloadStr = JSON.stringify(customPayload);
    } else {
      // Default sample from user's prompt
      const sampleMac = 'fc012c2db628';
      const sample = {
        mac: sampleMac,
        [sampleMac]: {
          temp: Number((26 + Math.random() * 5).toFixed(1)),
          humi: Number((50 + Math.random() * 10).toFixed(1)),
          bootupTimes: 4,
          tick: 1552662 + Math.floor(Math.random() * 1000),
          bon: 11,
          boff: 15,
          onSecs: 244 + Math.floor(Math.random() * 20),
          onTimes: 11,
          valveStatus: Math.random() > 0.5 ? 1 : 0,
        },
      };
      payloadStr = JSON.stringify(sample);
    }

    handleIncomingMessage(currentTopic, payloadStr);
    res.json({ success: true, message: '已模拟上报数据', payload: JSON.parse(payloadStr) });
  });

  // API: Get message logs
  app.get('/api/logs', (req: Request, res: Response) => {
    res.json({ logs: messageLogs });
  });

  // API: Clear message logs
  app.delete('/api/logs', (req: Request, res: Response) => {
    messageLogs.length = 0;
    broadcastSSE('clear_logs', {});
    res.json({ success: true });
  });

  // API: SSE Stream
  app.get('/api/stream', (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    res.write(`event: init\ndata: ${JSON.stringify({
      status: getStatus(),
      devices: Array.from(devices.values()),
      logs: messageLogs.slice(0, 30),
    })}\n\n`);

    sseClients.add(res);

    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
        sseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseClients.delete(res);
    });
  });

  // Seed initial known devices: fc012c2db628 and 3c8427c81f04
  handleIncomingMessage(
    currentTopic,
    JSON.stringify({
      mac: 'fc012c2db628',
      fc012c2db628: {
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
    }),
  );

  handleIncomingMessage(
    currentTopic,
    JSON.stringify({
      mac: '3c8427c81f04',
      '3c8427c81f04': {
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
    }),
  );

  // Initialize MQTT connection
  initMqtt();

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ESP32 MQTT Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
