"use client";

import { useState, useMemo } from "react";
import Button from "./Button";

export default function OrderClient({ categories }) {
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    deliveryType: "DELIVERY", // default
    address: "",
    notes: "",
    notifyWhenReady: false, // <-- added
  });

  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [reference, setReference] = useState("");
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [trackRef, setTrackRef] = useState("");
  const [cancelRef, setCancelRef] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [trackError, setTrackError] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [cancelResult, setCancelResult] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // CART LOGIC
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === item.id);
      if (existing) {
        return prev.map((x) =>
          x.id === item.id ? { ...x, quantity: x.quantity + 1 } : x
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, qty) } : item
      )
    );
  };

  const removeItem = (id) =>
    setCart((prev) => prev.filter((x) => x.id !== id));

  const total = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cart]
  );

  // SUBMIT ORDER
  const submitOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setLoading(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: cart,
          paidOnline: false,
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!data?.success) {
        alert("Unable to place order. Please try again.");
        return;
      }

      // assign reference number from backend
      const ref = data.data?.reference;
      setReference(ref || "(missing reference)");
      setShowDialog(true);

      // Reset cart + form
      setCart([]);
      setForm({
        name: "",
        phone: "",
        deliveryType: "DELIVERY",
        address: "",
        notes: "",
        notifyWhenReady: false,
      });
    } catch (err) {
      setLoading(false);
      alert("Order failed. Check your connection.");
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const handleTrack = async (e) => {
    e.preventDefault();
    setTrackError("");
    setTrackResult(null);

    const trimmed = trackRef.trim();
    if (trimmed.length < 3) {
      setTrackError("Please enter a valid reference number.");
      return;
    }

    setTrackLoading(true);
    try {
      const res = await fetch(`/api/orders/track?reference=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!data?.success) {
        setTrackError(data?.error || "Unable to find order.");
        setTrackLoading(false);
        return;
      }

      setTrackResult(data.data?.order || null);
    } catch (err) {
      setTrackError("Unable to reach the server. Please try again.");
    } finally {
      setTrackLoading(false);
    }
  };

  const handleCancel = async (e) => {
    e.preventDefault();
    setCancelError("");
    setCancelResult(null);

    const trimmed = cancelRef.trim();
    if (trimmed.length < 3) {
      setCancelError("Please enter a valid reference number.");
      return;
    }

    setCancelLoading(true);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trimmed }),
      });
      const data = await res.json();

      if (!data?.success) {
        setCancelError(data?.error || "Unable to cancel order.");
        setCancelLoading(false);
        return;
      }

      setCancelResult(data.data || { cancelled: true });
    } catch (err) {
      setCancelError("Unable to reach the server. Please try again.");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <>
    <div className="grid md:grid-cols-2 gap-4 mb-6">
        <button
          type="button"
          onClick={() => setShowTrackModal(true)}
          className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div>
            <p className="text-sm text-amber-900/80">Check on an order</p>
            <p className="text-lg font-semibold text-amber-900">Track Order</p>
          </div>
          <span className="text-amber-700 text-xl">→</span>
        </button>

        <button
          type="button"
          onClick={() => setShowCancelModal(true)}
          className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div>
            <p className="text-sm text-amber-900/80">Change of plans?</p>
            <p className="text-lg font-semibold text-amber-900">Cancel Order</p>
          </div>
          <span className="text-amber-700 text-xl">→</span>
        </button>
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        {/* LEFT: MENU */}
        <div className="md:col-span-2 space-y-6">
          {categories.map((cat) => (
            <div key={cat.id} className="section-bg p-4 rounded-xl">
              <h3 className="font-semibold text-xl mb-2">{cat.name}</h3>
              <p className="text-sm text-textdark/70 mb-3">{cat.description}</p>

              <div className="space-y-3">
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start border-b pb-3"
                  >
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-sm text-textdark/70">
                        {item.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">
                        AED {item.price.toFixed(2)}
                      </p>

                      <Button
                        className="mt-2 text-sm px-3 py-1"
                        onClick={() => addToCart(item)}
                      >
                        Add to cart
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT: CART + CHECKOUT FORM */}
        <div className="section-bg p-4 space-y-4 rounded-xl">
          <h3 className="font-semibold text-xl">Your Cart</h3>

          {cart.length === 0 ? (
            <p className="text-sm text-textdark/70">No items yet.</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="border-b pb-2">
                  <div className="flex justify-between">
                    <p className="font-semibold">{item.name}</p>
                    <button
                      className="text-xs text-red-600"
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 border"
                        onClick={() => updateQty(item.id, item.quantity - 1)}
                      >
                        -
                      </button>

                      <span>{item.quantity}</span>

                      <button
                        className="px-2 py-1 border"
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>

                    <p className="font-semibold">
                      AED {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}

              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>AED {total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* CUSTOMER FORM */}
          <form className="grid gap-3" onSubmit={submitOrder}>
            <input
              className="border rounded-lg p-2"
              placeholder="Full name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
              required
            />

            <input
              className="border rounded-lg p-2"
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
              required
            />

            {/* delivery / pickup */}
            <div className="flex gap-2 text-sm">
              <label
                className={`flex-1 text-center border rounded-full py-2 cursor-pointer ${
                  form.deliveryType === "DELIVERY"
                    ? "border-primary bg-primary/10"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="delivery"
                  className="hidden"
                  checked={form.deliveryType === "DELIVERY"}
                  onChange={() =>
                    setForm({
                      ...form,
                      deliveryType: "DELIVERY",
                      notifyWhenReady: false, // reset
                    })
                  }
                />
                Delivery
              </label>

              <label
                className={`flex-1 text-center border rounded-full py-2 cursor-pointer ${
                  form.deliveryType === "PICKUP"
                    ? "border-primary bg-primary/10"
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="delivery"
                  className="hidden"
                  checked={form.deliveryType === "PICKUP"}
                  onChange={() =>
                    setForm({
                      ...form,
                      deliveryType: "PICKUP",
                    })
                  }
                />
                Pickup
              </label>
            </div>

            {/* DELIVERY address */}
            {form.deliveryType === "DELIVERY" && (
              <input
                className="border rounded-lg p-2"
                placeholder="Delivery address"
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
                required
              />
            )}

            {/* PICKUP WhatsApp checkbox */}
            {form.deliveryType === "PICKUP" && (
              <div className="rounded-lg border p-3 space-y-2 bg-white">
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                  <input
                    type="checkbox"
                    checked={form.notifyWhenReady}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        notifyWhenReady: e.target.checked,
                      })
                    }
                  />
                  Notify me via WhatsApp when my order is ready
                </label>

                <p className="text-xs text-neutral-600">
                  Please enter your WhatsApp number in the phone field.
                </p>
              </div>
            )}

            <textarea
              className="border rounded-lg p-2"
              rows="3"
              placeholder="Order notes"
              value={form.notes}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
            />

            <Button type="submit" disabled={loading}>
              {loading ? "Placing order..." : "Checkout"}
            </Button>
          </form>
        </div>
      </div>

      {/* POPUP DIALOG */}
      {showDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="bg-white/20 backdrop-blur-xl border border-white/30 p-6 rounded-2xl shadow-2xl text-white max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-3">Order Placed!</h2>

            <p className="text-sm mb-3 text-white/90">Your reference number:</p>

            <div className="flex items-center justify-between bg-white/10 px-3 py-2 rounded-lg border border-white/20">
              <span className="font-mono">{reference}</span>

              <button
                onClick={() => navigator.clipboard.writeText(reference)}
                className="text-sm font-semibold text-yellow-200 hover:text-yellow-300"
              >
                Copy
              </button>
            </div>

            <p className="text-xs text-white/70 mt-2">
              Keep this number safe — you will need it to cancel your order.
            </p>

            <button
              onClick={() => setShowDialog(false)}
              className="w-full mt-4 py-2 rounded-lg bg-white/30 text-white backdrop-blur-lg font-semibold hover:bg-white/40"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* TRACK ORDER MODAL */}
      {showTrackModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => {
            setShowTrackModal(false);
            setTrackResult(null);
            setTrackError("");
          }}
        >
          <div
            className="bg-white/20 backdrop-blur-xl border border-white/30 p-6 rounded-2xl shadow-2xl text-white max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/70">Support</p>
                <h2 className="text-xl font-bold">Track Your Order</h2>
              </div>
              <button
                className="text-white/70 hover:text-white"
                onClick={() => {
                  setShowTrackModal(false);
                  setTrackResult(null);
                  setTrackError("");
                }}
              >
                ×
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleTrack}>
              <input
                className="w-full rounded-lg border border-white/40 bg-white/20 px-3 py-2 text-white placeholder:text-white/60"
                placeholder="Enter reference number"
                value={trackRef}
                onChange={(e) => setTrackRef(e.target.value)}
              />

              {trackError && (
                <div className="rounded-lg border border-red-300/60 bg-red-500/20 px-3 py-2 text-sm text-red-50">
                  {trackError}
                </div>
              )}

              {trackResult && (
                <div className="rounded-xl border border-white/30 bg-white/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/80">Status</p>
                    <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                      {trackResult.status}
                    </span>
                  </div>

                  {trackResult.deliveryType && (
                    <div className="flex items-center justify-between text-sm text-white/80">
                      <span>Type</span>
                      <span className="font-semibold">{trackResult.deliveryType}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-white/80">
                    <span>Placed on</span>
                    <span className="font-semibold">{formatDateTime(trackResult.createdAt)}</span>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={trackLoading} className="w-full justify-center">
                {trackLoading ? "Checking..." : "Check Status"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL ORDER MODAL */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => {
            setShowCancelModal(false);
            setCancelResult(null);
            setCancelError("");
          }}
        >
          <div
            className="bg-white/20 backdrop-blur-xl border border-white/30 p-6 rounded-2xl shadow-2xl text-white max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/70">Support</p>
                <h2 className="text-xl font-bold">Cancel Your Order</h2>
              </div>
              <button
                className="text-white/70 hover:text-white"
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelResult(null);
                  setCancelError("");
                }}
              >
                ×
              </button>
            </div>

            <form className="space-y-3" onSubmit={handleCancel}>
              <input
                className="w-full rounded-lg border border-white/40 bg-white/20 px-3 py-2 text-white placeholder:text-white/60"
                placeholder="Enter reference number"
                value={cancelRef}
                onChange={(e) => setCancelRef(e.target.value)}
              />

              {cancelError && (
                <div className="rounded-lg border border-red-300/60 bg-red-500/20 px-3 py-2 text-sm text-red-50">
                  {cancelError}
                </div>
              )}

              {cancelResult && (
                <div className="rounded-xl border border-white/30 bg-white/10 p-3 space-y-2 text-sm text-white/90">
                  <p className="font-semibold">Order cancelled successfully.</p>
                  {cancelResult?.fee && (
                    <p className="text-white/80">Cancellation fee: AED {cancelResult.fee}</p>
                  )}
                </div>
              )}

              <Button type="submit" disabled={cancelLoading} className="w-full justify-center">
                {cancelLoading ? "Cancelling..." : "Cancel Order"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
