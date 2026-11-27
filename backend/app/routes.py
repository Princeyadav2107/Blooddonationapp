import logging
import json
import math
import secrets
import smtplib
from threading import Lock
from datetime import date, datetime, timedelta, timezone
from re import sub
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest, urlopen

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.email import (
    is_email_delivery_configured,
    send_blood_request_email,
    send_password_reset_email,
)
from app.models import BloodNeed, BloodRequest, DonationInvitation, PasswordResetToken, User
from app.schemas import (
    PasswordResetConfirm,
    PasswordResetRequest,
    BloodDonorRead,
    BloodNeedCreate,
    BloodNeedCreated,
    BloodNeedRead,
    BloodNeedFallbackChoice,
    BloodRequestCreate,
    BloodRequestInboxRead,
    BloodRequestRead,
    DonorInvitationRead,
    DonorInvitationResponse,
    DonationCompletionConfirm,
    DonorMedicalFeedbackUpdate,
    DonorProfileUpdate,
    GeocodedPlaceRead,
    LocationUpdate,
    NeedInvitationRead,
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
_geocode_lock = Lock()
_geocode_cache: dict[str, list[dict[str, str | float | None]]] = {}
_last_geocode_request_at = 0.0

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
        gender=payload.gender,
        phone=payload.phone,
        city=payload.city,
        latitude=payload.latitude,
        longitude=payload.longitude,
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


@router.get("/location/geocode", response_model=list[GeocodedPlaceRead])
def geocode_location(
    query: str = Query(..., min_length=3, max_length=150),
    user: User = Depends(get_current_user),
) -> list[GeocodedPlaceRead]:
    del user  # Authentication is required because the address is personal location data.
    global _last_geocode_request_at
    normalized_query = query.strip()
    if len(normalized_query) < 3:
        raise HTTPException(status_code=422, detail="Enter at least three characters for a location.")
    cache_key = normalized_query.casefold()
    with _geocode_lock:
        if cache_key in _geocode_cache:
            return [GeocodedPlaceRead(**place) for place in _geocode_cache[cache_key]]
        now = monotonic()
        if now - _last_geocode_request_at < 1:
            raise HTTPException(status_code=429, detail="Please wait a moment before searching for another location.")
        _last_geocode_request_at = now

    params = urlencode({"q": normalized_query, "format": "jsonv2", "addressdetails": 1, "limit": 5})
    external_request = UrlRequest(
        f"https://nominatim.openstreetmap.org/search?{params}",
        headers={
            "User-Agent": "Blood365/1.0 (https://github.com/Princeyadav2107/Blooddonationapp)",
            "Accept": "application/json",
            "Accept-Language": "en",
        },
    )
    try:
        with urlopen(external_request, timeout=8) as response:
            raw_results = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError):
        logger.exception("Location lookup failed")
        raise HTTPException(status_code=502, detail="Location lookup is temporarily unavailable. Try device location, a PIN code, or an address.") from None

    results: list[dict[str, str | float | None]] = []
    for result in raw_results:
        address = result.get("address") or {}
        city = next(
            (address[key] for key in ("city", "town", "village", "municipality", "suburb", "county", "state_district") if address.get(key)),
            None,
        )
        try:
            latitude = float(result["lat"])
            longitude = float(result["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        results.append({
            "label": str(result.get("display_name", normalized_query)),
            "city": str(city) if city else None,
            "latitude": latitude,
            "longitude": longitude,
        })

    if results:
        with _geocode_lock:
            if len(_geocode_cache) >= 256:
                _geocode_cache.pop(next(iter(_geocode_cache)))
            _geocode_cache[cache_key] = results
    return [GeocodedPlaceRead(**place) for place in results]


@router.get("/location/pincode", response_model=list[GeocodedPlaceRead])
def geocode_indian_pincode(
    code: str = Query(..., min_length=6, max_length=6, pattern=r"^[1-9]\d{5}$"),
    user: User = Depends(get_current_user),
) -> list[GeocodedPlaceRead]:
    del user
    global _last_geocode_request_at
    cache_key = f"india-pincode:{code}"
    with _geocode_lock:
        if cache_key in _geocode_cache:
            return [GeocodedPlaceRead(**place) for place in _geocode_cache[cache_key]]
        now = monotonic()
        if now - _last_geocode_request_at < 1:
            raise HTTPException(status_code=429, detail="Please wait a moment before searching again.")
        _last_geocode_request_at = now

    results: list[dict[str, str | float | None]] = []
    postal_request = UrlRequest(
        f"https://api.pincodeapi.in/api/v1/pincode/{code}",
        headers={"User-Agent": "Blood365/1.0", "Accept": "application/json"},
    )
    try:
        with urlopen(postal_request, timeout=8) as response:
            postal_data = json.loads(response.read().decode("utf-8"))
        if postal_data.get("success"):
            for office in (postal_data.get("data") or {}).get("post_offices", []):
                try:
                    latitude = float(office["latitude"])
                    longitude = float(office["longitude"])
                except (KeyError, TypeError, ValueError):
                    continue
                if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                    continue
                office_name = str(office.get("office_name") or "Post office")
                district = str(office.get("district") or "")
                state = str(office.get("state") or "")
                label = ", ".join(part for part in (office_name, district, state) if part)
                place = {
                    "label": f"{label} · PIN {code}",
                    "city": district or state or None,
                    "latitude": latitude,
                    "longitude": longitude,
                }
                if not any(
                    abs(float(existing["latitude"]) - latitude) < 0.00001
                    and abs(float(existing["longitude"]) - longitude) < 0.00001
                    for existing in results
                ):
                    results.append(place)
    except HTTPError as exc:
        if exc.code != 404:
            logger.warning("PIN directory lookup failed with HTTP %s", exc.code)
    except (URLError, TimeoutError, json.JSONDecodeError, OSError):
        logger.exception("PIN directory lookup failed; trying map search")

    # Some postal records have no coordinates. Fall back to a structured map
    # search so the user can still select a mapped result for the PIN code.
    if not results:
        params = urlencode({
            "postalcode": code,
            "country": "India",
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 10,
        })
        map_request = UrlRequest(
            f"https://nominatim.openstreetmap.org/search?{params}",
            headers={
                "User-Agent": "Blood365/1.0 (https://github.com/Princeyadav2107/Blooddonationapp)",
                "Accept": "application/json",
                "Accept-Language": "en",
            },
        )
        try:
            with urlopen(map_request, timeout=8) as response:
                raw_results = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, OSError):
            logger.exception("PIN code map fallback failed")
            raise HTTPException(status_code=502, detail="PIN code lookup is temporarily unavailable. Try again or search by address.") from None

        for result in raw_results:
            address = result.get("address") or {}
            if address.get("country_code") not in (None, "in"):
                continue
            result_postcode = sub(r"\D", "", str(address.get("postcode", "")))
            if result_postcode and result_postcode != code:
                continue
            city = next(
                (address[key] for key in ("city", "town", "village", "municipality", "suburb", "county", "state_district") if address.get(key)),
                None,
            )
            try:
                latitude = float(result["lat"])
                longitude = float(result["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            label = str(result.get("display_name", f"PIN {code}"))
            results.append({
                "label": f"{label} · PIN {code}",
                "city": str(city) if city else None,
                "latitude": latitude,
                "longitude": longitude,
            })

    if results:
        with _geocode_lock:
            if len(_geocode_cache) >= 256:
                _geocode_cache.pop(next(iter(_geocode_cache)))
            _geocode_cache[cache_key] = results
    return [GeocodedPlaceRead(**place) for place in results]


def haversine_km(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    earth_radius_km = 6371.0088
    lat_a, lat_b = math.radians(latitude_a), math.radians(latitude_b)
    delta_lat = math.radians(latitude_b - latitude_a)
    delta_lon = math.radians(longitude_b - longitude_a)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    )
    return 2 * earth_radius_km * math.asin(math.sqrt(haversine))


def donor_gap_eligibility(user: User) -> bool | None:
    """Return None when a donor must self-confirm because their record is incomplete."""
    if user.last_donation_date is None or user.gender not in {"male", "female"}:
        return None
    required_days = 90 if user.gender == "male" else 120
    return (date.today() - user.last_donation_date).days >= required_days


def radius_for_distance(distance_km: float) -> int:
    if distance_km <= 5:
        return 5
    if distance_km <= 10:
        return 10
    return 15


def generate_confirmation_pin(db: Session, blood_need_id: int) -> str:
    """Create a four-digit code unique to this request and all current assignments."""
    used_pins = set(db.scalars(
        select(DonationInvitation.confirmation_pin).where(
            DonationInvitation.confirmation_pin.is_not(None),
            or_(
                DonationInvitation.blood_need_id == blood_need_id,
                DonationInvitation.status.in_(("pending", "available", "accepted")),
            ),
        )
    ).all())
    for _ in range(9000):
        pin = f"{secrets.randbelow(9000) + 1000:04d}"
        if pin not in used_pins:
            return pin
    raise HTTPException(status_code=503, detail="Could not generate a unique donation confirmation code. Try again.")


def fallback_candidates(db: Session, need: BloodNeed, mode: str) -> list[tuple[User, float, int, bool]]:
    """Search a wider radius for an explicitly chosen compatible or O-negative fallback."""
    group_set = {"O-"} if mode == "universal" else DONOR_COMPATIBILITY[need.blood_group]
    query = select(User).where(
        User.id != need.recipient_id,
        User.role.in_(("donor", "both")),
        User.blood_group.in_(group_set),
        User.latitude.is_not(None),
        User.longitude.is_not(None),
    )
    invitations = db.scalars(select(DonationInvitation).where(DonationInvitation.blood_need_id == need.id)).all()
    excluded = {item.donor_id for item in invitations}
    if excluded:
        query = query.where(User.id.not_in(excluded))
    candidates = []
    for donor in db.scalars(query).all():
        distance = haversine_km(need.latitude, need.longitude, donor.latitude, donor.longitude)
        if distance <= 50 and (mode != "next_city" or (donor.city or "").casefold() != (need.city or "").casefold()):
            eligible = donor_gap_eligibility(donor)
            if eligible is not False:
                candidates.append((donor, distance, 50 if distance > 25 else 25, eligible is None))
    candidates.sort(key=lambda item: (item[1], item[3]))
    return candidates


def fallback_options(db: Session, need: BloodNeed) -> tuple[bool, bool]:
    if need.status != "unmatched":
        return False, False
    return bool(fallback_candidates(db, need, "universal")), bool(fallback_candidates(db, need, "next_city"))


def find_eligible_candidates(
    db: Session,
    *,
    recipient_id: int,
    blood_group: str,
    latitude: float,
    longitude: float,
    excluded_donor_ids: set[int] | None = None,
) -> list[tuple[User, float, int, bool]]:
    query = select(User).where(
        User.id != recipient_id,
        User.role.in_(("donor", "both")),
        User.blood_group.in_(DONOR_COMPATIBILITY[blood_group]),
        User.latitude.is_not(None),
        User.longitude.is_not(None),
    )
    if excluded_donor_ids:
        query = query.where(User.id.not_in(excluded_donor_ids))
    candidates = []
    for donor in db.scalars(query).all():
        distance = haversine_km(latitude, longitude, donor.latitude, donor.longitude)
        if distance > 15:
            continue
        eligibility = donor_gap_eligibility(donor)
        if eligibility is False:
            continue
        candidates.append((donor, distance, radius_for_distance(distance), eligibility is None))
    candidates.sort(key=lambda item: (item[2], item[1], item[3]))
    return candidates


def resume_unmatched_needs(db: Session) -> None:
    """Retry saved unmatched requests when a new eligible donor/location appears."""
    needs = db.scalars(select(BloodNeed).where(BloodNeed.status == "unmatched")).all()
    for need in needs:
        existing_invitations = db.scalars(
            select(DonationInvitation).where(DonationInvitation.blood_need_id == need.id)
        ).all()
        excluded_donor_ids = {invitation.donor_id for invitation in existing_invitations}
        candidates = find_eligible_candidates(
            db,
            recipient_id=need.recipient_id,
            blood_group=need.blood_group,
            latitude=need.latitude,
            longitude=need.longitude,
            excluded_donor_ids=excluded_donor_ids,
        )
        if not candidates:
            continue
        priority_start = max((invitation.priority for invitation in existing_invitations), default=-1) + 1
        first_donor, first_distance, _, first_needs_confirmation = candidates[0]
        for offset, (donor, distance, radius, needs_confirmation) in enumerate(candidates):
            db.add(
                DonationInvitation(
                    blood_need_id=need.id,
                    donor_id=donor.id,
                    status="pending" if offset == 0 else "queued",
                    distance_km=distance,
                    radius_km=radius,
                    eligibility_confirmation_required=needs_confirmation,
                    priority=priority_start + offset,
                    confirmation_pin=generate_confirmation_pin(db, need.id) if offset == 0 else None,
                )
            )
        need.status = "open"
        db.commit()
        notify_donor_of_need(first_donor, need, first_distance)


def notify_donor_of_need(donor: User, need: BloodNeed, distance_km: float) -> None:
    if not is_email_delivery_configured():
        return
    try:
        send_blood_request_email(
            donor.email,
            reference_code=need.reference_code,
            blood_group=need.blood_group,
            city=need.city,
            hospital=need.hospital,
            distance_km=distance_km,
            frontend_url=settings.frontend_url,
        )
    except (OSError, RuntimeError, smtplib.SMTPException):
        logger.exception("Could not deliver a blood request notification")


def advance_expired_invitations(db: Session) -> None:
    now = datetime.now(timezone.utc)
    response_deadline = now - timedelta(minutes=5)
    expired = db.scalars(
        select(DonationInvitation).where(
            DonationInvitation.status == "pending",
            DonationInvitation.created_at < response_deadline,
        )
    ).all()
    notifications: list[tuple[User, BloodNeed, float]] = []
    changed = False
    for invitation in expired:
        need = db.get(BloodNeed, invitation.blood_need_id)
        if need is None or need.status != "open":
            continue
        invitation.status = "not_available"
        invitation.responded_at = now
        next_invitation = db.scalar(
            select(DonationInvitation)
            .where(
                DonationInvitation.blood_need_id == need.id,
                DonationInvitation.status == "queued",
            )
            .order_by(DonationInvitation.priority)
            .limit(1)
        )
        if next_invitation is None:
            need.status = "unmatched"
        else:
            next_invitation.status = "pending"
            next_invitation.confirmation_pin = generate_confirmation_pin(db, need.id)
            next_invitation.confirmation_pin_attempts = 0
            next_invitation.created_at = now
            donor = db.get(User, next_invitation.donor_id)
            if donor is not None:
                notifications.append((donor, need, next_invitation.distance_km))
        changed = True
    if changed:
        db.commit()
        for donor, need, distance_km in notifications:
            notify_donor_of_need(donor, need, distance_km)


@router.put("/donor-profile", response_model=UserRead)
def update_donor_profile(
    payload: DonorProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if payload.blood_group is not None:
        user.blood_group = payload.blood_group
        if user.role == "recipient":
            user.role = "both"
    if payload.gender is not None:
        user.gender = payload.gender
    if "city" in payload.model_fields_set:
        user.city = payload.city
    if "latitude" in payload.model_fields_set or "longitude" in payload.model_fields_set:
        user.latitude = payload.latitude
        user.longitude = payload.longitude
    if "last_donation_date" in payload.model_fields_set:
        user.last_donation_date = payload.last_donation_date
    db.commit()
    resume_unmatched_needs(db)
    db.refresh(user)
    return user


@router.put("/shared-location", response_model=UserRead)
def update_shared_location(
    payload: LocationUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    user.city = payload.city
    user.latitude = payload.latitude
    user.longitude = payload.longitude
    db.commit()
    resume_unmatched_needs(db)
    db.refresh(user)
    return user


@router.post("/blood-needs", response_model=BloodNeedCreated, status_code=201)
def create_blood_need(
    payload: BloodNeedCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BloodNeedCreated:
    db.scalar(select(User.id).where(User.id == user.id).with_for_update())
    active_need = db.scalar(
        select(BloodNeed.id).where(
            BloodNeed.recipient_id == user.id,
            BloodNeed.status.in_(("open", "unmatched", "matched")),
        ).limit(1)
    )
    if active_need is not None:
        raise HTTPException(status_code=409, detail="You already have an active blood request. Track it below or wait for it to finish before creating another.")

    donors = db.scalars(
        select(User).where(
            User.id != user.id,
            User.role.in_(("donor", "both")),
            User.blood_group.in_(DONOR_COMPATIBILITY[payload.blood_group]),
            User.latitude.is_not(None),
            User.longitude.is_not(None),
        )
    ).all()

    candidates: list[tuple[User, float, int, bool]] = []
    for donor in donors:
        distance = haversine_km(
            payload.latitude,
            payload.longitude,
            donor.latitude,
            donor.longitude,
        )
        if distance > 15:
            continue
        eligibility = donor_gap_eligibility(donor)
        if eligibility is False:
            continue
        candidates.append((donor, distance, radius_for_distance(distance), eligibility is None))

    candidates.sort(key=lambda item: (item[2], item[1], item[3]))
    reference_code = f"OV-{date.today():%y%m%d}-{secrets.token_hex(3).upper()}"
    need = BloodNeed(
        reference_code=reference_code,
        recipient_id=user.id,
        blood_group=payload.blood_group,
        city=payload.city,
        latitude=payload.latitude,
        longitude=payload.longitude,
        hospital=payload.hospital,
        units=payload.units,
        message=payload.message,
        status="open" if candidates else "unmatched",
    )
    db.add(need)
    db.flush()

    first_donor = None
    first_distance = None
    first_radius = 15
    first_needs_confirmation = False
    if candidates:
        first_donor, first_distance, first_radius, first_needs_confirmation = candidates[0]
        for priority, (donor, distance, radius, needs_confirmation) in enumerate(candidates):
            db.add(
                DonationInvitation(
                    blood_need_id=need.id,
                    donor_id=donor.id,
                    status="pending" if priority == 0 else "queued",
                    distance_km=distance,
                    radius_km=radius,
                    eligibility_confirmation_required=needs_confirmation,
                    priority=priority,
                    confirmation_pin=generate_confirmation_pin(db, need.id) if priority == 0 else None,
                )
            )
    db.commit()
    if first_donor is not None and first_distance is not None:
        notify_donor_of_need(first_donor, need, first_distance)
    universal_available, next_city_available = fallback_options(db, need)
    return BloodNeedCreated(
        reference_code=reference_code,
        blood_group=need.blood_group,
        city=need.city,
        status=need.status,
        search_radius_km=first_radius,
        donor_name=first_donor.full_name if first_donor is not None else None,
        distance_km=round(first_distance, 2) if first_distance is not None else None,
        eligibility_confirmation_required=first_needs_confirmation,
        universal_option_available=universal_available,
        next_city_option_available=next_city_available,
    )


@router.post("/blood-needs/{reference_code}/fallback", response_model=BloodNeedCreated)
def choose_blood_need_fallback(
    reference_code: str,
    payload: BloodNeedFallbackChoice,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BloodNeedCreated:
    need = db.scalar(select(BloodNeed).where(BloodNeed.reference_code == reference_code, BloodNeed.recipient_id == user.id))
    if need is None:
        raise HTTPException(status_code=404, detail="Blood request not found.")
    if need.status != "unmatched":
        raise HTTPException(status_code=409, detail="Fallback search is available only while no donor is matched.")
    candidates = fallback_candidates(db, need, payload.choice)
    if not candidates:
        raise HTTPException(status_code=404, detail="No eligible donors were found for that search option within 50 km.")
    first_donor, first_distance, first_radius, first_needs_confirmation = candidates[0]
    for priority, (donor, distance, radius, needs_confirmation) in enumerate(candidates):
        db.add(DonationInvitation(
            blood_need_id=need.id, donor_id=donor.id,
            status="pending" if priority == 0 else "queued",
            distance_km=distance, radius_km=radius,
            eligibility_confirmation_required=needs_confirmation, priority=priority,
            matching_mode=payload.choice,
            confirmation_pin=generate_confirmation_pin(db, need.id) if priority == 0 else None,
        ))
    need.status = "open"
    db.commit()
    notify_donor_of_need(first_donor, need, first_distance)
    universal_available, next_city_available = fallback_options(db, need)
    return BloodNeedCreated(
        reference_code=need.reference_code, blood_group=need.blood_group, city=need.city,
        status=need.status, search_radius_km=first_radius, donor_name=first_donor.full_name,
        distance_km=round(first_distance, 2), eligibility_confirmation_required=first_needs_confirmation,
        universal_option_available=universal_available, next_city_option_available=next_city_available,
    )


@router.post("/blood-needs/{reference_code}/close", response_model=BloodNeedRead)
def close_blood_need(
    reference_code: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BloodNeedRead:
    need = db.scalar(select(BloodNeed).where(BloodNeed.reference_code == reference_code, BloodNeed.recipient_id == user.id))
    if need is None:
        raise HTTPException(status_code=404, detail="Blood request not found.")
    if need.status in {"completed", "cancelled"}:
        raise HTTPException(status_code=409, detail="This request is already closed.")
    need.status = "cancelled"
    db.query(DonationInvitation).filter(
        DonationInvitation.blood_need_id == need.id,
        DonationInvitation.status.in_(("pending", "queued", "available", "accepted")),
    ).update(
        {
            DonationInvitation.status: "closed",
            DonationInvitation.responded_at: datetime.now(timezone.utc),
        },
        synchronize_session=False,
    )
    db.commit()
    return BloodNeedRead(
        reference_code=need.reference_code, blood_group=need.blood_group, city=need.city,
        hospital=need.hospital, units=need.units, message=need.message, status=need.status,
        created_at=need.created_at, invitations=[],
    )


@router.put("/donor-invitations/{invitation_id}/medical-feedback")
def update_donor_medical_feedback(
    invitation_id: int,
    payload: DonorMedicalFeedbackUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str | bool | None]:
    invitation = db.get(DonationInvitation, invitation_id)
    if invitation is None or invitation.donor_id != user.id:
        raise HTTPException(status_code=404, detail="Donation request not found.")
    if invitation.status not in {"available", "completed"}:
        raise HTTPException(status_code=409, detail="Medical feedback can be shared after you accept the request.")
    invitation.medical_screening_status = payload.screening_status
    invitation.medical_background_concern = payload.background_concern
    invitation.medical_feedback_shared = payload.share_with_acceptor
    db.commit()
    return {"message": "Your self-reported medical feedback was saved.", "shared": invitation.medical_feedback_shared}


@router.get("/blood-needs", response_model=list[BloodNeedRead])
def list_my_blood_needs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[BloodNeedRead]:
    advance_expired_invitations(db)
    resume_unmatched_needs(db)
    needs = db.scalars(
        select(BloodNeed)
        .where(BloodNeed.recipient_id == user.id)
        .order_by(BloodNeed.created_at.desc())
    ).all()
    results = []
    for need in needs:
        rows = db.execute(
            select(DonationInvitation, User)
            .join(User, DonationInvitation.donor_id == User.id)
            .where(DonationInvitation.blood_need_id == need.id)
            .order_by(DonationInvitation.priority)
        ).all()
        results.append(
            BloodNeedRead(
                reference_code=need.reference_code,
                blood_group=need.blood_group,
                city=need.city,
                hospital=need.hospital,
                units=need.units,
                message=need.message,
                status=need.status,
                created_at=need.created_at,
                invitations=[
                    NeedInvitationRead(
                        donor_name=donor.full_name,
                        donor_phone=donor.phone if invitation.status == "available" else None,
                        donor_email=donor.email if invitation.status == "available" else None,
                        status=invitation.status,
                        distance_km=round(invitation.distance_km, 2),
                        radius_km=invitation.radius_km,
                        matching_mode=invitation.matching_mode,
                        medical_screening_status=invitation.medical_screening_status if invitation.medical_feedback_shared else None,
                        medical_background_concern=invitation.medical_background_concern if invitation.medical_feedback_shared else None,
                        confirmation_pin=invitation.confirmation_pin if invitation.status in {"pending", "available"} else None,
                        confirmation_pin_attempts=invitation.confirmation_pin_attempts,
                    )
                    for invitation, donor in rows
                ],
                universal_option_available=fallback_options(db, need)[0],
                next_city_option_available=fallback_options(db, need)[1],
            )
        )
    return results


@router.get("/donor-invitations", response_model=list[DonorInvitationRead])
def list_donor_invitations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DonorInvitationRead]:
    advance_expired_invitations(db)
    resume_unmatched_needs(db)
    rows = db.execute(
        select(DonationInvitation, BloodNeed, User)
        .join(BloodNeed, DonationInvitation.blood_need_id == BloodNeed.id)
        .join(User, BloodNeed.recipient_id == User.id)
        .where(
            DonationInvitation.donor_id == user.id,
        )
        .order_by(DonationInvitation.created_at.desc())
    ).all()
    return [
        DonorInvitationRead(
            id=invitation.id,
            reference_code=need.reference_code,
            recipient_name=recipient.full_name,
            recipient_phone=recipient.phone if invitation.status in {"available", "accepted", "completed"} else None,
            blood_group=need.blood_group,
            city=need.city,
            hospital=need.hospital,
            units=need.units,
            message=need.message,
            status=invitation.status,
            distance_km=round(invitation.distance_km, 2),
            radius_km=invitation.radius_km,
            eligibility_confirmation_required=invitation.eligibility_confirmation_required,
            created_at=invitation.created_at,
            matching_mode=invitation.matching_mode,
            medical_screening_status=invitation.medical_screening_status,
            medical_background_concern=invitation.medical_background_concern,
            medical_feedback_shared=invitation.medical_feedback_shared,
        )
        for invitation, need, recipient in rows
    ]


@router.post("/donor-invitations/{invitation_id}/respond")
def respond_to_donor_invitation(
    invitation_id: int,
    payload: DonorInvitationResponse,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str | None]:
    invitation = db.get(DonationInvitation, invitation_id)
    if invitation is None or invitation.donor_id != user.id:
        raise HTTPException(status_code=404, detail="Donation request not found.")
    if invitation.status != "pending":
        raise HTTPException(status_code=409, detail="This donation request is no longer active.")
    need = db.get(BloodNeed, invitation.blood_need_id)
    if need is None or need.status != "open":
        raise HTTPException(status_code=409, detail="This blood request is no longer open.")

    if payload.response == "available":
        db.scalar(select(User.id).where(User.id == user.id).with_for_update())
        active_acceptance = db.scalar(
            select(DonationInvitation.id)
            .where(
                DonationInvitation.donor_id == user.id,
                DonationInvitation.status == "available",
                DonationInvitation.id != invitation.id,
            )
            .limit(1)
        )
        if active_acceptance is not None:
            raise HTTPException(
                status_code=409,
                detail="You already accepted a donation request. Complete it before accepting another.",
            )
        known_eligibility = donor_gap_eligibility(user)
        if known_eligibility is False:
            raise HTTPException(
                status_code=409,
                detail="Your recorded last donation date does not meet the required interval. Update your record if it is incorrect.",
            )
        if known_eligibility is None and not payload.eligibility_confirmed:
            raise HTTPException(
                status_code=422,
                detail="No complete donation record is available. Confirm that you meet the donation interval before responding available.",
            )
        invitation.status = "available"
        invitation.responded_at = datetime.now(timezone.utc)
        need.status = "matched"
        db.query(DonationInvitation).filter(
            DonationInvitation.blood_need_id == need.id,
            DonationInvitation.id != invitation.id,
            DonationInvitation.status.in_(("pending", "queued")),
        ).update({DonationInvitation.status: "closed"}, synchronize_session=False)
        db.commit()
        recipient = db.get(User, need.recipient_id)
        return {
            "message": "Thank you. You are marked available; the recipient can now contact you.",
            "recipient_name": recipient.full_name if recipient else None,
            "recipient_phone": recipient.phone if recipient else None,
            "recipient_email": recipient.email if recipient else None,
        }

    invitation.status = payload.response
    invitation.responded_at = datetime.now(timezone.utc)
    next_invitation = db.scalar(
        select(DonationInvitation)
        .where(
            DonationInvitation.blood_need_id == need.id,
            DonationInvitation.status == "queued",
        )
        .order_by(DonationInvitation.priority)
        .limit(1)
    )
    next_donor = None
    if next_invitation is not None:
        next_invitation.status = "pending"
        next_invitation.confirmation_pin = generate_confirmation_pin(db, need.id)
        next_invitation.confirmation_pin_attempts = 0
        next_invitation.created_at = datetime.now(timezone.utc)
        next_donor = db.get(User, next_invitation.donor_id)
    else:
        remaining = db.scalar(
            select(DonationInvitation.id).where(
                DonationInvitation.blood_need_id == need.id,
                DonationInvitation.status == "pending",
            )
        )
        if remaining is None:
            need.status = "unmatched"
    db.commit()
    if next_invitation is not None and next_donor is not None:
        notify_donor_of_need(next_donor, need, next_invitation.distance_km)
        message = f"Response recorded. The next nearby donor has been notified at the {next_invitation.radius_km} km search radius."
    else:
        message = "Response recorded. No other matched donors are waiting."
    return {
        "message": message,
        "recipient_name": None,
        "recipient_phone": None,
        "recipient_email": None,
    }


@router.post("/donor-invitations/{invitation_id}/complete", response_model=UserRead)
def complete_donation_invitation(
    invitation_id: int,
    payload: DonationCompletionConfirm,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    invitation = db.get(DonationInvitation, invitation_id)
    if invitation is None or invitation.donor_id != user.id:
        raise HTTPException(status_code=404, detail="Donation request not found.")
    if invitation.status != "available":
        raise HTTPException(status_code=409, detail="Only an accepted donation request can be marked complete.")
    pin_is_correct = invitation.confirmation_pin is not None and secrets.compare_digest(
        payload.confirmation_pin, invitation.confirmation_pin
    )
    if not pin_is_correct:
        if invitation.confirmation_pin_attempts >= 10:
            raise HTTPException(status_code=429, detail="Too many incorrect codes. Ask the acceptor to generate a new donation confirmation code.")
        invitation.confirmation_pin_attempts += 1
        db.commit()
        raise HTTPException(status_code=422, detail="That donation confirmation code is incorrect. Check with the acceptor and try again.")

    invitation.status = "completed"
    completed_at = datetime.now(timezone.utc)
    user.last_donation_date = completed_at.date()
    user.last_verified_donation_date = completed_at.date()
    user.last_verified_donation_at = completed_at.isoformat()
    need = db.get(BloodNeed, invitation.blood_need_id)
    if need is not None:
        need.status = "completed"
    db.commit()
    db.refresh(user)
    return user


@router.post("/blood-needs/{reference_code}/invitations/{invitation_id}/confirmation-pin")
def regenerate_donation_confirmation_pin(
    reference_code: str,
    invitation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    need = db.scalar(select(BloodNeed).where(BloodNeed.reference_code == reference_code, BloodNeed.recipient_id == user.id))
    invitation = db.get(DonationInvitation, invitation_id)
    if need is None or invitation is None or invitation.blood_need_id != need.id:
        raise HTTPException(status_code=404, detail="Donation request not found.")
    if invitation.status not in {"pending", "available"}:
        raise HTTPException(status_code=409, detail="A code can only be generated for the currently assigned donor.")
    invitation.confirmation_pin = generate_confirmation_pin(db, need.id)
    invitation.confirmation_pin_attempts = 0
    db.commit()
    return {"message": "A new donation confirmation code was generated.", "confirmation_pin": invitation.confirmation_pin}


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
