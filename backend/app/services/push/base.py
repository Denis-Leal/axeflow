# app/services/push/base.py

from abc import ABC, abstractmethod

class PushProvider(ABC):

    @abstractmethod
    def send(self, token: str, payload: dict) -> bool:
        pass