from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from ..database import get_db
from ..models.ticket import Source
from ..models.user import User
from ..auth import get_current_user

router = APIRouter()


class SourceIn(BaseModel):
    name: str


class SourceOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


@router.get("/", response_model=List[SourceOut])
def list_sources(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Source).filter(Source.user_id == current_user.id).order_by(Source.name).all()


@router.post("/", response_model=SourceOut, status_code=201)
def create_source(data: SourceIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Source).filter(Source.name == data.name, Source.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Zdroj s tímto názvem již existuje")
    source = Source(name=data.name.strip(), user_id=current_user.id)
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.put("/{source_id}", response_model=SourceOut)
def update_source(source_id: int, data: SourceIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    source = db.query(Source).filter(Source.id == source_id, Source.user_id == current_user.id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Zdroj nenalezen")
    conflict = db.query(Source).filter(Source.name == data.name, Source.id != source_id, Source.user_id == current_user.id).first()
    if conflict:
        raise HTTPException(status_code=400, detail="Zdroj s tímto názvem již existuje")
    source.name = data.name.strip()
    db.commit()
    db.refresh(source)
    return source


@router.delete("/{source_id}", status_code=204)
def delete_source(source_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    source = db.query(Source).filter(Source.id == source_id, Source.user_id == current_user.id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Zdroj nenalezen")
    db.delete(source)
    db.commit()
