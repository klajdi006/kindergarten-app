import { OperatingHours } from '@app/data/schedule';

export type Id = string;

export interface Kindergarten {
  id: Id;
  name: string;
  address: string | null;
  operatingHours?: OperatingHours;
  createdByUid: Id;
  createdAt: number;
}

export type StaffRole = 'admin' | 'employee';

export interface Staff {
  id: Id;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  departmentIds: Id[];
  allDepartments: boolean;
  kindergartenId: Id;
  claimedByUid: Id | null;
  lastSeenPostsAt?: number;
  lastSeenSickAt?: number;
  seenPostIds?: Id[];
  createdAt: number;
}

export interface Department {
  id: Id;
  name: string;
  ageMin: number;
  ageMax: number;
  kindergartenId: Id;
  createdAt: number;
}

export type ChildGender = 'male' | 'female';

export interface Child {
  id: Id;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: ChildGender;
  departmentId: Id | null;
  parentIds: Id[];
  kindergartenId: Id;
  createdAt: number;
}

export interface Parent {
  id: Id;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  childIds: Id[];
  claimedByUid: Id | null;
  kindergartenId: Id;
  lastSeenPostsAt?: number;
  seenPostIds?: Id[];
  createdAt: number;
}

export interface ChildDocument {
  id: Id;
  childId: Id;
  kindergartenId: Id;
  name: string;
  url: string;
  path: string;
  /** Auth uids of the child's claimed parents — denormalized for the read rule. */
  allowedParentUids: Id[];
  uploadedByUid: Id;
  uploadedAt: number;
}

export type AbsenceType = 'sick' | 'holiday';

export interface Absence {
  id: Id;
  childId: Id;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  note: string | null;
  kindergartenId: Id;
  createdByUid: Id;
  createdAt: number;
}

export interface Album {
  id: Id;
  name: string;
  departmentId: Id;
  kindergartenId: Id;
  photoCount: number;
  createdByUid?: Id;
  createdAt: number;
}

export interface Photo {
  id: Id;
  albumId: Id;
  storagePath: string;
  downloadUrl: string;
  kindergartenId: Id;
  uploadedByUid: Id;
  uploadedAt: number;
}

export interface PostAttachment {
  name: string;
  url: string;
  path: string;
}

export interface Post {
  id: Id;
  title: string;
  description: string;
  departmentId: Id | null;
  imageUrls: string[];
  /** Storage paths parallel to imageUrls, for cleanup on delete. */
  imagePaths?: string[];
  /** Non-image file attachments shown as download links. */
  attachments?: PostAttachment[];
  kindergartenId: Id;
  authorUid: Id;
  authorName: string | null;
  createdAt: number;
  updatedAt: number;
}

export type ConversationRole = 'admin' | 'employee' | 'parent';

export interface Conversation {
  id: Id;
  kindergartenId: Id;
  participantIds: Id[];
  participantNames: Record<Id, string>;
  participantRoles: Record<Id, ConversationRole>;
  isGroup: boolean;
  title: string | null;
  lastMessage: string | null;
  lastMessageAt: number;
  lastMessageAuthorUid: Id | null;
  lastReadAt?: Record<Id, number>;
  createdAt: number;
  createdByUid: Id;
}

export interface Message {
  id: Id;
  authorUid: Id;
  authorName: string | null;
  text: string;
  createdAt: number;
}
