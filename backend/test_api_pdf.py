import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

import requests
from authentication.models import CustomUser
from rest_framework.authtoken.models import Token
import datetime
from django.utils import timezone

# 1. Get a user
user = CustomUser.objects.first()
print(f"Using test user: {user.username}")

# Get or create token (assuming DRF simplejwt or authtoken)
from rest_framework_simplejwt.tokens import RefreshToken
refresh = RefreshToken.for_user(user)
access_token = str(refresh.access_token)

# 2. Make authenticated request to backend API 
url = "http://127.0.0.1:8081/api/reports/finance/"
params = {
    'start_date': (timezone.now() - datetime.timedelta(days=30)).strftime('%Y-%m-%d'),
    'end_date': timezone.now().strftime('%Y-%m-%d'),
    'lang': 'en',
    'format': 'pdf'
}
headers = {
    'Authorization': f'Bearer {access_token}'
}

print(f"Sending GET request to {url} with params {params}")
response = requests.get(url, params=params, headers=headers)

print(f"Response Status Code: {response.status_code}")
if response.status_code == 200:
    filename = "test_api_output.pdf"
    with open(filename, 'wb') as f:
        f.write(response.content)
    print(f"Successfully generated API PDF. Size: {len(response.content)} bytes.")
else:
    print(f"Failed. Output: {response.text}")
