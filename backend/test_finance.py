import os
import django
import traceback
import re

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()
from django.conf import settings
settings.ALLOWED_HOSTS = ['testserver']

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from finance.models import CashShift

User = get_user_model()
su = User.objects.filter(is_superuser=True).first()

if not su:
    print("No superuser found.")
else:
    client = APIClient()
    client.force_authenticate(user=su)
    
    endpoints = [
        ('GET', '/api/finance/shifts/current/', None),
        ('POST', '/api/finance/shifts/open_shift/', {'branch': 1, 'denominations': [{'denomination': 200, 'quantity': 5}]}),
        ('GET', '/api/finance/sales/summary/', None),
        ('GET', '/api/finance/expenses/summary/', None),
        ('GET', '/api/finance/reports/?type=pnl', None),
        ('POST', '/api/finance/sales/transactions/', {
            'order_id': '00000000-0000-0000-0000-000000000000',
            'transaction_type': 'sale',
            'payment_method': 'cash',
            'gross_amount': 100,
            'net_amount': 100
        }),
        ('POST', '/api/finance/pettycash/spend/', {
            'amount': 50,
            'reason': 'Test',
            'receipt': ''
        }),
    ]
    
    with open("clean_test_log.txt", "w", encoding="utf-8") as f:
        f.write(f"Testing as superuser: {su.username} (branch: {su.branch})\n")
        for method, url, data in endpoints:
            try:
                if method == 'GET':
                    res = client.get(url, HTTP_ACCEPT='application/json')
                else:
                    res = client.post(url, data, format='json', HTTP_ACCEPT='application/json')
                
                if res.status_code >= 400:
                    content = res.content.decode('utf-8', errors='ignore')
                    # Try to extract Django exception title
                    match = re.search(r'<title>(.*?)</title>', content, re.DOTALL)
                    title = match.group(1).strip() if match else "No Title"
                    # Try to extract exception value
                    match_val = re.search(r'<pre class="exception_value">(.*?)</pre>', content, re.DOTALL)
                    val = match_val.group(1).strip() if match_val else "No Value"
                    
                    f.write(f"ERROR {res.status_code} {method} {url} | {title} | {val}\n")
                else:
                    f.write(f"SUCCESS {res.status_code} {method} {url}\n")
            except Exception as e:
                f.write(f"EXCEPTION CAUGHT on {url}: {e}\n")
