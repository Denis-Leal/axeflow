import enum


class StatusInscricaoEnum(str, enum.Enum):
    confirmado   = "confirmado"   # inscricao ativa dentro do limite de vagas
    lista_espera = "lista_espera" # fila aguardando vaga
    compareceu   = "compareceu"   # marcado apos a gira acontecer
    faltou       = "faltou"       # marcado apos a gira acontecer
    cancelado    = "cancelado"    # desistencia (nao penaliza o score)