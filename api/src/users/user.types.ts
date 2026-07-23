export type ConsentSettings = {
  dataExchange: boolean;
  tracking: boolean;
  updatedAt: string;
};

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  consent: ConsentSettings | null;
  createdAt: string;
};

export type PublicUser = Pick<User, 'id' | 'email'>;
