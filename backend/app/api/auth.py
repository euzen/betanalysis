from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..database import get_db
from ..models.user import User
from ..models.ticket import Ticket, Source
from ..models.system import LoginLog, SystemSetting
from ..auth import hash_password, verify_password, create_access_token, create_refresh_token, decode_refresh_token, get_current_user

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user_id: int
    username: str
    email: str


class MeResponse(BaseModel):
    id: int
    email: str
    username: str
    is_public: bool
    is_admin: bool


@router.post("/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email je již zaregistrován")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Uživatelské jméno je již použito")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Heslo musí mít alespoň 6 znaků")

    user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, token_type="bearer", user_id=user.id, username=user.username, email=user.email)


@router.post("/login", response_model=TokenResponse)
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    ip = request.client.host if request.client else None

    user = db.query(User).filter(
        (User.email == form.username) | (User.username == form.username)
    ).first()

    if not user or not verify_password(form.password, user.hashed_password):
        db.add(LoginLog(user_id=user.id if user else None, username_attempted=form.username, ip_address=ip, success=False))
        db.commit()
        raise HTTPException(status_code=401, detail="Nesprávný email nebo heslo")
    if not user.is_active:
        db.add(LoginLog(user_id=user.id, username_attempted=form.username, ip_address=ip, success=False))
        db.commit()
        raise HTTPException(status_code=400, detail="Účet je deaktivován")

    # Maintenance mode – block non-admins
    maintenance = db.query(SystemSetting).filter(SystemSetting.key == "maintenance_mode").first()
    if maintenance and maintenance.value == "1" and not user.is_admin:
        raise HTTPException(status_code=503, detail="Systém je momentálně v údržbě. Zkuste to prosím později.")

    db.add(LoginLog(user_id=user.id, username_attempted=form.username, ip_address=ip, success=True))
    db.commit()
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, token_type="bearer", user_id=user.id, username=user.username, email=user.email)


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return MeResponse(id=current_user.id, email=current_user.email, username=current_user.username, is_public=current_user.is_public, is_admin=current_user.is_admin)


class SetPublicRequest(BaseModel):
    is_public: bool


@router.post("/set-public")
def set_public(data: SetPublicRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.is_public = data.is_public
    db.commit()
    return {"is_public": current_user.is_public}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ChangeUsernameRequest(BaseModel):
    username: str


@router.post("/change-password")
def change_password(data: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Současné heslo je nesprávné")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Heslo musí mít alespoň 6 znaků")
    current_user.hashed_password = hash_password(data.new_password)
    db.commit()
    return {"ok": True}


@router.post("/change-username")
def change_username(data: ChangeUsernameRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not data.username or len(data.username) < 3:
        raise HTTPException(status_code=400, detail="Uživatelské jméno musí mít alespoň 3 znaky")
    existing = db.query(User).filter(User.username == data.username, User.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Uživatelské jméno je již použito")
    current_user.username = data.username
    db.commit()
    access_token = create_access_token({"sub": str(current_user.id)})
    refresh_token = create_refresh_token({"sub": str(current_user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, token_type="bearer", user_id=current_user.id, username=current_user.username, email=current_user.email)


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh")
def refresh_token(request: Request, data: RefreshRequest, db: Session = Depends(get_db)):
    user_id = decode_refresh_token(data.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Neplatný nebo expirovaný refresh token")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Neplatný token")
    access_token = create_access_token({"sub": str(user.id)})
    new_refresh = create_refresh_token({"sub": str(user.id)})
    return {"access_token": access_token, "refresh_token": new_refresh, "token_type": "bearer"}


@router.get("/profile/{username}")
def get_public_profile(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Uživatel nenalezen")
    if not user.is_public:
        raise HTTPException(status_code=403, detail="Tento uživatel má profil skrytý")

    tickets = db.query(Ticket).filter(Ticket.user_id == user.id).all()
    evaluated = [t for t in tickets if t.status in ("VÝHERNÍ", "PROHRÁVAJÍCÍ")]
    won = [t for t in evaluated if t.status == "VÝHERNÍ"]

    def effective_win(t):
        if t.actual_win is not None: return t.actual_win
        if t.possible_win is not None: return t.possible_win
        if t.stake and t.total_odds: return round(t.stake * t.total_odds, 2)
        return 0.0

    total_staked = sum(t.stake or 0 for t in evaluated)
    total_won = sum(effective_win(t) for t in won)
    profit = total_won - total_staked
    roi = round(profit / total_staked * 100, 2) if total_staked > 0 else 0
    winrate = round(len(won) / len(evaluated) * 100, 1) if evaluated else 0

    shared_tickets = [
        {
            "share_token": t.share_token,
            "status": t.status,
            "ticket_type": t.ticket_type,
            "created_at": t.created_at.isoformat(),
            "total_odds": t.total_odds,
            "stake": t.stake,
            "bets_count": len(t.bets) if t.bets else 0,
        }
        for t in tickets if t.share_token
    ]

    return {
        "username": user.username,
        "total_tickets": len(tickets),
        "evaluated": len(evaluated),
        "won": len(won),
        "winrate": winrate,
        "roi": roi,
        "profit": round(profit, 2),
        "shared_tickets": shared_tickets,
    }


@router.post("/migrate-existing-data")
def migrate_existing_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Assign all tickets/sources without user_id to the current user. Run once after first login."""
    tickets_updated = db.query(Ticket).filter(Ticket.user_id == None).update({"user_id": current_user.id})
    sources_updated = db.query(Source).filter(Source.user_id == None).update({"user_id": current_user.id})
    db.commit()
    return {"tickets_migrated": tickets_updated, "sources_migrated": sources_updated}
