import { ArrowLeft, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTheme } from '../theme/ThemeProvider';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  closeOnOverlayClick = true,
  size = 'default', // 'default' | 'large' | 'full'
  fullBleed = false,
  backLabel = '',
  onBack = null,
  contentClassName = '',
  panelClassName = '',
  // 'auto' follows the app theme; keep 'white'/'dark' for legacy call sites.
  backgroundColor = 'auto'
}) => {
  if (!isOpen) return null;

  const { resolvedTheme } = useTheme();

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const isDarkMode =
    backgroundColor === 'dark' ||
    (backgroundColor === 'auto' && resolvedTheme === 'dark');

  const bgOverrideClass =
    backgroundColor === 'dark'
      ? 'bg-slate-950'
      : backgroundColor === 'white'
        ? 'bg-white'
        : '';

  const textClass = isDarkMode ? 'text-slate-100' : 'text-gray-900 dark:text-gray-100';
  const buttonClass = isDarkMode
    ? 'text-slate-300 hover:text-white hover:bg-white/5'
    : 'text-gray-500 hover:text-gray-900 hover:bg-black/5';

  const isFullSize = size === 'full';
  const maxWidthClass = size === 'large' ? 'max-w-4xl w-full' : 'max-w-2xl w-full';

  return createPortal(
    <div 
      className={[
        'fixed inset-0 z-[1000] bg-black/60 motion-safe:animate-fade-in',
        isFullSize
          ? (fullBleed ? '' : 'lg:pl-[312px]')
          : 'flex items-center justify-center p-4 lg:pl-[312px]'
      ].join(' ')}
      onClick={handleOverlayClick}
    >
      <div 
        className={[
          'crm-panel w-full overflow-hidden flex flex-col',
          isFullSize ? 'h-[100dvh] max-w-none max-h-none rounded-none border-0' : `${maxWidthClass} max-h-[92vh]`,
          'motion-safe:animate-scale-in',
          bgOverrideClass,
          panelClassName
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton || backLabel) && (
          <div 
            className={[
              'flex items-center justify-between gap-4 px-6 py-4',
              'border-b border-[color:var(--crm-border)]',
              'bg-[rgb(var(--crm-surface-rgb)_/_0.55)]'
            ].join(' ')}
          >
            <div className="flex min-w-0 items-center gap-3">
              {backLabel && (
                <button
                  type="button"
                  onClick={onBack || onClose}
                  className={`${buttonClass} inline-flex items-center gap-2 rounded-xl border border-[color:var(--crm-border)] px-3 py-2 text-sm font-semibold transition-colors`}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel}
                </button>
              )}
              {title && (
                <h3 className={`truncate text-xl font-bold ${textClass}`}>{title}</h3>
              )}
            </div>
            {showCloseButton && !backLabel && (
              <button
                onClick={onClose}
                className={`${buttonClass} transition-colors p-2 rounded-xl`}
                aria-label="Fechar modal"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div 
          className={['flex-1 min-h-0 overflow-y-auto', contentClassName || 'p-6'].join(' ')}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
