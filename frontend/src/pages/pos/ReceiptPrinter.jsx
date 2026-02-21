import useSettingsStore from '../../store/settingsStore';
import { format } from 'date-fns';

// Page dimensions per printer type
const PRINTER_SIZES = {
    thermal80: { width: '80mm', fontSize: '12px', headingSize: '15px', logoMaxH: '60px' },
    thermal72: { width: '72mm', fontSize: '11px', headingSize: '14px', logoMaxH: '55px' },
    a4:        { width: '210mm', fontSize: '13px', headingSize: '20px', logoMaxH: '80px' },
    a5:        { width: '148mm', fontSize: '12px', headingSize: '17px', logoMaxH: '70px' },
};

/**
 * Opens a dedicated popup window and prints an isolated, premium thermal receipt.
 * Uses settings from the Zustand store (printer type, language, logo, brand, tax, etc.)
 */
export const printReceipt = ({ order, cart, subtotal, taxInfo, serviceCharge, discountInfo, total, payments }) => {
    const settings = useSettingsStore.getState().settings || {};

    const printerType = settings.receipt_printer_type || 'thermal80';
    const size = PRINTER_SIZES[printerType] || PRINTER_SIZES.thermal80;
    const isWide = printerType === 'a4' || printerType === 'a5';

    const currency   = settings.currency       || 'EGP';
    const lang       = settings.receipt_language || 'en';
    const isArabic   = lang === 'ar';
    const dir        = isArabic ? 'rtl' : 'ltr';
    const fontFamily = isArabic
        ? "'Cairo', 'Segoe UI', Arial, sans-serif"
        : "'Courier New', Courier, monospace";
    const taxLabel   = settings.tax_label      || 'VAT';
    const taxRate    = parseFloat(settings.tax_rate || 0);
    const isInclusive = settings.tax_inclusive;
    const brandName  = settings.brand_name     || 'Waitless';
    const brandPhone = settings.brand_phone    || '';
    const address    = settings.address        || '';
    const logoB64    = settings.logo_base64    || '';
    const wifiPwd    = settings.wifi_password  || '';
    const headerMsg  = settings.receipt_header_msg || '';
    const footerMsg  = settings.receipt_footer_msg || 'Thank you for visiting!';
    const socialLink = settings.social_link    || '';

    // Labels
    const lbl = {
        orderNo:   isArabic ? 'رقم الطلب'     : 'Order #',
        date:      isArabic ? 'التاريخ'       : 'Date',
        type:      isArabic ? 'نوع الطلب'     : 'Type',
        cashier:   isArabic ? 'الكاشير'       : 'Cashier',
        table:     isArabic ? 'الطاولة'       : 'Table',
        customer:  isArabic ? 'العميل'        : 'Customer',
        item:      isArabic ? 'الصنف'         : 'Item',
        qty:       isArabic ? 'الكمية'        : 'Qty',
        price:     isArabic ? 'السعر'         : 'Price',
        subtotal:  isArabic ? 'المجموع الفرعي' : 'Subtotal',
        tax:       isArabic
            ? `${taxLabel} (${taxRate}%)${isInclusive ? ' (شامل)' : ''}`
            : `${taxLabel} (${taxRate}%)${isInclusive ? ' (INCL)' : ''}`,
        service:   isArabic ? 'رسوم الخدمة'   : 'Service Charge',
        discount:  isArabic ? 'خصم'           : 'Discount',
        total:     isArabic ? 'الإجمالي'      : 'TOTAL',
        payments:  isArabic ? 'المدفوعات'     : 'PAYMENTS',
        wifi:      isArabic ? 'كلمة مرور Wi-Fi' : 'Wi-Fi Password',
        dineIn:    isArabic ? 'داخل المحل'    : 'Dine-In',
        takeaway:  isArabic ? 'تيك اواي'      : 'Takeaway',
        delivery:  isArabic ? 'توصيل'         : 'Delivery',
    };

    const orderTypeLabel = {
        dine_in: lbl.dineIn, takeaway: lbl.takeaway, delivery: lbl.delivery,
    }[order?.order_type] || (order?.order_type || '');

    // Resolve item list — pick the localized name based on receipt language
    const getItemName = (enName, arName) =>
        isArabic && arName ? arName : (enName || arName || 'Item');

    const items = (order?.items && order.items.length > 0)
        ? order.items.map(i => ({
            name:  getItemName(i.product_name, i.product_name_ar),
            qty:   i.quantity,
            unit:  parseFloat(i.unit_price || 0),
            total: parseFloat(i.total_price || (i.unit_price * i.quantity) || 0),
            mods:  i.modifiers_details?.map(m => m.name) || [],
            notes: i.special_instructions,
        }))
        : (cart || []).map(i => ({
            name:  getItemName(
                i.product?.name    || i.product_name    || 'Item',
                i.product?.name_ar || i.product_name_ar || ''
            ),
            qty:   i.quantity,
            unit:  parseFloat(i.unit_price || 0),
            total: parseFloat(i.total_price || (i.unit_price * i.quantity) || 0),
            mods:  i.modifiersObjects?.map(m => m.name) || [],
            notes: i.special_instructions,
        }));

    const dateStr = order?.created_at
        ? format(new Date(order.created_at), 'dd/MM/yyyy  HH:mm')
        : format(new Date(), 'dd/MM/yyyy  HH:mm');

    const fmt = (v) => parseFloat(v || 0).toFixed(2);

    // ── HTML Sections ──────────────────────────────────────────────
    const logoSection = logoB64
        ? `<img src="${logoB64}" alt="${brandName}" style="max-height:${size.logoMaxH};max-width:90%;display:block;margin:0 auto 6px;object-fit:contain;">`
        : `<div style="font-size:28px;margin-bottom:4px;letter-spacing:2px;">☕</div>`;

    const headerSection = `
    <div class="header-block">
        ${logoSection}
        <div class="brand-name">${brandName}</div>
        ${brandPhone ? `<div class="brand-sub">${brandPhone}</div>` : ''}
        ${address    ? `<div class="brand-sub">${address}</div>` : ''}
        ${headerMsg  ? `<div class="brand-sub italic">"${headerMsg}"</div>` : ''}
    </div>`;

    const metaSection = `
    <div class="meta-block">
        <div class="meta-row"><span>${lbl.orderNo}</span><strong>${order?.order_number || '—'}</strong></div>
        <div class="meta-row"><span>${lbl.date}</span><span>${dateStr}</span></div>
        <div class="meta-row"><span>${lbl.type}</span><span>${orderTypeLabel}</span></div>
        ${order?.table_number  ? `<div class="meta-row"><span>${lbl.table}</span><span>${order.table_number}</span></div>` : ''}
        ${order?.customer_name ? `<div class="meta-row"><span>${lbl.customer}</span><span>${order.customer_name}</span></div>` : ''}
        ${order?.waiter_name   ? `<div class="meta-row"><span>${lbl.cashier}</span><span>${order.waiter_name}</span></div>` : ''}
    </div>`;

    const itemRows = items.map(item => `
        <tr class="item-row">
            <td class="item-name">
                ${item.name}
                ${item.mods.length ? `<br><span class="item-modifier">↳ ${item.mods.join(' · ')}</span>` : ''}
                ${item.notes ? `<br><span class="item-note">"${item.notes}"</span>` : ''}
            </td>
            <td class="item-qty">${item.qty}</td>
            <td class="item-price">${currency} ${fmt(item.total)}</td>
        </tr>`
    ).join('');

    const itemsSection = `
    <table class="items-table">
        <thead>
            <tr>
                <th class="th-item">${lbl.item}</th>
                <th class="th-qty">${lbl.qty}</th>
                <th class="th-price">${lbl.price}</th>
            </tr>
        </thead>
        <tbody>${itemRows}</tbody>
    </table>`;

    const totalsSection = `
    <div class="totals-block">
        ${parseFloat(discountInfo || 0) > 0 ? `<div class="total-row"><span>${lbl.discount}</span><span class="discount-val">− ${currency} ${fmt(discountInfo)}</span></div>` : ''}
        <div class="total-row"><span>${lbl.subtotal}</span><span>${currency} ${fmt(subtotal)}</span></div>
        ${parseFloat(serviceCharge || 0) > 0 ? `<div class="total-row"><span>${lbl.service}</span><span>${currency} ${fmt(serviceCharge)}</span></div>` : ''}
        ${parseFloat(taxInfo || 0) > 0 ? `<div class="total-row"><span>${lbl.tax}</span><span>${currency} ${fmt(taxInfo)}</span></div>` : ''}
        <div class="total-final">
            <span>${lbl.total}</span>
            <span>${currency} ${fmt(total)}</span>
        </div>
    </div>`;

    const paymentsSection = (payments && payments.length > 0) ? `
    <div class="section-title">${lbl.payments}</div>
    <div class="payments-block">
        ${payments.map(p => `
            <div class="total-row">
                <span style="text-transform:capitalize;">${p.method?.replace(/_/g, ' ') || 'Cash'}</span>
                <span>${currency} ${fmt(p.amount)}</span>
            </div>`).join('')}
    </div>` : '';

    const wifiSection = wifiPwd ? `
    <div class="wifi-block">
        <span class="wifi-icon">📶</span>
        <span>${lbl.wifi}: <strong>${wifiPwd}</strong></span>
    </div>` : '';

    const qrSection = socialLink ? `
    <div class="qr-placeholder">
        <div style="font-size:10px;color:#888;margin-top:4px;">${socialLink}</div>
    </div>` : '';

    const footerSection = `
    <div class="footer-block">
        ${footerMsg ? `<div class="footer-msg">${footerMsg}</div>` : ''}
        <div class="powered-by">Powered by Waitless</div>
    </div>`;

    // ── CSS ───────────────────────────────────────────────────────
    const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        font-family: ${fontFamily};
        font-size: ${size.fontSize};
        color: #111;
        background: #fff;
        width: ${size.width};
        padding: ${isWide ? '20mm 15mm' : '6px 8px'};
        direction: ${dir};
    }

    /* ─ Header ─ */
    .header-block {
        text-align: center;
        padding-bottom: ${isWide ? '10px' : '6px'};
        margin-bottom: ${isWide ? '10px' : '6px'};
        border-bottom: 2px solid #111;
    }
    .brand-name {
        font-size: ${size.headingSize};
        font-weight: 900;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin: 4px 0 2px;
    }
    .brand-sub {
        font-size: calc(${size.fontSize} - 1px);
        color: #444;
        margin-top: 2px;
    }
    .italic { font-style: italic; }

    /* ─ Meta ─ */
    .meta-block {
        margin: ${isWide ? '10px 0' : '6px 0'};
        padding: ${isWide ? '8px 0' : '4px 0'};
        border-bottom: 1px dashed #888;
    }
    .meta-row {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
        font-size: calc(${size.fontSize} - 0.5px);
    }
    .meta-row strong { font-weight: 700; }

    /* ─ Items Table ─ */
    .items-table {
        width: 100%;
        border-collapse: collapse;
        margin: ${isWide ? '10px 0' : '6px 0'};
    }
    .items-table thead tr {
        border-top: 1px solid #111;
        border-bottom: 1px solid #111;
    }
    th {
        font-size: calc(${size.fontSize} - 1px);
        font-weight: 700;
        padding: 3px 2px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    .th-item  { text-align: ${isArabic ? 'right' : 'left'}; }
    .th-qty   { text-align: center; width: ${isWide ? '60px' : '28px'}; }
    .th-price { text-align: ${isArabic ? 'left' : 'right'}; width: ${isWide ? '90px' : '60px'}; }

    .item-row td { padding: ${isWide ? '5px 3px' : '3px 2px'}; vertical-align: top; }
    .item-row + .item-row td { border-top: 1px dotted #ddd; }
    .item-name  { text-align: ${isArabic ? 'right' : 'left'}; line-height: 1.4; }
    .item-qty   { text-align: center; }
    .item-price { text-align: ${isArabic ? 'left' : 'right'}; white-space: nowrap; font-weight: 600; }
    .item-modifier { font-size: calc(${size.fontSize} - 2px); color: #555; }
    .item-note     { font-size: calc(${size.fontSize} - 2px); font-style: italic; color: #777; }

    /* ─ Totals ─ */
    .totals-block {
        margin: 4px 0;
        padding-top: 4px;
        border-top: 1px solid #111;
    }
    .total-row {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
        font-size: calc(${size.fontSize} - 0.5px);
        color: #333;
    }
    .discount-val { color: #444; }
    .total-final {
        display: flex;
        justify-content: space-between;
        margin-top: 5px;
        padding: ${isWide ? '6px 0' : '4px 0'};
        border-top: 2px solid #111;
        border-bottom: 2px solid #111;
        font-size: ${isWide ? 'calc(' + size.headingSize + ' - 2px)' : 'calc(' + size.fontSize + ' + 2px)'};
        font-weight: 900;
        letter-spacing: 0.5px;
    }

    /* ─ Payments ─ */
    .section-title {
        font-size: calc(${size.fontSize} - 1px);
        font-weight: 700;
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin: ${isWide ? '10px 0 4px' : '6px 0 3px'};
        color: #444;
    }
    .payments-block {
        border-bottom: 1px dashed #888;
        padding-bottom: 4px;
        margin-bottom: 4px;
    }

    /* ─ Wi-Fi ─ */
    .wifi-block {
        text-align: center;
        font-size: calc(${size.fontSize} - 1px);
        margin: ${isWide ? '10px 0' : '6px 0'};
        padding: 4px 8px;
        border: 1px dashed #aaa;
        border-radius: 4px;
        color: #333;
    }
    .wifi-icon { margin-${isArabic ? 'left' : 'right'}: 4px; }

    /* ─ Footer ─ */
    .footer-block {
        text-align: center;
        margin-top: ${isWide ? '16px' : '10px'};
        padding-top: ${isWide ? '10px' : '6px'};
        border-top: 1px dashed #888;
    }
    .footer-msg {
        font-size: ${isWide ? size.fontSize : 'calc(' + size.fontSize + ' - 1px)'};
        font-weight: 700;
        margin-bottom: 3px;
    }
    .powered-by {
        font-size: calc(${size.fontSize} - 2px);
        color: #aaa;
        margin-top: 2px;
    }

    /* ─ Print page size ─ */
    @media print {
        @page {
            margin: 0;
            size: ${size.width} auto;
        }
        body {
            width: ${size.width};
            padding: ${isWide ? '15mm 12mm' : '4px 6px'};
        }
    }`;

    // ── Full HTML ─────────────────────────────────────────────────
    const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${brandName} — Receipt</title>
    ${isArabic ? '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">' : ''}
    <style>${css}</style>
</head>
<body>
    ${headerSection}
    ${metaSection}
    ${itemsSection}
    ${totalsSection}
    ${paymentsSection}
    ${wifiSection}
    ${qrSection}
    ${footerSection}
</body>
</html>`;

    // ── Open Popup & Print ────────────────────────────────────────
    const printWindow = window.open(
        '',
        '_blank',
        `width=400,height=700,toolbar=0,menubar=0,location=0,scrollbars=1,resizable=1`
    );

    if (!printWindow) {
        alert('Please allow popups for this site to enable receipt printing.');
        return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    // Wait for fonts/images to settle, then print
    const doPrint = () => {
        printWindow.print();
        // Close after print dialog is dismissed
        printWindow.onafterprint = () => printWindow.close();
        // Fallback close if onafterprint not supported
        setTimeout(() => { if (!printWindow.closed) printWindow.close(); }, 5000);
    };

    printWindow.onload = () => setTimeout(doPrint, isArabic ? 600 : 200);
    // Safety fallback
    setTimeout(() => { if (!printWindow.closed) doPrint(); }, 1500);
};
