import { WhatsAppIcon } from "@/components/whatsapp-icon";

const WHATSAPP_LINK = "https://wa.me/2347087950366";

export function FloatingWhatsApp() {
  return (
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with HypeData support on WhatsApp"
      className="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)] transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-110 hover:shadow-[0_12px_28px_rgba(37,211,102,0.55)] active:scale-95"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}
