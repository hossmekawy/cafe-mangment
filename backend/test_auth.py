import requests

BASE_URL = 'http://127.0.0.1:8000/api/auth'

print("--- Testing Registration ---")
reg_data = {
    'username': 'testuser',
    'email': 'testuser@example.com',
    'password': 'strongpassword123'
}

r1 = requests.post(f"{BASE_URL}/register/", data=reg_data)
print("Status:", r1.status_code)
print("Response:", r1.json())
print()

print("--- Testing Token Obtain (Login) ---")
login_data = {
    'email': 'testuser@example.com',
    'password': 'strongpassword123'
}
r2 = requests.post(f"{BASE_URL}/login/", data=login_data)
print("Status:", r2.status_code)
print("Response:", r2.json())
print()

if r2.status_code == 200:
    refresh_token = r2.json().get('refresh')
    
    print("--- Testing Token Refresh ---")
    refresh_data = {
        'refresh': refresh_token
    }
    r3 = requests.post(f"{BASE_URL}/refresh/", data=refresh_data)
    print("Status:", r3.status_code)
    print("Response:", r3.json())
