import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  icon: Icon,
  children,
  maxWidth = 'max-w-xl',
  headerVariant = 'default', // 'default' | 'danger' | 'success'
  className = '',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const iconColors = {
    default: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    danger: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden transform transition-all duration-200 animate-in fade-in-0 zoom-in-95 my-8 ${className}`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className={`p-2 rounded-xl border ${iconColors[headerVariant] || iconColors.default} shrink-0 mt-0.5`}>
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">{title}</h2>
              {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[calc(85vh-8rem)] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
