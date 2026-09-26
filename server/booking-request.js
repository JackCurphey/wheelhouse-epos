// The booking request's own fields (book screen 05, `details`), checked before
// anything is written. Pure: no database, no request object. The route calls it
// before it creates a guest customer, so a bad request leaves nothing behind.
// A booking can hold several services (1-10, distinct) or "not sure" alone.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md
// Spec (several services): docs/superpowers/specs/2026-09-26-book-server-7-multiple-services-design.md

export const UPDATE_CHANNELS = ['email', 'sms', 'whatsapp'];
export const MAX_SERVICES = 10;

const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+$/.test(s);

// `phone` is the guest phone or the signed-in customer's phone as sent; the
// channel rule needs to know whether there is one.
export function parseBookingRequest(body, phone = '') {
  const notSure = body.notSure === true;
  const hasServices = body.serviceIds !== undefined && body.serviceIds !== null;
  if (notSure && hasServices) return { error: 'Choose services, or "not sure" - not both' };
  if (!notSure && !hasServices) return { error: 'Please choose a service, or "not sure"' };
  if (hasServices) {
    const ids = body.serviceIds;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => Number.isInteger(id) && id > 0)) {
      return { error: 'That service is not available to book' };
    }
    if (ids.length > MAX_SERVICES) return { error: 'Please choose up to 10 services' };
    if (new Set(ids).size !== ids.length) return { error: 'Each service can be chosen only once' };
  }

  if (!UPDATE_CHANNELS.includes(body.updateChannel)) {
    return { error: "Please choose how you'd like to hear from us" };
  }
  const email = (typeof body.email === 'string' ? body.email : '').trim();
  if (email && !looksLikeEmail(email)) return { error: 'Please enter a valid email address' };
  if (body.updateChannel === 'email' && !email) {
    return { error: 'Please enter your email address so we can email you updates' };
  }
  if (body.updateChannel !== 'email' && !String(phone || '').trim()) {
    return { error: 'Please enter your phone number so we can message you updates' };
  }

  if (body.termsAccepted !== true) return { error: 'Please accept the terms to book' };

  return {
    value: {
      serviceIds: hasServices ? [...body.serviceIds] : [],
      notSure,
      email,
      updateChannel: body.updateChannel,
      termsAccepted: true,
      marketingPermission: body.marketingPermission === true,
    },
  };
}
