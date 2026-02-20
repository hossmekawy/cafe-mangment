from rest_framework.throttling import AnonRateThrottle
from django.core.cache import cache

class LoginRateThrottle(AnonRateThrottle):
    rate = '5/min'

def check_account_lockout(username):
    """
    Checks if an account is locked out due to too many failed attempts.
    Returns (is_locked, time_remaining)
    """
    attempts = cache.get(f'login_attempts_{username}', 0)
    if attempts >= 5:
        # Check if lock time has expired
        lock_timer = cache.get(f'login_lock_{username}')
        if lock_timer:
            return True, lock_timer
        else:
            # Lock has expired, reset attempts
            cache.delete(f'login_attempts_{username}')
            return False, 0
    return False, 0

def record_failed_login(username):
    """
    Records a failed login attempt and locks account if threshold reached.
    Lock time: 15 minutes
    """
    attempts = cache.get(f'login_attempts_{username}', 0)
    attempts += 1
    cache.set(f'login_attempts_{username}', attempts, timeout=3600) # Keep attempts for 1 hour
    
    if attempts >= 5:
        cache.set(f'login_lock_{username}', True, timeout=900) # Lock for 15 minutes

def reset_failed_login(username):
    """
    Resets failed login attempts on successful login.
    """
    cache.delete(f'login_attempts_{username}')
    cache.delete(f'login_lock_{username}')
