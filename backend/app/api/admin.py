from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from ..database import get_db
from ..models.user import User
from ..models.ticket import Ticket, Source
from ..models.system import LoginLog, SystemSetting
from ..auth import require_admin, hash_password, create_access_token

router = APIRouter()


class AdminUserOut(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_admin: bool
    is_public: bool
    created_at: str
    ticket_count: int

    class Config:
        from_attributes = True


class AdminEditUser(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_public: Optional[bool] = None


@router.get("/stats")
def admin_stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    total_tickets = db.query(Ticket).count()
    admin_count = db.query(User).filter(User.is_admin == True).count()
    return {
        "total_users": total_users,
        "active_users": active_users,
        "admin_count": admin_count,
        "total_tickets": total_tickets,
    }


@router.get("/users", response_model=List[AdminUserOut])
def admin_list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    users = db.query(User).order_by(User.id).all()
    result = []
    for u in users:
        ticket_count = db.query(Ticket).filter(Ticket.user_id == u.id).count()
        result.append(AdminUserOut(
            id=u.id,
            username=u.username,
            email=u.email,
            is_active=u.is_active,
            is_admin=u.is_admin,
            is_public=u.is_public,
            created_at=u.created_at.isoformat() if u.created_at else "",
            ticket_count=ticket_count,
        ))
    return result


@router.get("/users/{user_id}", response_model=AdminUserOut)
def admin_get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Uživatel nenalezen")
    ticket_count = db.query(Ticket).filter(Ticket.user_id == u.id).count()
    return AdminUserOut(
        id=u.id,
        username=u.username,
        email=u.email,
        is_active=u.is_active,
        is_admin=u.is_admin,
        is_public=u.is_public,
        created_at=u.created_at.isoformat() if u.created_at else "",
        ticket_count=ticket_count,
    )


@router.put("/users/{user_id}", response_model=AdminUserOut)
def admin_edit_user(
    user_id: int,
    data: AdminEditUser,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Uživatel nenalezen")

    if data.username is not None:
        if len(data.username) < 3:
            raise HTTPException(status_code=400, detail="Uživatelské jméno musí mít alespoň 3 znaky")
        existing = db.query(User).filter(User.username == data.username, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Uživatelské jméno je již použito")
        u.username = data.username

    if data.email is not None:
        existing = db.query(User).filter(User.email == data.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email je již použit")
        u.email = data.email

    if data.password is not None:
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail="Heslo musí mít alespoň 6 znaků")
        u.hashed_password = hash_password(data.password)

    if data.is_active is not None:
        u.is_active = data.is_active

    if data.is_public is not None:
        u.is_public = data.is_public

    if data.is_admin is not None:
        if user_id == current_admin.id and not data.is_admin:
            raise HTTPException(status_code=400, detail="Nemůžete odebrat admin práva sami sobě")
        u.is_admin = data.is_admin

    db.commit()
    ticket_count = db.query(Ticket).filter(Ticket.user_id == u.id).count()
    return AdminUserOut(
        id=u.id,
        username=u.username,
        email=u.email,
        is_active=u.is_active,
        is_admin=u.is_admin,
        is_public=u.is_public,
        created_at=u.created_at.isoformat() if u.created_at else "",
        ticket_count=ticket_count,
    )


@router.delete("/users/{user_id}")
def admin_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="Nemůžete smazat sami sebe")
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Uživatel nenalezen")
    db.query(Ticket).filter(Ticket.user_id == user_id).delete()
    db.query(Source).filter(Source.user_id == user_id).delete()
    db.delete(u)
    db.commit()
    return {"ok": True}


# ── Bulk actions ────────────────────────────────────────────────────────────────

class BulkActionRequest(BaseModel):
    user_ids: List[int]
    action: str  # "activate" | "deactivate" | "delete"


@router.post("/users/bulk")
def admin_bulk_action(
    data: BulkActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    if current_admin.id in data.user_ids and data.action == "delete":
        raise HTTPException(status_code=400, detail="Nemůžete smazat sami sebe")
    affected = 0
    for uid in data.user_ids:
        u = db.query(User).filter(User.id == uid).first()
        if not u:
            continue
        if data.action == "activate":
            u.is_active = True; affected += 1
        elif data.action == "deactivate":
            if uid != current_admin.id:
                u.is_active = False; affected += 1
        elif data.action == "delete":
            if uid != current_admin.id:
                db.query(Ticket).filter(Ticket.user_id == uid).delete()
                db.query(Source).filter(Source.user_id == uid).delete()
                db.delete(u); affected += 1
    db.commit()
    return {"affected": affected}


# ── Impersonation ───────────────────────────────────────────────────────────────

@router.post("/users/{user_id}/impersonate")
def admin_impersonate(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Uživatel nenalezen")
    token = create_access_token({"sub": str(u.id)})
    return {"access_token": token, "token_type": "bearer", "user_id": u.id, "username": u.username, "email": u.email}


# ── Login logs ─────────────────────────────────────────────────────────────────

@router.get("/login-logs")
def admin_login_logs(limit: int = 100, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    logs = db.query(LoginLog).order_by(LoginLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "username_attempted": l.username_attempted,
            "ip_address": l.ip_address,
            "success": l.success,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "user_id": l.user_id,
        }
        for l in logs
    ]


# ── Extended stats ─────────────────────────────────────────────────────────────

@router.get("/extended-stats")
def admin_extended_stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    tickets_today = db.query(Ticket).filter(Ticket.created_at >= today_start).count()
    tickets_week = db.query(Ticket).filter(Ticket.created_at >= week_start).count()
    tickets_month = db.query(Ticket).filter(Ticket.created_at >= month_start).count()

    # Registrations per day – last 30 days
    reg_data = []
    for i in range(29, -1, -1):
        day = today_start - timedelta(days=i)
        next_day = day + timedelta(days=1)
        count = db.query(User).filter(User.created_at >= day, User.created_at < next_day).count()
        reg_data.append({"date": day.strftime("%d.%m."), "count": count})

    # Top users by ticket count
    users = db.query(User).all()
    user_stats = []
    for u in users:
        tc = db.query(Ticket).filter(Ticket.user_id == u.id).count()
        shared = db.query(Ticket).filter(Ticket.user_id == u.id, Ticket.share_token != None).count()
        evaluated = db.query(Ticket).filter(Ticket.user_id == u.id, Ticket.status.in_(["VÝHERNÍ", "PROHRÁVAJÍCÍ"])).all()
        won = [t for t in evaluated if t.status == "VÝHERNÍ"]
        winrate = round(len(won) / len(evaluated) * 100, 1) if evaluated else 0
        user_stats.append({"id": u.id, "username": u.username, "ticket_count": tc, "shared_count": shared, "winrate": winrate})

    top_tickets = sorted(user_stats, key=lambda x: x["ticket_count"], reverse=True)[:5]
    top_winrate = sorted([u for u in user_stats if db.query(Ticket).filter(Ticket.user_id == u["id"], Ticket.status.in_(["VÝHERNÍ", "PROHRÁVAJÍCÍ"])).count() >= 3], key=lambda x: x["winrate"], reverse=True)[:5]
    top_shared = sorted(user_stats, key=lambda x: x["shared_count"], reverse=True)[:5]

    return {
        "activity": {"today": tickets_today, "week": tickets_week, "month": tickets_month},
        "registrations_30d": reg_data,
        "top_by_tickets": top_tickets,
        "top_by_winrate": top_winrate,
        "top_by_shared": top_shared,
    }


# ── System settings ────────────────────────────────────────────────────────────

@router.get("/system-settings")
def get_system_settings(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    settings = db.query(SystemSetting).all()
    return {s.key: s.value for s in settings}


class SystemSettingsUpdate(BaseModel):
    maintenance_mode: Optional[bool] = None
    announcement: Optional[str] = None


@router.put("/system-settings")
def update_system_settings(
    data: SystemSettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    def set_setting(key: str, value: str):
        s = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if s:
            s.value = value
        else:
            db.add(SystemSetting(key=key, value=value))

    if data.maintenance_mode is not None:
        set_setting("maintenance_mode", "1" if data.maintenance_mode else "0")
    if data.announcement is not None:
        set_setting("announcement", data.announcement)

    db.commit()
    settings = db.query(SystemSetting).all()
    return {s.key: s.value for s in settings}


# ── Public system info (no auth) ────────────────────────────────────────────────

@router.get("/public-settings")
def get_public_settings(db: Session = Depends(get_db)):
    announcement = db.query(SystemSetting).filter(SystemSetting.key == "announcement").first()
    return {"announcement": announcement.value if announcement else ""}
