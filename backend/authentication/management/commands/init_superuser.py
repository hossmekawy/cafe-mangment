from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = 'Creates the default superuser (hussien) if it does not exist'

    def handle(self, *args, **options):
        User = get_user_model()
        username = 'hussien'
        password = 'Sahs223344$'
        
        if not User.objects.filter(username=username).exists():
            # Using create_superuser which was defined in our CustomUserManager
            user = User.objects.create_superuser(
                username=username,
                password=password,
                name='Hussien'
            )
            
            # Additional custom fields
            user.role = 'super_admin'
            user.save()
            
            self.stdout.write(self.style.SUCCESS(f'Successfully created superuser "{username}"'))
        else:
            # Optionally update password if user exists but we want to reset it to default
            user = User.objects.get(username=username)
            user.set_password(password)
            user.role = 'super_admin'
            user.is_staff = True
            user.is_superuser = True
            user.save()
            self.stdout.write(self.style.WARNING(f'Superuser "{username}" already exists. Superuser permissions and password were reset to default.'))
