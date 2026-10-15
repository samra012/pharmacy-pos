# Pharmacy POS

A point-of-sale and stock system for a single pharmacy, run on the shop's own computer.

- **Checkout** with a cart, tax, and a prescription warning for Rx items. Stock is
  taken from the batch that expires soonest (FEFO), and expired batches are never sold.
- **Inventory**: products with multiple batches, each with its own expiry date.
- **Sales history** with per-sale details (product, batch, cashier).
- **Reports**: today's sales, top sellers, low stock, batches nearing expiry.
- **Staff accounts** with two roles: cashiers can sell and see sales history;
  managers can also manage inventory, reports, staff and settings.
- **80mm receipts** for thermal printers, with the store details from Settings.
- **Automatic backups** of the database while the backend is running.

Urdu text is supported in product names, store details and receipts.

## Tech stack

| Part | Uses |
|---|---|
| Backend | Python, FastAPI, SQLAlchemy, SQLite, Pydantic, bcrypt, PyJWT |
| Frontend | React, Vite, React Router, axios |

Developed with Python 3.13 and Node.js 24.

## First-time setup

Commands below are for Windows (PowerShell or Command Prompt). On macOS/Linux,
activate the virtual environment with `source venv/bin/activate` instead.

### Backend

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Generate a secret key and paste it into `backend/.env` as `JWT_SECRET_KEY`:

```
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

The other settings in `.env` can stay as they are. `.env.example` explains each one.

Create the first manager account (it asks for a username and a password):

```
python -m app.create_manager
```

Run this from PowerShell, Command Prompt or the VS Code terminal. The hidden password
prompt doesn't work reliably in the standalone Git Bash window. Running it again with
an existing username offers to reset that account's password, which is how you get
back in if you're locked out.

### Frontend

```
cd frontend
npm install
copy .env.example .env
```

## Running

Start both, each in its own terminal.

**Backend**, from the `backend` folder:

```
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Always start it from the `backend` folder: the database path in `.env` is relative to it.

**Frontend**, from the `frontend` folder:

```
npm run dev
```

Then open http://localhost:5173 and log in with the manager account. Managers add
cashier accounts from the Staff page.

## Backups

While the backend is running, it copies the database every 6 hours
(`BACKUP_INTERVAL_HOURS`) into `backend/backups` (`BACKUP_DIR`) and keeps the newest
30 copies (`BACKUP_KEEP`). Each copy is checked for integrity before it is kept, and
files are named by date and time, e.g. `pharmacy_pos-2026-10-04_221535.db`.

Managers can see backup status and make a backup straight away under
**Settings → Backups**.

Backups only protect you if they live somewhere other than this computer. Point
`BACKUP_DIR` at a folder that syncs to cloud storage (OneDrive, Google Drive, Dropbox)
or copy the folder to a USB drive regularly.

### Restoring a backup

`python -m app.restore_backup` is planned but not built yet. Until then, restore by hand:

1. Stop the backend.
2. Rename `backend/pharmacy_pos.db` to something like
   `pharmacy_pos.before-restore-2026-10-15.db`, so you can go back if needed.
3. Copy the backup you want from `backend/backups` to `backend/pharmacy_pos.db`.
4. Start the backend again.

Anything recorded after that backup was taken is lost, so pick the newest backup that
is from before the problem.

## Notes

- The database files, backups and both `.env` files are excluded from git.
  Never commit `.env`: it holds the secret that signs logins.
- Expiry dates and "today" in reports use `APP_TIMEZONE` (default `Asia/Karachi`).
