import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ApiError } from "@/lib/api/client";

function getErrorDescription(error: ApiError) {
  if (error.status === 0) {
    return "The frontend could not reach the API. Make sure the backend is running and try again.";
  }

  if (error.code === "invalid_api_response") {
    return "The API responded, but the payload did not match the expected contract.";
  }

  return `${error.code}: ${error.message}`;
}

function InlineApiErrorPanel({
  label,
  error,
  children,
}: {
  label: string;
  error: ApiError;
  children?: ReactNode;
}) {
  return (
    <Alert
      className="border-destructive/40 bg-destructive/5"
      variant="destructive"
    >
      <CircleAlert className="size-4" />
      <AlertTitle className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="text-xs font-semibold tracking-[0.2em] uppercase">
          {label}
        </span>
        <span>Request failed</span>
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{getErrorDescription(error)}</p>
        {error.details === undefined ? null : (
          <p className="break-words text-xs leading-6 sm:text-sm">
            <span className="font-medium">Details:</span>{" "}
            {JSON.stringify(error.details)}
          </p>
        )}
        {children === undefined ? null : <div className="pt-2">{children}</div>}
      </AlertDescription>
    </Alert>
  );
}

export default InlineApiErrorPanel;
