from sqlalchemy.orm import Session
from fastapi import HTTPException
from uuid import UUID
from app.models.gira import Gira
from app.models.usuario import Usuario
from app.models.inscricao import InscricaoGira
from app.schemas.gira_schema import GiraCreate, GiraUpdate, GiraResponse
from app.utils.slug import generate_gira_slug

def list_giras(db: Session, terreiro_id: UUID):
    giras = db.query(Gira).filter(Gira.terreiro_id == terreiro_id).order_by(Gira.data.desc()).all()
    result = []
    for g in giras:
        total = db.query(InscricaoGira).filter(
            InscricaoGira.gira_id == g.id,
            InscricaoGira.status != "cancelado"
        ).count()
        r = GiraResponse.model_validate(g)
        r.total_inscritos = total
        result.append(r)
    return result

def create_gira(db: Session, data: GiraCreate, user: Usuario) -> GiraResponse:
    slug = generate_gira_slug(data.titulo, data.data)
    # ensure uniqueness
    existing = db.query(Gira).filter(Gira.slug_publico == slug).first()
    if existing:
        slug = f"{slug}-{str(user.terreiro_id)[:8]}"

    gira = Gira(
        terreiro_id=user.terreiro_id,
        titulo=data.titulo,
        tipo=data.tipo,
        data=data.data,
        horario=data.horario,
        limite_consulentes=data.limite_consulentes,
        abertura_lista=data.abertura_lista,
        fechamento_lista=data.fechamento_lista,
        responsavel_lista_id=data.responsavel_lista_id,
        slug_publico=slug
    )
    db.add(gira)
    db.commit()
    db.refresh(gira)
    r = GiraResponse.model_validate(gira)
    r.total_inscritos = 0
    return r

def get_gira(db: Session, gira_id: UUID, terreiro_id: UUID) -> GiraResponse:
    gira = db.query(Gira).filter(Gira.id == gira_id, Gira.terreiro_id == terreiro_id).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    total = db.query(InscricaoGira).filter(
        InscricaoGira.gira_id == gira.id,
        InscricaoGira.status != "cancelado"
    ).count()
    r = GiraResponse.model_validate(gira)
    r.total_inscritos = total
    return r

def update_gira(db: Session, gira_id: UUID, data: GiraUpdate, terreiro_id: UUID) -> GiraResponse:
    gira = db.query(Gira).filter(Gira.id == gira_id, Gira.terreiro_id == terreiro_id).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(gira, field, value)
    db.commit()
    db.refresh(gira)
    return GiraResponse.model_validate(gira)

def delete_gira(db: Session, gira_id: UUID, terreiro_id: UUID):
    gira = db.query(Gira).filter(Gira.id == gira_id, Gira.terreiro_id == terreiro_id).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    db.delete(gira)
    db.commit()
    return {"ok": True}
