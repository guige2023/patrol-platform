from cryptography.fernet import Fernet
from app.config import settings
import base64
import hashlib


def _get_cipher():
    key = hashlib.sha256(settings.ENCRYPTION_KEY.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_field(value: str) -> str:
    """Encrypt a sensitive field value (e.g., ID card number)"""
    if not value:
        return value
    cipher = _get_cipher()
    return cipher.encrypt(value.encode()).decode()


def decrypt_field(encrypted_value: str) -> str:
    """Decrypt a sensitive field value"""
    if not encrypted_value:
        return encrypted_value
    cipher = _get_cipher()
    return cipher.decrypt(encrypted_value.encode()).decode()


def mask_id_card(id_card: str) -> str:
    """Mask ID card number for display (show first 3 and last 4)"""
    if not id_card or len(id_card) < 7:
        return id_card
    return id_card[:3] + "****" + id_card[-4:]
