/**
 * ESP32 MQTT Device Monitoring Types
 */

export interface TelemetryData {
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

export interface HistoryPoint {
  timestamp: number;
  timeStr: string;
  temp: number;
  humi: number;
  valveStatus: number;
}

export interface DeviceInfo {
  mac: string;
  name?: string;
  data: TelemetryData;
  lastUpdated: number;
  history: HistoryPoint[];
  online: boolean;
  totalReceived: number;
}

export interface MqttStatus {
  connected: boolean;
  connecting: boolean;
  broker: string;
  topic: string;
  messageCount: number;
  lastMessageAt: number | null;
  lastError: string | null;
}

export interface MessageLog {
  id: string;
  type: 'rx' | 'tx' | 'sys';
  topic: string;
  content: string;
  timestamp: number;
  mac?: string;
}

export interface MqttConfig {
  broker: string;
  topic: string;
}
