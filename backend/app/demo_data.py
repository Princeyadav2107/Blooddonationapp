from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User
from app.security import hash_password


DEMO_DONOR_PASSWORD = "OpenVeinDemo2026!"
DEMO_DONORS = (
    ("Demo Donor Asha", "asha.demo@example.test", "O+", "Roorkee"),
    ("Demo Donor Naveen", "naveen.demo@example.test", "B+", "Roorkee"),
    ("Demo Donor Tara", "tara.demo@example.test", "A+", "Roorkee"),
    ("Demo Donor Kabir", "kabir.demo@example.test", "O-", "Roorkee"),
    ("Demo Donor Leela", "leela.demo@example.test", "A-", "Roorkee"),
    ("Demo Donor Isha", "isha.demo@example.test", "AB+", "Roorkee"),
    ("Demo Donor Rohan", "rohan.demo@example.test", "AB-", "Roorkee"),
    ("Demo Donor Amit", "amit.demo@example.test", "B-", "Roorkee"),
)


def seed_demo_donors(db: Session) -> None:
    password_hash = hash_password(DEMO_DONOR_PASSWORD)
    for full_name, email, blood_group, city in DEMO_DONORS:
        existing = db.scalar(select(User).where(User.email == email))
        if existing is not None:
            existing.city = city
            continue
        db.add(
            User(
                full_name=full_name,
                email=email,
                hashed_password=password_hash,
                role="donor",
                blood_group=blood_group,
                date_of_birth=date(1990, 1, 1),
                city=city,
            )
        )
    db.commit()
