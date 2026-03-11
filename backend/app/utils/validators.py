import re

def normalize_phone(phone: str) -> str:
    """
    Normaliza telefone brasileiro para formato E.164 sem o '+'.
    Exemplos:
      (11) 99999-9999   -> 5511999999999
      11999999999       -> 5511999999999
      +55 11 99999-9999 -> 5511999999999
    """
    digits = re.sub(r'\D', '', phone)

    # Remove DDI 55 se vier duplicado
    if digits.startswith('55') and len(digits) > 11:
        digits = digits[2:]

    # Adiciona DDI 55 se não tiver
    if not digits.startswith('55'):
        digits = '55' + digits

    return digits


def validate_phone(phone: str) -> bool:
    """Valida telefone brasileiro normalizado. Aceita 12 ou 13 digitos (55 + DDD + numero)."""
    digits = normalize_phone(phone)
    return 12 <= len(digits) <= 13
