/** "£13.00": a deposit in pence as the booking pages show it (deposit-pay-screen, deposit-refund-pages). */
export const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
