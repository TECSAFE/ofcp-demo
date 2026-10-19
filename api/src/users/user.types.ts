export type ConsentSettings = {
  version?: 'v1' | 'v2' | 'v3';
  nativeTracking?: boolean;
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
