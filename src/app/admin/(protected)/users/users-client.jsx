'use client';

import { useEffect, useState } from 'react';
import AdminCard from '../../components/AdminCard.jsx';
import AdminForm from '../../components/AdminForm.jsx';
import AdminPageHeader from '../../components/AdminPageHeader.jsx';
import AdminTable from '../../components/AdminTable.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

async function apiRequest(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await res.json();
  if (!data?.success) {
    throw new Error(data?.error || 'Request failed');
  }
  return data.data;
}

export default function AdminUsersClient() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', role: 'ADMIN' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/admin/users');
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ email: '', password: '', role: 'ADMIN' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateRole = async (id, role) => {
    await apiRequest(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ role }) });
    load();
  };

  const resetPassword = async (id) => {
    const password = prompt('Enter a new password for this admin');
    if (!password) return;
    await apiRequest(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ password }) });
    load();
  };

  const deleteUser = async (id) => {
    await apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Admin users" description="Manage admin, manager, and support accounts." />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Invite new admin" description="Create a new account with a defined role.">
          <AdminForm onSubmit={handleSubmit} submitLabel="Create admin">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Email</label>
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-800">Role</label>
              <select
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="SUPPORT">Support</option>
              </select>
            </div>
          </AdminForm>
        </AdminCard>

        <AdminCard title="Guidelines" description="Role capabilities">
          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-700">
            <li><strong>Admin</strong>: full control, can manage other admins.</li>
            <li><strong>Manager</strong>: manage content, orders, and reservations.</li>
            <li><strong>Support</strong>: view-only access.</li>
          </ul>
        </AdminCard>
      </div>

      <AdminCard title="Existing admins" actions={loading && <span className="text-sm text-neutral-500">Loading...</span>}>
        <AdminTable
          columns={[
            { key: 'email', header: 'Email' },
            {
              key: 'role',
              header: 'Role',
              render: (val, row) => (
                <select
                  className="rounded-lg border border-neutral-200 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                  value={val}
                  onChange={(e) => updateRole(row.id, e.target.value)}
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="SUPPORT">Support</option>
                </select>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (_val, row) => (
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <button className="text-primary" onClick={() => resetPassword(row.id)}>
                    Reset password
                  </button>
                  <ConfirmDialog
                    confirmLabel="Delete"
                    description={`Remove ${row.email}?`}
                    onConfirm={() => deleteUser(row.id)}
                  />
                </div>
              ),
            },
          ]}
          rows={users}
          emptyMessage={loading ? 'Loading admins...' : 'No admins found'}
        />
      </AdminCard>
    </div>
  );
}