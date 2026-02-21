from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import GlobalSettings, OrderCancelReason
from .serializers import GlobalSettingsSerializer, OrderCancelReasonSerializer
from authentication.permissions import IsAdminOrManager

class OrderCancelReasonViewSet(viewsets.ModelViewSet):
    """CRUD for configurable order cancellation reasons."""
    queryset = OrderCancelReason.objects.all()
    serializer_class = OrderCancelReasonSerializer
    permission_classes = [IsAuthenticated]


class GlobalSettingsView(APIView):
    """
    GET: Retrieve global settings (Available to all authenticated staff).
    PUT/PATCH: Update global settings (Super Admin or Manager only).
    """

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAdminOrManager()]
        return [AllowAny()]

    def get(self, request):
        settings = GlobalSettings.load()
        serializer = GlobalSettingsSerializer(settings)
        return Response({
            "success": True,
            "data": serializer.data
        })

    def put(self, request):
        settings = GlobalSettings.load()
        serializer = GlobalSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                "success": True,
                "data": serializer.data,
                "message": "Settings updated successfully."
            })
        return Response({
            "success": False,
            "error": "VALIDATION_ERROR",
            "detail": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        return self.put(request)

import os
from django.conf import settings as django_settings
from django.core.management import call_command
from io import StringIO
from django.http import HttpResponse

class SystemBackupView(APIView):
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        """Generates a JSON dump of the entire database for backup purposes."""
        try:
            out = StringIO()
            # Exclude content types and permissions which can cause issues on restore across environments
            call_command(
                'dumpdata', 
                exclude=['contenttypes', 'auth.Permission', 'sessions'],
                format='json',
                stdout=out
            )
            json_data = out.getvalue()
            
            response = HttpResponse(json_data, content_type='application/json')
            response['Content-Disposition'] = 'attachment; filename="waitless_backup.json"'
            return response
        except Exception as e:
            return Response({"success": False, "error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SystemRestoreView(APIView):
    permission_classes = [IsAdminOrManager]

    def post(self, request):
        """Restores the database from a provided JSON file."""
        file = request.FILES.get('file')
        if not file:
            return Response({"success": False, "error": "No backup file provided."}, status=status.HTTP_400_BAD_REQUEST)

        temp_path = os.path.join(django_settings.BASE_DIR, 'temp_restore.json')
        
        try:
            with open(temp_path, 'wb+') as destination:
                for chunk in file.chunks():
                    destination.write(chunk)
            
            # Use loaddata to overwrite DB
            call_command('loaddata', temp_path)
            
            return Response({"success": True, "message": "System successfully restored from backup."})
        except Exception as e:
            return Response({"success": False, "error": f"Restore failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
