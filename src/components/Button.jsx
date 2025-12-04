export default function Button({ children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center bg-primary text-white px-4 py-2 rounded-full shadow hover:scale-105 transition-transform ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}