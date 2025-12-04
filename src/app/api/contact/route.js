import { failure, success } from "../../../lib/api-response";
import { sendWhatsAppMessage } from "../../../lib/whatsapp";
import { strings } from "../../../lib/strings";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getRecipientPhone() {
  const configured =
    process.env.CONTACT_WHATSAPP_TO ||
    process.env.ADMIN_WHATSAPP_TO ||
    process.env.WHATSAPP_RECIPIENT;

  if (configured) return configured;

  if (strings?.whatsapp) {
    return strings.whatsapp.replace(/[^\d+]/g, "");
  }

  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = (body?.name || "").trim();
    const email = (body?.email || "").trim();
    const message = (body?.message || "").trim();

    if (!name || !message) {
      return failure("Name and message are required", 400);
    }

    if (email && !emailRegex.test(email)) {
      return failure("Please provide a valid email", 400);
    }

    const recipientPhone = getRecipientPhone();

    if (!recipientPhone) {
      return failure("Messaging is not configured", 500);
    }

    const text = `New contact message from ${name}\nEmail: ${email || "Not provided"}\nMessage:\n${message}`;

    await sendWhatsAppMessage(recipientPhone, text);

    return success({});
  } catch (error) {
    console.error("Failed to handle contact message", error);
    return failure("Unable to send message", 500);
  }
}