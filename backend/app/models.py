from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))
    blood_group: Mapped[str | None] = mapped_column(String(3), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(30), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_donation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_verified_donation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_verified_donation_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class BloodNeed(Base):
    __tablename__ = "blood_needs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    reference_code: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    blood_group: Mapped[str] = mapped_column(String(3))
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    hospital: Mapped[str | None] = mapped_column(String(160), nullable=True)
    units: Mapped[int] = mapped_column(default=1)
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class DonationInvitation(Base):
    __tablename__ = "donation_invitations"
    __table_args__ = (UniqueConstraint("blood_need_id", "donor_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    blood_need_id: Mapped[int] = mapped_column(ForeignKey("blood_needs.id", ondelete="CASCADE"), index=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    distance_km: Mapped[float] = mapped_column(Float)
    radius_km: Mapped[int] = mapped_column(default=15)
    eligibility_confirmation_required: Mapped[bool] = mapped_column(default=False)
    priority: Mapped[int] = mapped_column(default=0)
    matching_mode: Mapped[str] = mapped_column(String(20), default="compatible")
    medical_screening_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    medical_background_concern: Mapped[bool | None] = mapped_column(nullable=True)
    medical_feedback_shared: Mapped[bool] = mapped_column(default=False)
    confirmation_pin: Mapped[str | None] = mapped_column(String(4), nullable=True)
    confirmation_pin_attempts: Mapped[int] = mapped_column(default=0)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class BloodRequest(Base):
    __tablename__ = "blood_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    blood_group: Mapped[str] = mapped_column(String(3))
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hospital: Mapped[str | None] = mapped_column(String(160), nullable=True)
    units: Mapped[int] = mapped_column(default=1)
    message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
