import smtplib
import ssl
from email.message import EmailMessage

from app.config import settings


def is_email_delivery_configured() -> bool:
    auth_is_complete = bool(settings.smtp_username) == bool(settings.smtp_password)
    return bool(settings.smtp_host and settings.smtp_from_email and auth_is_complete)


def send_password_reset_email(recipient: str, reset_url: str) -> None:
    if settings.smtp_host is None or settings.smtp_from_email is None:
        raise RuntimeError("Password reset email delivery is not configured")

    message = EmailMessage()
    message["Subject"] = "Reset your OpenVein password"
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(
        "We received a request to reset your OpenVein password.\n\n"
        f"Use this one-time link within {settings.password_reset_expire_minutes} minutes:\n"
        f"{reset_url}\n\n"
        "If you did not request this, you can ignore this email."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.ehlo()
        if settings.smtp_use_tls:
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


def send_blood_request_email(
    recipient: str,
    *,
    reference_code: str,
    blood_group: str,
    city: str | None,
    hospital: str | None,
    distance_km: float,
    frontend_url: str,
) -> None:
    if settings.smtp_host is None or settings.smtp_from_email is None:
        raise RuntimeError("Blood request email delivery is not configured")

    location = city or "near your saved location"
    if hospital:
        location = f"{hospital}, {location}"
    message = EmailMessage()
    message["Subject"] = f"Nearby blood request {reference_code}"
    message["From"] = settings.smtp_from_email
    message["To"] = recipient
    message.set_content(
        "A nearby person has requested a blood donation that may match your profile.\n\n"
        f"Request reference: {reference_code}\n"
        f"Blood group needed: {blood_group}\n"
        f"Location: {location}\n"
        f"Approximate distance: {distance_km:.1f} km\n\n"
        "Sign in to OpenVein to confirm whether you are available and eligible. "
        "A blood bank must make the final medical eligibility decision.\n\n"
        f"{frontend_url.rstrip('/')}"
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.ehlo()
        if settings.smtp_use_tls:
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
