'use client';
import { useState, useMemo } from 'react';
import Button from './Button';

export default function OrderClient({ categories }) {
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', deliveryType: 'DELIVERY', address: '', notes: '' });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === item.id);
      if (existing) return prev.map((p) => p.id === item.id ? { ...p, quantity: p.quantity + 1 } : p);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    setCart((prev) => prev.map((item) => item.id === id ? { ...item, quantity: Math.max(1, qty) } : item));
  };

  const removeItem = (id) => setCart((prev) => prev.filter((item) => item.id !== id));

  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || (form.deliveryType === 'DELIVERY' && !form.address) || cart.length === 0) {
      setStatus({ type: 'error', message: 'Please complete the form and add items.' });
      return;
    }
    setLoading(true);
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, items: cart }) });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      setStatus({ type: 'success', message: 'Order placed! We will confirm shortly.' });
      setCart([]);
      setForm({ name: '', phone: '', deliveryType: 'DELIVERY', address: '', notes: '' });
    } else {
      setStatus({ type: 'error', message: data.error || 'Something went wrong' });
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <div className="md:col-span-2 space-y-6">
        {categories.map((cat) => (
          <div key={cat.id} className="section-bg p-4">
            <h3 className="font-semibold text-xl mb-2">{cat.name}</h3>
            <p className="text-sm text-textdark/70 mb-3">{cat.description}</p>
            <div className="space-y-3">
              {cat.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start border-b pb-3">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-textdark/70">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">AED {item.price.toFixed(2)}</p>
                    <Button className="mt-2 text-sm px-3 py-1" onClick={() => addToCart(item)}>Add to cart</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="section-bg p-4 space-y-4">
        <h3 className="font-semibold text-xl">Your Cart</h3>
        {cart.length === 0 ? <p className="text-sm text-textdark/70">No items yet.</p> : (
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="border-b pb-2">
                <div className="flex justify-between">
                  <p className="font-semibold">{item.name}</p>
                  <button className="text-xs text-red-600" onClick={() => removeItem(item.id)}>Remove</button>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div className="flex items-center gap-2">
                    <button className="px-2 py-1 border" onClick={() => updateQty(item.id, item.quantity - 1)}>-</button>
                    <span>{item.quantity}</span>
                    <button className="px-2 py-1 border" onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
                  </div>
                  <p className="font-semibold">AED {(item.price * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>AED {total.toFixed(2)}</span>
            </div>
          </div>
        )}
        <form className="grid gap-3" onSubmit={submit}>
          <input className="border rounded-lg p-2" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="border rounded-lg p-2" placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <div className="flex gap-2 text-sm">
            <label className={`flex-1 text-center border rounded-full py-2 cursor-pointer ${form.deliveryType === 'DELIVERY' ? 'border-primary bg-primary/10' : ''}`}>
              <input type="radio" name="delivery" value="DELIVERY" className="hidden" checked={form.deliveryType === 'DELIVERY'} onChange={() => setForm({ ...form, deliveryType: 'DELIVERY' })} />
              Delivery
            </label>
            <label className={`flex-1 text-center border rounded-full py-2 cursor-pointer ${form.deliveryType === 'PICKUP' ? 'border-primary bg-primary/10' : ''}`}>
              <input type="radio" name="delivery" value="PICKUP" className="hidden" checked={form.deliveryType === 'PICKUP'} onChange={() => setForm({ ...form, deliveryType: 'PICKUP' })} />
              Pickup
            </label>
          </div>
          {form.deliveryType === 'DELIVERY' && (
            <input className="border rounded-lg p-2" placeholder="Delivery address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          )}
          <textarea className="border rounded-lg p-2" rows="3" placeholder="Order notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button type="submit" disabled={loading}>{loading ? 'Placing order...' : 'Checkout'}</Button>
        </form>
        {status && <p className={`text-sm ${status.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>{status.message}</p>}
      </div>
    </div>
  );
}