import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from reports.services import generate_pdf
import traceback

context = {
    'title': 'Financial Report',
    'start_date': '2023-01-01',
    'end_date': '2024-01-01',
    'lang': 'en',
    'summary': {
        'revenue': 1000,
        'expenses': 500,
        'waste': 100,
        'profit': 400
    },
    'financials': [
        {'Category': 'Sales Revenue', 'Amount': 1000}
    ]
}

try:
    print("Testing financial report rendering again...")
    pdf_bytes = generate_pdf('reports/financial_report.html', context, 'en')
    
    with open('test_output.pdf', 'wb') as f:
        f.write(pdf_bytes)
    print("PDF generated successfully and saved to test_output.pdf. Size:", len(pdf_bytes))
except Exception as e:
    print("PDF GENERATION FAILED!")
    traceback.print_exc()
