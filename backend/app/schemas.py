from datetime import date, datetime
from re import sub
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
UserRole = Literal["donor", "recipient", "both"]
Gender = Literal["male", "female", "other", "prefer_not_to_say"]


def validate_phone_number(value: str) -> str:
    value = value.strip()
    if len(sub(r"\D", "", value)) < 7:
        raise ValueError("Enter a valid phone number")
    return value


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    blood_group: BloodGroup | None = None
    date_of_birth: date
    gender: Gender | None = None
    phone: str = Field(min_length=7, max_length=30)
    city: str | None = Field(default=None, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def coordinates_must_be_paired(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together")
        return self

    @field_validator("full_name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name cannot be blank")
        return value

    @field_validator("phone", "city")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("date_of_birth")
    @classmethod
    def date_of_birth_must_be_in_the_past(cls, value: date) -> date:
        if value >= date.today():
            raise ValueError("Date of birth must be in the past")
        return value

    @field_validator("phone")
    @classmethod
    def phone_must_not_be_blank(cls, value: str) -> str:
        return validate_phone_number(value)


class RecoveryDetailsUpdate(BaseModel):
    date_of_birth: date
    phone: str = Field(min_length=7, max_length=30)

    @field_validator("date_of_birth")
    @classmethod
    def date_of_birth_must_be_in_the_past(cls, value: date) -> date:
        if value >= date.today():
            raise ValueError("Date of birth must be in the past")
        return value

    @field_validator("phone")
    @classmethod
    def phone_must_not_be_blank(cls, value: str) -> str:
        return validate_phone_number(value)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    email: EmailStr
    date_of_birth: date
    phone: str = Field(min_length=7, max_length=30)

    @field_validator("phone")
    @classmethod
    def strip_phone(cls, value: str) -> str:
        return validate_phone_number(value)


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Field(min_length=8, max_length=128)


class UserRead(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    blood_group: BloodGroup | None
    city: str | None
    gender: Gender | None = None
    last_donation_date: date | None = None
    latitude: float | None = None
    longitude: float | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class BloodRequestCreate(BaseModel):
    blood_group: BloodGroup
    city: str = Field(min_length=2, max_length=100)
    hospital: str | None = Field(default=None, max_length=160)
    units: int = Field(default=1, ge=1, le=10)
    message: str | None = Field(default=None, max_length=500)

    @field_validator("city", "hospital", "message")
    @classmethod
    def strip_request_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class BloodDonorRead(BaseModel):
    id: int
    full_name: str
    blood_group: BloodGroup
    city: str | None

    model_config = ConfigDict(from_attributes=True)


class BloodRequestRead(BaseModel):
    id: int
    donor_id: int
    blood_group: BloodGroup
    city: str
    hospital: str | None
    units: int
    message: str | None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BloodRequestInboxRead(BaseModel):
    id: int
    recipient_name: str
    blood_group: BloodGroup
    city: str
    hospital: str | None
    units: int
    message: str | None
    status: str
    created_at: datetime


class DonorProfileUpdate(BaseModel):
    gender: Gender | None = None
    blood_group: BloodGroup | None = None
    city: str | None = Field(default=None, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    last_donation_date: date | None = None

    @model_validator(mode="after")
    def coordinates_must_be_paired(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together")
        return self

    @field_validator("city")
    @classmethod
    def strip_city(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @field_validator("last_donation_date", mode="before")
    @classmethod
    def blank_last_donation_date_is_empty(cls, value):
        # Older clients may submit an empty date input as "" instead of null.
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("last_donation_date")
    @classmethod
    def last_donation_cannot_be_in_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("Last donation date cannot be in the future")
        return value


class LocationUpdate(BaseModel):
    city: str | None = Field(default=None, max_length=100)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)

    @model_validator(mode="after")
    def coordinates_must_be_paired(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together")
        return self

    @field_validator("city")
    @classmethod
    def strip_city(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class BloodNeedCreate(BaseModel):
    blood_group: BloodGroup
    city: str | None = Field(default=None, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    hospital: str | None = Field(default=None, max_length=160)
    units: int = Field(default=1, ge=1, le=10)
    message: str | None = Field(default=None, max_length=500)

    @field_validator("city", "hospital", "message")
    @classmethod
    def strip_need_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class GeocodedPlaceRead(BaseModel):
    label: str
    city: str | None
    latitude: float
    longitude: float


class BloodNeedCreated(BaseModel):
    reference_code: str
    blood_group: BloodGroup
    city: str | None
    status: str
    search_radius_km: int
    donor_name: str | None
    distance_km: float | None
    eligibility_confirmation_required: bool
    universal_option_available: bool = False
    next_city_option_available: bool = False


class BloodNeedFallbackChoice(BaseModel):
    choice: Literal["universal", "next_city"]


class DonorMedicalFeedbackUpdate(BaseModel):
    screening_status: Literal["not_scheduled", "scheduled", "awaiting_results", "cleared_by_blood_bank", "not_cleared"]
    background_concern: bool
    share_with_acceptor: bool


class NeedInvitationRead(BaseModel):
    donor_name: str
    donor_phone: str | None = None
    donor_email: EmailStr | None = None
    status: str
    distance_km: float
    radius_km: int
    matching_mode: str = "compatible"
    medical_screening_status: str | None = None
    medical_background_concern: bool | None = None


class BloodNeedRead(BaseModel):
    reference_code: str
    blood_group: BloodGroup
    city: str | None
    hospital: str | None
    units: int
    message: str | None
    status: str
    created_at: datetime
    invitations: list[NeedInvitationRead]
    universal_option_available: bool = False
    next_city_option_available: bool = False


class DonorInvitationRead(BaseModel):
    id: int
    reference_code: str
    recipient_name: str
    recipient_phone: str | None = None
    blood_group: BloodGroup
    city: str | None
    hospital: str | None
    units: int
    message: str | None
    status: str
    distance_km: float
    radius_km: int
    eligibility_confirmation_required: bool
    created_at: datetime
    matching_mode: str = "compatible"
    medical_screening_status: str | None = None
    medical_background_concern: bool | None = None
    medical_feedback_shared: bool = False


class DonorInvitationResponse(BaseModel):
    response: Literal["available", "not_available", "not_eligible"]
    eligibility_confirmed: bool = False
