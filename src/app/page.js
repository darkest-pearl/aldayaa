import { redirect } from "next/navigation";

/**
 * Root route handler that forwards visitors to the public landing page.
 * Ensures the app always starts from the customer-facing experience.
 */
export default function Home() {
  redirect("/public");
}