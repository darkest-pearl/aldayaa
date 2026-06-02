"use client";

import { useMemo, useState } from 'react';

const moduleOptions = [
  'Public website / menu',
  'Reservation / contact flows',
  'Online ordering',
  'QR table ordering',
  'Waiter-assisted ordering',
  'Kitchen queue',
  'Inventory management',
  'Recipe / stock deduction foundation',
  'Restaurant profile / configuration',
  'Custom workflows',
];

const PACKAGE_INTEREST_OPTIONS = [
  {
    value: 'STARTER',
    label: 'Starter',
    modules: ['Public website / menu', 'Reservation / contact flows', 'Restaurant profile / configuration'],
  },
  {
    value: 'OPERATIONS',
    label: 'Operations',
    modules: ['Online ordering', 'QR table ordering', 'Waiter-assisted ordering', 'Kitchen queue'],
  },
  {
    value: 'ADVANCED_CUSTOM',
    label: 'Advanced / Custom',
    modules: ['Inventory management', 'Recipe / stock deduction foundation', 'Custom workflows'],
  },
];

const PACKAGE_INTEREST_LABELS = PACKAGE_INTEREST_OPTIONS.reduce((labels, option) => {
  labels[option.value] = option.label;
  return labels;
}, {});

function getPackageModuleDefaults(packageInterest) {
  return PACKAGE_INTEREST_OPTIONS.find((option) => option.value === packageInterest)?.modules || [];
}

function normalizePackageInterest(packageInterest) {
  return PACKAGE_INTEREST_LABELS[packageInterest] ? packageInterest : '';
}

function createInitialForm(initialPackageInterest = '') {
  const packageInterest = normalizePackageInterest(initialPackageInterest);

  return {
    restaurantName: '',
    contactName: '',
    phone: '',
    email: '',
    packageInterest,
    interestedModules: getPackageModuleDefaults(packageInterest),
    message: '',
    companyWebsite: '',
  };
}

const initialForm = createInitialForm('');

function mergeUniqueModules(currentModules, nextModules) {
  return Array.from(new Set([...currentModules, ...nextModules]));
};

function getTrimmedForm(form) {
  return {
    ...form,
    restaurantName: form.restaurantName.trim(),
    contactName: form.contactName.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    packageInterest: normalizePackageInterest(form.packageInterest),
    message: form.message.trim(),
    companyWebsite: form.companyWebsite.trim(),
  };
}

function validateForm(form) {
  const trimmed = getTrimmedForm(form);
  const errors = {};

  if (trimmed.restaurantName.length < 2) {
    errors.restaurantName = 'Enter the restaurant or business name.';
  }

  if (trimmed.contactName.length < 2) {
    errors.contactName = 'Enter the main contact name.';
  }

  if (trimmed.phone.length < 5) {
    errors.phone = 'Enter a phone or WhatsApp number.';
  }

  if (trimmed.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.email)) {
    errors.email = 'Enter a valid email address or leave this blank.';
  }

  if (trimmed.message.length > 1200) {
    errors.message = 'Keep the request under 1200 characters.';
  }

  return errors;
}

export default function GatewayLeadForm({ initialPackageInterest = '' }) {
  const [form, setForm] = useState(() => createInitialForm(initialPackageInterest));
  const [status, setStatus] = useState('IDLE');
  const [feedback, setFeedback] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const submitting = status === 'SUBMITTING';
  const selectedModuleCount = useMemo(() => form.interestedModules.length, [form.interestedModules]);
  const selectedPackageLabel = form.packageInterest ? PACKAGE_INTEREST_LABELS[form.packageInterest] : 'No package selected';

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
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

  function updatePackageInterest(packageInterest) {
    const normalizedPackage = normalizePackageInterest(packageInterest);
    const packageModules = getPackageModuleDefaults(normalizedPackage);

    setForm((current) => ({
      ...current,
      packageInterest: normalizedPackage,
      interestedModules: normalizedPackage
        ? mergeUniqueModules(current.interestedModules, packageModules)
        : current.interestedModules,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      setStatus('ERROR');
      setFeedback('Please check the highlighted fields and try again.');
      return;
    }

    setStatus('SUBMITTING');
    setFeedback('');
    setFieldErrors({});

    try {
      const response = await fetch('/api/gateway/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getTrimmedForm(form)),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to send request');
      }

      setStatus('SUCCESS');
      setFeedback('Request received. The next step is a short review of your restaurant workflow and the modules you want to customize.');
      setForm(initialForm);
      setFieldErrors({});
    } catch (error) {
      setStatus('ERROR');
      setFeedback(error.message || 'Unable to send request. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 text-secondary shadow-lifted sm:p-8" noValidate>
      <div className="hidden" aria-hidden="true">
        <label>
          Company website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.companyWebsite}
            onChange={(event) => updateField('companyWebsite', event.target.value)}
          />
        </label>
      </div>

      <label className="block text-sm font-semibold">
        Request the package or module mix
        <select
          className="mt-2"
          value={form.packageInterest}
          onChange={(event) => updatePackageInterest(event.target.value)}
        >
          <option value="">I am not sure yet</option>
          {PACKAGE_INTEREST_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="mt-2 block text-xs font-medium text-neutral-500">
          Selected package: {selectedPackageLabel}. You can still mix modules before sending the request.
        </span>
      </label>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Restaurant / business name
          <input
            className="mt-2"
            value={form.restaurantName}
            onChange={(event) => updateField('restaurantName', event.target.value)}
            required
            minLength={2}
            maxLength={160}
            aria-invalid={fieldErrors.restaurantName ? 'true' : 'false'}
          />
          {fieldErrors.restaurantName ? <span className="mt-1 block text-xs font-medium text-red-700">{fieldErrors.restaurantName}</span> : null}
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
            aria-invalid={fieldErrors.contactName ? 'true' : 'false'}
          />
          {fieldErrors.contactName ? <span className="mt-1 block text-xs font-medium text-red-700">{fieldErrors.contactName}</span> : null}
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
            aria-invalid={fieldErrors.phone ? 'true' : 'false'}
          />
          {fieldErrors.phone ? <span className="mt-1 block text-xs font-medium text-red-700">{fieldErrors.phone}</span> : null}
        </label>
        <label className="block text-sm font-semibold">
          Email optional
          <input
            className="mt-2"
            type="email"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            maxLength={160}
            aria-invalid={fieldErrors.email ? 'true' : 'false'}
          />
          {fieldErrors.email ? <span className="mt-1 block text-xs font-medium text-red-700">{fieldErrors.email}</span> : null}
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
          placeholder="Tell us what to customize first: table ordering, staff order entry, kitchen workflow, inventory, or another operational need."
          maxLength={1200}
          aria-invalid={fieldErrors.message ? 'true' : 'false'}
        />
        {fieldErrors.message ? <span className="mt-1 block text-xs font-medium text-red-700">{fieldErrors.message}</span> : null}
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-[#143a31] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2f7d5b] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-[#143a31]"
      >
        {submitting ? 'Sending request...' : 'Send customization request'}
      </button>

      {feedback ? (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            status === 'SUCCESS'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
          aria-live="polite"
        >
          <p className="font-semibold">{status === 'SUCCESS' ? 'Request received' : 'Request not sent yet'}</p>
          <p className="mt-1 leading-6">{feedback}</p>
        </div>
      ) : null}
    </form>
  );
}
