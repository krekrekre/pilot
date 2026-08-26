/**
 * Top-down airliner mark. Inherits colour from the parent via currentColor,
 * so it picks up brand-500 from the link that wraps it.
 */
export default function Logo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 1.5c.9 0 1.4 1.7 1.4 3.7v3.4l8.9 6v1.8l-8.9-3v4.8l3 2.2v1.2L12 20.4l-4.4 1.2v-1.2l3-2.2v-4.8l-8.9 3v-1.8l8.9-6V5.2c0-2 .5-3.7 1.4-3.7Z" />
    </svg>
  );
}
