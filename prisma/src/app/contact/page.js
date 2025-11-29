'use client';
import { useState } from 'react';
import Section from '../../components/Section';
import Button from '../../components/Button';
import { strings } from '../../lib/strings';

export const metadata = { title: 'Contact | Al Dayaa Al Shamiah' };

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.message) {
      setStatus({ type: 'error', message: 'Please add your name and message.' });
      return;
    }
    setLoading(true);
    const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      setStatus({ type: 'success', message: 'Message sent. Thank you!' });
      setForm({ name: '', email: '', message: '' });
    } else {
      setStatus({ type: 'error', message: data.error || 'Something went wrong' });
    }
  };

  return (
    <Section>
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold">Contact Us</h1>
          <p>{strings.address}</p>
          <a href={strings.googleMaps} className="text-primary font-semibold" target="_blank">View on Google Maps</a>
          <div>
            <p className="font-semibold">WhatsApp</p>
            <a href={strings.whatsappLink} target="_blank" className="text-primary">{strings.whatsapp}</a>
          </div>
          <div>
            <p className="font-semibold">Opening Hours</p>
            <p>{strings.hours.weekday}</p>
            <p>{strings.hours.friday}</p>
          </div>
          <iframe className="w-full h-48 rounded-xl" src="https://maps.google.com/maps?q=Majestic%20Tower%20Al%20Taawun%20St%20Sharjah&t=&z=13&ie=UTF8&iwloc=&output=embed"></iframe>
        </div>
        <div className="section-bg p-4">
          <h3 className="text-xl font-semibold mb-3">Send a message</h3>
          <form className="grid gap-3" onSubmit={submit}>
            <input className="border rounded-lg p-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="border rounded-lg p-2" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <textarea className="border rounded-lg p-2" rows="4" placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
            <Button type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send'}</Button>
          </form>
          {status && <p className={`mt-3 text-sm ${status.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>{status.message}</p>}
        </div>
      </div>
    </Section>
  );
}