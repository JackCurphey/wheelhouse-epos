import { poundsText } from '../../lib/money.ts';
/** "£13.00": a deposit in pence as the booking pages show it (deposit-pay-screen, deposit-refund-pages). */
export const pounds = (pence: number) => poundsText(pence / 100);
