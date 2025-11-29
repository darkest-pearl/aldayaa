export default function Button({ children, className = '', ...props }) {
  return (
    <button
      className={`bg-primary text-white px-4 py-2 rounded-full shadow hover:scale-105 transition-transform ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}