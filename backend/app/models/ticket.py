from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.orm import relationship
from ..database import Base
from datetime import datetime
import enum


class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    tickets = relationship("Ticket", back_populates="source")
    user = relationship("User", back_populates="sources")


class TicketStatus(str, enum.Enum):
    PENDING = "NEVYHODNOCENÝ"
    WON = "VÝHERNÍ"
    LOST = "PROHRÁVAJÍCÍ"
    CANCELLED = "STORNOVANÝ"


class TicketType(str, enum.Enum):
    SOLO = "SÓLO"
    AKU = "AKU"
    SYSTEM = "SYSTÉM"


class BetResult(str, enum.Enum):
    PENDING = "NEVYHODNOCENO"
    WON = "VÝHRA"
    LOST = "PROHRA"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default=TicketStatus.PENDING)
    ticket_type = Column(String, default=TicketType.SOLO)
    bookmaker = Column(String, nullable=True)  # e.g. "Tipsport", "Fortuna"
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    total_odds = Column(Float, nullable=True)
    stake = Column(Float, nullable=True)
    possible_win = Column(Float, nullable=True)
    actual_win = Column(Float, nullable=True)
    note = Column(String, nullable=True)
    share_token = Column(String, nullable=True, unique=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    source = relationship("Source", back_populates="tickets")
    bets = relationship("Bet", back_populates="ticket", cascade="all, delete-orphan")
    user = relationship("User", back_populates="tickets")


class Bet(Base):
    __tablename__ = "bets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)

    match_name = Column(String, nullable=False)
    league = Column(String, nullable=True)
    match_datetime = Column(DateTime, nullable=True)
    tip = Column(String, nullable=False)
    odds = Column(Float, nullable=False)
    result = Column(String, default=BetResult.PENDING)
    score = Column(String, nullable=True)

    ticket = relationship("Ticket", back_populates="bets")


class TicketTemplate(Base):
    __tablename__ = "ticket_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    ticket_type = Column(String, nullable=True)
    bookmaker = Column(String, nullable=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=True)
    stake = Column(Float, nullable=True)
    bets_json = Column(Text, nullable=True)  # JSON serialized list of bets
    created_at = Column(DateTime, default=datetime.utcnow)
