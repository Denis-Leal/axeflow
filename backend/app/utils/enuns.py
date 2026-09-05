import enum
    
class StatusInscricaoEnum(str, enum.Enum):
    confirmado   = "confirmado"    # inscrição ativa dentro do limite de vagas
    lista_espera = "lista_espera"  # fila aguardando vaga (apenas consulentes)
    compareceu   = "compareceu"    # marcado após a gira acontecer
    faltou       = "faltou"        # marcado após a gira acontecer
    cancelado    = "cancelado"     # desistência (não penaliza score de consulente)
    
class UnidadeMedidaEnum(str, enum.Enum):
    KG = "kg"
    G = "g"
    MG = "mg"
    L = "l"
    ML = "ml"
    UN = "un"
    PACOTE = "pacote"
    CAIXA = "caixa"
    GARRAFA = "garrafa"
    LATA = "lata"
    DUZIA = "duzia"