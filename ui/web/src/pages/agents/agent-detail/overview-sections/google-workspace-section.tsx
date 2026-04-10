import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHttp } from "@/hooks/use-ws";

interface GoogleAccount {
  email: string;
  category?: string;
  description?: string;
}

interface GoogleAccountsResponse {
  accounts: GoogleAccount[];
  available: boolean;
}

interface GoogleWorkspaceSectionProps {
  emails: string[];
  onChange: (emails: string[]) => void;
}

export function GoogleWorkspaceSection({ emails, onChange }: GoogleWorkspaceSectionProps) {
  const { t } = useTranslation("agents");
  const http = useHttp();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<GoogleAccountsResponse>({
    queryKey: ["integrations", "google", "accounts"],
    queryFn: () => http.get<GoogleAccountsResponse>("/v1/integrations/google/accounts"),
    staleTime: 30_000,
    retry: false,
  });

  const authedEmails = new Set((data?.accounts ?? []).map((a) => a.email.toLowerCase()));
  const available = data?.available ?? false;

  const addEmail = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email || emails.includes(email)) return;
    onChange([...emails, email]);
    setInput("");
  };

  const removeEmail = (email: string) => {
    onChange(emails.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addEmail(input);
    }
    if (e.key === "Backspace" && !input && emails.length > 0) {
      const last = emails[emails.length - 1];
      if (last) removeEmail(last);
    }
  };

  const authUrl = `${window.location.origin}/auth`;

  return (
    <section className="space-y-3 rounded-lg border p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t("googleWorkspace.title")}</h3>
        {available && (
          <a
            href={authUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {t("googleWorkspace.signIn")}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t("googleWorkspace.description")}</p>

      {!available && !isLoading && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {t("googleWorkspace.notConfigured")}
        </p>
      )}

      {/* Email tags */}
      <div
        className="flex flex-wrap gap-1.5 rounded-md border bg-background p-2 cursor-text min-h-[40px]"
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email) => {
          const authed = authedEmails.has(email.toLowerCase());
          return (
            <span
              key={email}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                authed
                  ? "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-300"
                  : "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {isLoading
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : authed
                ? <CheckCircle2 className="h-3 w-3" />
                : <XCircle className="h-3 w-3" />}
              {email}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeEmail(email); }}
                className="ml-0.5 rounded-full hover:opacity-70"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          );
        })}

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (input.includes("@")) addEmail(input); }}
          placeholder={emails.length === 0 ? t("googleWorkspace.emailPlaceholder") : ""}
          className="flex-1 min-w-[180px] bg-transparent text-sm outline-none placeholder:text-muted-foreground text-base md:text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        {input.includes("@") && (
          <Button type="button" variant="outline" size="sm" onClick={() => addEmail(input)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("googleWorkspace.addEmail")}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {t("googleWorkspace.hint")}
        </p>
      </div>
    </section>
  );
}
