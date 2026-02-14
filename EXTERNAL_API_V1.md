# Prolean External API v1

Base URL:
- `https://sitemanagement-production.up.railway.app/api/public/v1`
- Backward compatible alias: `/api/public`

## Public Endpoints (No Token)

1. `GET /formations`
- Returns public formations list.

2. `GET /formations/:slug`
- Returns one formation.

3. `GET /cities`
- Returns public cities list.

4. `POST /contact-requests`
- Body:
```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "0612345678",
  "city_id": "city-id",
  "message": "I need information"
}
```

5. `POST /pre-inscriptions`
- Body:
```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "0612345678",
  "city_id": "city-id",
  "formation_id": "formation-id",
  "message": "Interested in this formation"
}
```

6. `POST /student-register`
- Creates profile in pending state when profile schema has state columns.
- Body:
```json
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "password": "StrongPassword",
  "cin_or_passport": "AB123456",
  "phone_number": "0612345678",
  "city_id": "city-id"
}
```

7. `POST /student-login`
- Body:
```json
{
  "email": "john@example.com",
  "password": "StrongPassword"
}
```
- Returns external student token.

## Student Token Endpoints

Headers:
- `Authorization: Bearer <token>`

1. `GET /student/profile`
- Returns current student profile.

2. `GET /student/dashboard`
- Returns profile, status, basic stats, sessions, formations.

## Security

- Public write endpoints are rate-limited.
- External-origin enforcement for public write endpoints uses:
  - `EXTERNAL_PUBLIC_ORIGINS`
  - Fallback: `ALLOWED_ORIGINS`
- Student endpoints use a separate token type (`external_student`).

## Required Env Vars

- `JWT_SECRET` (already required by internal auth)
- `EXTERNAL_STUDENT_JWT_SECRET` (recommended, fallback to `JWT_SECRET`)
- `EXTERNAL_STUDENT_TOKEN_TTL` (default `24h`)
- `EXTERNAL_PUBLIC_ORIGINS` (comma-separated external domains)

## Integration Notes

- Internal management website remains source of truth.
- External website must only consume this API, never DB credentials.
- Staff activation/assignments stay internal-only.
