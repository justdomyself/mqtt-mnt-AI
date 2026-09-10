import { useState } from 'react';
import { Terminal, Trash2, ArrowDownLeft, ArrowUpRight, Info, Search, X } from 'lucide-react';
import { MessageLog } from '../types';

interface MessageLogPanelProps {
  logs: MessageLog[];
  isOpen: boolean;
  onClose: () => void;
  onClearLogs: () => void;
}

export function MessageLogPanel({
  logs,
  isOpen,
  onClose,
  onClearLogs,
}: MessageLogPanelProps) {
  const [filterType, setFilterType] = useState<'all' | 'rx' | 'tx' | 'sys'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filterType !== 'all' && log.type !== filterType) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        log.content.toLowerCase().includes(q) ||
        log.topic.toLowerCase().includes(q) ||
        (log.mac && log.mac.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-slate-950 border-t border-slate-800 shadow-2xl transition-transform duration-300 max-h-80 sm:max-h-96 flex flex-col">
      {/* Header Bar */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            MQTT 报文日志监控 ({logs.length})
          </h3>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
        </div>

        {/* Filter & Actions */}
        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜索 MAC / 报文..."
              className="bg-slate-950 text-slate-200 text-xs pl-8 pr-3 py-1 rounded-md border border-slate-800 outline-none focus:border-cyan-500 w-32 sm:w-44"
            />
          </div>

          {/* Type filters */}
          <div className="flex items-center bg-slate-950 rounded-md p-0.5 border border-slate-800 text-[11px]">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2 py-0.5 rounded ${filterType === 'all' ? 'bg-cyan-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              全部
            </button>
            <button
              onClick={() => setFilterType('rx')}
              className={`px-2 py-0.5 rounded ${filterType === 'rx' ? 'bg-emerald-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              收包 (RX)
            </button>
            <button
              onClick={() => setFilterType('tx')}
              className={`px-2 py-0.5 rounded ${filterType === 'tx' ? 'bg-blue-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
            >
              发包 (TX)
            </button>
          </div>

          <button
            onClick={onClearLogs}
            title="清空日志"
            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log items list */}
      <div className="p-3 overflow-y-auto flex-1 font-mono text-xs space-y-1.5 bg-slate-950">
        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-slate-600">
            暂无匹配的 MQTT 报文记录
          </div>
        ) : (
          filteredLogs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false });
            return (
              <div
                key={log.id}
                className="flex items-start gap-2.5 p-1.5 rounded hover:bg-slate-900/80 transition-colors border border-transparent hover:border-slate-800/80"
              >
                <span className="text-[11px] text-slate-500 shrink-0 select-none">
                  {timeStr}
                </span>

                {log.type === 'rx' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/50 px-1.5 py-0.5 rounded shrink-0">
                    <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                    RX
                  </span>
                ) : log.type === 'tx' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800/50 px-1.5 py-0.5 rounded shrink-0">
                    <ArrowUpRight className="w-3 h-3 text-blue-400" />
                    TX
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded shrink-0">
                    <Info className="w-3 h-3 text-slate-400" />
                    SYS
                  </span>
                )}

                <span className="text-[11px] text-cyan-400 shrink-0 font-medium">
                  [{log.topic}]
                </span>

                {log.mac && (
                  <span className="text-[11px] text-amber-300 shrink-0">
                    {log.mac}:
                  </span>
                )}

                <span className="text-slate-300 break-all select-text font-mono text-[11px]">
                  {log.content}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
