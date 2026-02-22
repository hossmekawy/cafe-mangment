import io
import pdfkit
import pandas as pd
from django.template.loader import render_to_string
from django.conf import settings
import arabic_reshaper
from bidi.algorithm import get_display

def _reshape_arabic(text):
    if not isinstance(text, str):
        return text
    # Checks if contains arabic characters, reshape it for wkhtmltopdf proper rendering
    reshaped_text = arabic_reshaper.reshape(text)
    return get_display(reshaped_text)

def generate_pdf(template_name, context, lang='en'):
    """
    Renders an HTML template to a PDF byte string.
    :param template_name: path to the Django template
    :param context: context dict for the template
    :param lang: language code (ar/en)
    """
    # If Arabic, we want proper text shaping for wkhtmltopdf
    is_rtl = lang == 'ar'
    context['is_rtl'] = is_rtl
    context['lang'] = lang
    
    # We optionally reshape strings in context if wkhtmltopdf needs it, 
    # but modern qt versions handle it if dir="rtl". 
    # Let's pass a reshaper function to the template just in case
    context['reshape'] = _reshape_arabic

    html_string = render_to_string(template_name, context)
    
    options = {
        'page-size': 'A4',
        'margin-top': '0.75in',
        'margin-right': '0.75in',
        'margin-bottom': '0.75in',
        'margin-left': '0.75in',
        'encoding': "UTF-8",
        'no-outline': None
    }
    
    pdf_bytes = pdfkit.from_string(html_string, False, options=options)
    return pdf_bytes

def generate_excel(data, columns, file_name="report"):
    """
    Generates an Excel byte stream from list of dictionaries.
    :param data: list of dicts representing rows
    :param columns: ordered list of headers (keys mapping to data)
    """
    output = io.BytesIO()
    
    # Simple Pandas ExcelWriter
    df = pd.DataFrame(data)
    
    # Reorder columns if we have data
    if not df.empty and columns:
        valid_cols = [c for c in columns if c in df.columns]
        df = df[valid_cols]

    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Sheet1')
        workbook = writer.book
        worksheet = writer.sheets['Sheet1']
        
        # Format the headers
        header_format = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'top',
            'bg_color': '#D7E4BC',
            'border': 1
        })
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            # Add auto-width
            worksheet.set_column(col_num, col_num, 15)
            
    return output.getvalue()
