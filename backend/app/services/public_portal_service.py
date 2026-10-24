from datetime import date
from math import atan2, cos, radians, sin, sqrt
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.gira import Gira, StatusGiraEnum
from app.models.publicacao_terreiro import PublicacaoTerreiro
from app.models.terreiro import Terreiro
from app.schemas.public_portal_schema import PerfilPublicoUpdate, PublicacaoCreate, PublicacaoUpdate
from app.utils.datetime_utils import utcnow


def _perfil(terreiro: Terreiro):
    return {
        "nome": terreiro.nome, "cidade": terreiro.cidade, "publico_ativo": terreiro.publico_ativo,
        "slug_publico": terreiro.slug_publico, "descricao_publica": terreiro.descricao_publica,
        "telefone_publico": terreiro.telefone_publico, "whatsapp_publico": terreiro.whatsapp_publico,
        "instagram_publico": terreiro.instagram_publico, "endereco_publico": terreiro.endereco_publico,
        "endereco_linha": terreiro.endereco_linha, "bairro": terreiro.bairro, "uf": terreiro.uf,
        "cep": terreiro.cep, "latitude": terreiro.latitude, "longitude": terreiro.longitude,
    }


def get_perfil(db: Session, terreiro_id: UUID):
    terreiro = db.get(Terreiro, terreiro_id)
    if not terreiro:
        raise HTTPException(404, "Terreiro não encontrado")
    return _perfil(terreiro)


def update_perfil(db: Session, terreiro_id: UUID, data: PerfilPublicoUpdate):
    terreiro = db.get(Terreiro, terreiro_id)
    if not terreiro:
        raise HTTPException(404, "Terreiro não encontrado")
    values = data.model_dump(exclude_unset=True)
    slug = values.get("slug_publico")
    if slug:
        duplicate = db.query(Terreiro).filter(Terreiro.slug_publico == slug, Terreiro.id != terreiro_id).first()
        if duplicate:
            raise HTTPException(409, "Este endereço público já está em uso")
    for key, value in values.items():
        setattr(terreiro, key, value)
    db.commit()
    db.refresh(terreiro)
    return _perfil(terreiro)


def list_publicacoes(db: Session, terreiro_id: UUID):
    return db.query(PublicacaoTerreiro).filter(PublicacaoTerreiro.terreiro_id == terreiro_id).order_by(PublicacaoTerreiro.created_at.desc()).all()


def create_publicacao(db: Session, terreiro_id: UUID, data: PublicacaoCreate):
    values = data.model_dump()
    if values["publicado"]:
        values["publicado_em"] = utcnow()
    item = PublicacaoTerreiro(terreiro_id=terreiro_id, **values)
    db.add(item); db.commit(); db.refresh(item)
    return item


def update_publicacao(db: Session, terreiro_id: UUID, publicacao_id: UUID, data: PublicacaoUpdate):
    item = db.query(PublicacaoTerreiro).filter(PublicacaoTerreiro.id == publicacao_id, PublicacaoTerreiro.terreiro_id == terreiro_id).first()
    if not item:
        raise HTTPException(404, "Publicação não encontrada")
    values = data.model_dump(exclude_unset=True)
    if values.get("publicado") is True and not item.publicado:
        item.publicado_em = utcnow()
    for key, value in values.items(): setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item


def delete_publicacao(db: Session, terreiro_id: UUID, publicacao_id: UUID):
    item = db.query(PublicacaoTerreiro).filter(PublicacaoTerreiro.id == publicacao_id, PublicacaoTerreiro.terreiro_id == terreiro_id).first()
    if not item: raise HTTPException(404, "Publicação não encontrada")
    db.delete(item); db.commit()


def _gira_card(gira: Gira):
    return {"titulo": gira.titulo, "tipo": gira.tipo, "data": gira.data.isoformat(), "horario": gira.horario.strftime("%H:%M"), "slug": gira.slug_publico}


def _distancia_km(latitude: float, longitude: float, terreiro: Terreiro):
    if terreiro.latitude is None or terreiro.longitude is None:
        return None
    lat2, lon2 = radians(float(terreiro.latitude)), radians(float(terreiro.longitude))
    lat1, lon1 = radians(latitude), radians(longitude)
    a = sin((lat2-lat1)/2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2-lon1)/2) ** 2
    return round(6371 * 2 * atan2(sqrt(a), sqrt(1-a)), 1)


def explorar(db: Session, busca: str | None = None, cidade: str | None = None, latitude: float | None = None, longitude: float | None = None, raio_km: float = 30):
    query = db.query(Terreiro).filter(Terreiro.publico_ativo.is_(True), Terreiro.slug_publico.isnot(None))
    if busca:
        term = f"%{busca.strip()}%"
        query = query.filter(or_(Terreiro.nome.ilike(term), Terreiro.cidade.ilike(term), Terreiro.bairro.ilike(term)))
    if cidade: query = query.filter(Terreiro.cidade.ilike(f"%{cidade.strip()}%"))
    terreiros = query.limit(100).all()
    agora = utcnow()
    cards = []
    for terreiro in terreiros:
        publicacoes = db.query(PublicacaoTerreiro).filter(PublicacaoTerreiro.terreiro_id == terreiro.id, PublicacaoTerreiro.publicado.is_(True), PublicacaoTerreiro.publicado_em <= agora, or_(PublicacaoTerreiro.expira_em.is_(None), PublicacaoTerreiro.expira_em > agora)).order_by(PublicacaoTerreiro.publicado_em.desc()).limit(3).all()
        giras = db.query(Gira).filter(Gira.terreiro_id == terreiro.id, Gira.visivel_portal.is_(True), Gira.acesso == "publica", Gira.status == StatusGiraEnum.aberta, Gira.deleted_at.is_(None), Gira.data >= date.today()).order_by(Gira.data, Gira.horario).limit(3).all()
        distancia_km = _distancia_km(latitude, longitude, terreiro) if latitude is not None and longitude is not None else None
        if latitude is not None and (distancia_km is None or distancia_km > raio_km):
            continue
        cards.append({"nome": terreiro.nome, "slug": terreiro.slug_publico, "cidade": terreiro.cidade, "bairro": terreiro.bairro, "descricao": terreiro.descricao_publica, "distancia_km": distancia_km, "total_giras_abertas": len(giras), "publicacoes": [{"id": str(p.id), "titulo": p.titulo, "conteudo": p.conteudo, "categoria": p.categoria} for p in publicacoes], "giras": [_gira_card(g) for g in giras]})
    return sorted(cards, key=lambda item: item["distancia_km"] if item["distancia_km"] is not None else float("inf")) if latitude is not None else sorted(cards, key=lambda item: item["nome"].lower())


def perfil_publico(db: Session, slug: str):
    terreiro = db.query(Terreiro).filter(Terreiro.slug_publico == slug, Terreiro.publico_ativo.is_(True)).first()
    if not terreiro: raise HTTPException(404, "Terreiro não encontrado")
    result = _perfil(terreiro)
    result["publicacoes"] = list_publicacoes_publicas(db, terreiro.id)
    result["giras"] = [_gira_card(g) for g in db.query(Gira).filter(Gira.terreiro_id == terreiro.id, Gira.visivel_portal.is_(True), Gira.acesso == "publica", Gira.status == StatusGiraEnum.aberta, Gira.deleted_at.is_(None), Gira.data >= date.today()).order_by(Gira.data, Gira.horario).all()]
    return result


def list_publicacoes_publicas(db: Session, terreiro_id: UUID):
    agora = utcnow()
    return [{"id": str(p.id), "titulo": p.titulo, "conteudo": p.conteudo, "categoria": p.categoria, "publicado_em": p.publicado_em.isoformat() if p.publicado_em else None} for p in db.query(PublicacaoTerreiro).filter(PublicacaoTerreiro.terreiro_id == terreiro_id, PublicacaoTerreiro.publicado.is_(True), PublicacaoTerreiro.publicado_em <= agora, or_(PublicacaoTerreiro.expira_em.is_(None), PublicacaoTerreiro.expira_em > agora)).order_by(PublicacaoTerreiro.publicado_em.desc()).all()]
