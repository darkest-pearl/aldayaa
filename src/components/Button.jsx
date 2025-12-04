export default function Button({ children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center bg-primary text-white px-4 py-2 rounded-full shadow transition-transform transition-shadow duration-200 hover:scale-105 hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}