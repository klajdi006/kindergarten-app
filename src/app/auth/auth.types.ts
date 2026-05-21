export type UserRole = 'admin' | 'parent' | 'employee';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole | null;
}

export interface UserDoc {
  email: string;
  displayName: string | null;
  role: UserRole;
  kindergartenId: string | null;
  staffRecordId: string | null;
  createdAt: number;
}
