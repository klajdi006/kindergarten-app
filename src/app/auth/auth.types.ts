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
  /**
   * Per-device FCM token map. Key is a stable per-device id stored in
   * localStorage; value is the current FCM registration token for that device.
   * Re-registering on the same device overwrites its entry rather than appending.
   */
  fcmTokens?: Record<string, string>;
  createdAt: number;
}
