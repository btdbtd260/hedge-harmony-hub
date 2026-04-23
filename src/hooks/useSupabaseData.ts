import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { formatPhone } from "@/lib/phoneFormat";

// ─── Types from DB ───
export type DbCustomer = Tables<"customers">;
export type DbEstimation = Tables<"estimations">;
export type DbJob = Tables<"jobs">;
export type DbInvoice = Tables<"invoices">;
export type DbExpense = Tables<"expenses">;
export type DbEmployee = Tables<"employees">;
export type DbEmployeeJob = Tables<"employee_jobs">;
export type DbReminder = Tables<"reminders">;
export type DbParameters = Tables<"parameters">;
export type DbEstimationRequest = Tables<"estimation_requests">;

// ─── CUSTOMERS ───
export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data as DbCustomer[];
    },
  });
}

export function useInsertCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: TablesInsert<"customers">) => {
      // Normalize phone to "514-708-8976" format on every insert path
      // (manual creation, estimation request conversion, etc.).
      const payload = { ...c, phone: c.phone !== undefined ? formatPhone(c.phone) : c.phone };
      const { data, error } = await supabase.from("customers").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TablesInsert<"customers">>) => {
      // Normalize phone if provided
      const payload = { ...updates, phone: updates.phone !== undefined ? formatPhone(updates.phone) : updates.phone };
      const { error } = await supabase.from("customers").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useHideCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").update({ hidden: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useRestoreCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").update({ hidden: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

/**
 * Permanently delete a customer and all their related data
 * (jobs, estimations, unpaid invoices, reminders, messages, calendar items).
 *
 * IMPORTANT — Finance preservation:
 * Paid invoices are NOT deleted. The DB function reassigns them
 * (and their parent jobs) to a technical "Client supprimé" archive customer
 * so historical profits remain in Finance.
 */
export function useDeleteCustomerCascade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_customer_cascade" as any, { _customer_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      // Refresh every dataset that could reference the deleted customer
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["estimations"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: ["estimation_requests"] });
      qc.invalidateQueries({ queryKey: ["employee_jobs"] });
    },
  });
}

// ─── JOBS ───
export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data as DbJob[];
    },
  });
}

// ─── INVOICES ───
export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").order("issued_at", { ascending: false });
      if (error) throw error;
      return data as DbInvoice[];
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TablesInsert<"invoices">>) => {
      const { error } = await supabase.from("invoices").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

// ─── EXPENSES ───
export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as DbExpense[];
    },
  });
}

export function useInsertExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: TablesInsert<"expenses">) => {
      const { data, error } = await supabase.from("expenses").insert(e).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

// ─── EMPLOYEES ───
export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("name");
      if (error) throw error;
      return data as DbEmployee[];
    },
  });
}

export function useInsertEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: TablesInsert<"employees">) => {
      const { data, error } = await supabase.from("employees").insert(e).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TablesInsert<"employees">>) => {
      const { error } = await supabase.from("employees").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useEmployeeJobs() {
  return useQuery({
    queryKey: ["employee_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employee_jobs").select("*");
      if (error) throw error;
      return data as DbEmployeeJob[];
    },
  });
}

// ─── REMINDERS ───
export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reminders").select("*").order("due_date");
      if (error) throw error;
      return data as DbReminder[];
    },
  });
}

export function useInsertReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: TablesInsert<"reminders">) => {
      const { data, error } = await supabase.from("reminders").insert(r).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });
}

export function useUpdateReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TablesInsert<"reminders">>) => {
      const { error } = await supabase.from("reminders").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });
}

// ─── ESTIMATIONS ───
export function useEstimations() {
  return useQuery({
    queryKey: ["estimations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estimations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as DbEstimation[];
    },
  });
}

export function useInsertEstimation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: TablesInsert<"estimations">) => {
      const { data, error } = await supabase.from("estimations").insert(e).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimations"] }),
  });
}

// ─── JOBS (insert / update) ───
export function useInsertJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (j: TablesInsert<"jobs">) => {
      const { data, error } = await supabase.from("jobs").insert(j).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TablesInsert<"jobs">>) => {
      const { error } = await supabase.from("jobs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

// ─── INVOICES (insert) ───
export function useInsertInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inv: TablesInsert<"invoices">) => {
      const { data, error } = await supabase.from("invoices").insert(inv).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}

// ─── PARAMETERS ───
export function useParameters() {
  return useQuery({
    queryKey: ["parameters"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parameters").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as DbParameters | null;
    },
  });
}

export function useUpdateParameters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<TablesInsert<"parameters">>) => {
      const { error } = await supabase.from("parameters").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parameters"] }),
  });
}

// ─── ESTIMATION REQUESTS (external site submissions) ───
export function useEstimationRequests() {
  return useQuery({
    queryKey: ["estimation_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimation_requests")
        .select("*")
        .eq("hidden", false)
        .order("requested_date", { ascending: true });
      if (error) throw error;
      return data as DbEstimationRequest[];
    },
  });
}

export function useUpdateEstimationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DbEstimationRequest> }) => {
      const { error } = await supabase.from("estimation_requests").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimation_requests"] }),
  });
}

/**
 * Marks an estimation request as seen (sets seen_at = now()).
 * Idempotent: only updates rows where seen_at IS NULL to avoid unnecessary writes.
 */
export function useMarkEstimationRequestSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("estimation_requests")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", id)
        .is("seen_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimation_requests"] }),
  });
}

export function useInsertEstimationRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TablesInsert<"estimation_requests">) => {
      const { data, error } = await supabase.from("estimation_requests").insert(payload).select().single();
      if (error) throw error;
      return data as DbEstimationRequest;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estimation_requests"] }),
  });
}

// ─── Helper: get client name ───
export function getClientNameFromList(customers: DbCustomer[], id: string): string {
  return customers.find((c) => c.id === id)?.name ?? "Client inconnu";
}
