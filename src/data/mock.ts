import { Customer, Job, Quote, Invoice, CrewMember } from "@/types";

export const customers: Customer[] = [
  { id: "c1", name: "Martin Gagnon", phone: "514-555-1234", email: "martin@email.com", address: "123 Rue Principale, Laval", status: "scheduled", hidden: false, createdAt: "2025-03-10", activeYear: 2026 },
  { id: "c2", name: "Sophie Tremblay", phone: "514-555-5678", email: "sophie@email.com", address: "456 Boul. des Laurentides, Rosemère", status: "completed", hidden: false, createdAt: "2025-04-15", activeYear: 2026 },
  { id: "c3", name: "Pierre Lavoie", phone: "450-555-9012", email: "pierre@email.com", address: "789 Ch. du Lac, Blainville", status: "pending", hidden: false, createdAt: "2025-05-01", activeYear: 2026 },
  { id: "c4", name: "Julie Bouchard", phone: "450-555-3456", email: "julie@email.com", address: "321 Rue du Parc, Terrebonne", status: "pending", hidden: false, createdAt: "2025-06-12", activeYear: 2026 },
  { id: "c5", name: "André Roy", phone: "514-555-7890", email: "andre@email.com", address: "654 Ave des Pins, Boisbriand", status: "next_year", hidden: false, createdAt: "2025-02-20", activeYear: 2027 },
];

export const crewMembers: CrewMember[] = [
  { id: "cr1", name: "Luc Bélanger", phone: "514-555-1111", role: "Lead Trimmer", active: true },
  { id: "cr2", name: "Marc Dubois", phone: "514-555-2222", role: "Trimmer", active: true },
  { id: "cr3", name: "Jean Côté", phone: "450-555-3333", role: "Driver / Helper", active: true },
  { id: "cr4", name: "Éric Fortin", phone: "450-555-4444", role: "Trimmer", active: false },
];

export const jobs: Job[] = [
  { id: "j1", customerId: "c1", customerName: "Martin Gagnon", address: "123 Rue Principale, Laval", crewId: "cr1", crewName: "Luc Bélanger", serviceType: "Trim", status: "scheduled", scheduledDate: "2026-02-18", notes: "Large backyard hedge" },
  { id: "j2", customerId: "c2", customerName: "Sophie Tremblay", address: "456 Boul. des Laurentides, Rosemère", crewId: "cr1", crewName: "Luc Bélanger", serviceType: "Levelling", status: "completed", scheduledDate: "2026-02-10", startTime: "09:00", endTime: "11:30", notes: "" },
  { id: "j3", customerId: "c3", customerName: "Pierre Lavoie", address: "789 Ch. du Lac, Blainville", crewId: "cr2", crewName: "Marc Dubois", serviceType: "Trim", status: "scheduled", scheduledDate: "2026-02-20", notes: "Front and sides only" },
  { id: "j4", customerId: "c4", customerName: "Julie Bouchard", address: "321 Rue du Parc, Terrebonne", crewId: "cr3", crewName: "Jean Côté", serviceType: "Trim", status: "in_progress", scheduledDate: "2026-02-16", startTime: "08:00", notes: "Customer prefers morning" },
];

export const quotes: Quote[] = [
  { id: "q1", customerId: "c1", customerName: "Martin Gagnon", status: "accepted", items: [{ description: "Cedar hedge trim – front & back", quantity: 1, unitPrice: 350 }], total: 350, createdAt: "2026-02-01" },
  { id: "q2", customerId: "c3", customerName: "Pierre Lavoie", status: "sent", items: [{ description: "Cedar hedge trim – front & sides", quantity: 1, unitPrice: 275 }, { description: "Bush trimming x3", quantity: 3, unitPrice: 40 }], total: 395, createdAt: "2026-02-05" },
  { id: "q3", customerId: "c4", customerName: "Julie Bouchard", status: "draft", items: [{ description: "Full perimeter trim", quantity: 1, unitPrice: 500 }], total: 500, createdAt: "2026-02-14" },
];

export const invoices: Invoice[] = [
  { id: "i1", jobId: "j2", customerId: "c2", customerName: "Sophie Tremblay", status: "paid", amount: 320, issuedAt: "2026-02-10", paidAt: "2026-02-12" },
  { id: "i2", jobId: "j1", customerId: "c1", customerName: "Martin Gagnon", status: "unpaid", amount: 350, issuedAt: "2026-02-15" },
];
