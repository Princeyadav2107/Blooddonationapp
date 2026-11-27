from datetime import date, datetime
from re import sub
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
UserRole = Literal["donor", "recipient", "both"]


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
    phone: str = Field(min_length=7, max_length=30)
    city: str | None = Field(default=None, max_length=100)

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
