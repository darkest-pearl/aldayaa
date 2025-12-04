"use client";

import { useState } from "react";
import Section from "../../../components/Section";
import Button from "../../../components/Button";

export default function TrackOrderClient() {
  const [reference, setReference] = useState("");
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setOrder(null);

    if (!reference.trim()) {
      setError("Please enter your reference number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/orders/track?reference=${encodeURIComponent(reference.trim())}`
      );
      const data = await res.json();

      if (data.success) {
        setOrder(data.data);
      } else {
        setError(data.error || "Unable to find this order.");
      }
    } catch (err) {
      setError("Unable to fetch order status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section>
      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold">Track your order</h1>
          <p className="text-textdark/70">
            Enter your reference number to view the latest status.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-800">
              Reference number
            </label>
            <input
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="e.g. c123abc456"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? "Checking status..." : "Track Order"}
          </Button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {order && (
          <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Reference</span>
              <span className="font-mono">{order.reference}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Status</span>
              <span className="uppercase">{order.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Order Type</span>
              <span>{order.orderType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Placed At</span>
              <span>
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleString()
                  : "--"}
              </span>
            </div>
            {order.address && (
              <div className="space-y-1">
                <p className="font-semibold">Delivery Address</p>
                <p className="text-sm leading-5 text-green-900/90">{order.address}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Section>
  );
}