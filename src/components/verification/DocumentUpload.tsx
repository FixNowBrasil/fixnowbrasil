import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  removeVerificationFile,
  signedDocumentUrl,
  uploadVerificationFile,
  type DocumentSlot,
} from "@/lib/verification";

type Props = {
  label: string;
  hint?: string;
  providerId: string;
  slot: DocumentSlot;
  path: string | null;
  disabled?: boolean;
  capture?: boolean;
  onChange: (path: string | null) => void;
};

export function DocumentUpload({ label, hint, providerId, slot, path, disabled, capture, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!path) {
      setPreview(null);
      return;
    }
    signedDocumentUrl(path)
      .then((url) => {
        if (active) setPreview(url);
      })
      .catch(() => setPreview(null));
    return () => {
      active = false;
    };
  }, [path]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadVerificationFile(file, providerId, slot);
      if (path) await removeVerificationFile(path);
      onChange(uploaded);
      toast.success("Arquivo enviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio do arquivo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const isPdf = path?.toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {path ? (
            isPdf || !preview ? (
              <span className="text-[10px] font-medium text-muted-foreground">Arquivo enviado</span>
            ) : (
              <img src={preview} alt={label} className="h-full w-full object-cover" />
            )
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={path ? "outline" : "default"}
            disabled={busy || disabled}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {path ? "Substituir" : "Enviar arquivo"}
          </Button>
          {path && !disabled ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                await removeVerificationFile(path);
                onChange(null);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Remover
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        {...(capture ? { capture: "user" as const } : {})}
        className="hidden"
        aria-label={label}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  );
}
