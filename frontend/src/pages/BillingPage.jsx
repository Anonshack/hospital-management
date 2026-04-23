import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Eye, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { billingAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import {
  StatusBadge, SearchInput, Pagination, LoadingPage,
  EmptyState, Modal, Select, FormField
} from '../components/common/UI'

export default function BillingPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detail, setDetail] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')

  const isPatient = user?.role === 'patient'

  const { data, isLoading } = useQuery({
    queryKey: ['billing', page, search, statusFilter],
    queryFn: () => isPatient
      ? billingAPI.myBills().then(r => ({ results: r.data }))
      : billingAPI.list({ page, search: search || undefined, status: statusFilter || undefined }).then(r => r.data),
  })

  const payMutation = useMutation({
    mutationFn: ({ id, amount, method }) => billingAPI.processPayment(id, { amount, payment_method: method }),
    onSuccess: () => {
      toast.success('Payment processed successfully')
      qc.invalidateQueries(['billing'])
      setPayModal(null)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Payment failed'),
  })

  const bills = data?.results || data || []
  const totalPages = data?.total_pages || 1

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">Billing</h1>
        <p className="section-subtitle">{isPatient ? 'Your invoices and payment history' : 'Invoice management and payments'}</p>
      </div>

      {!isPatient && (
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by invoice or patient..." />
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="sm:w-44">
            <option value="">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="partially_paid">Partial</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
      )}

      <div className="table-wrapper">
        {isLoading ? <LoadingPage /> : bills.length === 0 ? (
          <EmptyState icon={CreditCard} title="No bills found" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Invoice', 'Patient', 'Amount', 'Paid', 'Balance', 'Status', 'Date', 'Actions'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bills.map(bill => (
                    <tr key={bill.id} className="table-row">
                      <td className="table-cell font-mono text-primary-400 text-xs">{bill.invoice_number}</td>
                      <td className="table-cell text-slate-200">{bill.patient_name}</td>
                      <td className="table-cell text-slate-300">${Number(bill.total_amount).toFixed(2)}</td>
                      <td className="table-cell text-emerald-400">${Number(bill.paid_amount).toFixed(2)}</td>
                      <td className="table-cell text-red-400">${Number(bill.balance_due).toFixed(2)}</td>
                      <td className="table-cell"><StatusBadge status={bill.status} /></td>
                      <td className="table-cell text-slate-500 text-xs">
                        {bill.created_at ? format(new Date(bill.created_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setDetail(bill)} className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all">
                            <Eye size={14} />
                          </button>
                          {!isPatient && bill.status !== 'paid' && bill.status !== 'cancelled' && (
                            <button
                              onClick={() => { setPayModal(bill); setPayAmount(bill.balance_due) }}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all"
                              title="Process Payment"
                            >
                              <DollarSign size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isPatient && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
          </>
        )}
      </div>

      {/* Bill Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Invoice Details" size="md">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/40">
              <div>
                <p className="text-xs text-slate-500">Invoice Number</p>
                <p className="text-lg font-mono font-bold text-primary-400">{detail.invoice_number}</p>
              </div>
              <StatusBadge status={detail.status} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Patient', detail.patient_name],
                ['Created', detail.created_at ? format(new Date(detail.created_at), 'MMM d, yyyy') : '—'],
                ['Due Date', detail.due_date || '—'],
                ['Payment Method', detail.payment_method || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-slate-200 font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
              {[
                ['Subtotal', `$${Number(detail.amount).toFixed(2)}`, 'text-slate-300'],
                ['Discount', `-$${Number(detail.discount).toFixed(2)}`, 'text-emerald-400'],
                ['Tax', `+$${Number(detail.tax).toFixed(2)}`, 'text-amber-400'],
                ['Total', `$${Number(detail.total_amount).toFixed(2)}`, 'text-white font-bold'],
                ['Paid', `$${Number(detail.paid_amount).toFixed(2)}`, 'text-emerald-400'],
                ['Balance Due', `$${Number(detail.balance_due).toFixed(2)}`, 'text-red-400 font-bold'],
              ].map(([label, value, cls]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className={`text-sm ${cls}`}>{value}</span>
                </div>
              ))}
            </div>
            {detail.description && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-slate-300">{detail.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Process Payment" size="sm">
        {payModal && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500">Invoice</p>
              <p className="text-slate-200 font-mono font-semibold">{payModal.invoice_number}</p>
              <p className="text-xs text-slate-500 mt-2">Balance Due</p>
              <p className="text-2xl font-bold text-red-400">${Number(payModal.balance_due).toFixed(2)}</p>
            </div>
            <FormField label="Payment Amount">
              <input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                className="input-field"
                max={payModal.balance_due}
              />
            </FormField>
            <FormField label="Payment Method">
              <Select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="insurance">Insurance</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="online">Online</option>
              </Select>
            </FormField>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPayModal(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button
                onClick={() => payMutation.mutate({ id: payModal.id, amount: payAmount, method: payMethod })}
                disabled={payMutation.isPending || !payAmount}
                className="btn-success flex-1 justify-center"
              >
                <DollarSign size={15} /> {payMutation.isPending ? 'Processing...' : 'Process Payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
