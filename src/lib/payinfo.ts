/**
 * Payment instructions shown during onboarding.
 * Replace these placeholders with Jasper's real details before launch.
 */
export const PAYMENT_INFO = {
  gcash: {
    label: "GCash",
    image: "/payments/gcash.jpg",
    note: "Open GCash and scan the QR code or pay to the number shown on the image.",
  },
  bdo: {
    label: "BDO",
    image: "/payments/bdo.jpg",
    note: "Pay via BDO and keep your reference number for the proof.",
  },
  gotyme: {
    label: "GoTyme",
    image: "/payments/gotyme.jpg",
    note: "Pay via GoTyme and keep your reference number for the proof.",
  },
} as const;

export const PAYMENT_METHODS = ["GCash", "BDO", "GoTyme"] as const;

export function paymentInfo(method: string) {
  if (method === "BDO") return PAYMENT_INFO.bdo;
  if (method === "GoTyme") return PAYMENT_INFO.gotyme;
  return PAYMENT_INFO.gcash;
}
