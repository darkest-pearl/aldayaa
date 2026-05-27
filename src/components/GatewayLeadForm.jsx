"use client";

import { useMemo, useState } from 'react';

const moduleOptions = [
  'Digital menu / ordering',
  'QR table ordering',
  'Waiter-assisted ordering',
  'Kitchen queue',
  'Inventory management',
  'Recipe / stock deduction foundation',
  'Restaurant profile / configuration',
];

const initialForm = {
  restaurantName: '',
  contactName: '',
  phone: '',
  email: '',
  interestedModules: [],
  message: '',
};

export default function GatewayLeadForm() {
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState('IDLE');
  const [feedback, setFeedback] = useState('');

  const submitting = status === 'SUBMITTING';
  const selectedModuleCount = useMemo(() => form.interestedModules.length, [form.interestedModules]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleModule(module) {
    setForm((current) => {
      const selected = current.interestedModules.includes(module);
      return {
        ...current,
        interestedModules: selected
          ? current.interestedModules.filter((item) => item !== module)
          : [...current.interestedModules, module],
      };
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('SUBMITTING');
    setFeedback('');

    try {
      const response = await fetch('/api/gateway/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to send request');
      }

      setStatus('SUCCESS');
      setFeedback('Request received. We will follow up on the restaurant workflow details.');
      setForm(initialForm);
    } catch (error) {
      setStatus('ERROR');
      setFeedback(error.message || 'Unable to send request. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 text-secondary shadow-lifted sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Restaurant / business name
          <input
            className="mt-2"
            value={form.restaurantName}
            onChange={(event) => updateField('restaurantName', event.target.value)}
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label className="block text-sm font-semibold">
          Contact name
          <input
            className="mt-2"
            value={form.contactName}
            onChange={(event) => updateField('contactName', event.target.value)}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label className="block text-sm font-semibold">
          Phone / WhatsApp
          <input
            className="mt-2"
            value={form.phone}
            onChange={(event) => updateField('phone', event.target.value)}
            required
            minLength={5}
            maxLength={60}
          />
        </label>
        <label className="block text-sm font-semibold">
          Email optional
          <input
            className="mt-2"
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            maxLength={160}
          />
        </label>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">
          Interested modules <span className="font-normal text-neutral-500">({selectedModuleCount} selected)</span>
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {moduleOptions.map((module) => (
            <label
              key={module}
              className="flex min-h-[44px] items-center gap-3 rounded-lg border border-neutral-200 bg-[#f9fbfa] px-3 py-2 text-sm text-neutral-800"
            >
              <input
                type="checkbox"
                checked={form.interestedModules.includes(module)}
                onChange={() => toggleModule(module)}
                className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
              />
              <span>{module}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-6 block text-sm font-semibold">
        Message / customization request
        <textarea
          className="mt-2 min-h-[132px]"
          value={form.message}
          onChange={(event) => updateField('message', event.target.value)}
          placeholder="Tell us what the restaurant needs to automate first."
          maxLength={1200}
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-[#143a31] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2f7d5b] disabled:hover:bg-[#143a31]"
      >
        {submitting ? 'Sending request...' : 'Send customization request'}
      </button>

      {feedback ? (
        <p
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
          }`}
          aria-live="polite"
        >
          {feedback}
        </p>
      ) : null}
    </form>
  );
}
