import React from 'react';
import { FiWifi } from 'react-icons/fi';

export default function ReceiptPreview({ data }) {
    if (!data) return null;

    const [
        brand_name, brand_phone, address, tax_label, tax_rate,
        tax_inclusive, receipt_printer_type, receipt_language,
        receipt_header_msg, receipt_footer_msg, wifi_password, currency, logo_base64
    ] = data;

    const isArabic = receipt_language === 'ar';
    const isA4 = receipt_printer_type === 'a4' || receipt_printer_type === 'a5';

    const widthClass = 
        receipt_printer_type === 'thermal80' ? 'w-[300px]' : 
        receipt_printer_type === 'thermal72' ? 'w-[270px]' :
        receipt_printer_type === 'a4' ? 'w-[400px]' :
        'w-[350px]';

    // Full Arabic translation map for all receipt labels
    const t = {
        orderNo: isArabic ? 'رقم الطلب' : 'Order',
        date: isArabic ? 'التاريخ' : 'Date',
        cashier: isArabic ? 'الكاشير' : 'Cashier',
        type: isArabic ? 'نوع الطلب' : 'Type',
        dineIn: isArabic ? 'داخل المحل' : 'Dine-In',
        itemHeader: isArabic ? 'الصنف' : 'Item',
        qtyHeader: isArabic ? 'الكمية' : 'Qty',
        totalHeader: isArabic ? 'المبلغ' : 'Total',
        subtotal: isArabic ? 'المجموع الفرعي' : 'Subtotal',
        taxLabel: isArabic ? (tax_label || 'ضريبة') : (tax_label || 'Tax'),
        incl: isArabic ? '(شامل)' : '(Inc)',
        total: isArabic ? 'الإجمالي' : 'Total',
        wifi: isArabic ? 'كلمة مرور الواي فاي' : 'Wi-Fi',
        adminName: isArabic ? 'مدير' : 'Admin',
        // Sample dummy items
        item1: isArabic ? 'آيس لاتيه' : 'Iced Latte',
        item2: isArabic ? 'كيك شوكولاتة' : 'Chocolate Cake',
    };

    const taxRateNum = parseFloat(tax_rate) || 14;
    const subtotalAmount = 205.00;
    const taxAmount = tax_inclusive
        ? (subtotalAmount - subtotalAmount / (1 + taxRateNum / 100)).toFixed(2)
        : (subtotalAmount * taxRateNum / 100).toFixed(2);
    const totalAmount = tax_inclusive
        ? subtotalAmount.toFixed(2)
        : (subtotalAmount + parseFloat(taxAmount)).toFixed(2);

    return (
        <div 
            dir={isArabic ? 'rtl' : 'ltr'}
            className={`bg-surface text-black p-6 shadow-2xl relative ${widthClass} font-mono text-sm`}
            style={{ fontFamily: isArabic ? '"Cairo", "Noto Sans Arabic", sans-serif' : 'monospace' }}
        >
            {/* Receipt Header */}
            <div className="text-center mb-6">
                {logo_base64 && (
                    <div className="flex justify-center mb-2">
                        <img src={logo_base64} alt="Brand Logo" className="max-w-[120px] max-h-[120px] object-contain filter grayscale contrast-125" />
                    </div>
                )}
                {!logo_base64 && <h1 className="text-xl font-bold uppercase">{brand_name || 'BRAND NAME'}</h1>}
                {logo_base64 && brand_name && <h2 className="text-sm font-bold uppercase mt-1">{brand_name}</h2>}
                {address && <p className="text-xs text-gray-600 mt-1">{address}</p>}
                {brand_phone && (
                    <p className="text-xs text-gray-600">
                        {isArabic ? 'هاتف: ' : 'Tel: '}{brand_phone}
                    </p>
                )}
                {receipt_header_msg && (
                    <p className="text-xs mt-3 italic whitespace-pre-wrap">{receipt_header_msg}</p>
                )}
            </div>

            <div className="border-b-2 border-dashed border-gray-400 my-4" />

            {/* Order Meta Info */}
            <div className="flex justify-between text-xs mb-4">
                <div className="space-y-1">
                    <p><span className="font-bold">{t.orderNo}:</span> #1024</p>
                    <p><span className="font-bold">{t.date}:</span> 12/05/2024 14:30</p>
                </div>
                <div className="space-y-1 text-right" style={{ textAlign: isArabic ? 'left' : 'right' }}>
                    <p><span className="font-bold">{t.cashier}:</span> {t.adminName}</p>
                    <p><span className="font-bold">{t.type}:</span> {t.dineIn}</p>
                </div>
            </div>

            <div className="border-b-2 border-dotted border-gray-300 my-4" />

            {/* Items Table */}
            <div className="mb-4">
                {/* Column Headers */}
                <div className="flex justify-between font-bold text-xs mb-2 border-b border-gray-400 pb-1">
                    <span className="flex-1">{t.itemHeader}</span>
                    <span className="w-12 text-center">{t.qtyHeader}</span>
                    <span className="w-20" style={{ textAlign: isArabic ? 'left' : 'right' }}>{t.totalHeader}</span>
                </div>
                
                <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span className="flex-1">{t.item1}</span>
                        <span className="w-12 text-center">x2</span>
                        <span className="w-20" style={{ textAlign: isArabic ? 'left' : 'right' }}>120.00</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="flex-1">{t.item2}</span>
                        <span className="w-12 text-center">x1</span>
                        <span className="w-20" style={{ textAlign: isArabic ? 'left' : 'right' }}>85.00</span>
                    </div>
                </div>
            </div>
            
            <div className="border-b-2 border-dotted border-gray-300 my-4" />

            {/* Totals */}
            <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                    <span>{t.subtotal}</span>
                    <span>{subtotalAmount.toFixed(2)} {currency}</span>
                </div>
                <div className="flex justify-between">
                    <span>
                        {t.taxLabel} ({taxRateNum}%) {tax_inclusive ? t.incl : ''}
                    </span>
                    <span>{taxAmount} {currency}</span>
                </div>
                <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-gray-300">
                    <span>{t.total}</span>
                    <span>{totalAmount} {currency}</span>
                </div>
            </div>

            <div className="border-b-2 border-dashed border-gray-400 my-4" />

            {/* Receipt Footer */}
            <div className="text-center space-y-3">
                {wifi_password && (
                    <div className="inline-flex items-center justify-center space-x-2 border border-black/20 px-3 py-1 rounded text-xs bg-gray-50">
                        <FiWifi className="w-4 h-4 ml-2" />
                        <span>{t.wifi}: {wifi_password}</span>
                    </div>
                )}
                
                {receipt_footer_msg && (
                    <p className="text-xs italic whitespace-pre-wrap">{receipt_footer_msg}</p>
                )}

                {!isA4 && (
                    <p className="text-[10px] text-gray-400 mt-4">Powered by Waitless POS</p>
                )}
            </div>
        </div>
    );
}
