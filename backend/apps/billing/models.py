"""
Billing Model
"""

from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator


class Billing(models.Model):
    class Status(models.TextChoices):
        UNPAID = 'unpaid', _('Unpaid')
        PAID = 'paid', _('Paid')
        PARTIALLY_PAID = 'partially_paid', _('Partially Paid')
        REFUNDED = 'refunded', _('Refunded')
        CANCELLED = 'cancelled', _('Cancelled')

    class PaymentMethod(models.TextChoices):
        CASH = 'cash', _('Cash')
        CARD = 'card', _('Card')
        INSURANCE = 'insurance', _('Insurance')
        BANK_TRANSFER = 'bank_transfer', _('Bank Transfer')
        ONLINE = 'online', _('Online')

    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='bills',
    )
    appointment = models.OneToOneField(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='bill',
    )
    invoice_number = models.CharField(max_length=50, unique=True)
    amount = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(0)],
    )
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNPAID, db_index=True)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, blank=True)
    payment_date = models.DateTimeField(null=True, blank=True)
    description = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _('Bill')
        verbose_name_plural = _('Bills')
        ordering = ['-created_at']

    def __str__(self):
        return f"Invoice #{self.invoice_number} - {self.patient.full_name} - {self.status}"

    def save(self, *args, **kwargs):
        self.total_amount = self.amount - self.discount + self.tax
        if not self.invoice_number:
            import uuid
            self.invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    @property
    def balance_due(self):
        return self.total_amount - self.paid_amount


def receipt_upload_path(instance, filename):
    import uuid
    ext = filename.split('.')[-1]
    return f'billing/receipts/{instance.billing_id}/{uuid.uuid4().hex}.{ext}'


class PaymentReceipt(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', _('Pending')
        CONFIRMED = 'confirmed', _('Confirmed')
        REJECTED = 'rejected', _('Rejected')

    billing = models.ForeignKey(
        Billing,
        on_delete=models.CASCADE,
        related_name='receipts',
    )
    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.CASCADE,
        related_name='payment_receipts',
    )
    card_number = models.CharField(max_length=20, blank=True, help_text="Last 4 digits or masked card number")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    receipt_image = models.ImageField(upload_to=receipt_upload_path)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='confirmed_receipts',
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Receipt #{self.id} for {self.billing.invoice_number} — {self.status}"
