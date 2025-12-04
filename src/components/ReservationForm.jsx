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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelForm, setCancelForm] = useState({ reference: "", phone: "" });
  const [cancelStatus, setCancelStatus] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

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

  const submitCancellation = async (e) => {
    e.preventDefault();
    setCancelStatus(null);
    if (!cancelForm.reference.trim()) {
      setCancelStatus({
        type: "error",
        message: "Please enter your reservation reference.",
      });
      return;
    }

    setCancelLoading(true);
    try {
      const res = await fetch("/api/reservations/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: cancelForm.reference.trim(),
          phone: cancelForm.phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCancelStatus({
          type: "success",
          message: "Your reservation has been cancelled.",
        });
      } else {
        setCancelStatus({
          type: "error",
          message: data.error || "Unable to cancel reservation.",
        });
      }
    } catch (error) {
      setCancelStatus({
        type: "error",
        message: "Unable to cancel reservation.",
      });
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="rounded-xl border bg-white/80 shadow-sm p-6 sm:p-8">
        <h1 className="text-3xl font-semibold mb-2 text-center">
          Reserve a Table
        </h1>

        <p className="text-center text-textdark/70 mb-6 text-sm">
          We are open late for families and friends. Fill in your details and
          we will confirm over WhatsApp.
        </p>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-textdark">
              Full name
            </label>
            <p className="text-xs text-textdark/70">Required for booking confirmation.</p>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white/90 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              placeholder="Enter your full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-textdark">
              Phone number
            </label>
            <p className="text-xs text-textdark/70">We will confirm over WhatsApp.</p>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white/90 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              placeholder="Your phone number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-textdark">Email</label>
            <p className="text-xs text-textdark/70">Optional, for additional updates.</p>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white/90 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-textdark">Date</label>
              <p className="text-xs text-textdark/70">Choose your preferred day.</p>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white/90 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-textdark">Time</label>
              <p className="text-xs text-textdark/70">Let us know when to expect you.</p>
              <input
                type="time"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white/90 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-textdark">
              Number of guests
            </label>
            <p className="text-xs text-textdark/70">Tell us how many seats you need.</p>
            <input
              type="number"
              min="1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white/90 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              value={form.guests}
              onChange={(e) =>
                setForm({ ...form, guests: Number(e.target.value) })
              }
              placeholder="Guests"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-textdark">
              Special requests
            </label>
            <p className="text-xs text-textdark/70">Birthdays, allergies, seating preferences.</p>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white/90 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              rows="3"
              placeholder="Anything we should know?"
              value={form.specialRequests}
              onChange={(e) =>
                setForm({ ...form, specialRequests: e.target.value })
              }
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end">
            <Button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto justify-center"
            >
              {loading ? "Submitting..." : "Submit Reservation"}
            </Button>
          </div>
        </form>

        {status && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              status.type === "success"
                ? "border-green-100 bg-green-50 text-green-700"
                : "border-red-100 bg-red-50 text-red-600"
            }`}
          >
            {status.message}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white/80 shadow-sm p-5 text-center space-y-1">
        <p className="text-sm text-textdark/80">Prefer WhatsApp? Message us directly.</p>
        <a
          href={strings.whatsappLink}
          target="_blank"
          className="text-primary font-semibold"
        >
          WhatsApp {strings.whatsapp}
        </a>
        <p className="text-xs text-neutral-500">
          Need to cancel a reservation?{' '}
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="underline-offset-4 hover:underline text-neutral-600 hover:text-primary transition-colors"
          >
            Click here
          </button>
          .
        </p>
      </div>
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-white/60 bg-white/90 shadow-2xl p-6">
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              className="absolute right-4 top-4 text-neutral-500 hover:text-neutral-800"
              aria-label="Close"
            >
              ×
            </button>
            <div className="space-y-1 mb-4">
              <h2 className="text-xl font-semibold text-textdark">Cancel your reservation</h2>
              <p className="text-sm text-textdark/70">
                Enter your reservation reference below to request a cancellation.
              </p>
            </div>
            <form className="space-y-4" onSubmit={submitCancellation}>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-800">Reservation reference</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="e.g. c123abc456"
                  value={cancelForm.reference}
                  onChange={(e) =>
                    setCancelForm({ ...cancelForm, reference: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-800">Phone number (optional)</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="Used for verification"
                  value={cancelForm.phone}
                  onChange={(e) =>
                    setCancelForm({ ...cancelForm, phone: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={cancelLoading}
                  className="flex-1 justify-center"
                >
                  {cancelLoading ? "Cancelling..." : "Cancel Reservation"}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
                >
                  Close
                </button>
              </div>
            </form>
            {cancelStatus && (
              <div
                className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                  cancelStatus.type === "success"
                    ? "border-green-100 bg-green-50 text-green-700"
                    : "border-red-100 bg-red-50 text-red-700"
                }`}
              >
                {cancelStatus.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
