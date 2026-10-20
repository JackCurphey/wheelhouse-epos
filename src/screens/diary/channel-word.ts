// How a message goes, in words: "by text", "by email", "by WhatsApp" (the
// messages engine sends each the customer's way; drawn as "by [text]").
const WORDS: Record<string, string> = { sms: 'text', email: 'email', whatsapp: 'WhatsApp' };
export function channelWord(channel: string | null | undefined): string {
  return WORDS[channel ?? 'sms'] ?? 'text';
}
