import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Any
from pydantic import BaseModel

from ..database import get_db
from ..models.ticket import TicketTemplate, Source

router = APIRouter()


class TemplateBet(BaseModel):
    match_name: str
    league: str = ''
    match_datetime: str = ''
    tip: str
    odds: float
    result: str = 'NEVYHODNOCENO'
    score: str = ''


class TemplateIn(BaseModel):
    name: str
    ticket_type: Optional[str] = None
    bookmaker: Optional[str] = None
    source_id: Optional[int] = None
    stake: Optional[float] = None
    bets: List[TemplateBet] = []


class TemplateOut(BaseModel):
    id: int
    name: str
    ticket_type: Optional[str] = None
    bookmaker: Optional[str] = None
    source_id: Optional[int] = None
    source_name: Optional[str] = None
    stake: Optional[float] = None
    bets: List[Any] = []
    created_at: str

    class Config:
        from_attributes = True


def to_out(t: TicketTemplate) -> dict:
    bets = json.loads(t.bets_json) if t.bets_json else []
    source = None
    if t.source_id:
        from sqlalchemy import inspect
        session = inspect(t).session
        source = session.get(Source, t.source_id)
    return {
        "id": t.id,
        "name": t.name,
        "ticket_type": t.ticket_type,
        "bookmaker": t.bookmaker,
        "source_id": t.source_id,
        "source_name": source.name if source else None,
        "stake": t.stake,
        "bets": bets,
        "created_at": t.created_at.isoformat(),
    }


@router.get("/", response_model=List[TemplateOut])
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(TicketTemplate).order_by(TicketTemplate.name).all()
    return [to_out(t) for t in templates]


@router.post("/", status_code=201)
def create_template(data: TemplateIn, db: Session = Depends(get_db)):
    existing = db.query(TicketTemplate).filter(TicketTemplate.name == data.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Šablona s tímto názvem již existuje")
    tpl = TicketTemplate(
        name=data.name.strip(),
        ticket_type=data.ticket_type,
        bookmaker=data.bookmaker,
        source_id=data.source_id,
        stake=data.stake,
        bets_json=json.dumps([b.model_dump() for b in data.bets], ensure_ascii=False),
    )
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return to_out(tpl)


@router.put("/{template_id}")
def update_template(template_id: int, data: TemplateIn, db: Session = Depends(get_db)):
    tpl = db.query(TicketTemplate).filter(TicketTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Šablona nenalezena")
    conflict = db.query(TicketTemplate).filter(
        TicketTemplate.name == data.name.strip(), TicketTemplate.id != template_id
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail="Šablona s tímto názvem již existuje")
    tpl.name = data.name.strip()
    tpl.ticket_type = data.ticket_type
    tpl.bookmaker = data.bookmaker
    tpl.source_id = data.source_id
    tpl.stake = data.stake
    tpl.bets_json = json.dumps([b.model_dump() for b in data.bets], ensure_ascii=False)
    db.commit()
    db.refresh(tpl)
    return to_out(tpl)


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    tpl = db.query(TicketTemplate).filter(TicketTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Šablona nenalezena")
    db.delete(tpl)
    db.commit()
