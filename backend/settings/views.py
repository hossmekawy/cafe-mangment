from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .models import GlobalSettings
from .serializers import GlobalSettingsSerializer
from authentication.permissions import IsAdminOrManager

class GlobalSettingsView(APIView):
    """
    GET: Retrieve global settings (Available to all authenticated staff).
    PUT/PATCH: Update global settings (Super Admin or Manager only).
    """

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH']:
            return [IsAdminOrManager()]
        return [IsAuthenticated()]

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
