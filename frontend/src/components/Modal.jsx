import { X } from 'lucide-react';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = true,
  closeOnOverlayClick = true
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 p-4"
      onClick={handleOverlayClick}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        overflowY: 'auto'
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '800px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div 
            className="flex justify-between items-center p-6 border-b border-gray-200 bg-white rounded-t-xl"
            style={{ flexShrink: 0 }}
          >
            {title && (
              <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div 
          className="p-6"
          style={{ 
            overflowY: 'auto',
            flex: 1,
            minHeight: 0
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;