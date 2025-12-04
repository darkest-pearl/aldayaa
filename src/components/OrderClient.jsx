"use client";

import { useEffect, useMemo, useRef, useState } from "react"
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
  const [cartPulse, setCartPulse] = useState(false);

  const cartRef = useRef(null);

  useEffect(() => {
    if (!cartPulse) return;

    const timer = setTimeout(() => setCartPulse(false), 700);
    return () => clearTimeout(timer);
  }, [cartPulse]);

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

    setCartPulse(true);
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

  const handleScrollToCart = () => {
    if (cartRef.current) {
      cartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
    <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <button
          type="button"
          onClick={() => setShowTrackModal(true)}
          className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
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
          className="flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <div>
            <p className="text-sm text-amber-900/80">Change of plans?</p>
            <p className="text-lg font-semibold text-amber-900">Cancel Order</p>
          </div>
          <span className="text-amber-700 text-xl">→</span>
        </button>
      </div>
      <div className="flex flex-col gap-6 lg:gap-8">
        <div className="grid gap-6 md:grid-cols-2 md:items-start lg:grid-cols-[2fr,1fr]">
          {/* LEFT: MENU */}
          <div className="space-y-6">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="section-bg p-4 sm:p-5 rounded-2xl shadow-sm border border-neutral-200/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-xl mb-1 text-neutral-900">
                      {cat.name}
                    </h3>
                    <p className="text-sm text-textdark/70 mb-3">
                      {cat.description}
                    </p>
                  </div>
                <span className="hidden text-xs rounded-full bg-primary/10 text-primary px-3 py-1 sm:inline-flex items-center">
                    {cat.items.length} items
                  </span>
                </div>

        <div className="space-y-3">
                  {cat.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 rounded-xl border border-neutral-200/60 bg-white/70 p-3"
                    >
                      <div className="space-y-1">
                        <p className="font-semibold text-neutral-900">{item.name}</p>
                        <p className="text-sm text-textdark/70 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end">
                        <p className="font-semibold text-primary">
                          AED {item.price.toFixed(2)}
                        </p>

                        <Button
                          className="mt-auto text-sm px-4 py-2 min-h-[44px] w-full sm:w-auto focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60 hover:shadow-md"
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
          <div
            ref={cartRef}
            className={`section-bg p-4 sm:p-5 space-y-4 rounded-2xl border border-neutral-200/70 shadow-sm md:sticky md:top-4 ${
              cartPulse ? "ring-2 ring-primary/30" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-xl">Your Cart</h3>
              <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-medium">
                {cart.length} item{cart.length !== 1 ? "s" : ""}
              </span>
            </div>

            {cart.length === 0 ? (
              <p className="text-sm text-textdark/70">No items yet.</p>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="rounded-lg border border-neutral-200/70 p-3 bg-white/80">
                    <div className="flex justify-between gap-3">
                      <p className="font-semibold text-neutral-900">{item.name}</p>
                      <button
                        className="text-xs text-red-600 hover:text-red-700 focus-visible:outline-none focus-visible:underline"
                        onClick={() => removeItem(item.id)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="h-9 w-9 rounded-full border border-neutral-200 bg-white text-lg font-semibold shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                        >
                          -
                        </button>

                        <span className="px-2 text-sm font-medium">{item.quantity}</span>

                        <button
                          className="h-9 w-9 rounded-full border border-neutral-200 bg-white text-lg font-semibold shadow-sm transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>

                      <p className="font-semibold text-neutral-900">
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
                className="border rounded-lg p-3 bg-white/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <input
                className="border rounded-lg p-3 bg-white/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Phone number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />

              {/* delivery / pickup */}
              <div className="flex gap-2 text-sm">
                <label
                  className={`flex-1 text-center border rounded-full py-3 cursor-pointer transition shadow-sm ${
                    form.deliveryType === "DELIVERY"
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-white"
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
                  className={`flex-1 text-center border rounded-full py-3 cursor-pointer transition shadow-sm ${
                    form.deliveryType === "PICKUP"
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-white"
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
                  className="border rounded-lg p-3 bg-white/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Delivery address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
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
                  <p className="text-xs text-neutral-600">
                    You will receive a confirmation message when your order is ready for pickup.
                  </p>
                </div>
              )}

              <textarea
                className="border rounded-lg p-3 bg-white/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
                rows="3"
                placeholder="Order notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />

              <Button
                type="submit"
                disabled={loading}
                className="w-full justify-center min-h-[44px] text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60"
              >
                {loading ? "Placing order..." : "Checkout"}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Floating cart summary for mobile */}
      {cart.length > 0 && (
        <div className="md:hidden fixed inset-x-4 bottom-4 z-40">
          <div
            className={`flex items-center gap-3 rounded-2xl border border-primary/20 bg-white/95 px-4 py-3 shadow-lg backdrop-blur ${
              cartPulse ? "animate-pulse" : ""
            }`}
          >
            <div className="flex flex-1 items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Cart total</p>
                <p className="text-base font-bold text-primary">
                  AED {total.toFixed(2)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleScrollToCart}
              className="rounded-full bg-primary px-4 py-2 text-white text-sm font-semibold shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              View cart
            </button>
          </div>
        </div>
      )}

      {/* POPUP DIALOG */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          showDialog ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => showDialog && setShowDialog(false)}
      >
        <div
          className={`bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 transform transition-all duration-200 text-white ${
            showDialog ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
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
            Keep this number safe — you will need it to track your order.
          </p>

          <button
            onClick={() => setShowDialog(false)}
            className="w-full mt-4 py-2 rounded-lg bg-white/30 text-white backdrop-blur-lg font-semibold hover:bg-white/40 transition"
          >
            Close
          </button>
        </div>
      </div>
      {/* TRACK ORDER MODAL */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          showTrackModal ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => {
          if (!showTrackModal) return;
          setShowTrackModal(false);
          setTrackResult(null);
          setTrackError("");
        }}
      >
        <div
          className={`bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 transform transition-all duration-200 text-white ${
            showTrackModal ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
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
              className="w-full rounded-lg border border-neutral-200/80 bg-white/90 px-3 py-3 text-neutral-900 placeholder:text-neutral-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Enter reference number"
              value={trackRef}
              onChange={(e) => setTrackRef(e.target.value)}
            />

            {trackResult && (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-3 space-y-2 text-sm text-emerald-900 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm">Status</p>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    {trackResult.status}
                  </span>
              </div>
            {trackResult.deliveryType && (
                  <div className="flex items-center justify-between text-sm">
                    <span>Type</span>
                    <span className="font-semibold">{trackResult.deliveryType}</span>
                  </div>
            )}

                  <div className="flex items-center justify-between text-sm">
                  <span>Placed on</span>
                  <span className="font-semibold">{formatDateTime(trackResult.createdAt)}</span>
                </div>
              </div>
            )}

              <Button
              type="submit"
              disabled={trackLoading}
              className="w-full justify-center shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60"
            >
              {trackLoading ? "Checking..." : "Check Status"}
            </Button>
          </form>
        </div>
      </div>

      {/* CANCEL ORDER MODAL */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
          showCancelModal ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => {
          if (!showCancelModal) return;
          setShowCancelModal(false);
          setCancelResult(null);
          setCancelError("");
        }}
      >
        <div
          className={`bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 transform transition-all duration-200 text-white ${
            showCancelModal ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
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
              className="w-full rounded-lg border border-neutral-200/80 bg-white/90 px-3 py-3 text-neutral-900 placeholder:text-neutral-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Enter reference number"
              value={cancelRef}
              onChange={(e) => setCancelRef(e.target.value)}
            />

            {cancelError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 shadow-sm">
                {cancelError}
              </div>
            )}

            {cancelResult && (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-3 space-y-2 text-sm text-emerald-900 shadow-sm">
                <p className="font-semibold">Order cancelled successfully.</p>
                {cancelResult?.fee && (
                  <p className="text-emerald-800">Cancellation fee: AED {cancelResult.fee}</p>
                )}
              </div>
            )}

              <Button
              type="submit"
              disabled={cancelLoading}
              className="w-full justify-center shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60"
            >
              {cancelLoading ? "Cancelling..." : "Cancel Order"}
            </Button>
          </form>
          </div>
        </div>
      
    </>
  );
}
