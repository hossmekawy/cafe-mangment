import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { FiFileText, FiDownload, FiCalendar, FiGlobe, FiPieChart, FiTrendingUp, FiBox, FiUsers } from 'react-icons/fi';
import { reportsApi } from '../../api/reportsApi';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';

const reportTypes = [
    { id: 'sales', name: 'Sales & Orders', icon: FiTrendingUp },
    { id: 'inventory', name: 'Inventory & Stock', icon: FiBox },
    { id: 'customers', name: 'Customer Activity', icon: FiUsers },
    { id: 'finance', name: 'Financial Summary', icon: FiPieChart },
];

export default function ReportsDashboard() {
    const [activeTab, setActiveTab] = useState('sales');
    const [dateRange, setDateRange] = useState({
        start_date: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First of month
        end_date: new Date().toISOString().split('T')[0]
    });
    const [language, setLanguage] = useState('en');

    const [data, setData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        fetchReportData();
    }, [activeTab, dateRange]);

    const fetchReportData = async () => {
        setIsLoading(true);
        try {
            let res;
            const params = { ...dateRange, lang: language };
            
            if (activeTab === 'sales') res = await reportsApi.getSales(params);
            else if (activeTab === 'inventory') res = await reportsApi.getInventory(params);
            else if (activeTab === 'customers') res = await reportsApi.getCustomers(params);
            else if (activeTab === 'finance') res = await reportsApi.getFinancials(params);
            
            if (res.data.success) {
                setData(res.data.data || []);
                setSummary(res.data.summary || null);
            }
        } catch (error) {
            toast.error("Failed to load report data");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async (format) => {
        setIsExporting(true);
        const tid = toast.loading(`Generating ${format.toUpperCase()} report...`);
        try {
            const params = { ...dateRange, lang: language, format };
            const res = await reportsApi.downloadReport(activeTab, params);
            
            // Create a blob URL and download it
            const blob = new Blob([res.data], { 
                type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${activeTab}_report_${dateRange.start_date}_to_${dateRange.end_date}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            
            toast.success("Download started!", { id: tid });
        } catch (error) {
            toast.error("Export failed. File might be too large or server issue.", { id: tid });
        } finally {
            setIsExporting(false);
        }
    };

    // Dynamic Columns based on the first data row keys
    const columns = useMemo(() => {
        if (!data || data.length === 0) return [];
        const keys = Object.keys(data[0]);
        return keys.map(k => ({
            header: k,
            accessorKey: k,
            cell: info => {
                const val = info.getValue();
                if (typeof val === 'number') {
                    // Very simple heuristic to detect money vs quantity
                    if (k.toLowerCase().includes('total') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('value')) {
                        return <span className="text-green-400 font-mono">${val.toFixed(2)}</span>;
                    }
                    return <span className="font-mono">{val}</span>;
                }
                return val;
            }
        }));
    }, [data]);

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <PageHeader 
                title="Reports & Analytics" 
                subtitle="Generate, view, and export PDF/Excel reports for various modules."
                icon={FiFileText}
            />

            {/* Filter Bar */}
            <div className="glass-panel p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                    {reportTypes.map(t => (
                        <button 
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                                activeTab === t.id ? 'bg-primary text-white shadow-lg' : 'bg-white/5 text-textMuted hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <t.icon className="w-4 h-4" />
                            <span>{t.name}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center space-x-3 w-full md:w-auto">
                    <div className="flex items-center space-x-2 bg-black/20 rounded-lg p-1 border border-white/5">
                        <FiCalendar className="text-textMuted mx-2" />
                        <input type="date" className="bg-transparent text-sm text-white outline-none w-[120px]" 
                            value={dateRange.start_date} onChange={e => setDateRange({...dateRange, start_date: e.target.value})} />
                        <span className="text-textMuted">-</span>
                        <input type="date" className="bg-transparent text-sm text-white outline-none w-[120px]" 
                            value={dateRange.end_date} onChange={e => setDateRange({...dateRange, end_date: e.target.value})} />
                    </div>

                    <div className="flex items-center space-x-2 bg-black/20 rounded-lg px-3 py-1.5 border border-white/5 cursor-pointer hover:bg-white/5"
                         onClick={() => setLanguage(l => l === 'en' ? 'ar' : 'en')}
                         title="Toggle Export Language">
                        <FiGlobe className={language === 'ar' ? 'text-primary' : 'text-textMuted'} />
                        <span className="text-xs font-bold uppercase">{language}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Summary Sidebar */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="glass-panel p-5">
                        <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Quick Summary</h3>
                        {summary ? (
                            <div className="space-y-4">
                                {Object.entries(summary).map(([key, val]) => (
                                    <div key={key}>
                                        <p className="text-xs text-textMuted uppercase tracking-wider mb-1">{key.replace('_', ' ')}</p>
                                        <p className={`text-xl font-bold font-mono ${typeof val === 'number' && key.includes('profit') ? (val >= 0 ? 'text-green-400' : 'text-red-400') : 'text-white'}`}>
                                            {typeof val === 'number' && (key.includes('total_value') || key.includes('revenue') || key.includes('amount') || key.includes('profit') || key.includes('expenses')) 
                                                ? `$${val.toFixed(2)}` 
                                                : val}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-textMuted italic">No summary available.</p>
                        )}
                        
                        <div className="mt-8 pt-4 border-t border-white/10 space-y-3">
                            <button onClick={() => handleDownload('pdf')} disabled={isExporting || data.length === 0}
                                className="w-full btn-primary flex items-center justify-center space-x-2 py-3 shadow-lg shadow-primary/20">
                                <FiDownload /><span>Export PDF Document</span>
                            </button>
                            <button onClick={() => handleDownload('excel')} disabled={isExporting || data.length === 0}
                                className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl flex items-center justify-center space-x-2 py-3 shadow-lg shadow-green-900/40 transition-colors font-bold disabled:opacity-50">
                                <FiFileText /><span>Export to Excel</span>
                            </button>
                            {language === 'ar' && (
                                <p className="text-[10px] text-orange-400 text-center mt-2 px-2 leading-tight">
                                    Arabic PDF exports will generate strictly parsed right-to-left UI using standard layout.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Preview Table */}
                <div className="lg:col-span-3">
                    <div className="glass-panel p-2">
                         <DataTable 
                            columns={columns} 
                            data={data} 
                            isLoading={isLoading} 
                            searchPlaceholder="Search in report preview..."
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
