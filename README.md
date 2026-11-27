# OpenVein

A blood donor and recipient community starter app built with React, Tailwind CSS, FastAPI, and PostgreSQL.

## Features

- Self-service account registration for multiple users
- Donor, recipient, or both account types
- Optional blood group, city, and phone number
- Email/password sign-in with hashed passwords and expiring JWT access tokens
- PostgreSQL persistence, responsive registration UI, and a signed-in welcome screen
- Contact details are not exposed through public API endpoints

## Run with Docker Compose

1. Install Docker Desktop.
2. From the project root, run:

   ```sh
   docker compose up --build
   ```

3. Visit [http://localhost:5173](http://localhost:5173). The API documentation is at [http://localhost:8000/docs](http://localhost:8000/docs).

For any deployment beyond local development, set a strong `SECRET_KEY` in the environment. The Compose credentials and fallback signing key are development-only.

## Run locally without Docker

You need Python 3.11+, Node.js, and a running PostgreSQL server. Create a database/user matching the URL below, or set `DATABASE_URL` to your own connection string.

Backend, from the project root:

```sh
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL='postgresql+psycopg://bloodapp:bloodapp@localhost:5432/bloodapp'
export SECRET_KEY='replace-with-a-long-random-secret'
uvicorn app.main:app --reload
```

Frontend, in a second terminal:

```sh
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Set `VITE_API_URL` if the API is not at `http://localhost:8000`.

## API

- `POST /api/auth/register` — create an account; duplicate emails return `409`
- `POST /api/auth/login` — verify credentials and return an access token
- `GET /api/auth/me` — return the current user's profile (requires `Authorization: Bearer <token>`)
- `GET /health` — basic API health check

The initial version creates database tables on startup. For production, add schema migrations, configure HTTPS and secret management, and review privacy, consent, and local healthcare requirements before onboarding real users. The app is for community connection and does not provide medical advice or determine donor eligibility.
