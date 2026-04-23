# 🏥 MediCore — Hospital Management System

A complete, production-ready Hospital Management System built with **Django REST Framework** + **React** + **PostgreSQL**, deployed via **Docker** + **Nginx** + **Gunicorn**.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Django 4.2 + Django REST Framework |
| **Auth** | JWT (djangorestframework-simplejwt) |
| **Database** | PostgreSQL 15 |
| **Cache/Queue** | Redis 7 + Celery |
| **Frontend** | React 18 + TailwindCSS + Zustand |
| **API Docs** | Swagger (drf-yasg) |
| **Deployment** | Docker + Nginx + Gunicorn |

---

## 👥 User Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **Admin** | Full system access, user management, statistics, billing |
| **Doctor** | Own appointments, medical records, patient profiles |
| **Nurse** | View appointments and patients, read medical records |
| **Receptionist** | Manage appointments, patients, billing, view doctors |
| **Patient** | Self-register, book appointments, view own records/bills |

---

## 📁 Project Structure

```
hospital-management/
├── backend/
│   ├── apps/
│   │   ├── users/          # Auth, JWT, user management
│   │   ├── patients/       # Patient profiles
│   │   ├── doctors/        # Doctor profiles + dashboard
│   │   ├── departments/    # Hospital departments
│   │   ├── appointments/   # Booking system
│   │   ├── medical_records/# Diagnoses, prescriptions, file uploads
│   │   ├── billing/        # Invoices + payments
│   │   └── notifications/  # In-app + email notifications
│   ├── core/               # Settings, URLs, middleware, permissions
│   ├── requirements.txt
│   ├── Dockerfile
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── pages/          # All page components
│   │   ├── components/     # Reusable UI components
│   │   ├── services/       # Axios API layer
│   │   ├── store/          # Zustand state management
│   │   └── index.css       # Tailwind + custom styles
│   ├── Dockerfile
│   └── vite.config.js
├── nginx/
│   └── nginx.conf          # Reverse proxy config
├── docker-compose.yml
└── .env
```

---

## ⚡ Quick Start

### Prerequisites
- Docker & Docker Compose
- Git

### 1. Clone & configure
```bash
git clone <repo-url>
cd hospital-management
cp .env.example .env   # Edit with your values
```

### 2. Start all services
```bash
docker-compose up --build -d
```

### 3. Access the application
| Service | URL |
|---------|-----|
| **Frontend** | http://localhost |
| **API** | http://localhost/api/ |
| **Swagger Docs** | http://localhost/api/docs/ |
| **Django Admin** | http://localhost/admin/ |

### 4. Default Admin Credentials
```
Email:    admin@hospital.com
Password: Admin@12345
```
> ⚠️ Change these immediately in production!

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/login/                 # JWT login
POST   /api/auth/register/              # Patient self-registration
POST   /api/auth/logout/                # Blacklist token
POST   /api/auth/token/refresh/         # Refresh JWT
GET    /api/auth/verify-email/<token>/  # Email verification
POST   /api/auth/password-reset/        # Request reset
POST   /api/auth/password-reset/confirm/# Confirm reset
```

### Core Resources (all support filtering, search, pagination)
```
GET/POST        /api/patients/
GET/PATCH/DELETE /api/patients/{id}/
GET             /api/patients/{id}/medical_records/
GET             /api/patients/{id}/appointments/
GET             /api/patients/me/

GET/POST        /api/doctors/
GET/PATCH       /api/doctors/{id}/
GET             /api/doctors/{id}/dashboard/
GET             /api/doctors/{id}/schedule/

GET/POST        /api/appointments/
GET/PATCH/DELETE /api/appointments/{id}/
POST            /api/appointments/{id}/approve/
POST            /api/appointments/{id}/cancel/
POST            /api/appointments/{id}/complete/
GET             /api/appointments/today/
GET             /api/appointments/upcoming/
GET             /api/appointments/statistics/

GET/POST        /api/medical-records/
GET/PATCH       /api/medical-records/{id}/

GET/POST        /api/billing/
GET             /api/billing/{id}/
POST            /api/billing/{id}/process_payment/
GET             /api/billing/revenue_summary/

GET/POST        /api/departments/
GET/PATCH/DELETE /api/departments/{id}/

GET             /api/notifications/
POST            /api/notifications/{id}/mark_read/
POST            /api/notifications/mark_all_read/
GET             /api/notifications/unread_count/

GET/POST        /api/users/              # Admin only
GET             /api/users/me/
POST            /api/users/change-password/
GET             /api/users/statistics/
```

---

## 🗄️ Database Models

- **User** — Custom AbstractUser with role, phone, avatar, verification
- **Patient** — blood_group, date_of_birth, allergies, insurance
- **Doctor** — specialization, consultation_fee, availability schedule
- **Department** — name, head_doctor, location
- **Appointment** — patient + doctor + date/time + status workflow
- **MedicalRecord** — diagnosis, prescriptions, vital signs, file upload
- **Prescription** — medicine, dosage, frequency, duration
- **Billing** — invoice, amount, tax, discount, payment tracking
- **Notification** — in-app notification with type + read status

---

## 🛡️ Security Features

- JWT with automatic refresh + token blacklisting on logout
- Role-based permission classes (12 custom permission types)
- Rate limiting on auth endpoints (10 req/min) and API (60 req/min)
- Input validation on all endpoints
- CORS configuration
- Security headers (X-Frame-Options, XSS, HSTS)
- File upload validation (max 10MB)

---

## 🔧 Development Setup (without Docker)

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # Configure DB settings
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## 📊 Monitoring & Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f backend
docker-compose logs -f nginx

# Django shell
docker-compose exec backend python manage.py shell

# Database shell
docker-compose exec db psql -U hospital_user -d hospital_db
```

---

## 🚀 Production Checklist

- [ ] Change `SECRET_KEY` to a 50+ character random string
- [ ] Set `DEBUG=False`
- [ ] Configure production email (SendGrid/SES)
- [ ] Set up SSL/TLS certificates (Let's Encrypt)
- [ ] Change default admin credentials
- [ ] Configure proper `ALLOWED_HOSTS`
- [ ] Set up database backups
- [ ] Configure media storage (S3/GCS)
- [ ] Enable Sentry for error tracking
- [ ] Set up monitoring (Prometheus + Grafana)

---

## 📝 License

MIT License — See LICENSE file for details.
