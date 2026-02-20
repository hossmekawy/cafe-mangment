import requests

# Login to get token
resp = requests.post('http://127.0.0.1:8000/api/auth/login/', json={'username': 'hussien', 'password': 'Sahs223344$'})
print("Login:", resp.status_code, resp.json())
token = resp.json().get('data', {}).get('access')

if token:
    headers = {'Authorization': f'Bearer {token}'}
    patch_resp = requests.patch('http://127.0.0.1:8000/api/auth/me/', json={'name': 'Hussien Hossam'}, headers=headers)
    print("Patch:", patch_resp.status_code, patch_resp.json())
