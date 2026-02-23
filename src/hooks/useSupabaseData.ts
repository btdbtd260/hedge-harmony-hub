import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

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
      const { data, error } = await supabase.from("customers").insert(c).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
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

// ─── Helper: get client name ───
export function getClientNameFromList(customers: DbCustomer[], id: string): string {
  return customers.find((c) => c.id === id)?.name ?? "Client inconnu";
}
