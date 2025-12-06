'use client';

import { useState } from 'react';
import Section from '../../../components/Section';
import Button from '../../../components/Button';

export default function OrderCancelClient() {
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (!reference.trim()) {
      setStatus({ type: 'error', message: 'Please enter your order reference number.' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reference.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        const feeText = data.data?.fee ? ` A fee of AED ${Number(data.data.fee).toFixed(2)} applies.` : '';
        setStatus({ type: 'success', message: `Your order has been cancelled.${feeText}` });
      } else {
        setStatus({ type: 'error', message: data.error || 'Unable to cancel order.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Unable to cancel order.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section>
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl section-bg p-6 sm:p-7">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Support</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-secondary">Cancel your order</h1>
          <p className="text-neutral-600">
            Enter the order reference number you received when placing your order.
          </p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-secondary">Order reference</label>
            <input
              className="w-full rounded-xl border border-neutral-200 px-3.5 py-3 text-sm bg-white shadow-sm focus:border-primary focus:outline-none"
              placeholder="e.g. c123abc456"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? 'Cancelling…' : 'Cancel Order'}
          </Button>
        </form>
        {status && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {status.message}
          </div>
        )}
      </div>
    </Section>
  );
}