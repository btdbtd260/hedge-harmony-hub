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

export type JobStatus = "scheduled" | "in_progress" | "completed";

export interface Job {
  id: string;
  customerId: string;
  customerName: string;
  address: string;
  crewId: string;
  crewName: string;
  serviceType: string;
  status: JobStatus;
  scheduledDate: string;
  startTime?: string;
  endTime?: string;
  notes: string;
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "declined";
export type InvoiceStatus = "unpaid" | "paid";

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  customerId: string;
  customerName: string;
  status: QuoteStatus;
  items: QuoteLineItem[];
  total: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  jobId: string;
  customerId: string;
  customerName: string;
  status: InvoiceStatus;
  amount: number;
  issuedAt: string;
  paidAt?: string;
}

export interface CrewMember {
  id: string;
  name: string;
  phone: string;
  role: string;
  active: boolean;
}
