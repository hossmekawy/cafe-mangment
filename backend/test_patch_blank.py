import requests

resp = requests.post('http://127.0.0.1:8000/api/auth/login/', json={'username': 'hussien', 'password': 'Sahs223344$'})
token = resp.json().get('data', {}).get('access')

headers = {'Authorization': f'Bearer {token}'}
patch_resp = requests.patch('http://127.0.0.1:8000/api/auth/me/', json={'name': '', 'avatar': ''}, headers=headers)
print("Patch:", patch_resp.status_code, patch_resp.text)
