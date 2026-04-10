import { toast } from "sonner";

export function formatApiError(raw: string): string {
  try {
    const o = JSON.parse(raw) as { detail?: unknown };
    const d = o.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d
        .map((item: { msg?: string; loc?: unknown }) => item.msg ?? JSON.stringify(item))
        .join("; ");
    }
  } catch {
    /* not JSON */
  }
  return raw || "Request failed";
}

export function toastError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  toast.error(formatApiError(msg));
}

export function toastSuccess(message: string) {
  toast.success(message);
}
