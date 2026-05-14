from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Any, Dict
from pydantic import BaseModel
from datetime import datetime
import re
import json as _json

from ..database import get_db
from ..models.ticket import Ticket, Bet, Source
from ..models.user import User
from ..auth import get_current_user
from ..parser import parse_ticket_html

router = APIRouter()


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class BetIn(BaseModel):
    match_name: str
    league: Optional[str] = None
    match_datetime: Optional[datetime] = None
    tip: str
    odds: float
    result: Optional[str] = "NEVYHODNOCENO"
    score: Optional[str] = None


class TicketIn(BaseModel):
    status: Optional[str] = "NEVYHODNOCENÝ"
    ticket_type: Optional[str] = "SÓLO"
    bookmaker: Optional[str] = None  # "Tipsport", "Fortuna", etc.
    source_id: Optional[int] = None
    created_at: Optional[datetime] = None
    total_odds: Optional[float] = None
    stake: Optional[float] = None
    possible_win: Optional[float] = None
    actual_win: Optional[float] = None
    note: Optional[str] = None
    bets: List[BetIn] = []


class BetOut(BaseModel):
    id: int
    match_name: str
    league: Optional[str]
    match_datetime: Optional[datetime]
    tip: str
    odds: float
    result: str
    score: Optional[str]

    class Config:
        from_attributes = True


class SourceOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class TicketOut(BaseModel):
    id: int
    status: str
    ticket_type: str
    bookmaker: Optional[str]
    source_id: Optional[int]
    source: Optional[SourceOut]
    created_at: datetime
    total_odds: Optional[float]
    stake: Optional[float]
    possible_win: Optional[float]
    actual_win: Optional[float]
    note: Optional[str]
    bets: List[BetOut]

    class Config:
        from_attributes = True


class HtmlImport(BaseModel):
    html: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

class PaginatedTickets(BaseModel):
    items: List[TicketOut]
    total: int
    limit: int
    offset: int

    class Config:
        from_attributes = True


@router.get("/", response_model=PaginatedTickets)
def get_tickets(
    status: Optional[str] = None,
    bookmaker: Optional[str] = None,
    source_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 25,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Ticket).options(joinedload(Ticket.bets), joinedload(Ticket.source)).filter(Ticket.user_id == current_user.id).order_by(Ticket.created_at.desc())
    if status:
        q = q.filter(Ticket.status == status)
    if bookmaker:
        q = q.filter(Ticket.bookmaker == bookmaker)
    if source_id:
        q = q.filter(Ticket.source_id == source_id)
    if date_from:
        q = q.filter(Ticket.created_at >= datetime.fromisoformat(date_from + "T00:00:00" if "T" not in date_from else date_from))
    if date_to:
        q = q.filter(Ticket.created_at <= datetime.fromisoformat(date_to + "T23:59:59" if "T" not in date_to else date_to))
    if search:
        from sqlalchemy import or_
        from ..models.ticket import Bet as BetModel
        q = q.outerjoin(BetModel, BetModel.ticket_id == Ticket.id).filter(
            or_(
                Ticket.bookmaker.ilike(f"%{search}%"),
                Ticket.note.ilike(f"%{search}%"),
                BetModel.match_name.ilike(f"%{search}%"),
                BetModel.tip.ilike(f"%{search}%"),
                BetModel.league.ilike(f"%{search}%"),
            )
        ).group_by(Ticket.id)
    total = q.count()
    items = q.offset(offset).limit(limit).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tickets = db.query(Ticket).options(joinedload(Ticket.bets)).filter(Ticket.user_id == current_user.id).all()
    total = len(tickets)
    won = sum(1 for t in tickets if t.status == "VÝHERNÍ")
    lost = sum(1 for t in tickets if t.status == "PROHRÁVAJÍCÍ")
    pending = sum(1 for t in tickets if t.status == "NEVYHODNOCENÝ")
    evaluated = [t for t in tickets if t.status in ("VÝHERNÍ", "PROHRÁVAJÍCÍ")]
    total_staked = sum(t.stake or 0 for t in evaluated)

    def effective_win(t: Ticket) -> float:
        if t.actual_win is not None:
            return t.actual_win
        if t.possible_win is not None:
            return t.possible_win
        if t.stake and t.total_odds:
            return round(t.stake * t.total_odds, 2)
        return 0.0

    total_won = sum(effective_win(t) for t in evaluated if t.status == "VÝHERNÍ")
    profit = total_won - total_staked
    roi = (profit / total_staked * 100) if total_staked > 0 else 0
    return {
        "total": total,
        "won": won,
        "lost": lost,
        "pending": pending,
        "total_staked": round(total_staked, 2),
        "total_won": round(total_won, 2),
        "profit": round(profit, 2),
        "roi": round(roi, 2),
    }


def classify_tip(tip: str, match_name: str) -> str:
    """Classify a bet tip into a category."""
    t = tip.strip().lower()

    # Goals over/under – matches "více/méně než X", "počet gólů...: více/méně než X", etc.
    if re.search(r"(více|méně|over|under) než \d", t) or re.search(r"(více|méně|over|under) \d", t):
        return "Počet gólů"
    if re.search(r"počet gólů", t):
        return "Počet gólů"
    if re.search(r"celkov\w* počet", t):
        return "Počet gólů"

    # Both teams to score
    if "oba" in t and "skór" in t:
        return "Oba dají gól"

    # Draw
    if t in ("remíza", "remiza", "x"):
        return "Remíza"

    # No goal / nobody scores
    if t in ("nikdo", "nikdo nedá", "0"):
        return "Nikdo nedá gól"

    # Handicap
    if "handicap" in t or t.startswith("(-") or t.startswith("(+"):
        return "Handicap"

    # Half-time / full-time combos like "1/1", "X/2"
    if re.match(r"^[1x2]/[1x2]$", t):
        return "Poločas/Výsledek"

    # If the tip matches one of the team names in the match → výhera týmu
    if match_name:
        teams = [team.strip().lower() for team in match_name.split("-")]
        for team in teams:
            # allow partial match (e.g. "Klaksvik" in "B68 Toftir - Klaksvik")
            if t in team or team in t:
                return "Výhra týmu"

    # Fallback – still likely a team win if it looks like a proper noun
    if tip and tip[0].isupper() and " " not in tip:
        return "Výhra týmu"

    return "Ostatní"


@router.get("/stats/by-odds-range")
def get_stats_by_odds_range(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Break down tickets by total_odds range and show win rate + profit per band."""
    BANDS = [
        ("1.00–1.49", 1.00, 1.50),
        ("1.50–1.99", 1.50, 2.00),
        ("2.00–2.99", 2.00, 3.00),
        ("3.00–4.99", 3.00, 5.00),
        ("5.00+",     5.00, 9999),
    ]
    tickets = db.query(Ticket).filter(
        Ticket.status.in_(["VÝHERNÍ", "PROHRÁVAJÍCÍ"]),
        Ticket.total_odds.isnot(None),
        Ticket.user_id == current_user.id,
    ).all()

    def effective_win(t: Ticket) -> float:
        if t.actual_win is not None:
            return t.actual_win
        if t.possible_win is not None:
            return t.possible_win
        if t.stake and t.total_odds:
            return round(t.stake * t.total_odds, 2)
        return 0.0

    result = []
    for label, lo, hi in BANDS:
        group = [t for t in tickets if lo <= (t.total_odds or 0) < hi]
        if not group:
            continue
        won = [t for t in group if t.status == "VÝHERNÍ"]
        lost = [t for t in group if t.status == "PROHRÁVAJÍCÍ"]
        staked = sum(t.stake or 0 for t in group)
        profit = sum(effective_win(t) - (t.stake or 0) for t in won) - sum(t.stake or 0 for t in lost)
        avg_odds = sum(t.total_odds for t in group if t.total_odds) / len(group)
        result.append({
            "band": label,
            "total": len(group),
            "won": len(won),
            "lost": len(lost),
            "success_rate": round(len(won) / len(group) * 100, 1) if group else None,
            "staked": round(staked, 2),
            "profit": round(profit, 2),
            "roi": round(profit / staked * 100, 2) if staked > 0 else None,
            "avg_odds": round(avg_odds, 2),
        })
    return result


@router.get("/stats/by-tip")
def get_stats_by_tip(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bets = db.query(Bet).join(Ticket).filter(Ticket.user_id == current_user.id).all()

    # Per-tip detail
    tip_groups: dict = {}
    # Per-category summary
    cat_groups: dict = {}

    for bet in bets:
        tip = bet.tip if bet.tip else "?"
        category = classify_tip(tip, bet.match_name or "")

        # tip detail
        if tip not in tip_groups:
            tip_groups[tip] = {"tip": tip, "category": category, "total": 0, "won": 0, "lost": 0, "pending": 0}
        tip_groups[tip]["total"] += 1
        if bet.result == "VÝHRA":
            tip_groups[tip]["won"] += 1
        elif bet.result == "PROHRA":
            tip_groups[tip]["lost"] += 1
        else:
            tip_groups[tip]["pending"] += 1

        # category summary
        if category not in cat_groups:
            cat_groups[category] = {"category": category, "total": 0, "won": 0, "lost": 0, "pending": 0}
        cat_groups[category]["total"] += 1
        if bet.result == "VÝHRA":
            cat_groups[category]["won"] += 1
        elif bet.result == "PROHRA":
            cat_groups[category]["lost"] += 1
        else:
            cat_groups[category]["pending"] += 1

    tips = []
    for g in tip_groups.values():
        evaluated = g["won"] + g["lost"]
        g["success_rate"] = round(g["won"] / evaluated * 100, 1) if evaluated > 0 else None
        tips.append(g)
    tips.sort(key=lambda x: x["total"], reverse=True)

    categories = []
    for g in cat_groups.values():
        evaluated = g["won"] + g["lost"]
        g["success_rate"] = round(g["won"] / evaluated * 100, 1) if evaluated > 0 else None
        categories.append(g)
    categories.sort(key=lambda x: x["total"], reverse=True)

    return {"tips": tips, "categories": categories}


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ticket = db.query(Ticket).options(joinedload(Ticket.bets), joinedload(Ticket.source)).filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.post("/", response_model=TicketOut, status_code=201)
def create_ticket(data: TicketIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ticket = Ticket(
        status=data.status,
        ticket_type=data.ticket_type,
        bookmaker=data.bookmaker,
        source_id=data.source_id,
        created_at=data.created_at or datetime.utcnow(),
        total_odds=data.total_odds,
        stake=data.stake,
        possible_win=data.possible_win,
        actual_win=data.actual_win,
        note=data.note,
        user_id=current_user.id,
    )
    db.add(ticket)
    db.flush()
    for b in data.bets:
        bet = Bet(
            ticket_id=ticket.id,
            match_name=b.match_name,
            league=b.league,
            match_datetime=b.match_datetime,
            tip=b.tip,
            odds=b.odds,
            result=b.result or "NEVYHODNOCENO",
            score=b.score,
        )
        db.add(bet)
    db.commit()
    ticket = db.query(Ticket).options(joinedload(Ticket.bets), joinedload(Ticket.source)).filter(Ticket.id == ticket.id).first()
    return ticket


@router.put("/{ticket_id}", response_model=TicketOut)
def update_ticket(ticket_id: int, data: TicketIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.status = data.status
    ticket.ticket_type = data.ticket_type
    ticket.bookmaker = data.bookmaker
    ticket.source_id = data.source_id
    if data.created_at:
        ticket.created_at = data.created_at
    ticket.total_odds = data.total_odds
    ticket.stake = data.stake
    ticket.possible_win = data.possible_win
    ticket.actual_win = data.actual_win
    ticket.note = data.note
    # Replace bets
    db.query(Bet).filter(Bet.ticket_id == ticket_id).delete()
    for b in data.bets:
        bet = Bet(
            ticket_id=ticket.id,
            match_name=b.match_name,
            league=b.league,
            match_datetime=b.match_datetime,
            tip=b.tip,
            odds=b.odds,
            result=b.result or "NEVYHODNOCENO",
            score=b.score,
        )
        db.add(bet)
    db.commit()
    ticket = db.query(Ticket).options(joinedload(Ticket.bets), joinedload(Ticket.source)).filter(Ticket.id == ticket_id).first()
    return ticket


class StatusPatch(BaseModel):
    status: str


@router.patch("/{ticket_id}/status", response_model=TicketOut)
def patch_ticket_status(ticket_id: int, data: StatusPatch, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.status = data.status
    db.commit()
    ticket = db.query(Ticket).options(joinedload(Ticket.bets), joinedload(Ticket.source)).filter(Ticket.id == ticket_id).first()
    return ticket


@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    db.delete(ticket)
    db.commit()


@router.post("/import/html", response_model=TicketOut, status_code=201)
def import_from_html(payload: HtmlImport, db: Session = Depends(get_db)):
    try:
        data = parse_ticket_html(payload.html)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Chyba při parsování HTML: {e}")

    ticket = Ticket(
        status=data["status"],
        ticket_type=data["ticket_type"],
        bookmaker=data.get("bookmaker"),
        created_at=data["created_at"],
        total_odds=data["total_odds"],
        stake=data["stake"],
        possible_win=data["possible_win"],
        actual_win=data["actual_win"],
    )
    db.add(ticket)
    db.flush()
    for b in data["bets"]:
        bet = Bet(
            ticket_id=ticket.id,
            match_name=b["match_name"],
            league=b["league"],
            match_datetime=b["match_datetime"],
            tip=b["tip"],
            odds=b["odds"],
            result=b["result"],
            score=b["score"],
        )
        db.add(bet)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/stats/reporting")
def get_reporting(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    bookmaker: Optional[str] = None,
    source_id: Optional[int] = None,
    ticket_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..models.ticket import Source

    q = db.query(Ticket).options(joinedload(Ticket.bets), joinedload(Ticket.source)).filter(Ticket.user_id == current_user.id)
    if date_from:
        q = q.filter(Ticket.created_at >= datetime.fromisoformat(date_from + "T00:00:00" if "T" not in date_from else date_from))
    if date_to:
        q = q.filter(Ticket.created_at <= datetime.fromisoformat(date_to + "T23:59:59" if "T" not in date_to else date_to))
    if bookmaker:
        q = q.filter(Ticket.bookmaker == bookmaker)
    if source_id:
        q = q.filter(Ticket.source_id == source_id)
    if ticket_type:
        q = q.filter(Ticket.ticket_type == ticket_type)

    tickets = q.order_by(Ticket.created_at.asc()).all()

    evaluated = [t for t in tickets if t.status in ("VÝHERNÍ", "PROHRÁVAJÍCÍ")]

    def effective_win(t: Ticket) -> float:
        if t.actual_win is not None:
            return t.actual_win
        if t.possible_win is not None:
            return t.possible_win
        if t.stake and t.total_odds:
            return round(t.stake * t.total_odds, 2)
        return 0.0

    total_staked = sum(t.stake or 0 for t in evaluated)
    total_won = sum(effective_win(t) for t in evaluated if t.status == "VÝHERNÍ")
    profit = total_won - total_staked
    roi = round(profit / total_staked * 100, 2) if total_staked > 0 else 0
    avg_odds = round(sum(t.total_odds for t in evaluated if t.total_odds) / len([t for t in evaluated if t.total_odds]), 2) if any(t.total_odds for t in evaluated) else None

    # Cumulative profit over time - aggregated by day
    daily_profit: dict = {}
    for t in tickets:
        if t.status in ("VÝHERNÍ", "PROHRÁVAJÍCÍ"):
            day = t.created_at.strftime("%d.%m.%Y")
            win = effective_win(t) if t.status == "VÝHERNÍ" else 0.0
            daily_profit[day] = daily_profit.get(day, 0.0) + win - (t.stake or 0)

    profit_over_time = []
    cumulative = 0.0
    for day, day_profit in daily_profit.items():
        cumulative += day_profit
        profit_over_time.append({
            "date": day,
            "profit": round(cumulative, 2),
        })

    # By bookmaker
    bm_groups: dict = {}
    for t in tickets:
        key = t.bookmaker or "Neuvedeno"
        if key not in bm_groups:
            bm_groups[key] = {"bookmaker": key, "total": 0, "won": 0, "lost": 0, "staked": 0.0, "profit": 0.0}
        bm_groups[key]["total"] += 1
        if t.status == "VÝHERNÍ":
            bm_groups[key]["won"] += 1
            if t.status in ("VÝHERNÍ", "PROHRÁVAJÍCÍ"):
                bm_groups[key]["profit"] += effective_win(t) - (t.stake or 0)
        elif t.status == "PROHRÁVAJÍCÍ":
            bm_groups[key]["lost"] += 1
            bm_groups[key]["profit"] -= (t.stake or 0)
        if t.status in ("VÝHERNÍ", "PROHRÁVAJÍCÍ"):
            bm_groups[key]["staked"] += t.stake or 0
    for g in bm_groups.values():
        ev = g["won"] + g["lost"]
        g["success_rate"] = round(g["won"] / ev * 100, 1) if ev > 0 else None
        g["roi"] = round(g["profit"] / g["staked"] * 100, 2) if g["staked"] > 0 else None
        g["profit"] = round(g["profit"], 2)
        g["staked"] = round(g["staked"], 2)

    # By source
    src_groups: dict = {}
    for t in tickets:
        key = (t.source.name if t.source else "Neuvedeno")
        if key not in src_groups:
            src_groups[key] = {"source": key, "total": 0, "won": 0, "lost": 0, "staked": 0.0, "profit": 0.0}
        src_groups[key]["total"] += 1
        if t.status == "VÝHERNÍ":
            src_groups[key]["won"] += 1
            src_groups[key]["profit"] += effective_win(t) - (t.stake or 0)
        elif t.status == "PROHRÁVAJÍCÍ":
            src_groups[key]["lost"] += 1
            src_groups[key]["profit"] -= (t.stake or 0)
        if t.status in ("VÝHERNÍ", "PROHRÁVAJÍCÍ"):
            src_groups[key]["staked"] += t.stake or 0
    for g in src_groups.values():
        ev = g["won"] + g["lost"]
        g["success_rate"] = round(g["won"] / ev * 100, 1) if ev > 0 else None
        g["roi"] = round(g["profit"] / g["staked"] * 100, 2) if g["staked"] > 0 else None
        g["profit"] = round(g["profit"], 2)
        g["staked"] = round(g["staked"], 2)

    # By category – counted per ticket (category = most frequent bet category in the ticket)
    cat_groups: dict = {}
    for t in tickets:
        if not t.bets:
            continue
        # Determine dominant category for this ticket
        cat_counts: dict = {}
        for bet in t.bets:
            c = classify_tip(bet.tip, bet.match_name or "")
            cat_counts[c] = cat_counts.get(c, 0) + 1
        cat = max(cat_counts, key=lambda k: cat_counts[k])
        if cat not in cat_groups:
            cat_groups[cat] = {"category": cat, "total": 0, "won": 0, "lost": 0, "pending": 0, "odds_sum": 0.0, "odds_count": 0}
        cat_groups[cat]["total"] += 1
        if t.status == "VÝHERNÍ":
            cat_groups[cat]["won"] += 1
        elif t.status == "PROHRÁVAJÍCÍ":
            cat_groups[cat]["lost"] += 1
        else:
            cat_groups[cat]["pending"] += 1
        if t.total_odds:
            cat_groups[cat]["odds_sum"] += t.total_odds
            cat_groups[cat]["odds_count"] += 1
    for g in cat_groups.values():
        ev = g["won"] + g["lost"]
        g["success_rate"] = round(g["won"] / ev * 100, 1) if ev > 0 else None
        g["avg_odds"] = round(g["odds_sum"] / g["odds_count"], 2) if g["odds_count"] > 0 else None
        del g["odds_sum"]
        del g["odds_count"]

    # Top 5 best / worst tickets
    def ticket_profit(t: Ticket) -> float:
        if t.status == "VÝHERNÍ":
            return effective_win(t) - (t.stake or 0)
        elif t.status == "PROHRÁVAJÍCÍ":
            return -(t.stake or 0)
        return 0.0

    def ticket_summary(t: Ticket) -> dict:
        bets_names = ", ".join(b.match_name for b in t.bets[:2])
        if len(t.bets) > 2:
            bets_names += f" +{len(t.bets) - 2}"
        return {
            "id": t.id,
            "date": t.created_at.strftime("%d.%m.%Y"),
            "matches": bets_names,
            "stake": t.stake,
            "profit": round(ticket_profit(t), 2),
            "bookmaker": t.bookmaker,
        }

    evaluated_tickets = [t for t in tickets if t.status in ("VÝHERNÍ", "PROHRÁVAJÍCÍ")]
    sorted_by_profit = sorted(evaluated_tickets, key=ticket_profit, reverse=True)
    top_best = [ticket_summary(t) for t in sorted_by_profit[:5]]
    top_worst = [ticket_summary(t) for t in sorted_by_profit[-5:] if ticket_profit(t) < 0]
    top_worst.reverse()

    # Streak tracking (chronological order)
    chron = sorted(evaluated_tickets, key=lambda t: t.created_at)
    current_streak = 0
    current_streak_type = None
    best_win_streak = 0
    best_loss_streak = 0
    tmp_win = 0
    tmp_loss = 0
    for t in chron:
        if t.status == "VÝHERNÍ":
            tmp_win += 1
            tmp_loss = 0
            best_win_streak = max(best_win_streak, tmp_win)
        else:
            tmp_loss += 1
            tmp_win = 0
            best_loss_streak = max(best_loss_streak, tmp_loss)
    if chron:
        last = chron[-1].status
        current_streak_type = "win" if last == "VÝHERNÍ" else "loss"
        streak_val = 0
        for t in reversed(chron):
            if t.status == last:
                streak_val += 1
            else:
                break
        current_streak = streak_val

    # By day of week
    DAY_NAMES = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"]
    dow_groups: dict = {i: {"day": DAY_NAMES[i], "total": 0, "won": 0, "lost": 0, "staked": 0.0, "profit": 0.0} for i in range(7)}
    for t in tickets:
        dow = t.created_at.weekday()
        dow_groups[dow]["total"] += 1
        if t.status == "VÝHERNÍ":
            dow_groups[dow]["won"] += 1
            dow_groups[dow]["profit"] += effective_win(t) - (t.stake or 0)
        elif t.status == "PROHRÁVAJÍCÍ":
            dow_groups[dow]["lost"] += 1
            dow_groups[dow]["profit"] -= (t.stake or 0)
        if t.status in ("VÝHERNÍ", "PROHRÁVAJÍCÍ"):
            dow_groups[dow]["staked"] += t.stake or 0
    for g in dow_groups.values():
        ev = g["won"] + g["lost"]
        g["success_rate"] = round(g["won"] / ev * 100, 1) if ev > 0 else None
        g["roi"] = round(g["profit"] / g["staked"] * 100, 2) if g["staked"] > 0 else None
        g["profit"] = round(g["profit"], 2)
        g["staked"] = round(g["staked"], 2)

    # By month
    month_groups: dict = {}
    for t in tickets:
        key = t.created_at.strftime("%Y-%m")
        label = t.created_at.strftime("%m/%Y")
        if key not in month_groups:
            month_groups[key] = {"month": label, "key": key, "total": 0, "won": 0, "lost": 0, "pending": 0, "staked": 0.0, "profit": 0.0}
        month_groups[key]["total"] += 1
        if t.status == "VÝHERNÍ":
            month_groups[key]["won"] += 1
            month_groups[key]["profit"] += effective_win(t) - (t.stake or 0)
            month_groups[key]["staked"] += t.stake or 0
        elif t.status == "PROHRÁVAJÍCÍ":
            month_groups[key]["lost"] += 1
            month_groups[key]["profit"] -= t.stake or 0
            month_groups[key]["staked"] += t.stake or 0
        else:
            month_groups[key]["pending"] += 1
    for g in month_groups.values():
        ev = g["won"] + g["lost"]
        g["success_rate"] = round(g["won"] / ev * 100, 1) if ev > 0 else None
        g["roi"] = round(g["profit"] / g["staked"] * 100, 2) if g["staked"] > 0 else None
        g["profit"] = round(g["profit"], 2)
        g["staked"] = round(g["staked"], 2)
    by_month = sorted(month_groups.values(), key=lambda x: x["key"], reverse=True)

    return {
        "summary": {
            "total": len(tickets),
            "won": sum(1 for t in tickets if t.status == "VÝHERNÍ"),
            "lost": sum(1 for t in tickets if t.status == "PROHRÁVAJÍCÍ"),
            "pending": sum(1 for t in tickets if t.status == "NEVYHODNOCENÝ"),
            "total_staked": round(total_staked, 2),
            "total_won": round(total_won, 2),
            "profit": round(profit, 2),
            "roi": roi,
            "avg_odds": avg_odds,
        },
        "streak": {
            "current": current_streak,
            "type": current_streak_type,
            "best_win": best_win_streak,
            "best_loss": best_loss_streak,
        },
        "profit_over_time": profit_over_time,
        "by_month": by_month,
        "by_bookmaker": list(bm_groups.values()),
        "by_source": list(src_groups.values()),
        "by_category": sorted(cat_groups.values(), key=lambda x: x["total"], reverse=True),
        "by_day_of_week": list(dow_groups.values()),
        "top_best": top_best,
        "top_worst": top_worst,
    }


# ── Backup / Restore ───────────────────────────────────────────────────────────

@router.get("/export/json")
def export_json(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tickets = db.query(Ticket).options(joinedload(Ticket.bets), joinedload(Ticket.source)).filter(Ticket.user_id == current_user.id).order_by(Ticket.id).all()
    data = []
    for t in tickets:
        data.append({
            "id": t.id,
            "status": t.status,
            "ticket_type": t.ticket_type,
            "bookmaker": t.bookmaker,
            "source_name": t.source.name if t.source else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "stake": t.stake,
            "total_odds": t.total_odds,
            "possible_win": t.possible_win,
            "actual_win": t.actual_win,
            "note": t.note,
            "bets": [
                {
                    "match_name": b.match_name,
                    "league": b.league,
                    "match_datetime": b.match_datetime.isoformat() if b.match_datetime else None,
                    "tip": b.tip,
                    "odds": b.odds,
                    "result": b.result,
                    "score": b.score,
                }
                for b in t.bets
            ],
        })
    content = _json.dumps({"version": 1, "exported_at": datetime.utcnow().isoformat(), "tickets": data}, ensure_ascii=False, indent=2)
    return JSONResponse(content=_json.loads(content), headers={"Content-Disposition": "attachment; filename=bet_backup.json"})


class ImportPayload(BaseModel):
    tickets: List[Dict[str, Any]]
    merge: bool = True


@router.post("/import/json")
def import_json(payload: ImportPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    imported = 0
    skipped = 0
    errors = []

    # Build source cache – only current user's sources
    source_cache: Dict[str, Source] = {}
    for s in db.query(Source).filter(Source.user_id == current_user.id).all():
        source_cache[s.name] = s

    for raw in payload.tickets:
        try:
            # Resolve or create source
            source_id = None
            sname = raw.get("source_name")
            if sname:
                if sname not in source_cache:
                    ns = Source(name=sname, user_id=current_user.id)
                    db.add(ns); db.flush()
                    source_cache[sname] = ns
                source_id = source_cache[sname].id

            created_at = None
            if raw.get("created_at"):
                try:
                    created_at = datetime.fromisoformat(raw["created_at"])
                except Exception:
                    pass

            t = Ticket(
                status=raw.get("status", "NEVYHODNOCENÝ"),
                ticket_type=raw.get("ticket_type", "SÓLO"),
                bookmaker=raw.get("bookmaker"),
                source_id=source_id,
                created_at=created_at or datetime.utcnow(),
                stake=raw.get("stake"),
                total_odds=raw.get("total_odds"),
                possible_win=raw.get("possible_win"),
                actual_win=raw.get("actual_win"),
                note=raw.get("note"),
                user_id=current_user.id,
            )
            db.add(t); db.flush()

            for b in raw.get("bets", []):
                match_dt = None
                if b.get("match_datetime"):
                    try:
                        match_dt = datetime.fromisoformat(b["match_datetime"])
                    except Exception:
                        pass
                db.add(Bet(
                    ticket_id=t.id,
                    match_name=b.get("match_name", ""),
                    league=b.get("league"),
                    match_datetime=match_dt,
                    tip=b.get("tip", ""),
                    odds=b.get("odds", 0),
                    result=b.get("result", "NEVYHODNOCENO"),
                    score=b.get("score"),
                ))
            imported += 1
        except Exception as e:
            skipped += 1
            errors.append(str(e))

    db.commit()
    return {"imported": imported, "skipped": skipped, "errors": errors[:10]}


# ── Sharing ────────────────────────────────────────────────────────────────────

@router.post("/{ticket_id}/share")
def generate_share_link(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import secrets
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket nenalezen")
    if not ticket.share_token:
        ticket.share_token = secrets.token_urlsafe(16)
        db.commit()
    return {"share_token": ticket.share_token}


@router.delete("/{ticket_id}/share")
def revoke_share_link(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.user_id == current_user.id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket nenalezen")
    ticket.share_token = None
    db.commit()
    return {"ok": True}


@router.get("/shared/{token}", response_model=TicketOut)
def get_shared_ticket(token: str, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).options(joinedload(Ticket.bets), joinedload(Ticket.source)).filter(Ticket.share_token == token).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Tiket nenalezen nebo odkaz byl zrušen")
    return ticket
