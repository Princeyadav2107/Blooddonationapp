from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, inspect, or_, select, text

from app.config import settings
from app.database import Base, SessionLocal, engine
from app import models  # noqa: F401
from app.models import BloodNeed, BloodRequest, DonationInvitation, PasswordResetToken, User
from app.routes import router


def remove_legacy_demo_donors() -> None:
    """Remove sample donor accounts created by earlier versions of OpenVein."""
    demo_user_ids = select(User.id).where(
        or_(
            User.full_name.like("Demo Donor %"),
            User.email.like("%.demo@example.com"),
            User.email.like("%.demo@example.test"),
        )
    )
    with SessionLocal() as db:
        db.execute(
            delete(DonationInvitation).where(
                or_(
                    DonationInvitation.donor_id.in_(demo_user_ids),
                    DonationInvitation.blood_need_id.in_(
                        select(BloodNeed.id).where(BloodNeed.recipient_id.in_(demo_user_ids))
                    ),
                )
            )
        )
        db.execute(delete(BloodNeed).where(BloodNeed.recipient_id.in_(demo_user_ids)))
        db.execute(
            delete(BloodRequest).where(
                or_(BloodRequest.recipient_id.in_(demo_user_ids), BloodRequest.donor_id.in_(demo_user_ids))
            )
        )
        db.execute(delete(PasswordResetToken).where(PasswordResetToken.user_id.in_(demo_user_ids)))
        db.execute(delete(User).where(User.id.in_(demo_user_ids)))
        db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    user_migrations = {
        "date_of_birth": "DATE",
        "gender": "VARCHAR(30)",
        "latitude": "FLOAT",
        "longitude": "FLOAT",
        "last_donation_date": "DATE",
    }
    with engine.begin() as connection:
        for column_name, column_type in user_migrations.items():
            if column_name not in user_columns:
                connection.execute(
                    text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}")
                )
        invitation_columns = {column["name"] for column in inspect(engine).get_columns("donation_invitations")}
        invitation_migrations = {
            "matching_mode": "VARCHAR(20) NOT NULL DEFAULT 'compatible'",
            "medical_screening_status": "VARCHAR(30)",
            "medical_background_concern": "BOOLEAN",
            "medical_feedback_shared": "BOOLEAN NOT NULL DEFAULT FALSE",
        }
        for column_name, column_type in invitation_migrations.items():
            if column_name not in invitation_columns:
                connection.execute(text(f"ALTER TABLE donation_invitations ADD COLUMN {column_name} {column_type}"))
    remove_legacy_demo_donors()
    yield


app = FastAPI(
    title="OpenVein API",
    description="Account registration and authentication for a blood donation community.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
