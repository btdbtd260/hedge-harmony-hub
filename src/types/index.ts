// === CLIENT ===
export type CustomerStatus = "pending" | "scheduled" | "completed" | "next_year";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  status: CustomerStatus;
  hidden: boolean;
  createdAt: string;
  activeYear: number;
}

// === ESTIMATION ===
export type CutType = "trim" | "levelling" | "restoration";
export type HeightMode = "global" | "per_side";

export interface EstimationExtra {
  id: string;
  description: string;
  price: number;
}

export type DiscountType = "percent" | "fixed";

export interface EstimationDiscount {
  id: string;
  description: string;
  type: DiscountType;
  /** percent: 0-100, fixed: dollar amount */
  value: number;
}

export interface Estimation {
  id: string;
  clientId: string;
  cutType: CutType;
  facadeLength: number;
  leftLength: number;
  rightLength: number;
  backLength: number;
  heightMode: HeightMode;
  heightGlobal: number;
  heightFacade: number;
  heightLeft: number;
  heightRight: number;
  heightBack: number;
  width: number;
  extras: EstimationExtra[];
  bushesCount: number;
  totalPrice: number;
  createdAt: string;
  pdfUrl?: string;
}

// === JOB ===
export type JobStatus = "pending" | "scheduled" | "completed" | "hidden";

export interface Job {
  id: string;
  clientId: string;
  estimationId: string;
  status: JobStatus;
  scheduledDate: string;
  startTime?: string;
  endTime?: string;
  totalDurationMinutes?: number;
  beforePhotos: string[];
  afterPhotos: string[];
  cutType: CutType;
  measurementSnapshot: {
    facadeLength: number;
    leftLength: number;
    rightLength: number;
    backLength: number;
    heightMode: HeightMode;
    heightGlobal: number;
    heightFacade: number;
    heightLeft: number;
    heightRight: number;
    heightBack: number;
    width: number;
  };
  estimatedProfit: number;
  realProfit?: number;
}

// === FACTURE (INVOICE) ===
export type InvoiceStatus = "unpaid" | "paid";

export interface Invoice {
  id: string;
  jobId: string;
  clientId: string;
  amount: number;
  status: InvoiceStatus;
  issuedAt: string;
  paidAt?: string;
  pdfUrl?: string;
}

// === EXPENSE ===
export type ExpenseCategory = "gas" | "insurance" | "equipment" | "other";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: string;
  receiptPhotoUrl?: string;
  createdAt: string;
}

// === EMPLOYEE ===
export interface Employee {
  id: string;
  name: string;
  hourlyRate: number;
  active: boolean;
}

export interface EmployeeJob {
  id: string;
  employeeId: string;
  jobId: string;
  hoursWorked: number;
  calculatedPay: number;
}

// === REMINDER ===
export type ReminderType = "client" | "maintenance";

export interface Reminder {
  id: string;
  type: ReminderType;
  referenceId?: string; // clientId if client reminder
  dueDate: string;
  description: string;
  isCompleted: boolean;
  notificationSent: boolean;
}

// === PARAMETERS ===
export interface Parameters {
  // Estimation
  pricePerFootTrim: number;
  pricePerFootLevelling: number;
  bushPrice: number;
  heightMultiplierThreshold: number;
  heightMultiplier: number;
  widthMultiplierThreshold: number;
  widthMultiplier: number;

  // Template
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  socialLinks: { platform: string; url: string }[];

  // Reminder
  maintenanceIntervalDays: number;
  reminderNotificationTime: string; // e.g. "08:00"

  // Finance
  splitRuleProfitExpense: number; // percentage
}
