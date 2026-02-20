import React from 'react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", isDestructive = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      ></div>
      
      {/* Modal */}
      <div className="relative glass-panel w-full max-w-md p-6 animate-scale-in">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-textMuted mb-6">{message}</p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg font-medium text-textMuted hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isDestructive 
                ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30' 
                : 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
