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
    <div className="grid md:grid-cols-2 gap-8">
      {/* LEFT SIDE — Info */}
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold">Contact Us</h1>

        <div className="rounded-xl border bg-white/80 shadow-sm p-4 space-y-3">
          {/* Correct address */}
          <div className="flex gap-3">
            <span className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg">📍</span>
            <div>
              <p className="font-semibold text-textdark">Visit us</p>
              <p className="text-sm leading-relaxed text-textdark/80">{strings.address}</p>
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
            <span className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg">💬</span>
            <div>
              <p className="font-semibold text-textdark">WhatsApp</p>
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
            <span className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg">⏰</span>
            <div>
              <p className="font-semibold text-textdark">Opening Hours</p>
              <p className="text-sm leading-relaxed text-textdark/80">{strings.hours.weekday}</p>
              <p className="text-sm leading-relaxed text-textdark/80">{strings.hours.friday}</p>
            </div>
          </div>
        </div>

        {/* Updated Google Maps iframe */}
        <iframe
          className="w-full h-48 rounded-xl border"
          src={strings.googleMapsEmbed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>

      {/* RIGHT SIDE — Form */}
      <div className="rounded-xl border bg-white/80 shadow-sm p-5 sm:p-6 lg:p-8">
        <h3 className="text-xl font-semibold mb-4">Send a message</h3>

        <form className="grid gap-4" onSubmit={submit}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-textdark">Name</label>
            <p className="text-xs text-textdark/70">Tell us who we are replying to.</p>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white/90 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              placeholder="Your name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-textdark">Email</label>
            <p className="text-xs text-textdark/70">Optional, if you prefer email replies.</p>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white/90 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-textdark">Message</label>
            <p className="text-xs text-textdark/70">Share your question or feedback.</p>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white/90 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition"
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
