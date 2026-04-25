"""Rate limiting configuration using SlowAPI."""

import os

from slowapi import Limiter
from starlette.requests import Request

from app.core.config import settings

redis_url = os.getenv("REDIS_URL")
is_testing = os.getenv("TESTING", "").lower() == "true"


def _get_real_ip(request: Request) -> str:
    """Extract client IP for rate limiting.

    Trust model (audit F-01-004): X-Forwarded-For is spoofable by any
    direct caller. We only honour the header when the immediate TCP
    peer (`request.client.host`) is listed in `Settings.TRUSTED_PROXIES`,
    or when that setting is `*` (operator declares the deployment is
    behind a known reverse proxy / load balancer that strips and
    rewrites the header).

    Default = empty trusted-proxy list = ignore the header entirely. This
    is safe for direct-exposed deployments (the rate limiter keys on the
    real TCP peer). Operators behind Scalingo / Heroku / Cloudflare /
    nginx etc. should set `TRUSTED_PROXIES=*` (or the specific
    proxy IPs) in their environment.
    """
    direct_peer = request.client.host if request.client else "127.0.0.1"
    trusted = settings.trusted_proxies_list

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and trusted and ("*" in trusted or direct_peer in trusted):
        # First entry is the original client IP per RFC 7239 convention
        return forwarded.split(",")[0].strip()

    return direct_peer


if is_testing:
    # Disable rate limiting during tests
    limiter = Limiter(key_func=_get_real_ip, enabled=False)
elif redis_url:
    # Use Redis as storage if available (standard for Scalingo/Cloud)
    limiter = Limiter(key_func=_get_real_ip, storage_uri=redis_url)
else:
    # Fallback to in-memory for local development
    limiter = Limiter(key_func=_get_real_ip)
