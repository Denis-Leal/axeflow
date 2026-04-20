class Participante(Base):
    __tablename__ = "participantes"

    id = Column(UUID, primary_key=True)
    tipo = Column(Enum("CONSULENTE", "MEMBRO", name="tipo_participante"), nullable=False)

    consulente_id = Column(UUID, ForeignKey("consulentes.id"), nullable=True)
    membro_id = Column(UUID, ForeignKey("membros.id"), nullable=True)

    __table_args__ = (
        CheckConstraint("""
            (tipo = 'CONSULENTE' AND consulente_id IS NOT NULL AND membro_id IS NULL)
            OR
            (tipo = 'MEMBRO' AND membro_id IS NOT NULL AND consulente_id IS NULL)
        """),
    )