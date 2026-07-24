'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Payment {
  id: string;
  userId: string;
  amount: number;
  slipUrl: string;
  status: string;
  createdAt: string;
  user: {
    email: string;
    subscriptionStatus: string;
  }
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/admin/payments');
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
      } else {
        setErrorMsg('Failed to load payments');
      }
    } catch (err) {
      setErrorMsg('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleAction = async (paymentId: string, action: 'approve' | 'reject' | 'recheck') => {
    if (action !== 'recheck' && !confirm(`Are you sure you want to ${action} this payment?`)) return;
    setProcessingId(paymentId);
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, action })
      });
      const data = await res.json();
      if (res.ok) {
        if (action === 'recheck') {
          if (data.verified) {
            setPayments(payments.map(p => p.id === paymentId ? { ...p, status: 'approved' } : p));
            alert(`ตรวจสอบสำเร็จ (อนุมัติแล้ว): ${data.message}`);
          } else {
            alert(`ตรวจสอบสลิปไม่ผ่าน: ${data.message}`);
          }
        } else {
          // Update local state
          setPayments(payments.map(p => p.id === paymentId ? { ...p, status: action === 'approve' ? 'approved' : 'rejected' } : p));
        }
      } else {
        alert(data.error || 'Action failed');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-amber-500" />
            ระบบตรวจสลิปโอนเงิน (Payments)
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            จัดการการต่ออายุสมาชิกและตรวจสอบสลิปการโอนเงิน
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-mono">
          {errorMsg}
        </div>
      )}

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-neutral-500 font-mono animate-pulse">Loading payments...</div>
        ) : (
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-left text-sm text-neutral-300">
            <thead className="bg-neutral-950/50 text-xs uppercase text-neutral-500 font-mono">
              <tr>
                <th className="px-6 py-4 font-semibold">User Email</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold text-center">Slip Image</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-neutral-800/20 transition-colors">
                  <td className="px-6 py-4 font-medium text-neutral-200">{payment.user.email}</td>
                  <td className="px-6 py-4 font-bold text-amber-500">฿{payment.amount}</td>
                  <td className="px-6 py-4">
                    {payment.status === 'pending' && <span className="inline-flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md text-xs font-mono border border-amber-500/20"><Clock className="h-3 w-3" /> PENDING</span>}
                    {payment.status === 'approved' && <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md text-xs font-mono border border-emerald-500/20"><CheckCircle className="h-3 w-3" /> APPROVED</span>}
                    {payment.status === 'rejected' && <span className="inline-flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md text-xs font-mono border border-rose-500/20"><XCircle className="h-3 w-3" /> REJECTED</span>}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-neutral-500">
                    {new Date(payment.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <a href={payment.slipUrl} target="_blank" rel="noreferrer" className="inline-block relative group">
                      <img src={payment.slipUrl} alt="Slip" className="w-16 h-16 object-cover rounded-lg border border-neutral-700 group-hover:border-amber-500 transition-colors" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity text-[10px] font-bold">VIEW</div>
                    </a>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {payment.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => handleAction(payment.id, 'recheck')}
                          disabled={processingId === payment.id}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold rounded-lg text-xs transition-colors disabled:opacity-50"
                        >
                          Recheck
                        </button>
                        <button 
                          onClick={() => handleAction(payment.id, 'approve')}
                          disabled={processingId === payment.id}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-bold rounded-lg text-xs transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleAction(payment.id, 'reject')}
                          disabled={processingId === payment.id}
                          className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-rose-950 font-bold rounded-lg text-xs transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}

              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                    No payment records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
