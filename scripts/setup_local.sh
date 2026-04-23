#!/usr/bin/env bash
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

ENV_FILE="$(dirname "$0")/../.env"
if [ ! -f "$ENV_FILE" ]; then
  info ".env not found — copying from .env.example"
  cp "$(dirname "$0")/../.env.example" "$ENV_FILE"
  ok "Created .env — edit it if your Postgres credentials differ, then re-run."
fi

export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

DB_NAME="${DB_NAME:-hospital_db}"
DB_USER="${DB_USER:-hospital_user}"
DB_PASSWORD="${DB_PASSWORD:-hospital_password}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

info "Using DB: $DB_NAME  user: $DB_USER  host: $DB_HOST:$DB_PORT"

if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; then
  echo ""
  warn "PostgreSQL is NOT running on $DB_HOST:$DB_PORT."
  echo ""
  echo "  Start it with one of:"
  echo "    brew services start postgresql@15   (macOS Homebrew)"
  echo "    sudo systemctl start postgresql     (Linux)"
  echo "    pg_ctl -D /usr/local/var/postgresql start"
  echo ""
  error "Please start PostgreSQL and re-run this script."
fi
ok "PostgreSQL is running."

info "Creating database user '$DB_USER' (if not exists)..."
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -tc \
  "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  psql -h "$DB_HOST" -p "$DB_PORT" -U postgres \
    -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null
ok "User '$DB_USER' ready."

info "Creating database '$DB_NAME' (if not exists)..."
psql -h "$DB_HOST" -p "$DB_PORT" -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  psql -h "$DB_HOST" -p "$DB_PORT" -U postgres \
    -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null
ok "Database '$DB_NAME' ready."

psql -h "$DB_HOST" -p "$DB_PORT" -U postgres \
  -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null
ok "Privileges granted."

BACKEND_DIR="$(dirname "$0")/.."
cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
  warn "No venv found. Creating one..."
  python3 -m venv venv
  ok "venv created."
fi

info "Activating venv and installing requirements..."
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
ok "Requirements installed."

info "Running migrations..."
python manage.py migrate --noinput
ok "Migrations done."

info "Creating superuser (admin@hospital.com / Admin@12345)..."
python manage.py shell -c "
from apps.users.models import User
if not User.objects.filter(email='admin@hospital.com').exists():
    User.objects.create_superuser(
        email='admin@hospital.com',
        username='admin',
        password='Admin@12345',
        first_name='System',
        last_name='Admin',
        role='admin',
        is_verified=True,
    )
    print('  Superuser created.')
else:
    print('  Superuser already exists — skipping.')
"

echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅  Setup complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo "  Start the dev server:"
echo -e "    ${CYAN}source venv/bin/activate${NC}"
echo -e "    ${CYAN}python manage.py runserver${NC}"
echo ""
echo "  API docs:  http://localhost:8000/api/docs/"
echo "  Admin:     http://localhost:8000/admin/"
echo "  Login:     admin@hospital.com  /  Admin@12345"
echo ""
