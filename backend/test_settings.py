import requests
import sys

BASE_URL = 'http://127.0.0.1:8000/api'

# 1. First, we need to register a super admin and login to get a token.
print("--- 1. Registering Manager User ---")
reg_data = {
    'username': 'manager_user',
    'name': 'Cafe Manager',
    'password': 'strongpassword123'
}
r_reg = requests.post(f"{BASE_URL}/auth/register/", data=reg_data)
print(f"Status: {r_reg.status_code}")
print(f"Response: {r_reg.json()}\n")

print("--- 2. Logging In ---")
login_data = {
    'username': 'manager_user',
    'password': 'strongpassword123'
}
r_login = requests.post(f"{BASE_URL}/auth/login/", data=login_data)
print(f"Status: {r_login.status_code}")
if r_login.status_code != 200:
    print("Login failed, assuming user exists, let's just login.")
    sys.exit(1)

access_token = r_login.json()['data']['access']
headers = {
    'Authorization': f'Bearer {access_token}'
}

# 3. Quick hack to make the user a manager (since default is cashier)
# In reality, this would be done by Super Admin or Django Admin
print("\n--- 3. Promoting User to Manager directly in DB (Hack for test) ---")
import sqlite3
conn = sqlite3.connect('db.sqlite3')
cur = conn.cursor()
cur.execute(f"UPDATE authentication_customuser SET role='manager' WHERE username='manager_user'")
conn.commit()
conn.close()
print("Success\n")

print("--- 4. Fetching Initial Settings (GET) ---")
r_get = requests.get(f"{BASE_URL}/settings/", headers=headers)
print(f"Status: {r_get.status_code}")
print(f"Response: {r_get.json()}\n")

print("--- 5. Updating Settings (PUT) ---")
update_data = {
    "brand_name": "New Awesome Cafe",
    "vat_percentage": "15.50",
    "social_link": "https://linktr.ee/hossmekawy",
    "tax_inclusive": True
}
# Using json parameters since DRF handles boolean serialization better that way
r_put = requests.put(f"{BASE_URL}/settings/", json=update_data, headers=headers)
print(f"Status: {r_put.status_code}")
print(f"Response: {r_put.json()}\n")

print("--- 6. Fetching Updated Settings (GET) ---")
r_get_updated = requests.get(f"{BASE_URL}/settings/", headers=headers)
print(f"Status: {r_get_updated.status_code}")
print(f"Response: {r_get_updated.json()}\n")
