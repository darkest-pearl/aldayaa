"use client";

import { useState, useMemo } from "react";
import Button from "./Button";

export default function OrderClient({ categories }) {
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    deliveryType: "DELIVERY",
    address: "",
    notes: ""
  });

  const [loading, setLoading] = useState(false);

  // dialog popup state
  const [showDialog, setShowDialog] = useState(false);
  const [reference, setReference] = useState("");

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
        item.id === id
          ? { ...item, quantity: Math.max(1, qty) }
          : item
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
        body: JSON.stringify({ ...form, items: cart, paidOnline: false })
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

      // reset cart + form
      setCart([]);
      setForm({
        name: "",
        phone: "",
        deliveryType: "DELIVERY",
        address: "",
        notes: ""
      });
    } catch (err) {
      setLoading(false);
      alert("Order failed. Check your connection.");
    }
  };

  return (
    <>
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

        {/* RIGHT: CART */}
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
                    setForm({ ...form, deliveryType: "DELIVERY" })
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
                    setForm({ ...form, deliveryType: "PICKUP" })
                  }
                />
                Pickup
              </label>
            </div>

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

      {/* GLASSMORPHISM POPUP DIALOG */}
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

            <p className="text-sm mb-3 text-white/90">
              Your reference number:
            </p>

            <div className="flex items-center justify-between bg-white/10 px-3 py-2 rounded-lg border border-white/20">
              <span className="font-mono">{reference}</span>

              <button
                onClick={() =>
                  navigator.clipboard.writeText(reference)
                }
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
    </>
  );
}
