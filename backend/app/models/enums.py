import enum

class StatusInscricaoEnum(str, enum.Enum):
    confirmado   = "confirmado"
    lista_espera = "lista_espera"   # vaga esgotada — entrou na fila de espera
    compareceu   = "compareceu"
    faltou       = "faltou"
    cancelado    = "cancelado"
    
class RoleEnum(str, enum.Enum):
    admin = "admin"
    operador = "operador"
    membro = "membro"
    
class StatusGiraEnum(str, enum.Enum):
    aberta    = "aberta"
    fechada   = "fechada"
    concluida = "concluida"

class AcessoGiraEnum(str, enum.Enum):
    publica = "publica"
    fechada = "fechada"