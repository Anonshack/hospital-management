#!/bin/bash
set -e

echo "Waiting for PostgreSQL..."
while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q; do
  sleep 1
done
echo "PostgreSQL is ready."

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Creating superuser if not exists..."
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
    print('Superuser created: admin@hospital.com / Admin@12345')
else:
    print('Superuser already exists.')
"

echo "Starting Gunicorn..."
exec gunicorn core.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --worker-class gthread \
  --threads 2 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile - \
  --log-level info
