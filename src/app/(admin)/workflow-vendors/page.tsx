"use client";

import { useEffect, useState, useMemo } from "react";
import { getWorkflowVendors } from "@/lib/queries";
import {
  PageHeader,
  DataTable,
  Column,
  FilterBar,
  Button,
  Modal,
  FormField,
  ErrorBanner,
  inputClass,
} from "@/components/ui";
import { adminUpsert } from "@/app/(admin)/admin-actions";
import { Plus } from "lucide-react";

type Vendor = Record<string, unknown>;

export default function WorkflowVendorsPage() {
  const [data, setData] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getWorkflowVendors()
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load vendors.");
        setLoading(false);
      });
  };

  useEffect(load, []);

  const filtered = useMemo(
    () =>
      data.filter(
        (r) =>
          !search ||
          [r.name, r.email, r.contact_name, r.vendor_type]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
      ),
    [data, search]
  );

  const columns: Column<Vendor>[] = [
    { key: "name", label: "Name", render: (r) => <span className="font-medium">{r.name as string}</span> },
    { key: "vendor_type", label: "Type" },
    { key: "contact_name", label: "Contact" },
    { key: "email", label: "Email" },
    {
      key: "auth_user_id",
      label: "Portal login",
      render: (r) => (
        <span className="text-xs font-mono text-gray-500">
          {r.auth_user_id ? "Linked" : "Not linked"}
        </span>
      ),
    },
    {
      key: "active",
      label: "Active",
      render: (r) => (r.active ? "Yes" : "No"),
    },
  ];

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const record: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      if (k !== "active") record[k] = v || null;
    });
    record.active = fd.get("active") === "on";
    if (editing?.id) record.id = editing.id;
    const result = await adminUpsert("vendors", record);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setModalOpen(false);
    setEditing(null);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Outside vendors"
        description="Vendors with portal access — link auth_user_id to their Supabase login"
        action={
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus size={16} />
            Add vendor
          </Button>
        }
      />
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 -mt-2">
        Set each user&apos;s <code className="text-xs">app_metadata.role</code> to{" "}
        <code className="text-xs">vendor</code> in Supabase Auth, then paste their user UUID below.
      </p>

      <FilterBar search={search} onSearchChange={setSearch} placeholder="Search vendors…" />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={(r) => { setEditing(r); setModalOpen(true); }}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit vendor" : "New vendor"}>
        <form onSubmit={handleSave} className="space-y-4">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <FormField label="Business name" required>
            <input name="name" className={inputClass} required defaultValue={String(editing?.name ?? "")} />
          </FormField>
          <FormField label="Type (mechanic, detailer, tow…)">
            <input name="vendor_type" className={inputClass} defaultValue={String(editing?.vendor_type ?? "")} />
          </FormField>
          <FormField label="Contact name">
            <input name="contact_name" className={inputClass} defaultValue={String(editing?.contact_name ?? "")} />
          </FormField>
          <FormField label="Email">
            <input name="email" type="email" className={inputClass} defaultValue={String(editing?.email ?? "")} />
          </FormField>
          <FormField label="Phone">
            <input name="phone" className={inputClass} defaultValue={String(editing?.phone ?? "")} />
          </FormField>
          <FormField label="Supabase Auth user ID (UUID)">
            <input name="auth_user_id" className={inputClass} defaultValue={String(editing?.auth_user_id ?? "")} placeholder="Links portal login to this vendor" />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={editing?.active !== false} />
            Active
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
