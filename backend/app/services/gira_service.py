from sqlalchemy.orm import Session
from fastapi import HTTPException
from uuid import UUID
from app.models.gira import Gira
from app.models.usuario import Usuario
from app.models.inscricao import InscricaoGira
from app.schemas.gira_schema import GiraCreate, GiraUpdate, GiraResponse
from app.utils.slug import generate_gira_slug
from app.services.push_service import broadcast_push_notification

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

    # 🔔 Push: nova gira criada
    data_fmt = gira.data.strftime("%d/%m/%Y")
    horario_fmt = gira.horario.strftime("%H:%M")
    broadcast_push_notification(
        title="✦ Nova Gira Criada",
        body=f"{gira.titulo} — {data_fmt} às {horario_fmt}",
        url=f"/giras/{gira.id}",
    )

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

    campos_alterados = data.model_dump(exclude_unset=True)
    for field, value in campos_alterados.items():
        setattr(gira, field, value)
    db.commit()
    db.refresh(gira)

    # 🔔 Push: status da gira mudou
    if "status" in campos_alterados:
        novo_status = campos_alterados["status"]
        msgs = {
            "aberta":    ("📋 Lista Aberta",    f"A lista da gira {gira.titulo} está aberta para inscrições!"),
            "fechada":   ("🔒 Lista Encerrada", f"A lista da gira {gira.titulo} foi encerrada."),
            "concluida": ("✅ Gira Concluída",  f"A gira {gira.titulo} foi marcada como concluída."),
        }
        if novo_status in msgs:
            titulo, corpo = msgs[novo_status]
            broadcast_push_notification(title=titulo, body=corpo, url=f"/giras/{gira.id}")

    return GiraResponse.model_validate(gira)

def delete_gira(db: Session, gira_id: UUID, terreiro_id: UUID):
    gira = db.query(Gira).filter(Gira.id == gira_id, Gira.terreiro_id == terreiro_id).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    titulo = gira.titulo
    db.delete(gira)
    db.commit()

    # 🔔 Push: gira removida
    broadcast_push_notification(
        title="🗑️ Gira Removida",
        body=f"A gira {titulo} foi removida.",
        url="/giras",
    )

    return {"ok": True}
