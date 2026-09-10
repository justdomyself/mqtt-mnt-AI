import React, { useState } from 'react';
import { X, Plus, Cpu, Radio, ShieldCheck } from 'lucide-react';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (mac: string, name?: string) => Promise<void>;
}

export function AddDeviceModal({ isOpen, onClose, onAdd }: AddDeviceModalProps) {
  const [mac, setMac] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanMac = mac.trim().toLowerCase().replace(/[:-]/g, '');

    if (!cleanMac) {
      setError('请输入 12 位 MAC 地址');
      return;
    }
    if (!/^[0-9a-fA-F]{12}$/.test(cleanMac)) {
      setError('MAC 格式必须为 12 位十六进制字符（例如 3c8427c81f04）');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdd(cleanMac, name.trim() || undefined);
      setMac('');
      setName('');
      onClose();
    } catch (err: any) {
      setError(err?.message || '添加设备失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickFill = (macStr: string, nameStr: string) => {
    setMac(macStr);
    setName(nameStr);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">添加 / 登记 ESP32 设备</h3>
              <p className="text-[11px] text-slate-400">登记设备的 12 位 MAC，开启实时遥测与开关控制</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              12 位 MAC 地址 <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={mac}
                onChange={(e) => {
                  setMac(e.target.value);
                  setError(null);
                }}
                placeholder="例如 3c8427c81f04 或 fc012c2db628"
                maxLength={17}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-cyan-300 font-mono placeholder-slate-600 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all uppercase"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              支持不含冒号纯字符（如 <code className="text-slate-400 font-mono">3c8427c81f04</code>）
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              设备备注名称 (可选)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如 ESP32-1F04 或 客厅电磁阀"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-all"
            />
          </div>

          {/* Quick presets */}
          <div>
            <span className="text-[11px] font-medium text-slate-400">快速填入已知设备:</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => quickFill('3c8427c81f04', 'ESP32-1F04 (3C84)')}
                className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-cyan-300 rounded-lg text-[11px] font-mono border border-slate-700/60 transition-colors"
              >
                3c8427c81f04
              </button>
              <button
                type="button"
                onClick={() => quickFill('fc012c2db628', 'ESP32-B628 (FC01)')}
                className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-700 text-cyan-300 rounded-lg text-[11px] font-mono border border-slate-700/60 transition-colors"
              >
                fc012c2db628
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-cyan-950/40 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? '正在添加...' : '确定添加并监控'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
