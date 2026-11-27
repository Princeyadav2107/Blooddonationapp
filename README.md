# Blood365

Blood365 connects people requesting blood with nearby compatible volunteer donors. It is a hackathon prototype, not a blood bank or medical service.

## What it does

- Email and password sign-up/sign-in, hashed passwords, bearer-token sessions, and email-based password reset.
- A post-login choice to request blood or volunteer to donate.
- Blood-group compatibility filtering and distance ranking using donor and request coordinates.
- Search expansion from 5 km to 10 km and then 15 km. The closest candidate is contacted first; the next candidate is notified after a decline or a five-minute timeout.
- Donor responses for available, not available, or not eligible. When a donor has no recorded last donation date, the app asks them to confirm the applicable interval before accepting.
- A unique reference code and request status tracking. Donor inboxes refresh every 15 seconds; email notifications are sent when SMTP is configured.
- Requesters can share device location or search for an address/locality. Donors can set their location the same way.

For whole-blood matching, the app uses a preliminary interval of 90 days for male donors and 120 days for female donors, as stated in India's [2025 Guidelines for Blood Donor Selection and Blood Donor Deferral](https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/about.cnt?hmode=DOWNLOADDOCUMENTNHRM&type=20). This is only an initial filter. A licensed blood bank must confirm donor eligibility and cross-match blood before transfusion.

## Run with Docker Compose

1. Copy `.env.example` to `.env`.
2. Set a strong `SECRET_KEY`. Add SMTP settings if you want password-reset and donor-request emails.
3. Start the services:

   ```sh
   docker compose up --build
   ```

4. Open `http://localhost:5173`.

Compose starts PostgreSQL, the FastAPI backend, and the React frontend. Donors appear in matching after they register and save a location; the app does not create demo donor accounts.

## Local development without Docker

The backend expects PostgreSQL by default. Start a PostgreSQL database, install backend requirements, set `DATABASE_URL`, then run:

```sh
cd backend
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. The app asks donors and requesters to share browser location or enter coordinates manually. Donors need a saved location to appear in proximity matching.

## Configuration

See `.env.example` for the available settings. Password-reset and email notifications require a working SMTP host, sender address, and, where needed, credentials. Without SMTP, requests still appear in the in-app donor inbox. Address search uses the OpenStreetMap Nominatim service and displays OpenStreetMap attribution; the entered address is sent to that service to look up coordinates. Device geolocation and manual coordinates remain available if address lookup cannot be reached.
