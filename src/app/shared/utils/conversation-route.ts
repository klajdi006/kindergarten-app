/** True when the URL is a conversation detail page (e.g. /admin/messages/abc123). */
export function isConversationDetailUrl(url: string): boolean {
  return /\/messages\/[^/?#]+/.test(url);
}
