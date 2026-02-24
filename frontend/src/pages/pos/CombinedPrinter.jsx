import useSettingsStore from '../../store/settingsStore';
import { format } from 'date-fns';

const PRINTER_SIZES = {
    thermal80: { width: '80mm', fontSize: '13px', headingSize: '16px', logoMaxH: '60px' },
    thermal72: { width: '72mm', fontSize: '12px', headingSize: '15px', logoMaxH: '55px' },
    a4:        { width: '210mm', fontSize: '14px', headingSize: '22px', logoMaxH: '80px' },
    a5:        { width: '148mm', fontSize: '13px', headingSize: '18px', logoMaxH: '70px' },
};

/**
 * Prints both the kitchen ticket AND the customer receipt in a single print job.
 * Uses a page-break between them — thermal printers treat this as a paper cut.
 * No popup window is opened; content is injected into a hidden div on the current page.
 *
 * @param {object} opts
 * @param {object}  opts.order         - The finalized server-side order object (with nested items)
 * @param {Array}   opts.cart          - Cart array (fallback if order.items is empty)
 * @param {number}  opts.subtotal
 * @param {number}  opts.taxInfo       - Calculated tax amount
 * @param {number}  opts.serviceCharge
 * @param {number}  opts.discountInfo  - Combined discount amount
 * @param {number}  opts.total
 * @param {Array}   opts.payments      - Array of {method, amount}
 * @param {boolean} [opts.kitchenOnly] - When true, skip the receipt section (e.g. "Hold" button)
 */
export const printCombined = ({
    order,
    cart,
    subtotal,
    taxInfo,
    serviceCharge,
    discountInfo,
    total,
    payments,
    kitchenOnly = false,
}) => {
    const settings = useSettingsStore.getState().settings || {};

    const printerType = settings.receipt_printer_type || 'thermal80';
    const size = PRINTER_SIZES[printerType] || PRINTER_SIZES.thermal80;
    const isWide = printerType === 'a4' || printerType === 'a5';

    const currency    = settings.currency        || 'EGP';
    const lang        = settings.receipt_language || 'en';
    const isArabic    = lang === 'ar';
    const dir         = isArabic ? 'rtl' : 'ltr';
    const fontFamily  = isArabic
        ? "'Cairo', 'Segoe UI', Arial, sans-serif"
        : "'Courier New', Courier, monospace";

    // ── Shared data ───────────────────────────────────────────────
    const taxLabel    = settings.tax_label       || 'VAT';
    const taxRate     = parseFloat(settings.tax_rate || 0);
    const isInclusive = settings.tax_inclusive;
    const brandName   = settings.brand_name      || 'Waitless';
    const brandPhone  = settings.brand_phone     || '';
    const address     = settings.address         || '';
    const logoB64     = settings.logo_base64     || '';
    const wifiPwd     = settings.wifi_password   || '';
    const headerMsg   = settings.receipt_header_msg || '';
    const footerMsg   = settings.receipt_footer_msg || 'Thank you for visiting!';

    const lbl = {
        // kitchen
        kitchenTicket: isArabic ? 'تذكرة المطبخ'      : 'KITCHEN TICKET',
        orderNo:       isArabic ? 'رقم الطلب'          : 'Order #',
        date:          isArabic ? 'التاريخ'            : 'Date',
        type:          isArabic ? 'نوع الطلب'          : 'Type',
        table:         isArabic ? 'الطاولة'            : 'Table',
        notes:         isArabic ? 'ملاحظات'            : 'Notes',
        item:          isArabic ? 'الصنف'              : 'Item',
        qty:           isArabic ? 'الكمية'             : 'Qty',
        dineIn:        isArabic ? 'داخل المحل'         : 'Dine-In',
        takeaway:      isArabic ? 'تيك اواي'           : 'Takeaway',
        delivery:      isArabic ? 'توصيل'              : 'Delivery',
        // receipt
        cashier:       isArabic ? 'الكاشير'            : 'Cashier',
        customer:      isArabic ? 'العميل'             : 'Customer',
        price:         isArabic ? 'السعر'              : 'Price',
        subtotal:      isArabic ? 'المجموع الفرعي'     : 'Subtotal',
        tax:           isArabic
            ? `${taxLabel} (${taxRate}%)${isInclusive ? ' (شامل)' : ''}`
            : `${taxLabel} (${taxRate}%)${isInclusive ? ' (INCL)' : ''}`,
        service:       isArabic ? 'رسوم الخدمة'        : 'Service Charge',
        discount:      isArabic ? 'خصم'                : 'Discount',
        totalLbl:      isArabic ? 'الإجمالي'           : 'TOTAL',
        payments:      isArabic ? 'المدفوعات'          : 'PAYMENTS',
        wifi:          isArabic ? 'كلمة مرور Wi-Fi'    : 'Wi-Fi Password',
    };

    const orderTypeLabel = {
        dine_in: lbl.dineIn, takeaway: lbl.takeaway, delivery: lbl.delivery,
    }[order?.order_type] || (order?.order_type || '');

    const getItemName = (enName, arName) =>
        isArabic && arName ? arName : (enName || arName || 'Item');

    // Resolve items — prefer nested order.items from the server (with product_name etc.)
    const kitchenItems = (order?.items && order.items.length > 0)
        ? order.items.map(i => ({
            name:      getItemName(i.product_name, i.product_name_ar),
            qty:       i.quantity,
            variation: i.variation_name || '',
            mods:      i.modifiers_details?.map(m => m.name) || [],
            notes:     i.special_instructions,
        }))
        : (cart || []).map(i => ({
            name:      getItemName(
                i.product?.name    || i.product_name    || 'Item',
                i.product?.name_ar || i.product_name_ar || ''
            ),
            qty:       i.quantity,
            variation: i.variation?.size_name || '',
            mods:      i.modifiersObjects?.map(m => m.name) || [],
            notes:     i.special_instructions,
        }));

    const receiptItems = (order?.items && order.items.length > 0)
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

    // ── Kitchen Ticket HTML ───────────────────────────────────────
    const kitchenRows = kitchenItems.map(item => `
        <tr class="k-row">
            <td class="k-qty"><strong>${item.qty}x</strong></td>
            <td class="k-name">
                <span class="k-product">${item.name}</span>
                ${item.variation ? `<span class="k-var">[${item.variation}]</span>` : ''}
                ${item.mods.length ? `<div class="k-mod">+ ${item.mods.join('<br>+ ')}</div>` : ''}
                ${item.notes ? `<div class="k-note">*** ${item.notes} ***</div>` : ''}
            </td>
        </tr>`).join('');

    const kitchenHTML = `
    <div class="section kitchen-section">
        <div class="k-meta">
            <h1 class="k-header">${lbl.kitchenTicket}</h1>
            <div class="k-row-meta bold"><span>${lbl.orderNo}</span><strong>${order?.order_number || '—'}</strong></div>
            <div class="k-row-meta"><span>${lbl.date}</span><span>${dateStr}</span></div>
            <div class="k-row-meta bold"><span>${lbl.type}</span><span>${orderTypeLabel}</span></div>
            ${order?.table_number ? `<div class="k-row-meta k-table"><span>${lbl.table}</span><strong>${order.table_number}</strong></div>` : ''}
        </div>
        <table class="k-table">
            <tbody>${kitchenRows}</tbody>
        </table>
        <div class="k-end">-- END OF TICKET --</div>
    </div>`;

    // ── Receipt HTML ───────────────────────────────────────────────
    const logoSection = logoB64
        ? `<img src="${logoB64}" alt="${brandName}" style="max-height:${size.logoMaxH};max-width:90%;display:block;margin:0 auto 6px;object-fit:contain;">`
        : `<div style="font-size:28px;margin-bottom:4px;">☕</div>`;

    const receiptRows = receiptItems.map(item => `
        <tr class="r-row">
            <td class="r-name">
                ${item.name}
                ${item.mods.length ? `<br><span class="r-mod">↳ ${item.mods.join(' · ')}</span>` : ''}
                ${item.notes ? `<br><span class="r-note">"${item.notes}"</span>` : ''}
            </td>
            <td class="r-qty">${item.qty}</td>
            <td class="r-price">${currency} ${fmt(item.total)}</td>
        </tr>`).join('');

    const paymentsList = (payments && payments.length > 0)
        ? payments.map(p => `
            <div class="r-total-row">
                <span style="text-transform:capitalize;">${p.method?.replace(/_/g, ' ') || 'Cash'}</span>
                <span>${currency} ${fmt(p.amount)}</span>
            </div>`).join('')
        : '';

    const receiptHTML = `
    <div class="section receipt-section">
        <div class="r-header">
            ${logoSection}
            <div class="r-brand">${brandName}</div>
            ${brandPhone ? `<div class="r-sub">${brandPhone}</div>` : ''}
            ${address    ? `<div class="r-sub">${address}</div>`    : ''}
            ${headerMsg  ? `<div class="r-sub italic">"${headerMsg}"</div>` : ''}
        </div>

        <div class="r-meta">
            <div class="r-meta-row"><span>${lbl.orderNo}</span><strong>${order?.order_number || '—'}</strong></div>
            <div class="r-meta-row"><span>${lbl.date}</span><span>${dateStr}</span></div>
            <div class="r-meta-row"><span>${lbl.type}</span><span>${orderTypeLabel}</span></div>
            ${order?.table_number  ? `<div class="r-meta-row"><span>${lbl.table}</span><span>${order.table_number}</span></div>` : ''}
            ${order?.customer_name ? `<div class="r-meta-row"><span>${lbl.customer}</span><span>${order.customer_name}</span></div>` : ''}
            ${order?.waiter_name   ? `<div class="r-meta-row"><span>${lbl.cashier}</span><span>${order.waiter_name}</span></div>` : ''}
        </div>

        <table class="r-items">
            <thead>
                <tr>
                    <th class="th-item">${lbl.item}</th>
                    <th class="th-qty">${lbl.qty}</th>
                    <th class="th-price">${lbl.price}</th>
                </tr>
            </thead>
            <tbody>${receiptRows}</tbody>
        </table>

        <div class="r-totals">
            ${parseFloat(discountInfo || 0) > 0 ? `<div class="r-total-row"><span>${lbl.discount}</span><span>− ${currency} ${fmt(discountInfo)}</span></div>` : ''}
            <div class="r-total-row"><span>${lbl.subtotal}</span><span>${currency} ${fmt(subtotal)}</span></div>
            ${parseFloat(serviceCharge || 0) > 0 ? `<div class="r-total-row"><span>${lbl.service}</span><span>${currency} ${fmt(serviceCharge)}</span></div>` : ''}
            ${parseFloat(taxInfo || 0) > 0 ? `<div class="r-total-row"><span>${lbl.tax}</span><span>${currency} ${fmt(taxInfo)}</span></div>` : ''}
            <div class="r-total-final">
                <span>${lbl.totalLbl}</span>
                <span>${currency} ${fmt(total)}</span>
            </div>
        </div>

        ${paymentsList ? `<div class="r-section-title">${lbl.payments}</div><div class="r-payments">${paymentsList}</div>` : ''}

        ${wifiPwd ? `<div class="r-wifi">📶 ${lbl.wifi}: <strong>${wifiPwd}</strong></div>` : ''}

        <div class="r-footer">
            ${footerMsg ? `<div class="r-footer-msg">${footerMsg}</div>` : ''}
            <div class="r-powered">Powered by Waitless</div>
        </div>
    </div>`;

    // ── Combined CSS ──────────────────────────────────────────────
    const arabicFont = isArabic
        ? `@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');`
        : '';

    const css = `
    ${arabicFont}

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        font-family: ${fontFamily};
        font-size: ${size.fontSize};
        color: #000;
        background: #fff;
        direction: ${dir};
    }

    /* ── Section wrapper ─────────────────────── */
    .section {
        width: ${size.width};
        padding: ${isWide ? '15mm 12mm' : '4px 6px'};
    }

    /* ── Cutter / page break between tickets ── */
    .print-cutter {
        page-break-after: always;
        break-after: page;
        height: 0; margin: 0; padding: 0; border: none;
    }

    /* ════════════════════════════════════════
       KITCHEN TICKET STYLES (k- prefix)
    ════════════════════════════════════════ */
    .k-header {
        text-align: center;
        font-size: ${size.headingSize};
        font-weight: 900;
        text-transform: uppercase;
        margin-bottom: 8px;
        padding-bottom: 5px;
        border-bottom: 2px solid #000;
        letter-spacing: 1px;
    }
    .k-meta {
        margin-bottom: 10px;
        border-bottom: 2px dashed #000;
        padding-bottom: 6px;
    }
    .k-row-meta {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
        font-size: calc(${size.fontSize} + 1px);
    }
    .k-row-meta.bold { font-weight: 700; }
    .k-table-meta {
        display: flex;
        justify-content: space-between;
        font-size: calc(${size.fontSize} + 4px);
        background-color: #000;
        color: #fff;
        padding: 4px 8px;
        margin-top: 4px;
        border-radius: 4px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .k-table { width: 100%; border-collapse: collapse; }
    .k-row td {
        padding: 8px 0;
        vertical-align: top;
        border-bottom: 1px solid #ccc;
    }
    .k-qty {
        width: 40px;
        font-size: calc(${size.fontSize} + 4px);
        padding-right: 5px;
    }
    .k-product {
        font-size: calc(${size.fontSize} + 2px);
        font-weight: 700;
    }
    .k-var {
        font-size: calc(${size.fontSize} + 1px);
        font-weight: 900;
        margin-left: 5px;
        white-space: nowrap;
    }
    .k-mod {
        font-size: calc(${size.fontSize} - 1px);
        margin-top: 4px;
        padding-left: 10px;
        font-weight: 700;
        color: #333;
    }
    .k-note {
        font-size: ${size.fontSize};
        font-style: italic;
        font-weight: 900;
        margin-top: 5px;
        padding: 4px;
        border: 2px solid #000;
        display: inline-block;
        background: #f0f0f0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .k-end {
        text-align: center;
        margin-top: 16px;
        font-weight: bold;
        border-top: 2px solid #000;
        padding-top: 8px;
        font-size: ${size.fontSize};
    }

    /* ════════════════════════════════════════
       RECEIPT STYLES (r- prefix)
    ════════════════════════════════════════ */
    .r-header { text-align: center; padding-bottom: 6px; margin-bottom: 6px; border-bottom: 2px solid #111; }
    .r-brand  { font-size: ${size.headingSize}; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; margin: 4px 0 2px; }
    .r-sub    { font-size: calc(${size.fontSize} - 1px); color: #444; margin-top: 2px; }
    .italic   { font-style: italic; }

    .r-meta     { margin: 6px 0; padding: 4px 0; border-bottom: 1px dashed #888; }
    .r-meta-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: calc(${size.fontSize} - 0.5px); }
    .r-meta-row strong { font-weight: 700; }

    .r-items { width: 100%; border-collapse: collapse; margin: 6px 0; }
    .r-items thead tr { border-top: 1px solid #111; border-bottom: 1px solid #111; }
    th { font-size: calc(${size.fontSize} - 1px); font-weight: 700; padding: 3px 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .th-item  { text-align: ${isArabic ? 'right' : 'left'}; }
    .th-qty   { text-align: center; width: ${isWide ? '60px' : '28px'}; }
    .th-price { text-align: ${isArabic ? 'left' : 'right'}; width: ${isWide ? '90px' : '60px'}; }

    .r-row td { padding: ${isWide ? '5px 3px' : '3px 2px'}; vertical-align: top; }
    .r-row + .r-row td { border-top: 1px dotted #ddd; }
    .r-name  { text-align: ${isArabic ? 'right' : 'left'}; line-height: 1.4; }
    .r-qty   { text-align: center; }
    .r-price { text-align: ${isArabic ? 'left' : 'right'}; white-space: nowrap; font-weight: 600; }
    .r-mod   { font-size: calc(${size.fontSize} - 2px); color: #555; }
    .r-note  { font-size: calc(${size.fontSize} - 2px); font-style: italic; color: #777; }

    .r-totals      { margin: 4px 0; padding-top: 4px; border-top: 1px solid #111; }
    .r-total-row   { display: flex; justify-content: space-between; padding: 2px 0; font-size: calc(${size.fontSize} - 0.5px); color: #333; }
    .r-total-final { display: flex; justify-content: space-between; margin-top: 5px; padding: 4px 0; border-top: 2px solid #111; border-bottom: 2px solid #111; font-size: calc(${size.fontSize} + 2px); font-weight: 900; }

    .r-section-title { font-size: calc(${size.fontSize} - 1px); font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin: 6px 0 3px; color: #444; }
    .r-payments      { border-bottom: 1px dashed #888; padding-bottom: 4px; margin-bottom: 4px; }
    .r-wifi          { text-align: center; font-size: calc(${size.fontSize} - 1px); margin: 6px 0; padding: 4px 8px; border: 1px dashed #aaa; border-radius: 4px; color: #333; }

    .r-footer     { text-align: center; margin-top: 10px; padding-top: 6px; border-top: 1px dashed #888; }
    .r-footer-msg { font-size: ${size.fontSize}; font-weight: 700; margin-bottom: 3px; }
    .r-powered    { font-size: calc(${size.fontSize} - 2px); color: #aaa; margin-top: 2px; }

    /* ── Print page settings ─── */
    @media print {
        @page {
            margin: 0;
            size: ${size.width} auto;
        }
        body { background: #fff; }
        .section { width: ${size.width}; }
        /* Force the table highlight background */
        .k-table-meta {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
    }`;

    // ── Assemble final HTML ───────────────────────────────────────
    const content = kitchenOnly
        ? kitchenHTML
        : `${kitchenHTML}<div class="print-cutter"></div>${receiptHTML}`;

    // ── Inject into a hidden iframe to prevent main DOM thrashing ──
    let iframe = document.getElementById('pos-print-iframe');
    if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'pos-print-iframe';
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        iframe.style.visibility = 'hidden';
        document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
        <!DOCTYPE html>
        <html dir="${dir}">
            <head>
                <meta charset="utf-8">
                <style>${css}</style>
            </head>
            <body>
                ${content}
            </body>
        </html>
    `);
    doc.close();

    // Small delay to allow any Google Fonts and images to load
    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }, isArabic ? 600 : 200);
};
