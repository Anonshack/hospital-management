"""
Custom Middleware for request logging and security
"""

import logging
import time
import json

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware:
    """
    Logs all incoming requests with timing information.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()

        # Log request
        logger.info(
            f"[REQUEST] {request.method} {request.path} "
            f"| IP: {self._get_client_ip(request)} "
            f"| User: {getattr(request.user, 'id', 'Anonymous')}"
        )

        response = self.get_response(request)

        # Log response
        duration = time.time() - start_time
        logger.info(
            f"[RESPONSE] {request.method} {request.path} "
            f"| Status: {response.status_code} "
            f"| Duration: {duration:.3f}s"
        )

        return response

    @staticmethod
    def _get_client_ip(request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0]
        return request.META.get('REMOTE_ADDR')
