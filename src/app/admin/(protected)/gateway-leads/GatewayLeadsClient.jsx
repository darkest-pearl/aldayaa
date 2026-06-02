'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';
import {
  GATEWAY_LEAD_STATUSES,
  getGatewayLeadStatusLabel,
} from '../../../../lib/gateway-leads';

const statusBadgeClasses = {
  NEW: 'border-blue-200 bg-blue-50 text-blue-700',
  CONTACTED: 'border-amber-200 bg-amber-50 text-amber-700',
  QUALIFIED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ARCHIVED: 'border-neutral-200 bg-neutral-100 text-neutral-600',
};

async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!data?.success) throw new Error(data?.error || 'Request failed');
  return data.data;
}

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses[status] || statusBadgeClasses.NEW}`}>
      {getGatewayLeadStatusLabel(status)}
    </span>
  );
}

export default function GatewayLeadsClient() {
  const [leads, setLeads] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [copiedValue, setCopiedValue] = useState('');
  const [error, setError] = useState(null);

  const countByStatus = useMemo(() => {
    return GATEWAY_LEAD_STATUSES.reduce((counts, leadStatus) => {
      counts[leadStatus] = leads.filter((lead) => lead.status === leadStatus).length;
      return counts;
    }, {});
  }, [leads]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search.trim()) params.set('search', search.trim());
      const query = params.toString();
      const data = await apiRequest(`/api/admin/gateway-leads${query ? `?${query}` : ''}`);
      setLeads(data.leads || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    const timeout = setTimeout(load, 250);
    return () => clearTimeout(timeout);
  }, [load]);

  const updateStatus = async (id, nextStatus) => {
    setUpdatingId(id);
    setError(null);
    try {
      const data = await apiRequest(`/api/admin/gateway-leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      setLeads((current) => current.map((lead) => (lead.id === id ? data.lead : lead)));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const copyToClipboard = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue(''), 1400);
    } catch {
      setError('Unable to copy this value.');
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Gateway Leads"
        description="Review submitted restaurant gateway inquiries and keep their follow-up status current."
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-neutral-500">Total leads</div>
          <div className="mt-2 text-2xl font-bold text-neutral-900">{leads.length}</div>
        </div>
        {GATEWAY_LEAD_STATUSES.map((leadStatus) => (
          <div key={leadStatus} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-neutral-500">{getGatewayLeadStatusLabel(leadStatus)}</div>
            <div className="mt-2 text-2xl font-bold text-neutral-900">{countByStatus[leadStatus] || 0}</div>
          </div>
        ))}
      </div>

      <AdminCard title="Filters">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-800">Search</label>
            <input
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Restaurant, contact, phone, or email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-800">Status</label>
            <select
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {GATEWAY_LEAD_STATUSES.map((leadStatus) => (
                <option key={leadStatus} value={leadStatus}>
                  {getGatewayLeadStatusLabel(leadStatus)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </AdminCard>

      <AdminCard title="Submitted leads" actions={loading && <span className="text-sm text-neutral-500">Loading...</span>}>
        <div className="space-y-4">
          {!loading && leads.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
              No gateway leads match these filters.
            </div>
          )}

          {leads.map((lead) => (
            <article key={lead.id} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900">{lead.restaurantName}</h2>
                    <p className="text-sm text-neutral-600">{lead.contactName}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-neutral-700">
                    <span className="inline-flex items-center gap-2 rounded-md bg-neutral-100 px-2 py-1">
                      Phone / WhatsApp: {lead.phone}
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary hover:underline"
                        onClick={() => copyToClipboard(lead.phone)}
                      >
                        {copiedValue === lead.phone ? 'Copied' : 'Copy'}
                      </button>
                    </span>
                    {lead.email && (
                      <span className="inline-flex items-center gap-2 rounded-md bg-neutral-100 px-2 py-1">
                        {lead.email}
                        <button
                          type="button"
                          className="text-xs font-semibold text-primary hover:underline"
                          onClick={() => copyToClipboard(lead.email)}
                        >
                          {copiedValue === lead.email ? 'Copied' : 'Copy'}
                        </button>
                      </span>
                    )}
                    <span className="rounded-md bg-neutral-100 px-2 py-1">{formatDate(lead.createdAt)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={lead.status} />
                  <select
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={lead.status}
                    disabled={updatingId === lead.id}
                    onChange={(event) => updateStatus(lead.id, event.target.value)}
                  >
                    {GATEWAY_LEAD_STATUSES.map((leadStatus) => (
                      <option key={leadStatus} value={leadStatus}>
                        {getGatewayLeadStatusLabel(leadStatus)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase text-neutral-500">Interested modules</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {lead.interestedModules?.length ? (
                      lead.interestedModules.map((module) => (
                        <span key={module} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          {module}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-neutral-500">No modules selected</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-neutral-500">Message / customization request</div>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-neutral-50 p-3">
                    <p className="whitespace-pre-line text-sm leading-6 text-neutral-700">{lead.message || 'No message provided'}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}
