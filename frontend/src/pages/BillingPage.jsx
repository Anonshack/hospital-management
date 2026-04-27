import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Eye, DollarSign, Upload, CheckCircle, XCircle, Clock, Image } from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { billingAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import useLanguageStore from '../store/languageStore'
import {
  StatusBadge, SearchInput, Pagination, LoadingPage,
  EmptyState, Modal, Select, FormField, Spinner
} from '../components/common/UI'

function ReceiptStatusBadge({ status }) {
  const map = {
    pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    confirmed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  }
  return <span className={`badge border text-[10px] ${map[status] || ''}`}>{status}</span>
}

export default function BillingPage() {
  const { user } = useAuthStore()
  const t = useLanguageStore(state => state.t)
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detail, setDetail] = useState(null)
  const [payModal, setPayModal] = useState(null)
  const [receiptModal, setReceiptModal] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [cardNumber, setCardNumber] = useState('')
  const [receiptNote, setReceiptNote] = useState('')
  const [receiptAmount, setReceiptAmount] = useState('')

  const isPatient = user?.role === 'patient'
  const isAdmin = user?.role === 'admin'

  const { data, isLoading } = useQuery({
    queryKey: ['billing', page, search, statusFilter],
    queryFn: () => isPatient
      ? billingAPI.myBills().then(r => ({ results: r.data }))
      : billingAPI.list({ page, search: search || undefined, status: statusFilter || undefined }).then(r => r.data),
  })

  const { data: pendingReceipts = [] } = useQuery({
    queryKey: ['pending-receipts'],
    queryFn: () => billingAPI.pendingReceipts().then(r => r.data),
    enabled: isAdmin,
    refetchInterval: 30000,
  })

  const payMutation = useMutation({
    mutationFn: ({ id, amount, method }) => billingAPI.processPayment(id, { amount, payment_method: method }),
    onSuccess: () => { toast.success(t('processPayment')); qc.invalidateQueries(['billing']); setPayModal(null) },
    onError: (e) => toast.error(e.response?.data?.message || 'Payment failed'),
  })

  const uploadReceiptMutation = useMutation({
    mutationFn: ({ id, fd }) => billingAPI.uploadReceipt(id, fd),
    onSuccess: () => {
      toast.success(t('uploadReceipt'))
      qc.invalidateQueries(['billing'])
      setReceiptModal(null)
      setReceiptFile(null); setReceiptPreview(null); setCardNumber(''); setReceiptNote(''); setReceiptAmount('')
    },
    onError: (e) => toast.error(e.response?.data?.error || 'Upload failed'),
  })

  const confirmReceiptMutation = useMutation({
    mutationFn: ({ receipt_id, action }) => billingAPI.confirmReceipt(receipt_id, action),
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'confirm' ? t('confirmed') || 'Confirmed' : t('rejected') || 'Rejected')
      qc.invalidateQueries(['billing'])
      qc.invalidateQueries(['pending-receipts'])
    },
    onError: () => toast.error('Action failed'),
  })

  const bills = data?.results || data || []
  const totalPages = data?.total_pages || 1

  const handleReceiptUpload = () => {
    if (!receiptFile) { toast.error(t('clickToSelect')); return }
    if (!receiptAmount) { toast.error(t('paymentAmount')); return }
    const fd = new FormData()
    fd.append('receipt_image', receiptFile)
    fd.append('amount', receiptAmount)
    fd.append('card_number', cardNumber)
    fd.append('note', receiptNote)
    uploadReceiptMutation.mutate({ id: receiptModal.id, fd })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">{t('billing')}</h1>
        <p className="section-subtitle">{isPatient ? t('myBillsSubtitle') : t('billingSubtitle')}</p>
      </div>

      {/* Admin: Pending Receipts Alert */}
      {isAdmin && pendingReceipts.length > 0 && (
        <div className="glass-card p-4 border-amber-500/30 bg-amber-500/5">
          <p className="text-amber-300 font-semibold text-sm mb-3 flex items-center gap-2">
            <Clock size={15} /> {pendingReceipts.length} {t('pendingReceiptsAlert')}
          </p>
          <div className="space-y-3">
            {pendingReceipts.map(r => (
              <div key={r.id} className="flex items-center gap-4 p-3 bg-slate-800/60 rounded-xl">
                {r.receipt_image_url && (
                  <a href={r.receipt_image_url} target="_blank" rel="noreferrer">
                    <img src={r.receipt_image_url} className="w-14 h-14 rounded-lg object-cover border border-slate-600 hover:opacity-80 transition-opacity" alt="receipt" />
                  </a>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm font-medium">{r.patient_name}</p>
                  <p className="text-slate-400 text-xs">{t('invoiceNumber')}: {r.billing} · {t('amount')}: <span className="text-emerald-400 font-semibold">${Number(r.amount).toFixed(2)}</span></p>
                  {r.card_number && <p className="text-slate-500 text-xs">{t('cardNumber')}: {r.card_number}</p>}
                  {r.note && <p className="text-slate-500 text-xs italic">"{r.note}"</p>}
                  <p className="text-slate-600 text-xs">{r.created_at ? format(new Date(r.created_at), 'MMM d, HH:mm') : ''}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => confirmReceiptMutation.mutate({ receipt_id: r.id, action: 'confirm' })}
                    disabled={confirmReceiptMutation.isPending}
                    className="p-2 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 rounded-lg transition-all border border-emerald-500/30"
                    title={t('confirm')}
                  >
                    <CheckCircle size={16} />
                  </button>
                  <button
                    onClick={() => confirmReceiptMutation.mutate({ receipt_id: r.id, action: 'reject' })}
                    disabled={confirmReceiptMutation.isPending}
                    className="p-2 bg-red-500/15 text-red-400 hover:bg-red-500/25 rounded-lg transition-all border border-red-500/30"
                    title={t('delete')}
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isPatient && (
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder={t('searchInvoice')} />
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="sm:w-44">
            <option value="">{t('allStatuses')}</option>
            <option value="unpaid">{t('unpaid')}</option>
            <option value="paid">{t('paid')}</option>
            <option value="partially_paid">{t('partiallyPaid')}</option>
            <option value="cancelled">{t('cancelled')}</option>
          </Select>
        </div>
      )}

      <div className="table-wrapper">
        {isLoading ? <LoadingPage /> : bills.length === 0 ? (
          <EmptyState icon={CreditCard} title={t('noBillsFound')} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {[t('invoiceCol'), t('patientCol'), t('amountCol'), t('paidCol'), t('balanceCol'), t('statusCol'), t('receiptCol'), t('dateCol'), t('actionsCol')].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bills.map(bill => {
                    const latestReceipt = bill.latest_receipt
                    return (
                      <tr key={bill.id} className="table-row">
                        <td className="table-cell font-mono text-primary-400 text-xs">{bill.invoice_number}</td>
                        <td className="table-cell text-slate-200">{bill.patient_name}</td>
                        <td className="table-cell text-slate-300">${Number(bill.total_amount).toFixed(2)}</td>
                        <td className="table-cell text-emerald-400">${Number(bill.paid_amount).toFixed(2)}</td>
                        <td className="table-cell text-red-400">${Number(bill.balance_due).toFixed(2)}</td>
                        <td className="table-cell"><StatusBadge status={bill.status} /></td>
                        <td className="table-cell">
                          {latestReceipt
                            ? <ReceiptStatusBadge status={latestReceipt.status} />
                            : <span className="text-slate-600 text-xs">—</span>
                          }
                        </td>
                        <td className="table-cell text-slate-500 text-xs">
                          {bill.created_at ? format(new Date(bill.created_at), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setDetail(bill)} className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all" title={t('view')}>
                              <Eye size={14} />
                            </button>
                            {isPatient && bill.status !== 'paid' && bill.status !== 'cancelled' && (
                              <button
                                onClick={() => { setReceiptModal(bill); setReceiptAmount(bill.balance_due) }}
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                title={t('uploadReceipt')}
                              >
                                <Upload size={14} />
                              </button>
                            )}
                            {(isAdmin || user?.role === 'receptionist') && bill.status !== 'paid' && bill.status !== 'cancelled' && (
                              <button
                                onClick={() => { setPayModal(bill); setPayAmount(bill.balance_due) }}
                                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all"
                                title={t('processPayment')}
                              >
                                <DollarSign size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!isPatient && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
          </>
        )}
      </div>

      {/* Bill Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={t('invoiceDetails')} size="md">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-700/40">
              <div>
                <p className="text-xs text-slate-500">{t('invoiceNumber')}</p>
                <p className="text-lg font-mono font-bold text-primary-400">{detail.invoice_number}</p>
              </div>
              <StatusBadge status={detail.status} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                [t('patient'), detail.patient_name],
                [t('createdAt'), detail.created_at ? format(new Date(detail.created_at), 'MMM d, yyyy') : '—'],
                [t('dueDate'), detail.due_date || '—'],
                [t('paymentMethod'), detail.payment_method || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-slate-200 font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
              {[
                [t('subtotal'), `$${Number(detail.amount).toFixed(2)}`, 'text-slate-300'],
                [t('discount'), `-$${Number(detail.discount).toFixed(2)}`, 'text-emerald-400'],
                [t('tax'), `+$${Number(detail.tax).toFixed(2)}`, 'text-amber-400'],
                [t('total'), `$${Number(detail.total_amount).toFixed(2)}`, 'text-white font-bold'],
                [t('amountPaid'), `$${Number(detail.paid_amount).toFixed(2)}`, 'text-emerald-400'],
                [t('balanceDue'), `$${Number(detail.balance_due).toFixed(2)}`, 'text-red-400 font-bold'],
              ].map(([label, value, cls]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className={`text-sm ${cls}`}>{value}</span>
                </div>
              ))}
            </div>

            {detail.receipts?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{t('paymentReceipts')}</p>
                <div className="space-y-2">
                  {detail.receipts.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl">
                      {r.receipt_image_url && (
                        <a href={r.receipt_image_url} target="_blank" rel="noreferrer">
                          <img src={r.receipt_image_url} className="w-12 h-12 rounded-lg object-cover border border-slate-600" alt="receipt" />
                        </a>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-semibold text-sm">${Number(r.amount).toFixed(2)}</span>
                          <ReceiptStatusBadge status={r.status} />
                        </div>
                        {r.card_number && <p className="text-slate-500 text-xs">{t('cardNumber')}: {r.card_number}</p>}
                        <p className="text-slate-600 text-xs">{r.created_at ? format(new Date(r.created_at), 'MMM d, HH:mm') : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.description && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{t('description')}</p>
                <p className="text-sm text-slate-300">{detail.description}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Patient: Upload Receipt Modal */}
      <Modal open={!!receiptModal} onClose={() => { setReceiptModal(null); setReceiptFile(null); setReceiptPreview(null) }} title={t('payViaCard')} size="sm">
        {receiptModal && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500">{t('invoiceCol')}</p>
              <p className="text-slate-200 font-mono font-semibold">{receiptModal.invoice_number}</p>
              <p className="text-xs text-slate-500 mt-2">{t('balanceDue')}</p>
              <p className="text-2xl font-bold text-red-400">${Number(receiptModal.balance_due).toFixed(2)}</p>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
              💳 {t('transferInstruction')}
            </div>

            <FormField label={t('amountPaidLabel')}>
              <input type="number" step="0.01" value={receiptAmount} onChange={e => setReceiptAmount(e.target.value)}
                className="input-field" placeholder="0.00" />
            </FormField>

            <FormField label={t('cardLastFour')}>
              <input value={cardNumber} onChange={e => setCardNumber(e.target.value)}
                className="input-field" placeholder="**** **** **** 1234" maxLength={20} />
            </FormField>

            <FormField label={t('paymentScreenshot') + ' *'}>
              {receiptPreview && (
                <div className="mb-2">
                  <img src={receiptPreview} className="w-full rounded-xl object-cover max-h-40 border border-slate-600" alt="preview" />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer p-3 border-2 border-dashed border-slate-600 hover:border-primary-500 rounded-xl transition-colors">
                <Image size={16} className="text-slate-400" />
                <span className="text-sm text-slate-400">{receiptFile ? receiptFile.name : t('clickToSelect')}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files[0]
                  if (f) { setReceiptFile(f); setReceiptPreview(URL.createObjectURL(f)) }
                }} />
              </label>
            </FormField>

            <FormField label={t('noteLabel')}>
              <input value={receiptNote} onChange={e => setReceiptNote(e.target.value)}
                className="input-field" placeholder="..." />
            </FormField>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setReceiptModal(null); setReceiptFile(null); setReceiptPreview(null) }} className="btn-secondary flex-1 justify-center">{t('cancel')}</button>
              <button onClick={handleReceiptUpload} disabled={uploadReceiptMutation.isPending || !receiptFile}
                className="btn-primary flex-1 justify-center">
                {uploadReceiptMutation.isPending ? <Spinner size={14} /> : <><Upload size={14} /> {t('submitReceipt')}</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Admin/Receptionist: Process Payment Modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={t('processPayment')} size="sm">
        {payModal && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 rounded-xl p-4">
              <p className="text-xs text-slate-500">{t('invoiceCol')}</p>
              <p className="text-slate-200 font-mono font-semibold">{payModal.invoice_number}</p>
              <p className="text-xs text-slate-500 mt-2">{t('balanceDue')}</p>
              <p className="text-2xl font-bold text-red-400">${Number(payModal.balance_due).toFixed(2)}</p>
            </div>
            <FormField label={t('paymentAmount')}>
              <input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                className="input-field" max={payModal.balance_due} />
            </FormField>
            <FormField label={t('paymentMethod')}>
              <Select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                <option value="cash">{t('cash')}</option>
                <option value="card">{t('card')}</option>
                <option value="insurance">{t('insuranceMethod')}</option>
                <option value="bank_transfer">{t('bankTransfer')}</option>
                <option value="online">{t('online')}</option>
              </Select>
            </FormField>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setPayModal(null)} className="btn-secondary flex-1 justify-center">{t('cancel')}</button>
              <button onClick={() => payMutation.mutate({ id: payModal.id, amount: payAmount, method: payMethod })}
                disabled={payMutation.isPending || !payAmount} className="btn-success flex-1 justify-center">
                <DollarSign size={15} /> {payMutation.isPending ? t('processing') : t('processPayment')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
