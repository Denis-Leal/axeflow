import enum
    
class StatusInscricaoEnum(str, enum.Enum):
    confirmado   = "confirmado"    # inscrição ativa dentro do limite de vagas
    lista_espera = "lista_espera"  # fila aguardando vaga (apenas consulentes)
    compareceu   = "compareceu"    # marcado após a gira acontecer
    faltou       = "faltou"        # marcado após a gira acontecer
    cancelado    = "cancelado"     # desistência (não penaliza score de consulente)