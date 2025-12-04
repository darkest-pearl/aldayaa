"use client";

import { useState } from "react";

export default function OrderClient({ categories }) {
  const [cart, setCart] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    deliveryType: "PICKUP",
    address: "",
    notes: "",
  });

  const setAddress = (value) => {
    setForm((prev) => ({ ...prev, address: value }));
  };

  const handleDeliveryTypeChange = (value) => {
    setForm((prev) => ({
      ...prev,
      deliveryType: value,
      address: value === "PICKUP" ? "" : prev.address,
    }));
  };
  
  const [loading, setLoading] = useState(false);

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [reference, setReference] = useState("");

  // Add item to cart
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === item.id);
      if (existing) {
        return prev.map((x) =>
          x.id === item.id
            ? { ...x, quantity: x.quantity + 1 }
            : x
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  // Submit Order
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

      // Set reference number from backend
      const ref = data?.data?.reference;
      setReference(ref || "(missing reference)");
      setShowDialog(true);

      // Reset form + cart
      setCart([]);
      setForm({
        name: "",
        phone: "",
        deliveryType: "PICKUP",
        address: "",
        notes: "",
      });

    } catch (err) {
      setLoading(false);
      alert("Order failed. Please check your connection.");
    }
  };

  return (
    <>
      {/* MENU + FORM */}
      <div className="grid md:grid-cols-2 gap-8">

        {/* MENU */}
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat.id}>
              <h2 className="text-xl font-semibold mb-3">{cat.name}</h2>

              <div className="space-y-4">
                {cat.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        AED {item.price.toFixed(2)}
                      </p>
                    </div>

                    <button
                      className="px-3 py-1 rounded-lg bg-primary text-white text-sm"
                      onClick={() => addToCart(item)}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CART + FORM */}
        <form onSubmit={submitOrder} className="p-6 border rounded-xl space-y-4">
          <h2 className="text-xl font-semibold">Your Order</h2>

          {cart.length === 0 && (
            <p className="text-gray-500">Your cart is empty.</p>
          )}

          {cart.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-center border-b py-2"
            >
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>AED {(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}

          {cart.length > 0 && (
            <>
              <div className="space-y-3">
                <input
                  required
                  className="w-full p-2 border rounded-lg"
                  placeholder="Your Name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />

                <input
                  required
                  className="w-full p-2 border rounded-lg"
                  placeholder="Phone Number"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                />

                <select
                  className="w-full p-2 border rounded-lg"
                  value={form.deliveryType}
                  onChange={(e) => handleDeliveryTypeChange(e.target.value)}
                >
                  <option value="PICKUP">Pickup</option>
                  <option value="DELIVERY">Delivery</option>
                </select>

                {form.deliveryType === "DELIVERY" && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-neutral-700">
                      Delivery Address
                    </label>
                    <input
                      required
                      className="w-full p-2 border rounded-lg"
                      placeholder="e.g. Al Nahda 2, Building 14, Apartment 202"
                      value={form.address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                )}

                <textarea
                  className="w-full p-2 border rounded-lg"
                  placeholder="Notes (optional)"
                  rows={2}
                  value={form.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value })
                  }
                />
              </div>

              <button
                disabled={loading}
                className="w-full py-2 rounded-lg bg-primary text-white font-semibold"
              >
                {loading ? "Placing Order..." : "Place Order"}
              </button>
            </>
          )}
        </form>
      </div>

      {/* GLASSMORPHISM DIALOG */}
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
    </>
  );
}
