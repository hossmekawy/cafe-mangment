from rest_framework.views import exception_handler
from rest_framework.response import Response

def custom_exception_handler(exc, context):
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    if response is not None:
        custom_response_data = {
            "success": False,
            "error": "API_ERROR",
            "detail": response.data
        }
        
        # Determine specific error codes based on status code
        if response.status_code == 401:
            custom_response_data['error'] = 'UNAUTHORIZED'
        elif response.status_code == 403:
            custom_response_data['error'] = 'PERMISSION_DENIED'
        elif response.status_code == 404:
            custom_response_data['error'] = 'NOT_FOUND'
        elif response.status_code == 400:
            custom_response_data['error'] = 'VALIDATION_ERROR'
            
        return Response(custom_response_data, status=response.status_code)

    return None
