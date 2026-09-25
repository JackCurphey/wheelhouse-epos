// Bookable services for the booking-route tests. The old route took a job type
// ('quick', 'repair', 'service'); it now takes a workshop_services id, so a
// test seeds three services with those lengths and looks the id up by name.
import { runWithShop, prepare } from '../../server/db.js';

const TYPES = { quick: 30, repair: 60, service: 120 };

export async function seedJobTypes(shopId) {
  return runWithShop(shopId, async () => {
    const ids = {};
    for (const [name, minutes] of Object.entries(TYPES)) {
      const { lastInsertRowid } = await prepare(
        "INSERT INTO workshop_services (name, price, minutes, bookable_online, active, updated_at) VALUES (?, 10, ?, 1, 1, now())"
      ).run(`Test ${name}`, minutes);
      ids[name] = lastInsertRowid;
    }
    return ids;
  });
}

// The fields the details screen now makes required on every booking.
export const BOOKING_CONTACT = { email: 'booker@example.com', updateChannel: 'email', termsAccepted: true };
