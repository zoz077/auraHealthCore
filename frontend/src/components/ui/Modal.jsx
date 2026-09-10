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
    default: 'text-cyan-600 bg-cyan-50 border-cyan-200/80',
    danger: 'text-rose-600 bg-rose-50 border-rose-200/80',
    success: 'text-emerald-600 bg-emerald-50 border-emerald-200/80',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog Window */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} bg-white/98 backdrop-blur-xl border border-white/90 rounded-3xl shadow-[0_25px_60px_-15px_rgba(15,23,42,0.22),0_10px_20px_-5px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,1)] overflow-hidden transform transition-all duration-200 animate-in fade-in-0 zoom-in-95 my-8 ${className}`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100/90 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className={`p-2 rounded-xl border ${iconColors[headerVariant] || iconColors.default} shadow-neu-sm shrink-0 mt-0.5`}>
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-800">{title}</h2>
              {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
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
