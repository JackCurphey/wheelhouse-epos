// The booking request's own fields (book screen 05, `details`), checked before
// anything is written. Pure: no database, no request object. The route calls it
// before it creates a guest customer, so a bad request leaves nothing behind.
// Spec: docs/superpowers/specs/2026-09-25-book-server-3-booking-request-design.md

export const UPDATE_CHANNELS = ['email', 'sms', 'whatsapp'];

const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+$/.test(s);

// `phone` is the guest phone or the signed-in customer's phone as sent; the
// channel rule needs to know whether there is one.
export function parseBookingRequest(body, phone = '') {
  const notSure = body.notSure === true;
  const hasService = body.serviceId !== undefined && body.serviceId !== null;
  if (notSure && hasService) return { error: 'Choose one service, or "not sure" - not both' };
  if (!notSure && !hasService) return { error: 'Please choose a service, or "not sure"' };
  if (hasService && !(Number.isInteger(body.serviceId) && body.serviceId > 0)) {
    return { error: 'That service is not available to book' };
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
      serviceId: hasService ? body.serviceId : null,
      notSure,
      email,
      updateChannel: body.updateChannel,
      termsAccepted: true,
      marketingPermission: body.marketingPermission === true,
    },
  };
}
