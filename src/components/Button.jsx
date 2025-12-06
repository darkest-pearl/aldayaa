export default function Button({ children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-secondary shadow-soft transition duration-200 ease-gentle hover:-translate-y-0.5 hover:shadow-lifted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}