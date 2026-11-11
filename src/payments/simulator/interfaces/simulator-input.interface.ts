export interface CardConfirmation {
  clientSecret: string;
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
}

export interface CardAuthentication {
  clientSecret: string;
  approve: boolean;
}
