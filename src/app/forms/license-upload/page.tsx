import { Suspense } from "react";
import { LicenseUploadForm } from "./LicenseUploadForm";

export default function LicenseUploadPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 px-4">
      <Suspense
        fallback={
          <div className="flex justify-center py-20 text-gray-600 dark:text-slate-400">Loading…</div>
        }
      >
        <LicenseUploadForm />
      </Suspense>
    </div>
  );
}
