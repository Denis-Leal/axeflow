import re

def normalize_phone(phone: str) -> str:
    """Remove non-digits from phone number."""
    return re.sub(r'\D', '', phone)

def validate_phone(phone: str) -> bool:
    """Validate Brazilian phone number."""
    digits = normalize_phone(phone)
    return 10 <= len(digits) <= 11
