"""
validators.py — AxeFlow
Utilitários de validação e normalização de dados de entrada.
"""
import re


def normalize_phone(phone: str) -> str:
    """
    Normaliza telefone brasileiro para o formato E.164 sem '+':
    55XXXXXXXXXXX (13 dígitos para celular, 12 para fixo).

    Exemplos aceitos:
        '11999999999'       → '5511999999999'
        '(11) 99999-9999'   → '5511999999999'
        '+55 11 99999-9999' → '5511999999999'
        '5511999999999'     → '5511999999999'
    """
    # Remove tudo que não seja dígito
    digits = re.sub(r'\D', '', phone)

    # Remove prefixo de discagem internacional 00 ou 0055
    if digits.startswith('0055'):
        digits = digits[4:]
    elif digits.startswith('00'):
        digits = digits[2:]

    # Adiciona DDI 55 se ainda não tiver
    if not digits.startswith('55'):
        digits = '55' + digits

    return digits


def validate_phone(phone: str) -> bool:
    """
    Valida telefone brasileiro após normalização.
    Formato esperado: 55 + DDD (2d) + número (8 ou 9 dígitos) = 12 ou 13 dígitos.
    """
    normalized = normalize_phone(phone)
    # 55 (DDI) + 2 (DDD) + 8 ou 9 (número) = 12 ou 13 dígitos
    return len(normalized) in (12, 13)
