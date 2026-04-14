"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ecdFetch } from "../../../../lib/api";

interface FhirBundle<T> {
  resourceType: "Bundle";
  type: "searchset";
  total?: number;
  entry?: Array<{ resource: T }>;
}

interface FhirDocumentReference {
  resourceType: "DocumentReference";
  id?: string;
  date?: string;
  content?: Array<{
    attachment?: { title?: string; contentType?: string; url?: string };
  }>;
}

function formatDate(iso?: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function Spinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-300 border-t-brand-700" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="my-2 text-sm text-coral-600">{msg}</p>;
}

export default function DocumentenPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id ?? "";

  const [items, setItems] = useState<FhirDocumentReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    ecdFetch<FhirBundle<FhirDocumentReference>>(
      `/api/clients/${clientId}/documenten`,
    ).then(({ data, error: err }) => {
      if (err) setError(err);
      else setItems(data?.entry?.map((e) => e.resource) ?? []);
      setLoading(false);
    });
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    const { error: err } = await ecdFetch(`/api/clients/${clientId}/documenten`, {
      method: "POST",
      body: formData,
    });

    setUploading(false);
    if (err) {
      setUploadError(err);
    } else {
      load();
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Documenten</h2>
        <label className="cursor-pointer rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-800">
          {uploading ? "Uploaden..." : "Bestand uploaden"}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {uploadError && <ErrorMsg msg={uploadError} />}
      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-sm text-fg-subtle">Geen documenten gevonden.</p>
      )}

      <div className="overflow-hidden rounded-lg border border-default bg-raised shadow-sm">
        <table className="min-w-full divide-y divide-default text-sm">
          <thead className="bg-page">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Naam</th>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Type</th>
              <th className="px-4 py-3 text-left font-medium text-fg-muted">Datum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {items.map((doc, i) => {
              const att = doc.content?.[0]?.attachment;
              return (
                <tr key={doc.id ?? i}>
                  <td className="px-4 py-3 text-fg">{att?.title ?? "-"}</td>
                  <td className="px-4 py-3 text-fg-muted">{att?.contentType ?? "-"}</td>
                  <td className="px-4 py-3 text-fg-muted">{formatDate(doc.date)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
