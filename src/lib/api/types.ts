/**
 * Response shapes, one definition per API shape. Each mirrors a serializer in
 * server/server.js - when the two disagree, the server is right and this file
 * is the bug.
 */

/** serializeWorkshopJob. The three `*State` fields are what screens drive
 * from; `status` is the derived legacy field kept for the old app. */
export type WorkshopJob = {
  id: number;
  title: string;
  customerId: number | null;
  customerName?: string | null;
  bikeId: number | null;
  bikeLabel?: string | null;
  mechanicId: number | null;
  mechanicName?: string | null;
  jobDate: string;
  startTime: string;
  endTime: string;
  status: string;
  reference: string;
  bookingState: string;
  custodyState: string;
  workState: string;
  /** Echoed on every action; see jobAction in client.ts. */
  version: number;
  notes: string | null;
  orderId: number | null;
  orderStatus: string | null;
  /** Totalled in SQL. No screen adds money up. */
  orderTotal: number | null;
  createdAt: string;
  updatedAt: string;
};

/** The body of every error response. `code` is sent on 409s only. */
export type ApiErrorBody = {
  error: string;
  code?: 'stale' | 'illegal';
};
