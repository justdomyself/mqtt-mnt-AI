import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  QrCode, 
  Share2, 
  PlusSquare, 
  Check, 
  Copy, 
  Download, 
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Zap,
  Info,
  AlertTriangle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstallPromptSuccess: () => void;
}

export function InstallAppModal({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallPromptSuccess,
}: InstallAppModalProps) {
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isWeChat, setIsWeChat] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
      const ua = window.navigator.userAgent.toLowerCase();
      setIsIOS(/iphone|ipad|ipod/.test(ua));
      setIsAndroid(/android/.test(ua));
      setIsWeChat(/micromessenger/.test(ua));
      
      const standalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches;
      setIsStandalone(Boolean(standalone));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        onInstallPromptSuccess();
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="install-app-modal"
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-950/40">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>安装 ESP32 监控中心到手机</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">PWA 原生体验</span>
              </h2>
              <p className="text-xs text-slate-400">独立全屏运行 • 桌面直达 • 实时监控</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-300 text-xs leading-relaxed">
          {/* Already installed banner */}
          {isStandalone && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex items-center gap-2.5 text-emerald-300">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>当前已在独立 App 模式下运行！已成功添加到手机主屏幕。</span>
            </div>
          )}

          {/* WeChat Warning */}
          {isWeChat && (
            <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3.5 space-y-2 text-amber-200">
              <p className="font-bold flex items-center gap-1.5 text-amber-300">
                <Info className="w-4 h-4 text-amber-400" />
                <span>微信内置浏览器无法直接添加图标</span>
              </p>
              <p className="text-[11px] leading-normal text-amber-100/90">
                请点击右上角【<strong>...</strong>】，选择【<strong>在默认浏览器打开</strong>】（如 Safari 或 Chrome），再执行下方添加到桌面操作。
              </p>
            </div>
          )}

          {/* Android Chrome One-Click Install */}
          {deferredPrompt && (
            <div className="bg-gradient-to-br from-cyan-950/60 to-blue-950/60 border border-cyan-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>检测到支持一键系统安装</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                您的手机浏览器已准备就绪，点击下方按钮即可直接将本监控控制中心生成手机独立 App！
              </p>
              <button
                onClick={handleNativeInstall}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-950/40 flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>立即一键安装到手机桌面</span>
              </button>
            </div>
          )}

          {/* Mobile Step-by-Step Guidance */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              手机端安装步骤（免应用商店、无需下载安装包）
            </h3>

            {/* Apple iOS Safari */}
            <div className={`p-4 rounded-xl border transition-all ${isIOS ? 'bg-cyan-950/30 border-cyan-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <span>🍎 苹果 iPhone / iPad (Safari 浏览器)</span>
                  {isIOS && <span className="text-[10px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded">当前设备</span>}
                </span>
              </div>
              <ol className="space-y-2 text-[11px] text-slate-300 pl-1">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <span>使用 <strong>Safari 浏览器</strong> 打开当前网页</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <span>点击屏幕底部正中间的【<strong className="text-cyan-300 inline-flex items-center gap-0.5"><Share2 className="w-3 h-3 inline" /> 分享</strong>】按钮</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                  <span>在菜单中往下滑动，找到并点击【<strong className="text-cyan-300 inline-flex items-center gap-0.5"><PlusSquare className="w-3 h-3 inline" /> 添加到主屏幕</strong>】</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
                  <span>点击右上角【<strong>添加</strong>】，手机桌面上就会出现“<strong>ESP32监控</strong>”图标，点击即全屏启动！</span>
                </li>
              </ol>
            </div>

            {/* Android Chrome / Edge */}
            <div className={`p-4 rounded-xl border transition-all ${isAndroid ? 'bg-cyan-950/30 border-cyan-500/50' : 'bg-slate-950/60 border-slate-800'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <span>🤖 安卓 Android 手机 (Chrome / 华为 / 小米 / OPPO / vivo 自带浏览器)</span>
                  {isAndroid && <span className="text-[10px] px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded">当前设备</span>}
                </span>
              </div>
              <ol className="space-y-2 text-[11px] text-slate-300 pl-1">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                  <span>在手机浏览器（建议 Chrome、Edge 或自带浏览器）打开本网址</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                  <span>点击右上角的菜单按钮【<strong>⋮</strong>】</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                  <span>选择【<strong>安装应用</strong>】或【<strong>添加到主屏幕</strong>】即可</span>
                </li>
              </ol>
            </div>

            {/* Troubleshooting block */}
            <div className="bg-amber-950/30 border border-amber-600/40 rounded-xl p-3.5 space-y-2 text-amber-200">
              <p className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>❓ 点击了安装/添加，但桌面上看不到图标？常见原因：</span>
              </p>
              <div className="space-y-2 text-[11px] text-amber-100/90 leading-relaxed pl-1">
                <p>
                  <strong>原因 1：安卓手机“桌面快捷方式”系统权限被默认拦截（最常见）</strong><br />
                  小米 (MIUI/HyperOS)、华为、OPPO、vivo 出于安全策略，<strong>默认禁止浏览器在桌面创建快捷图标</strong>。<br />
                  <span className="text-white font-medium">👉 解决方法：</span>打开手机【设置】→【应用设置 / 应用管理】→ 找到您使用的【浏览器】→ 点击【权限管理】→ 找到【<strong>桌面快捷方式</strong>】（或“创建桌面快捷方式”），勾选改为【<strong>允许</strong>】。改好后重新在浏览器中点击一次“添加到主屏幕”，桌面图标即可正常出现！
                </p>
                <p>
                  <strong>原因 2：Netlify 部署包未更新最新的 PWA 资源</strong><br />
                  如果使用的是之前导出的旧包，Netlify 上缺少 PWA 图标与清单。建议直接在手机上访问当前自带完整 PWA 配置的云端地址：<code className="bg-slate-900 px-1 py-0.5 rounded text-cyan-300 font-mono">ais-dev-sn42nexrlnhptw7lfvnbhh-222581862321.europe-west2.run.app</code>。
                </p>
              </div>
            </div>
          </div>

          {/* Scan QR Code or Copy Link */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="p-2 bg-white rounded-xl shadow-md shrink-0">
              <QRCodeSVG 
                value={currentUrl || 'https://ais-dev-sn42nexrlnhptw7lfvnbhh-222581862321.europe-west2.run.app'} 
                size={110} 
                level="M" 
                includeMargin={false}
              />
            </div>
            <div className="space-y-2 text-center sm:text-left flex-1">
              <p className="font-bold text-white text-xs flex items-center justify-center sm:justify-start gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>电脑端扫码：手机相机直接对准上方二维码</span>
              </p>
              <p className="text-[11px] text-slate-400">
                扫码即可在手机浏览器中打开本地址，然后按照上方指引添加到桌面。
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  readOnly
                  value={currentUrl}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-300 flex-1 outline-none truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors shrink-0 text-[11px]"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">已复制</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>复制网址</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            知道了 / 关闭
          </button>
        </div>
      </div>
    </div>
  );
}
