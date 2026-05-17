"use client";

import { useEffect, useState } from "react";
import { Button, ErrorBanner, inputClass } from "@/components/ui";
import {
  getSignedDocumentUrl,
  uploadContractPdf,
  removeContractPdf,
  uploadStaffLicenseImage,
  removeStaffLicenseImage,
  mintLicenseUploadLink,
} from "@/app/(admin)/document-actions";

type LicenseTable = "background_checks" | "active_customers";

export function ContractPdfControls({
  contractId,
  storagePath,
  onChange,
}: {
  contractId: string | null;
  storagePath: string | null | undefined;
  onChange: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!storagePath) {
      setPreviewUrl(null);
      return;
    }
    getSignedDocumentUrl(storagePath).then((r) => {
      if (!alive) return;
      if (r.success && r.data) setPreviewUrl(r.data.url);
      else setPreviewUrl(null);
    });
    return () => {
      alive = false;
    };
  }, [storagePath]);

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!contractId) return;
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set("contractId", contractId);
    const r = await uploadContractPdf(fd);
    setBusy(false);
    if (!r.success) {
      setError(r.error);
      return;
    }
    onChange();
    e.currentTarget.reset();
  }

  async function onRemove() {
    if (!contractId || !storagePath) return;
    setError(null);
    setBusy(true);
    const r = await removeContractPdf(contractId);
    setBusy(false);
    if (!r.success) {
      setError(r.error);
      return;
    }
    onChange();
  }

  if (!contractId) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400 sm:col-span-2">
        Save the contract once, then you can attach a signed PDF.
      </p>
    );
  }

  return (
    <div className="space-y-3 sm:col-span-2 border-t border-gray-200 dark:border-slate-700 pt-4 mt-2">
      <p className="text-sm font-medium text-gray-900 dark:text-white">Signed contract (PDF)</p>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {previewUrl && (
        <p>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline dark:text-blue-400"
          >
            Open current PDF
          </a>
        </p>
      )}
      {storagePath && !previewUrl && (
        <p className="text-xs text-gray-500 dark:text-slate-400">Preparing secure link…</p>
      )}
      <form onSubmit={onUpload} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="file" name="file" accept="application/pdf" className={`${inputClass} flex-1`} required />
        <Button type="submit" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </Button>
      </form>
      {storagePath ? (
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onRemove}>
          Remove PDF
        </Button>
      ) : null}
    </div>
  );
}

function LicensePreview({ path }: { path: string | null | undefined }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    getSignedDocumentUrl(path).then((r) => {
      if (!alive) return;
      if (r.success && r.data) setUrl(r.data.url);
      else setUrl(null);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path) return <span className="text-xs text-gray-500">No file</span>;
  if (!url) return <span className="text-xs text-gray-500">Loading preview…</span>;
  // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
  return <img src={url} alt="" className="mt-1 max-h-28 rounded border border-gray-200 object-contain dark:border-slate-600" />;
}

export function LicensePhotoControls({
  table,
  recordId,
  frontPath,
  backPath,
  onChange,
}: {
  table: LicenseTable;
  recordId: string | null;
  frontPath: string | null | undefined;
  backPath: string | null | undefined;
  onChange: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  async function uploadSide(e: React.FormEvent<HTMLFormElement>, side: "front" | "back") {
    e.preventDefault();
    if (!recordId) return;
    setError(null);
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set("table", table);
    fd.set("recordId", recordId);
    fd.set("side", side);
    const r = await uploadStaffLicenseImage(fd);
    setBusy(false);
    if (!r.success) {
      setError(r.error);
      return;
    }
    onChange();
    e.currentTarget.reset();
  }

  async function removeSide(side: "front" | "back") {
    if (!recordId) return;
    setError(null);
    setBusy(true);
    const r = await removeStaffLicenseImage(table, recordId, side);
    setBusy(false);
    if (!r.success) {
      setError(r.error);
      return;
    }
    onChange();
  }

  async function copyUploadLink() {
    if (!recordId) return;
    setLinkMsg(null);
    setError(null);
    setBusy(true);
    const fd = new FormData();
    fd.set("table", table);
    fd.set("id", recordId);
    const r = await mintLicenseUploadLink(fd);
    setBusy(false);
    if (!r.success) {
      setError(r.error);
      return;
    }
    if (!r.data) {
      setError("Could not create link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(r.data.url);
      setLinkMsg(`Link copied. Valid until ${new Date(r.data.expiresAt).toLocaleString()}.`);
    } catch {
      setLinkMsg(r.data.url);
    }
  }

  if (!recordId) {
    return (
      <p className="text-sm text-gray-500 dark:text-slate-400 sm:col-span-2">
        Save this record first, then you can upload license photos or create a customer upload link.
      </p>
    );
  }

  return (
    <div className="space-y-4 sm:col-span-2 border-t border-gray-200 dark:border-slate-700 pt-4 mt-2">
      <p className="text-sm font-medium text-gray-900 dark:text-white">Driver license (photos)</p>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {linkMsg && <p className="text-xs text-emerald-700 dark:text-emerald-400">{linkMsg}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Front</p>
          <LicensePreview path={frontPath} />
          <form onSubmit={(e) => uploadSide(e, "front")} className="mt-2 space-y-2">
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" className={inputClass} />
            <Button type="submit" size="sm" disabled={busy}>
              Upload front
            </Button>
          </form>
          {frontPath ? (
            <Button type="button" variant="secondary" size="sm" className="mt-1" disabled={busy} onClick={() => removeSide("front")}>
              Remove front
            </Button>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-medium text-gray-600 dark:text-slate-300 mb-1">Back</p>
          <LicensePreview path={backPath} />
          <form onSubmit={(e) => uploadSide(e, "back")} className="mt-2 space-y-2">
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" className={inputClass} />
            <Button type="submit" size="sm" disabled={busy}>
              Upload back
            </Button>
          </form>
          {backPath ? (
            <Button type="button" variant="secondary" size="sm" className="mt-1" disabled={busy} onClick={() => removeSide("back")}>
              Remove back
            </Button>
          ) : null}
        </div>
      </div>

      <div>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={copyUploadLink}>
          Copy customer upload link (7 days)
        </Button>
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          Customer opens the link and uploads front and back without logging in.
        </p>
      </div>
    </div>
  );
}
