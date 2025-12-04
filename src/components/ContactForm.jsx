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

    setLoading(false);

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
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      {/* LEFT SIDE — Info */}
      <div className="space-y-3">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold">Contact Us</h1>

        {/* Correct address */}
        <p className="text-base leading-relaxed text-textdark/80">{strings.address}</p>

        {/* Correct clickable Google Maps link */}
        <a
          href={strings.googleMaps}
          className="text-primary font-semibold"
          target="_blank"
        >
          View on Google Maps
        </a>

        {/* WhatsApp */}
        <div>
          <p className="font-semibold">WhatsApp</p>
          <a
            href={strings.whatsappLink}
            target="_blank"
            className="text-primary"
          >
            {strings.whatsapp}
          </a>
        </div>

        {/* Hours */}
        <div>
          <p className="font-semibold">Opening Hours</p>
          <p className="text-base leading-relaxed text-textdark/80">{strings.hours.weekday}</p>
          <p className="text-base leading-relaxed text-textdark/80">{strings.hours.friday}</p>
        </div>

        {/* Updated Google Maps iframe */}
        <iframe
          className="w-full h-48 rounded-xl"
          src={strings.googleMapsEmbed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>

      {/* RIGHT SIDE — Form */}
      <div className="section-bg p-4">
        <h3 className="text-xl font-semibold mb-3">Send a message</h3>

        <form className="grid gap-3" onSubmit={submit}>
          <input
            className="border rounded-lg p-2"
            placeholder="Name"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            required
          />

          <input
            className="border rounded-lg p-2"
            placeholder="Email"
            value={form.email}
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />

          <textarea
            className="border rounded-lg p-2"
            rows="4"
            placeholder="Message"
            value={form.message}
            onChange={(e) =>
              setForm({ ...form, message: e.target.value })
            }
            required
          />

          <Button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </Button>
        </form>

        {status && (
          <p
            className={`mt-3 text-sm ${
              status.type === "success"
                ? "text-green-700"
                : "text-red-600"
            }`}
          >
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
