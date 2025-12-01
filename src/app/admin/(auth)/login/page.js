'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Section from '../../../../components/Section';
import Button from '../../../../components/Button';

export default function AdminLogin() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
  e.preventDefault();
  setError(null);
  setLoading(true);


    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok && data?.success) {
        router.replace("/admin/dashboard");
        return;
      }

      setError(data?.error || "Login failed");
    } catch (err) {
      console.error("Login error:", err);
      setLoading(false);
      setError("Unable to login. Please try again.");
    }

    };

  return (
    <Section>
      <div className="max-w-md mx-auto section-bg p-6">
        <h1 className="text-2xl font-semibold mb-4">Admin Login</h1>
        <form className="grid gap-3" onSubmit={submit}>
          <input className="border rounded-lg p-2" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="border rounded-lg p-2" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</Button>
        </form>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>
    </Section>
  );
}