'use client';

import { useEffect, useState } from 'react';

const inputClass = 'rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-700 disabled:bg-neutral-50 disabled:text-neutral-500';
const staffRoles = ['OWNER', 'MANAGER', 'SUPPORT'];

function canManageStaff(role) {
  return role === 'OWNER';
}

function emptyCreateForm() {
  return {
    name: '',
    email: '',
    password: '',
    role: 'SUPPORT',
  };
}

function emptyEditForm() {
  return {
    name: '',
    email: '',
    password: '',
    role: 'SUPPORT',
    isActive: true,
  };
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!payload?.success) throw new Error(payload?.error || 'Request failed');
  return payload.data;
}

export default function TenantStaffClient({ restaurantSlug, staffRole }) {
  const writable = canManageStaff(staffRole);
  const [staffUsers, setStaffUsers] = useState([]);
  const [currentStaffId, setCurrentStaffId] = useState('');
  const [activeOwnerCount, setActiveOwnerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editingStaffId, setEditingStaffId] = useState('');
  const [editForm, setEditForm] = useState(emptyEditForm);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/api/restaurant-admin/staff?restaurantSlug=${encodeURIComponent(restaurantSlug)}`);
      setStaffUsers(data.staffUsers || []);
      setCurrentStaffId(data.currentStaffId || '');
      setActiveOwnerCount(Number(data.activeOwnerCount || 0));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug]);

  function updateCreateForm(field, value) {
    setCreateForm((current) => ({ ...current, [field]: value }));
  }

  function updateEditForm(field, value) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function createStaff(event) {
    event.preventDefault();
    if (!writable) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest('/api/restaurant-admin/staff', {
        method: 'POST',
        body: JSON.stringify({
          restaurantSlug,
          name: createForm.name,
          email: createForm.email,
          password: createForm.password,
          role: createForm.role,
        }),
      });
      setCreateForm(emptyCreateForm());
      setSuccessMessage('Staff user created.');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(staffUser) {
    setEditingStaffId(staffUser.id);
    setEditForm({
      name: staffUser.name || '',
      email: staffUser.email || '',
      password: '',
      role: staffUser.role || 'SUPPORT',
      isActive: Boolean(staffUser.isActive),
    });
  }

  function cancelEdit() {
    setEditingStaffId('');
    setEditForm(emptyEditForm());
  }

  async function updateStaff(event) {
    event.preventDefault();
    if (!writable || !editingStaffId) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/staff/${editingStaffId}`, {
        method: 'PUT',
        body: JSON.stringify({
          restaurantSlug,
          name: editForm.name,
          email: editForm.email,
          role: editForm.role,
          isActive: Boolean(editForm.isActive),
          password: editForm.password,
        }),
      });
      setSuccessMessage('Staff user updated.');
      cancelEdit();
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivateStaff(staffUser) {
    if (!writable) return;
    if (!window.confirm(`Deactivate ${staffUser.email}? They will no longer be able to sign in.`)) return;
    setSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      await apiRequest(`/api/restaurant-admin/staff/${staffUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          restaurantSlug,
          isActive: false,
        }),
      });
      setSuccessMessage('Staff user deactivated.');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function isLastActiveOwner(staffUser) {
    return staffUser.role === 'OWNER' && staffUser.isActive && activeOwnerCount <= 1;
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {successMessage ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
      {loading ? <div className="rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">Loading restaurant staff...</div> : null}
      {!writable ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Staff management is OWNER-only. MANAGER and SUPPORT users can view staff records but cannot create, edit, reset passwords, or deactivate accounts.
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={createStaff} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Create staff user</h3>
          <p className="mt-1 text-sm text-neutral-600">Creates a RestaurantUser for this restaurant only. No invitation or message is sent.</p>
          <div className="mt-4 grid gap-3">
            <input className={inputClass} disabled={!writable} placeholder="Name" value={createForm.name} onChange={(event) => updateCreateForm('name', event.target.value)} />
            <input className={inputClass} required disabled={!writable} type="email" placeholder="Email" value={createForm.email} onChange={(event) => updateCreateForm('email', event.target.value)} />
            <input className={inputClass} required disabled={!writable} type="password" minLength={10} placeholder="Temporary password" value={createForm.password} onChange={(event) => updateCreateForm('password', event.target.value)} />
            <select className={inputClass} disabled={!writable} value={createForm.role} onChange={(event) => updateCreateForm('role', event.target.value)}>
              {staffRoles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <button disabled={!writable || saving} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Saving...' : 'Create staff'}
            </button>
          </div>
        </form>

        <form onSubmit={updateStaff} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">{editingStaffId ? 'Edit staff user' : 'Select a staff user'}</h3>
          <p className="mt-1 text-sm text-neutral-600">Owners can update name, email, role, active state, or enter a new password to reset it manually.</p>
          <div className="mt-4 grid gap-3">
            <input className={inputClass} disabled={!writable || !editingStaffId} placeholder="Name" value={editForm.name} onChange={(event) => updateEditForm('name', event.target.value)} />
            <input className={inputClass} required disabled={!writable || !editingStaffId} type="email" placeholder="Email" value={editForm.email} onChange={(event) => updateEditForm('email', event.target.value)} />
            <select className={inputClass} disabled={!writable || !editingStaffId} value={editForm.role} onChange={(event) => updateEditForm('role', event.target.value)}>
              {staffRoles.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <input className={inputClass} disabled={!writable || !editingStaffId} type="password" minLength={10} placeholder="New password (optional)" value={editForm.password} onChange={(event) => updateEditForm('password', event.target.value)} />
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" disabled={!writable || !editingStaffId} checked={Boolean(editForm.isActive)} onChange={(event) => updateEditForm('isActive', event.target.checked)} />
              Active account
            </label>
            <div className="flex flex-wrap gap-2">
              <button disabled={!writable || !editingStaffId || saving} className="rounded-md bg-[#10241f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? 'Saving...' : 'Update staff'}
              </button>
              {editingStaffId ? <button type="button" onClick={cancelEdit} className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700">Cancel edit</button> : null}
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Restaurant staff</h3>
            <p className="mt-1 text-sm text-neutral-600">Password hashes are never shown. At least one active OWNER must remain.</p>
          </div>
          <div className="rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-700">
            Active owners: {activeOwnerCount}
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {staffUsers.length ? staffUsers.map((staffUser) => (
            <div key={staffUser.id} className="rounded-md border border-neutral-100 p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">{staffUser.name || staffUser.email}</p>
                  <p className="text-sm text-neutral-600">{staffUser.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-neutral-700">{staffUser.role}</span>
                    <span className={staffUser.isActive ? 'rounded-full bg-emerald-50 px-3 py-1 text-emerald-800' : 'rounded-full bg-neutral-100 px-3 py-1 text-neutral-500'}>
                      {staffUser.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {staffUser.id === currentStaffId ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">Current session</span> : null}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    Last login: {staffUser.lastLoginAt ? new Date(staffUser.lastLoginAt).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button disabled={!writable} onClick={() => startEdit(staffUser)} className="text-sm font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
                  <button
                    disabled={!writable || !staffUser.isActive || isLastActiveOwner(staffUser)}
                    onClick={() => deactivateStaff(staffUser)}
                    className="text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title={isLastActiveOwner(staffUser) ? 'At least one active OWNER must remain' : 'Deactivate staff user'}
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            </div>
          )) : <p className="text-sm text-neutral-500">{loading ? 'Loading staff...' : 'No restaurant staff users yet.'}</p>}
        </div>
      </section>
    </div>
  );
}
