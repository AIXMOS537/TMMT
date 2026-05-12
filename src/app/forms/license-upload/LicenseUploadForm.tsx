"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { submitLicenseUpload } from "@/app/forms/license-upload-actions";
import { Button, Card, FormField, ErrorBanner, inputClass } from "@/components/ui";
import { CheckCircle } from "lucide-react";

export function LicenseUploadForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("token", token);
    const result = await submitLicenseUpload(fd);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  };

  if (!token) {
    return (
      <Card className="p-8 max-w-lg mx-auto">
        <p className="text-gray-700 dark:text-slate-300">This page needs a valid link from TMMT staff. Open the full URL you were sent (it includes a token).</p>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className="p-8 text-center max-w-md mx-auto">
        <CheckCircle className="mx-auto h-16 w-16 text-emerald-500 dark:text-emerald-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Upload complete</h2>
        <p className="text-gray-600 dark:text-slate-400">Thank you. You can close this page.</p>
      </Card>
    );
  }

  return (
    <Card className="p-8 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Driver license upload</h1>
      <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
        Upload a clear photo of the front and back of your license (JPEG, PNG, or WebP). Max 8 MB each.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <FormField label="Front of license" required>
          <input type="file" name="front" accept="image/jpeg,image/png,image/webp" className={inputClass} required />
        </FormField>
        <FormField label="Back of license" required>
          <input type="file" name="back" accept="image/jpeg,image/png,image/webp" className={inputClass} required />
        </FormField>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Uploading…" : "Submit"}
        </Button>
      </form>
    </Card>
  );
}
