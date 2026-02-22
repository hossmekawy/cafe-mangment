import React from 'react';
import useSettingsStore from '../../store/settingsStore';
import { format } from 'date-fns';

const PRINTER_SIZES = {
    thermal80: { width: '80mm', fontSize: '14px', headingSize: '18px' },
    thermal72: { width: '72mm', fontSize: '13px', headingSize: '16px' },
    a4:        { width: '210mm', fontSize: '16px', headingSize: '24px' },
    a5:        { width: '148mm', fontSize: '15px', headingSize: '20px' },
};

/**
 * Opens a dedicated popup window and prints a kitchen ticket.
 * Excludes prices. Focuses on items, modifiers, sizes, and special instructions.
 */
export const printKitchenTicket = ({ order, cart, isUpdate = false }) => {
    const settings = useSettingsStore.getState().settings || {};

    const printerType = settings.receipt_printer_type || 'thermal80';
    const size = PRINTER_SIZES[printerType] || PRINTER_SIZES.thermal80;
    const isWide = printerType === 'a4' || printerType === 'a5';

    const lang       = settings.receipt_language || 'en';
    const isArabic   = lang === 'ar';
    const dir        = isArabic ? 'rtl' : 'ltr';
    const fontFamily = isArabic
        ? "'Cairo', 'Segoe UI', Arial, sans-serif"
        : "'Courier New', Courier, monospace";

    // Labels
    const lbl = {
        orderNo:   isArabic ? 'رقم الطلب'     : 'Order #',
        date:      isArabic ? 'التاريخ'       : 'Date',
        type:      isArabic ? 'نوع الطلب'     : 'Type',
        table:     isArabic ? 'الطاولة'       : 'Table',
        notes:     isArabic ? 'ملاحظات'       : 'Notes',
        item:      isArabic ? 'الصنف'         : 'Item',
        qty:       isArabic ? 'الكمية'        : 'Qty',
        kitchenTicket: isArabic ? 'تذكرة المطبخ' : 'KITCHEN TICKET',
        updateTicket: isArabic ? 'تحديث طلب المطبخ' : 'KITCHEN TICKET (UPDATE)',
        dineIn:    isArabic ? 'داخل المحل'    : 'Dine-In',
        takeaway:  isArabic ? 'تيك اواي'      : 'Takeaway',
        delivery:  isArabic ? 'توصيل'         : 'Delivery',
    };

    const orderTypeLabel = {
        dine_in: lbl.dineIn, takeaway: lbl.takeaway, delivery: lbl.delivery,
    }[order?.order_type] || (order?.order_type || '');

    const getItemName = (enName, arName) =>
        isArabic && arName ? arName : (enName || arName || 'Item');

    // Build items payload
    const items = (order?.items && order.items.length > 0)
        ? order.items.map(i => ({
            name:  getItemName(i.product_name, i.product_name_ar),
            qty:   i.quantity,
            variation: i.variation_name || '',
            mods:  i.modifiers_details?.map(m => m.name) || [],
            notes: i.special_instructions,
        }))
        : (cart || []).map(i => ({
            name:  getItemName(
                i.product?.name    || i.product_name    || 'Item',
                i.product?.name_ar || i.product_name_ar || ''
            ),
            qty:   i.quantity,
            variation: i.variation?.size_name || '',
            mods:  i.modifiersObjects?.map(m => m.name) || [],
            notes: i.special_instructions,
        }));

    const dateStr = order?.created_at
        ? format(new Date(order.created_at), 'dd/MM/yyyy  HH:mm')
        : format(new Date(), 'dd/MM/yyyy  HH:mm');

    const headerText = isUpdate ? lbl.updateTicket : lbl.kitchenTicket;

    const metaSection = `
    <div class="meta-block">
        <h1 class="ticket-header">${headerText}</h1>
        <div class="meta-row font-bold"><span>${lbl.orderNo}</span><strong>${order?.order_number || '—'}</strong></div>
        <div class="meta-row"><span>${lbl.date}</span><span>${dateStr}</span></div>
        <div class="meta-row font-bold"><span>${lbl.type}</span><span>${orderTypeLabel}</span></div>
        ${order?.table ? `<div class="meta-row table-hilight"><span>${lbl.table}</span><strong>${order.table_number || order.table}</strong></div>` : ''}
        ${order?.table_number && !order.table ? `<div class="meta-row table-hilight"><span>${lbl.table}</span><strong>${order.table_number}</strong></div>` : ''}
    </div>`;

    const itemRows = items.map(item => `
        <tr class="item-row">
            <td class="item-qty"><strong>${item.qty}x</strong></td>
            <td class="item-name">
                <span class="product-name">${item.name}</span>
                ${item.variation ? `<span class="variation-badge">[${item.variation}]</span>` : ''}
                ${item.mods.length ? `<div class="item-modifier">+ ${item.mods.join('<br>+ ')}</div>` : ''}
                ${item.notes ? `<div class="item-note">*** ${item.notes} ***</div>` : ''}
            </td>
        </tr>`
    ).join('');

    const itemsSection = `
    <table class="items-table">
        <tbody>${itemRows}</tbody>
    </table>`;

    const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        font-family: ${fontFamily};
        font-size: ${size.fontSize};
        color: #000;
        background: #fff;
        width: ${size.width};
        padding: ${isWide ? '20mm 15mm' : '4px'};
        direction: ${dir};
    }

    .ticket-header {
        text-align: center;
        font-size: ${size.headingSize};
        font-weight: 900;
        text-transform: uppercase;
        margin-bottom: 10px;
        padding-bottom: 5px;
        border-bottom: 2px solid #000;
        letter-spacing: 1px;
    }

    .meta-block {
        margin-bottom: 10px;
        border-bottom: 2px dashed #000;
        padding-bottom: 5px;
    }

    .meta-row {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
        font-size: calc(${size.fontSize} + 1px);
    }

    .font-bold { font-weight: 700; }
    
    .table-hilight {
        font-size: calc(${size.fontSize} + 4px);
        background-color: #000;
        color: #fff !important;
        padding: 4px 8px;
        margin-top: 4px;
        border-radius: 4px;
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
    }

    .items-table {
        width: 100%;
        border-collapse: collapse;
    }

    .item-row td { 
        padding: 8px 0; 
        vertical-align: top;
        border-bottom: 1px solid #ccc;
    }

    .item-qty { 
        width: 40px; 
        font-size: calc(${size.fontSize} + 4px);
        padding-right: 5px;
    }

    .item-name { 
        line-height: 1.3;
    }

    .product-name {
        font-size: calc(${size.fontSize} + 2px);
        font-weight: 700;
    }

    .variation-badge {
        font-size: calc(${size.fontSize} + 1px);
        font-weight: 900;
        margin-left: 5px;
        white-space: nowrap;
    }

    .item-modifier { 
        font-size: calc(${size.fontSize} - 1px); 
        margin-top: 4px;
        padding-left: 10px;
        font-weight: 700;
        color: #333;
    }

    .item-note { 
        font-size: calc(${size.fontSize}); 
        font-family: inherit;
        font-style: italic; 
        font-weight: 900;
        margin-top: 5px;
        padding: 4px;
        border: 2px solid #000;
        display: inline-block;
        background: #f0f0f0;
        -webkit-print-color-adjust: exact;
    }

    @media print {
        @page {
            margin: 0;
            size: ${size.width} auto;
        }
        body {
            width: ${size.width};
            padding: ${isWide ? '15mm' : '4px'};
        }
    }`;

    const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kitchen Ticket</title>
    ${isArabic ? '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">' : ''}
    <style>${css}</style>
</head>
<body>
    ${metaSection}
    ${itemsSection}
    <div style="text-align: center; margin-top: 20px; font-weight: bold; border-top: 2px solid #000; padding-top: 10px;">
        -- END OF TICKET --
    </div>
</body>
</html>`;

    const printWindow = window.open(
        '',
        '_blank',
        'width=400,height=600,toolbar=0,menubar=0,location=0,scrollbars=1,resizable=1'
    );

    if (!printWindow) {
        console.warn('Popup blocked for kitchen printing.');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    const doPrint = () => {
        printWindow.print();
        printWindow.onafterprint = () => printWindow.close();
        setTimeout(() => { if (!printWindow.closed) printWindow.close(); }, 5000);
    };

    printWindow.onload = () => setTimeout(doPrint, isArabic ? 400 : 150);
    setTimeout(() => { if (!printWindow.closed) doPrint(); }, 1000);
};
