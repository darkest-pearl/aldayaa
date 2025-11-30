'use client';
import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  return res.json();
}

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState([]);

  const load = async () => {
    const data = await fetchJson('/api/reservations');
    setReservations(data.reservations || []);
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await fetchJson('/api/reservations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold mb-4">Reservations</h1>
      <div className="space-y-3 text-sm">
        {reservations.map((r) => (
          <div key={r.id} className="section-bg p-3 flex justify-between items-center">
            <div>
              <p className="font-semibold">{r.name} • {r.date} {r.time}</p>
              <p>{r.phone} • {r.guests} guests</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-secondary/20 text-secondary">{r.status}</span>
              <button className="text-primary" onClick={() => updateStatus(r.id, 'CONFIRMED')}>Confirm</button>
              <button className="text-red-600" onClick={() => updateStatus(r.id, 'CANCELLED')}>Cancel</button>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}