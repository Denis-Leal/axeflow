"""
inscricao_status.py — AxeFlow
Enum de status compartilhado entre InscricaoConsulente e InscricaoMembro.

Separado dos models para evitar import circular e permitir que ambas
as tabelas usem o mesmo tipo de enum no PostgreSQL.
"""
import enum


class StatusInscricaoEnum(str, enum.Enum):
    confirmado   = "confirmado"    # inscrição ativa dentro do limite de vagas
    lista_espera = "lista_espera"  # fila aguardando vaga (apenas consulentes)
    compareceu   = "compareceu"    # marcado após a gira acontecer
    faltou       = "faltou"        # marcado após a gira acontecer
    cancelado    = "cancelado"     # desistência (não penaliza score de consulente)