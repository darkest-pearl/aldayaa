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
  const [reservationReference, setReservationReference] = useState(null)
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
    console.log("API response:", data);

    setLoading(false);

    if (data.success) {
      setReservationReference(data.data.reservation.reference);

      setStatus({
        type: "success",
        message:
          "Reservation received! Please save your reference number in case you need to cancel.",
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

  const copyReference = async () => {
    if (!reservationReference) return;

    try {
      await navigator.clipboard.writeText(reservationReference);
      alert("Reference copied to clipboard");
    } catch (err) {
      console.error("Clipboard copy failed", err);
      alert("Unable to copy reference");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 md:space-y-6">
      <div className="section-bg p-5 sm:p-6 lg:p-7">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 text-center text-secondary">
          Reserve a Table
        </h1>

        <p className="text-center text-neutral-600 mb-6 text-sm">
          We are open late for families and friends. Fill in your details and we will confirm over WhatsApp.
        </p>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">
              Full name
            </label>
            <p className="text-xs text-neutral-600">Required for booking confirmation.</p>
            <input
              className="bg-white"
              placeholder="Enter your full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">
              Phone number
            </label>
            <p className="text-xs text-neutral-600">We will confirm over WhatsApp.</p>
            <input
              className="bg-white"
              placeholder="Your phone number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Email</label>
            <p className="text-xs text-neutral-600">Optional, for additional updates.</p>
            <input
              className="bg-white"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-semibold text-secondary">Date</label>
              <p className="text-xs text-neutral-600">Choose your preferred day.</p>
              <input
                type="date"
                className="bg-white"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-semibold text-secondary">Time</label>
              <p className="text-xs text-neutral-600">Let us know when to expect you.</p>
              <input
                type="time"
                className="bg-white"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">
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
             <p className="text-xs text-neutral-600">Birthdays, allergies, seating preferences.</p>
            <textarea
              className="bg-white"
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
            <p>{status.message}</p>

            {status.type === "success" && reservationReference && (
              <div className="mt-2 flex items-center gap-2 font-mono">
                <span className="px-2 py-1 rounded bg-white border text-sm">
                  {reservationReference}
                </span>

                <button
                  type="button"
                  onClick={copyReference}
                  className="text-primary hover:text-primary/80 transition"
                  aria-label="Copy reservation reference"
                  title="Copy reference"
                >
                  📋
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="section-bg p-4 sm:p-5 text-center space-y-1">
        <p className="text-sm text-neutral-700">Prefer WhatsApp? Message us directly.</p>
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
          <div className="relative w-full max-w-md rounded-2xl border border-neutral-200/80 bg-white/95 shadow-lifted p-6">
            <button
              type="button"
              onClick={() => setShowCancelModal(false)}
              className="absolute right-4 top-4 text-neutral-500 hover:text-secondary"
              aria-label="Close"
            >
              ×
            </button>
            <div className="space-y-1 mb-4">
              <h2 className="text-lg md:text-xl font-semibold text-secondary">Cancel your reservation</h2>
              <p className="text-sm text-neutral-600">
                Enter your reservation reference below to request a cancellation.
              </p>
            </div>
            <form className="space-y-4" onSubmit={submitCancellation}>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-secondary">Reservation reference</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-primary focus:outline-none"
                  placeholder="e.g. c123abc456"
                  value={cancelForm.reference}
                  onChange={(e) =>
                    setCancelForm({ ...cancelForm, reference: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-secondary">Phone number (optional)</label>
                <input
                  className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-white focus:border-primary focus:outline-none"
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
