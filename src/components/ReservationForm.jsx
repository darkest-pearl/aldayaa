"use client";

import { useState } from "react";
import Button from "./Button";
import { strings } from "../lib/strings";

export default function ReservationForm() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    date: "",
    time: "",
    guests: 2,
    specialRequests: "",
  });

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.phone || !form.date || !form.time) {
      setStatus({
        type: "error",
        message: "Please fill required fields.",
      });
      return;
    }

    setLoading(true);

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      setStatus({
        type: "success",
        message:
          "Reservation received! We will confirm shortly.",
      });

      setForm({
        name: "",
        phone: "",
        email: "",
        date: "",
        time: "",
        guests: 2,
        specialRequests: "",
      });
    } else {
      setStatus({
        type: "error",
        message: data.error || "Something went wrong",
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto section-bg p-6">
      <h1 className="text-3xl font-semibold mb-4 text-center">
        Reserve a Table
      </h1>

      <p className="text-center text-textdark/70 mb-6">
        We are open late for families and friends. Fill in your
        details and we will confirm over WhatsApp.
      </p>

      <form className="grid gap-4" onSubmit={submit}>
        <input
          className="border rounded-lg p-3"
          placeholder="Full name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />

        <input
          className="border rounded-lg p-3"
          placeholder="Phone number"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />

        <input
          className="border rounded-lg p-3"
          placeholder="Email (optional)"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-3">
          <input
            type="date"
            className="border rounded-lg p-3"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
          <input
            type="time"
            className="border rounded-lg p-3"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            required
          />
        </div>

        <input
          type="number"
          min="1"
          className="border rounded-lg p-3"
          value={form.guests}
          onChange={(e) =>
            setForm({ ...form, guests: Number(e.target.value) })
          }
          placeholder="Guests"
        />

        <textarea
          className="border rounded-lg p-3"
          rows="3"
          placeholder="Special requests"
          value={form.specialRequests}
          onChange={(e) =>
            setForm({ ...form, specialRequests: e.target.value })
          }
        />

        <Button type="submit" disabled={loading}>
          {loading ? "Submitting..." : "Submit Reservation"}
        </Button>
      </form>

      {status && (
        <p
          className={`mt-4 text-sm ${
            status.type === "success"
              ? "text-green-700"
              : "text-red-600"
          }`}
        >
          {status.message}
        </p>
      )}

      <div className="mt-6 text-center">
        <p className="text-sm">Prefer WhatsApp? Message us directly.</p>
        <a
          href={strings.whatsappLink}
          target="_blank"
          className="text-primary font-semibold"
        >
          WhatsApp {strings.whatsapp}
        </a>
      </div>
    </div>
  );
}
