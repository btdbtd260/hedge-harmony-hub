import type {
  Customer, Estimation, Job, Invoice, Expense,
  Employee, EmployeeJob, Reminder, Parameters,
} from "@/types";

// === PARAMETERS (heart of the system) ===
export const parameters: Parameters = {
  pricePerFootTrim: 4.5,
  pricePerFootLevelling: 6,
  bushPrice: 40,
  heightMultiplierThreshold: 5,
  heightMultiplier: 1.5,
  widthMultiplierThreshold: 3,
  widthMultiplier: 1.3,
  companyName: "HedgePro",
  companyAddress: "123 Rue des Cèdres, Laval, QC",
  companyPhone: "514-555-0000",
  companyEmail: "info@hedgepro.ca",
  socialLinks: [{ platform: "Facebook", url: "https://facebook.com/hedgepro" }],
  maintenanceIntervalDays: 90,
  reminderNotificationTime: "08:00",
  splitRuleProfitExpense: 70,
};

// === CUSTOMERS ===
export const customers: Customer[] = [
  { id: "c1", name: "Martin Gagnon", phone: "514-555-1234", email: "martin@email.com", address: "123 Rue Principale, Laval", status: "scheduled", hidden: false, createdAt: "2025-03-10", activeYear: 2026 },
  { id: "c2", name: "Sophie Tremblay", phone: "514-555-5678", email: "sophie@email.com", address: "456 Boul. des Laurentides, Rosemère", status: "completed", hidden: false, createdAt: "2025-04-15", activeYear: 2026 },
  { id: "c3", name: "Pierre Lavoie", phone: "450-555-9012", email: "pierre@email.com", address: "789 Ch. du Lac, Blainville", status: "pending", hidden: false, createdAt: "2025-05-01", activeYear: 2026 },
  { id: "c4", name: "Julie Bouchard", phone: "450-555-3456", email: "julie@email.com", address: "321 Rue du Parc, Terrebonne", status: "pending", hidden: false, createdAt: "2025-06-12", activeYear: 2026 },
  { id: "c5", name: "André Roy", phone: "514-555-7890", email: "andre@email.com", address: "654 Ave des Pins, Boisbriand", status: "next_year", hidden: false, createdAt: "2025-02-20", activeYear: 2027 },
];

// === ESTIMATIONS ===
export const estimations: Estimation[] = [
  {
    id: "e1", clientId: "c1", cutType: "trim",
    facadeLength: 40, leftLength: 25, rightLength: 25, backLength: 30,
    heightMode: "global", heightGlobal: 4, heightFacade: 0, heightLeft: 0, heightRight: 0, heightBack: 0,
    width: 2,
    extras: [], bushesCount: 0,
    totalPrice: 540, createdAt: "2026-02-01",
  },
  {
    id: "e2", clientId: "c3", cutType: "trim",
    facadeLength: 30, leftLength: 20, rightLength: 20, backLength: 0,
    heightMode: "global", heightGlobal: 6, heightFacade: 0, heightLeft: 0, heightRight: 0, heightBack: 0,
    width: 2,
    extras: [{ id: "ex1", description: "Nettoyage", price: 50 }], bushesCount: 3,
    totalPrice: 642.5, createdAt: "2026-02-05",
  },
  {
    id: "e3", clientId: "c4", cutType: "levelling",
    facadeLength: 50, leftLength: 30, rightLength: 30, backLength: 40,
    heightMode: "per_side", heightGlobal: 0, heightFacade: 5, heightLeft: 4, heightRight: 4, heightBack: 6,
    width: 3,
    extras: [], bushesCount: 0,
    totalPrice: 900, createdAt: "2026-02-14",
  },
];

// === JOBS ===
export const jobs: Job[] = [
  {
    id: "j1", clientId: "c1", estimationId: "e1", status: "scheduled",
    scheduledDate: "2026-02-18", beforePhotos: [], afterPhotos: [],
    cutType: "trim",
    measurementSnapshot: { facadeLength: 40, leftLength: 25, rightLength: 25, backLength: 30, heightMode: "global", heightGlobal: 4, heightFacade: 0, heightLeft: 0, heightRight: 0, heightBack: 0, width: 2 },
    estimatedProfit: 540,
  },
  {
    id: "j2", clientId: "c2", estimationId: "e1", status: "completed",
    scheduledDate: "2026-02-10", startTime: "09:00", endTime: "11:30", totalDurationMinutes: 150,
    beforePhotos: [], afterPhotos: [],
    cutType: "levelling",
    measurementSnapshot: { facadeLength: 35, leftLength: 20, rightLength: 20, backLength: 25, heightMode: "global", heightGlobal: 5, heightFacade: 0, heightLeft: 0, heightRight: 0, heightBack: 0, width: 2 },
    estimatedProfit: 320, realProfit: 320,
  },
  {
    id: "j3", clientId: "c3", estimationId: "e2", status: "scheduled",
    scheduledDate: "2026-02-20", beforePhotos: [], afterPhotos: [],
    cutType: "trim",
    measurementSnapshot: { facadeLength: 30, leftLength: 20, rightLength: 20, backLength: 0, heightMode: "global", heightGlobal: 6, heightFacade: 0, heightLeft: 0, heightRight: 0, heightBack: 0, width: 2 },
    estimatedProfit: 642.5,
  },
  {
    id: "j4", clientId: "c4", estimationId: "e3", status: "pending",
    scheduledDate: "2026-02-25", beforePhotos: [], afterPhotos: [],
    cutType: "levelling",
    measurementSnapshot: { facadeLength: 50, leftLength: 30, rightLength: 30, backLength: 40, heightMode: "per_side", heightGlobal: 0, heightFacade: 5, heightLeft: 4, heightRight: 4, heightBack: 6, width: 3 },
    estimatedProfit: 900,
  },
];

// === INVOICES ===
export const invoices: Invoice[] = [
  { id: "i1", jobId: "j2", clientId: "c2", amount: 320, status: "paid", issuedAt: "2026-02-10", paidAt: "2026-02-12" },
  { id: "i2", jobId: "j1", clientId: "c1", amount: 540, status: "unpaid", issuedAt: "2026-02-15" },
  { id: "i3", jobId: "j3", clientId: "c3", amount: 642.5, status: "unpaid", issuedAt: "2026-02-18" },
];

// === EXPENSES ===
export const expenses: Expense[] = [
  { id: "exp1", category: "gas", amount: 85, description: "Essence camion", date: "2026-02-05", createdAt: "2026-02-05" },
  { id: "exp2", category: "equipment", amount: 250, description: "Nouvelle taille-haie", date: "2026-02-08", createdAt: "2026-02-08" },
  { id: "exp3", category: "insurance", amount: 400, description: "Assurance mensuelle", date: "2026-02-01", createdAt: "2026-02-01" },
];

// === EMPLOYEES ===
export const employees: Employee[] = [
  { id: "emp1", name: "Luc Bélanger", hourlyRate: 22, active: true },
  { id: "emp2", name: "Marc Dubois", hourlyRate: 20, active: true },
  { id: "emp3", name: "Jean Côté", hourlyRate: 18, active: true },
  { id: "emp4", name: "Éric Fortin", hourlyRate: 20, active: false },
];

export const employeeJobs: EmployeeJob[] = [
  { id: "ej1", employeeId: "emp1", jobId: "j2", hoursWorked: 2.5, calculatedPay: 55 },
  { id: "ej2", employeeId: "emp2", jobId: "j2", hoursWorked: 2.5, calculatedPay: 50 },
];

// === REMINDERS ===
export const reminders: Reminder[] = [
  { id: "r1", type: "client", referenceId: "c3", dueDate: "2026-02-20", description: "Suivre estimation Pierre Lavoie", isCompleted: false, notificationSent: false },
  { id: "r2", type: "client", referenceId: "c4", dueDate: "2026-02-22", description: "Suivre estimation Julie Bouchard", isCompleted: false, notificationSent: false },
  { id: "r3", type: "maintenance", dueDate: "2026-03-01", description: "Entretien taille-haie", isCompleted: false, notificationSent: false },
];

// === HELPERS ===
export function getClientById(id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}

export function getClientName(id: string): string {
  return getClientById(id)?.name ?? "Client inconnu";
}
