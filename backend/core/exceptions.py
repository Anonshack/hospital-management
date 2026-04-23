"""
Custom Exception Handler - Returns consistent error responses
"""

import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that returns consistent JSON error responses.
    Format: { "error": true, "message": "...", "details": {...} }
    """
    response = exception_handler(exc, context)

    if response is not None:
        error_data = {
            'error': True,
            'status_code': response.status_code,
            'message': _get_error_message(response),
            'details': response.data if isinstance(response.data, dict) else {'detail': response.data},
        }
        response.data = error_data
    else:
        # Unhandled exception
        logger.exception(f"Unhandled exception in {context.get('view')}: {exc}")
        response = Response(
            {
                'error': True,
                'status_code': 500,
                'message': 'An unexpected error occurred. Please try again later.',
                'details': {},
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response


def _get_error_message(response):
    """Extract human-readable error message from DRF response."""
    data = response.data

    if isinstance(data, dict):
        if 'detail' in data:
            detail = data['detail']
            return str(detail) if not isinstance(detail, list) else str(detail[0])
        # Collect field errors
        messages = []
        for field, errors in data.items():
            if isinstance(errors, list):
                messages.append(f"{field}: {', '.join(str(e) for e in errors)}")
            else:
                messages.append(f"{field}: {errors}")
        return '; '.join(messages) if messages else 'An error occurred'
    elif isinstance(data, list):
        return str(data[0]) if data else 'An error occurred'

    return str(data)
