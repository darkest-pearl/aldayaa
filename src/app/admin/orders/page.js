'use client';
import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  return res.json();
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const load = async () => {
    const data = await fetchJson('/api/orders');
    setOrders(data.orders || []);
  };
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await fetchJson('/api/orders', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    load();
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold mb-4">Orders</h1>
      <div className="space-y-3 text-sm">
        {orders.map((o) => (
          <div key={o.id} className="section-bg p-3">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{o.name} • {o.deliveryType}</p>
                <p>{o.phone}</p>
                <p>Total AED {o.totalPrice?.toFixed(2)}</p>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs px-2 py-1 bg-secondary/20 text-secondary rounded-full">{o.status}</span>
                <button className="text-primary" onClick={() => updateStatus(o.id, 'IN_PROGRESS')}>In Progress</button>
                <button className="text-green-700" onClick={() => updateStatus(o.id, 'COMPLETED')}>Complete</button>
              </div>
            </div>
            <div className="mt-2 text-xs text-textdark/80">
              {o.items?.map((item) => (
                <div key={item.id}>{item.quantity} x {item.name} (AED {item.price})</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}