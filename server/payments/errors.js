// A payment the provider refused or couldn't find (openspec/changes/deposit-payments design 1).
export class PaymentError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
