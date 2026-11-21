export type Role = "admin" | "teacher" | "student" | "parent";
export type CardState = "active" | "suspended" | "revoked" | "replaced" | "expired";

export interface CardTemplate {
  schoolName: string; address: string; phone: string; email: string; primaryColor: string; accentColor: string;
  footerText: string; backText: string; cardPrefix: string; validityMonths: number;
  show: { photo: boolean; number: boolean; classInfo: boolean; session: boolean; issueDate: boolean; expiry: boolean };
  logoKey: string | null;
}

export interface CardFace {
  cardId: string | null; userId: string; cardNumber: string; role: Role; name: string; idLabel: string; idValue: string;
  line1: string | null; line2: string | null; issuedAt: string; expiresAt: string | null; state: CardState | "preview";
  hasPhoto: boolean; avatarVersion: number | null; qr: string;
}

export interface PersonRow {
  id: string; role: Role; name: string; accountStatus: string; admissionNumber: string | null; staffNumber: string | null; className: string | null;
  avatarVersion: number | null; cardId: string | null; cardNumber: string | null; cardState: CardState | "none"; issuedAt: string | null; expiresAt: string | null;
}
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }

export interface HistoryRow {
  id: string; cardNumber: string; category: Role; state: CardState; issuedAt: string; expiresAt: string | null; revokedAt: string | null; revokeReason: string | null;
  userId: string; userName: string; issuedBy: string | null; revokedBy: string | null; scans: number;
}
