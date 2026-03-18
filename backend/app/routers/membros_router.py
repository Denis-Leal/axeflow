"""
membros_router.py — AxeFlow
Gerenciamento de membros, presença em giras e consulentes.

ADIÇÕES (sem alterar endpoints existentes):
  - GET  /membros/giras/{id}/presenca-membros-publica
      Retorna lista de membros com status de presença para giras PÚBLICAS.
      Reutiliza a mesma estrutura de resposta do endpoint de giras fechadas.

  - POST /membros/giras/{id}/confirmar-presenca-publica
      O próprio membro confirma/cancela presença em gira PÚBLICA.
      Comportamento idêntico ao confirmar-presenca, mas sem validar acesso=='fechada'.
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy import and_
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user, require_role, hash_password
from app.models.usuario import Usuario
from app.services.email_service import send_convite_membro
from app.models.terreiro import Terreiro
from app.models.gira import Gira as GiraModel
from app.models.inscricao import InscricaoGira
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/membros", tags=["membros"])

class MembroCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    telefone: Optional[str] = None
    role: str = "membro"

@router.get("")
def list_membros(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lista todos os membros ativos do terreiro."""
    membros = db.query(Usuario).filter(
        Usuario.terreiro_id == user.terreiro_id,
        Usuario.ativo == True,
    ).all()
    return [
        {
            "id":       str(m.id),
            "nome":     m.nome,
            "email":    m.email,
            "telefone": m.telefone,
            "role":     m.role,
            "ativo":    m.ativo,
        }
        for m in membros
    ]


@router.post("")
def create_membro(data: MembroCreate, user: Usuario = Depends(require_role("admin", "operador")), db: Session = Depends(get_db)):
    existing = db.query(Usuario).filter(Usuario.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    novo = Usuario(
        terreiro_id=user.terreiro_id,
        nome=data["nome"],
        email=data["email"],
        telefone=data.get("telefone", ""),
        senha_hash=hash_password(data["senha"]),
        role=data.get("role", "membro"),
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)

    # Buscar nome do terreiro para o email
    terreiro = db.query(Terreiro).filter(Terreiro.id == user.terreiro_id).first()
    terreiro_nome = terreiro.nome if terreiro else "seu terreiro"

    # Enviar email de convite (assíncrono — não bloqueia a resposta)
    try:
        enviado = send_convite_membro(
            nome=data.nome,
            email=data.email,
            senha_provisoria=data.senha,
            terreiro_nome=terreiro_nome,
            convidado_por=user.nome,
            app_url=settings.APP_URL,
        )
        if not enviado:
            logger.warning("[Membros] Email de convite não enviado para %s (RESEND_API_KEY configurada?)", data.email)
    except Exception as e:
        logger.error("[Membros] Erro ao enviar email de convite: %s", e)

    return {
        "id":                    str(novo.id),
        "nome":                  novo.nome,
        "email":                 novo.email,
        "role":                  novo.role,
        "email_convite_enviado": bool(settings.RESEND_API_KEY),
    }


@router.put("/{membro_id}")
def update_membro(
    membro_id: UUID,
    data: dict,
    user: Usuario = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Atualiza dados de um membro (admin only)."""
    membro = db.query(Usuario).filter(
        Usuario.id == membro_id,
        Usuario.terreiro_id == user.terreiro_id,
    ).first()
    if not membro:
        raise HTTPException(status_code=404, detail="Membro não encontrado")

    # Admin não pode desativar a si mesmo
    if str(membro.id) == str(user.id) and data.get("ativo") is False:
        raise HTTPException(status_code=400, detail="Você não pode desativar sua própria conta")

    if "nome"     in data: membro.nome      = data["nome"]
    if "telefone" in data: membro.telefone  = data["telefone"]
    if "role"     in data and data["role"] in ["admin", "operador", "membro"]:
        membro.role = data["role"]
    if "ativo"    in data: membro.ativo     = bool(data["ativo"])
    if "senha"    in data and data["senha"]: membro.senha_hash = hash_password(data["senha"])

    db.commit()
    db.refresh(membro)
    return {
        "id":       str(membro.id),
        "nome":     membro.nome,
        "email":    membro.email,
        "telefone": membro.telefone,
        "role":     membro.role,
        "ativo":    membro.ativo,
    }


# ── Lista de consulentes ───────────────────────────────────────────────────────

@router.get("/consulentes-lista")
def list_consulentes(user: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Retorna todos os consulentes que já se inscreveram em giras deste terreiro,
    incluindo primeira_visita, total de inscrições e comparecimentos.
    """
    from app.models.consulente import Consulente
    from app.models.inscricao import InscricaoGira
    from app.models.gira import Gira

    consulentes = db.query(Consulente).join(
        InscricaoGira, InscricaoGira.consulente_id == Consulente.id
    ).join(
        Gira, Gira.id == InscricaoGira.gira_id
    ).filter(
        Gira.terreiro_id == user.terreiro_id,
    ).distinct().all()

    result = []
    for c in consulentes:
        inscricoes = db.query(InscricaoGira).join(
            Gira, Gira.id == InscricaoGira.gira_id
        ).filter(
            InscricaoGira.consulente_id == c.id,
            Gira.terreiro_id == user.terreiro_id,
        ).all()

        total       = len([i for i in inscricoes if i.status != "cancelado"])
        compareceu  = len([i for i in inscricoes if i.status == "compareceu"])

        result.append({
            "id":              str(c.id),
            "nome":            c.nome,
            "telefone":        c.telefone,
            "primeira_visita": c.primeira_visita,
            "total_inscricoes": total,
            "comparecimentos":  compareceu,
        })

    return result


@router.get("/consulentes/{consulente_id}")
def get_consulente(
    consulente_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna perfil detalhado de um consulente com histórico e score."""
    from app.models.consulente import Consulente
    from app.models.inscricao import InscricaoGira
    from app.models.gira import Gira

    consulente = db.query(Consulente).join(
        InscricaoGira, InscricaoGira.consulente_id == Consulente.id
    ).join(
        Gira, Gira.id == InscricaoGira.gira_id
    ).filter(
        Consulente.id == consulente_id,
        Gira.terreiro_id == user.terreiro_id,
    ).first()

    if not consulente:
        raise HTTPException(status_code=404, detail="Consulente não encontrado")

    inscricoes = db.query(InscricaoGira).join(
        Gira, Gira.id == InscricaoGira.gira_id
    ).filter(
        InscricaoGira.consulente_id == consulente_id,
        Gira.terreiro_id == user.terreiro_id,
    ).all()

    def calcular_score(total, compareceu, faltas):
        if total == 0: return 0
        taxa = compareceu / total
        return round(taxa * 100)

    historico = []
    for i in inscricoes:
        g = db.query(Gira).filter(Gira.id == i.gira_id).first()
        if g:
            historico.append({
                "gira_id":    str(g.id),
                "gira_titulo": g.titulo,
                "gira_tipo":   g.tipo,
                "data":        g.data.isoformat(),
                "status":      i.status,
            })

    nao_cancelados  = [h for h in historico if h["status"] != "cancelado"]
    comparecimentos = [h for h in historico if h["status"] == "compareceu"]
    faltas          = [h for h in historico if h["status"] == "faltou"]
    cancelamentos   = [h for h in historico if h["status"] == "cancelado"]

    datas_compareceu = sorted([h["data"] for h in comparecimentos])
    ultima_visita    = datas_compareceu[-1] if datas_compareceu else None
    primeira_data    = datas_compareceu[0]  if datas_compareceu else None

    dias_ausente = None
    if ultima_visita:
        delta = date.today() - date.fromisoformat(ultima_visita)
        dias_ausente = delta.days

    tipos = {}
    for h in comparecimentos:
        t = h["gira_tipo"] or "Não especificado"
        tipos[t] = tipos.get(t, 0) + 1
    tipos_favoritos = sorted(tipos.items(), key=lambda x: x[1], reverse=True)

    score = calcular_score(len(nao_cancelados), len(comparecimentos), len(faltas))

    if dias_ausente is None:          status_retorno = "nunca_compareceu"
    elif dias_ausente <= 60:          status_retorno = "ativo"
    elif dias_ausente <= 180:         status_retorno = "morno"
    else:                             status_retorno = "inativo"

    return {
        "id":            str(consulente.id),
        "nome":          consulente.nome,
        "telefone":      consulente.telefone,
        "primeira_visita": consulente.primeira_visita,
        "cadastrado_em": consulente.created_at.isoformat(),
        "total_inscricoes":  len(nao_cancelados),
        "comparecimentos":   len(comparecimentos),
        "faltas":            len(faltas),
        "cancelamentos":     len(cancelamentos),
        "score":             score,
        "primeira_data":     primeira_data,
        "ultima_visita":     ultima_visita,
        "dias_ausente":      dias_ausente,
        "status_retorno":    status_retorno,
        "tipos_favoritos":   tipos_favoritos,
        "historico":         historico,
    }


# ── Presença em giras FECHADAS ────────────────────────────────────────────────

@router.get("/giras/{gira_id}/presenca-membros")
def get_presenca_membros(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Para giras FECHADAS: retorna todos os membros ativos do terreiro
    com seu status de presença nessa gira (compareceu / faltou / pendente).
    """
    gira = db.query(GiraModel).filter(
        GiraModel.id == gira_id,
        GiraModel.terreiro_id == user.terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    if getattr(gira, 'acesso', 'publica') != 'fechada':
        raise HTTPException(status_code=400, detail="Esta gira é pública — use a lista de inscrições")

    membros = db.query(Usuario).filter(
        Usuario.terreiro_id == user.terreiro_id,
        Usuario.ativo == True,
    ).all()

    result = []
    for m in membros:
        presenca = db.query(InscricaoGira).filter(
            and_(
                InscricaoGira.gira_id == gira_id,
                InscricaoGira.membro_id == m.id,
            )
        ).first()
        result.append({
            "membro_id":   str(m.id),
            "nome":        m.nome,
            "role":        m.role,
            "status":      presenca.status if presenca else "pendente",
            "presenca_id": str(presenca.id) if presenca else None,
        })

    return result


@router.post("/giras/{gira_id}/presenca-membros/{membro_id}")
def marcar_presenca_membro(
    gira_id: UUID,
    membro_id: UUID,
    data: dict,
    user: Usuario = Depends(require_role("admin", "operador")),
    db: Session = Depends(get_db),
):
    """Marca ou atualiza presença de um membro em gira fechada (admin/operador)."""
    gira = db.query(GiraModel).filter(
        GiraModel.id == gira_id,
        GiraModel.terreiro_id == user.terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")

    status = data.get("status")
    if status not in ("compareceu", "faltou", "pendente"):
        raise HTTPException(status_code=400, detail="Status inválido")

    presenca = db.query(InscricaoGira).filter(
        and_(InscricaoGira.gira_id == gira_id, InscricaoGira.membro_id == membro_id)
    ).first()

    if status == "pendente":
        if presenca:
            db.delete(presenca)
            db.commit()
        return {"ok": True, "status": "pendente"}

    if presenca:
        presenca.status = status
    else:
        max_pos = db.query(InscricaoGira).filter(InscricaoGira.gira_id == gira_id).count()
        presenca = InscricaoGira(
            gira_id=gira_id,
            membro_id=membro_id,
            consulente_id=None,
            posicao=max_pos + 1,
            status=status,
        )
        db.add(presenca)

    db.commit()
    return {"ok": True, "status": status}


@router.post("/giras/{gira_id}/confirmar-presenca")
def confirmar_presenca_propria(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    O próprio membro confirma/cancela presença em gira FECHADA.
    Toggle: confirmar → cancelar → confirmar…
    """
    gira = db.query(GiraModel).filter(
        GiraModel.id == gira_id,
        GiraModel.terreiro_id == user.terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    if getattr(gira, 'acesso', 'publica') != 'fechada':
        raise HTTPException(status_code=400, detail="Esta gira é pública")

    presenca = db.query(InscricaoGira).filter(
        and_(InscricaoGira.gira_id == gira_id, InscricaoGira.membro_id == user.id)
    ).first()

    if presenca:
        if presenca.status == "confirmado":
            db.delete(presenca)
            db.commit()
            return {"ok": True, "status": "pendente", "acao": "cancelado"}
        # Admin já marcou compareceu/faltou — membro não pode reverter
        return {"ok": False, "status": presenca.status, "acao": "ja_registrado"}

    max_pos = db.query(InscricaoGira).filter(InscricaoGira.gira_id == gira_id).count()
    presenca = InscricaoGira(
        gira_id=gira_id,
        membro_id=user.id,
        consulente_id=None,
        posicao=max_pos + 1,
        status="confirmado",
    )
    db.add(presenca)
    db.commit()
    return {"ok": True, "status": "confirmado", "acao": "confirmado"}


# ── Presença em giras PÚBLICAS ────────────────────────────────────────────────

@router.get("/giras/{gira_id}/presenca-membros-publica")
def get_presenca_membros_publica(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Para giras PÚBLICAS: retorna todos os membros ativos do terreiro
    com seu status de presença nessa gira.

    Mesma estrutura de resposta que presenca-membros (giras fechadas),
    sem a restrição de acesso == 'fechada'.
    """
    gira = db.query(GiraModel).filter(
        GiraModel.id == gira_id,
        GiraModel.terreiro_id == user.terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    if getattr(gira, 'acesso', 'publica') != 'publica':
        raise HTTPException(status_code=400, detail="Esta gira é fechada — use presenca-membros")

    membros = db.query(Usuario).filter(
        Usuario.terreiro_id == user.terreiro_id,
        Usuario.ativo == True,
    ).all()

    result = []
    for m in membros:
        presenca = db.query(InscricaoGira).filter(
            and_(
                InscricaoGira.gira_id == gira_id,
                InscricaoGira.membro_id == m.id,
            )
        ).first()
        result.append({
            "membro_id":   str(m.id),
            "nome":        m.nome,
            "role":        m.role,
            "status":      presenca.status if presenca else "pendente",
            "presenca_id": str(presenca.id) if presenca else None,
        })

    return result


@router.post("/giras/{gira_id}/confirmar-presenca-publica")
def confirmar_presenca_publica(
    gira_id: UUID,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    O próprio membro confirma/cancela presença em gira PÚBLICA.
    Toggle: confirmar → cancelar → confirmar…

    Comportamento idêntico ao confirmar-presenca (giras fechadas),
    mas aceita giras com acesso == 'publica'.
    """
    gira = db.query(GiraModel).filter(
        GiraModel.id == gira_id,
        GiraModel.terreiro_id == user.terreiro_id,
    ).first()
    if not gira:
        raise HTTPException(status_code=404, detail="Gira não encontrada")
    if getattr(gira, 'acesso', 'publica') != 'publica':
        raise HTTPException(status_code=400, detail="Esta gira é fechada — use confirmar-presenca")

    presenca = db.query(InscricaoGira).filter(
        and_(InscricaoGira.gira_id == gira_id, InscricaoGira.membro_id == user.id)
    ).first()

    if presenca:
        if presenca.status == "confirmado":
            db.delete(presenca)
            db.commit()
            return {"ok": True, "status": "pendente", "acao": "cancelado"}
        # Admin já marcou compareceu/faltou — membro não pode reverter
        return {"ok": False, "status": presenca.status, "acao": "ja_registrado"}

    max_pos = db.query(InscricaoGira).filter(InscricaoGira.gira_id == gira_id).count()
    presenca = InscricaoGira(
        gira_id=gira_id,
        membro_id=user.id,
        consulente_id=None,
        posicao=max_pos + 1,
        status="confirmado",
    )
    db.add(presenca)
    db.commit()
    return {"ok": True, "status": "confirmado", "acao": "confirmado"}