import logging
import smtplib
from datetime import datetime, timedelta, timezone
from re import sub

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.email import is_email_delivery_configured, send_password_reset_email
from app.models import BloodRequest, PasswordResetToken, User
from app.schemas import (
    PasswordResetConfirm,
    PasswordResetRequest,
    BloodDonorRead,
    BloodRequestCreate,
    BloodRequestInboxRead,
    BloodRequestRead,
    RecoveryDetailsUpdate,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserRead,
)
from app.security import (
    ALGORITHM,
    create_access_token,
    create_password_reset_token,
    hash_password,
    hash_password_reset_token,
    verify_password,
)


router = APIRouter(prefix="/api/auth", tags=["authentication"])
bearer_scheme = HTTPBearer(auto_error=False)
logger = logging.getLogger(__name__)

DONOR_COMPATIBILITY = {
    "O-": {"O-"},
    "O+": {"O-", "O+"},
    "A-": {"O-", "A-"},
    "A+": {"O-", "O+", "A-", "A+"},
    "B-": {"O-", "B-"},
    "B+": {"O-", "O+", "B-", "B+"},
    "AB-": {"O-", "A-", "B-", "AB-"},
    "AB+": {"O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"},
}


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not verify_password(password, user.hashed_password):
        return None
    return user


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> TokenResponse:
    email = str(payload.email).lower()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        full_name=payload.full_name,
        email=email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        blood_group=payload.blood_group,
        date_of_birth=payload.date_of_birth,
        phone=payload.phone,
        city=payload.city,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from None
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id), user=user)


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, str(payload.email), payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(access_token=create_access_token(user.id), user=user)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            credentials.credentials, settings.secret_key, algorithms=[ALGORITHM]
        )
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return user


@router.get("/me", response_model=UserRead)
def read_current_user(
    user: User = Depends(get_current_user),
) -> User:
    return user


@router.get("/donors", response_model=list[BloodDonorRead])
def find_compatible_donors(
    blood_group: str = Query(...),
    city: str | None = Query(default=None, max_length=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    if user.role not in {"recipient", "both"}:
        raise HTTPException(status_code=403, detail="Only recipients can search for donors.")
    if blood_group not in DONOR_COMPATIBILITY:
        raise HTTPException(status_code=422, detail="Choose a valid blood group.")
    query = select(User).where(
        User.role.in_(("donor", "both")),
        User.blood_group.in_(DONOR_COMPATIBILITY[blood_group]),
    )
    if city and city.strip():
        query = query.where(User.city.ilike(city.strip()))
    return list(db.scalars(query.order_by(User.city, User.full_name)).all())


@router.post("/blood-requests/{donor_id}", response_model=BloodRequestRead, status_code=201)
def ask_donor_for_blood(
    donor_id: int,
    payload: BloodRequestCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BloodRequest:
    if user.role not in {"recipient", "both"}:
        raise HTTPException(status_code=403, detail="Only recipients can request blood.")
    if payload.blood_group not in DONOR_COMPATIBILITY:
        raise HTTPException(status_code=422, detail="Choose a valid blood group.")
    donor = db.get(User, donor_id)
    if donor is None or donor.role not in {"donor", "both"} or donor.blood_group not in DONOR_COMPATIBILITY[payload.blood_group]:
        raise HTTPException(status_code=404, detail="This donor is not eligible for that blood group.")
    existing = db.scalar(select(BloodRequest.id).where(
        BloodRequest.recipient_id == user.id,
        BloodRequest.donor_id == donor.id,
        BloodRequest.status == "pending",
    ))
    if existing is not None:
        raise HTTPException(status_code=409, detail="You already have a pending request to this donor.")
    request = BloodRequest(
        recipient_id=user.id,
        donor_id=donor.id,
        blood_group=payload.blood_group,
        city=payload.city,
        hospital=payload.hospital,
        units=payload.units,
        message=payload.message,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.get("/blood-requests", response_model=list[BloodRequestRead])
def my_blood_requests(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BloodRequest]:
    if user.role not in {"recipient", "both"}:
        raise HTTPException(status_code=403, detail="Only recipients can view blood requests.")
    return list(db.scalars(select(BloodRequest).where(
        BloodRequest.recipient_id == user.id,
    ).order_by(BloodRequest.created_at.desc())).all())


@router.get("/blood-requests/inbox", response_model=list[BloodRequestInboxRead])
def donor_blood_request_inbox(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    if user.role not in {"donor", "both"}:
        raise HTTPException(status_code=403, detail="Only donors can view incoming requests.")
    rows = db.execute(
        select(BloodRequest, User.full_name)
        .join(User, BloodRequest.recipient_id == User.id)
        .where(BloodRequest.donor_id == user.id)
        .order_by(BloodRequest.created_at.desc())
    ).all()
    return [
        {
            "id": request.id,
            "recipient_name": recipient_name,
            "blood_group": request.blood_group,
            "city": request.city,
            "hospital": request.hospital,
            "units": request.units,
            "message": request.message,
            "status": request.status,
            "created_at": request.created_at,
        }
        for request, recipient_name in rows
    ]


@router.put("/recovery-details", response_model=UserRead)
def update_recovery_details(
    payload: RecoveryDetailsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user.date_of_birth = payload.date_of_birth
    user.phone = payload.phone
    db.commit()
    db.refresh(user)
    return user


@router.post("/password-reset/request", status_code=status.HTTP_202_ACCEPTED)
def request_password_reset(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not is_email_delivery_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email delivery is not configured.",
        )

    email = str(payload.email).lower()
    user = db.scalar(select(User).where(User.email == email))
    phone_matches = (
        user is not None
        and user.phone is not None
        and sub(r"\D", "", user.phone) == sub(r"\D", "", payload.phone)
    )
    if (
        user is None
        or user.date_of_birth != payload.date_of_birth
        or not phone_matches
    ):
        return {
            "message": "If the information matches an account, a reset link will be sent by email."
        }

    now = datetime.now(timezone.utc)
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    raw_token = create_password_reset_token()
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_password_reset_token(raw_token),
        expires_at=now + timedelta(minutes=settings.password_reset_expire_minutes),
    )
    db.add(reset_token)
    db.commit()

    reset_url = f"{settings.frontend_url.rstrip('/')}/#reset_token={raw_token}"
    try:
        send_password_reset_email(user.email, reset_url)
    except (OSError, smtplib.SMTPException):
        logger.exception("Could not deliver a password reset email")
        reset_token.used_at = datetime.now(timezone.utc)
        db.commit()

    return {
        "message": "If the information matches an account, a reset link will be sent by email."
    }


@router.post("/password-reset/confirm")
def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    now = datetime.now(timezone.utc)
    reset_token = db.scalar(
        select(PasswordResetToken)
        .where(PasswordResetToken.token_hash == hash_password_reset_token(payload.token))
        .with_for_update()
    )
    if reset_token is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has expired.",
        )
    expires_at = reset_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if reset_token.used_at is not None or expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has expired.",
        )

    user = db.get(User, reset_token.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has expired.",
        )

    user.hashed_password = hash_password(payload.new_password)
    reset_token.used_at = now
    db.execute(
        update(PasswordResetToken)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
        .values(used_at=now)
    )
    db.commit()
    return {"message": "Password updated. You can now sign in."}
