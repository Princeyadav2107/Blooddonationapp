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
