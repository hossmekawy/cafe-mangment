import React from 'react';

const PageHeader = ({ title, subtitle, icon: Icon, action }) => {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 mb-6">
            <div className="flex items-center gap-4">
                {Icon && (
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                        <Icon className="w-6 h-6" />
                    </div>
                )}
                <div>
                    <h1 className="text-2xl font-bold text-textMain tracking-tight">{title}</h1>
                    {subtitle && <p className="text-sm text-textMuted mt-1">{subtitle}</p>}
                </div>
            </div>
            
            {action && (
                React.isValidElement(action) ? (
                    action
                ) : (
                    <button 
                        onClick={action.onClick}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm shadow-blue-600/20 active:scale-[0.98]"
                    >
                        {action.icon && <action.icon className="w-4 h-4" />}
                        {action.label}
                    </button>
                )
            )}
        </div>
    );
};

export default PageHeader;
