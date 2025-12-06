"use client";

import { useState } from "react";
import Button from "./Button";
import { strings } from "../lib/strings";

export default function ContactForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    message: "",
  });

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.message) {
      setStatus({
        type: "error",
        message: "Please add your name and message.",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      let data = null;
      try {
        data = await res.json();
      } catch (err) {
        console.error("JSON parse error", err);
      }

      if (data?.success) {
        setStatus({
          type: "success",
          message: "Message sent. Thank you!",
        });
        setForm({ name: "", email: "", message: "" });
      } else {
        setStatus({
          type: "error",
          message: data?.error || "Something went wrong",
        });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Unable to send message. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-start">
      {/* LEFT SIDE — Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">We’d love to hear from you</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-secondary">Contact Us</h1>
          <p className="text-sm text-neutral-700 leading-relaxed">Reach out for bookings, questions, or collaborations.</p>
        </div>

        <div className="section-bg p-4 md:p-5 space-y-4">
          {/* Correct address */}
          <div className="flex gap-3">
            <span className="h-10 w-10 rounded-full bg-primary/15 text-secondary flex items-center justify-center text-base md:text-lg">📍</span>
            <div>
              <p className="font-semibold text-secondary">Visit us</p>
              <p className="text-sm leading-relaxed text-neutral-700">{strings.address}</p>
              <a
                href={strings.googleMaps}
                className="text-primary font-semibold text-sm"
                target="_blank"
              >
                View on Google Maps
              </a>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="flex gap-3">
            <span className="h-10 w-10 rounded-full bg-primary/15 text-secondary flex items-center justify-center text-base md:text-lg">💬</span>
            <div>
              <p className="font-semibold text-secondary">WhatsApp</p>
              <a
                href={strings.whatsappLink}
                target="_blank"
                className="text-primary text-sm font-semibold"
              >
                {strings.whatsapp}
              </a>
            </div>
          </div>

          {/* Hours */}
          <div className="flex gap-3">
            <span className="h-10 w-10 rounded-full bg-primary/15 text-secondary flex items-center justify-center text-base md:text-lg">⏰</span>
            <div>
              <p className="font-semibold text-secondary">Opening Hours</p>
              <p className="text-sm leading-relaxed text-neutral-700">{strings.hours.weekday}</p>
              <p className="text-sm leading-relaxed text-neutral-700">{strings.hours.friday}</p>
            </div>
          </div>
        </div>

        {/* Updated Google Maps iframe */}
        <iframe
          className="w-full h-48 rounded-2xl border border-neutral-200/80 shadow-soft"
          src={strings.googleMapsEmbed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>

      {/* RIGHT SIDE — Form */}
      <div className="section-bg p-5 sm:p-6 lg:p-7">
        <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 text-secondary">Send a message</h3>

        <form className="grid gap-4" onSubmit={submit}>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Name</label>
            <p className="text-xs text-neutral-600">Tell us who we are replying to.</p>
            <input
              className="bg-white"
              placeholder="Your name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Email</label>
            <p className="text-xs text-neutral-600">Optional, if you prefer email replies.</p>
            <input
              className="bg-white"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-secondary">Message</label>
            <p className="text-xs text-neutral-600">Share your question or feedback.</p>
            <textarea
              className="bg-white"
              rows="4"
              placeholder="How can we help?"
              value={form.message}
              onChange={(e) =>
                setForm({ ...form, message: e.target.value })
              }
              required
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-end">
            <Button type="submit" disabled={loading} className="w-full sm:w-auto justify-center">
              {loading ? "Sending..." : "Send"}
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
    </div>
  );
}
