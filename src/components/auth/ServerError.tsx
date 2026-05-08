import { CircleAlert } from "lucide-react";

interface ServerErrorProps {
  message?: string | null;
}

export function ServerError({ message }: ServerErrorProps) {
  if (!message) return null;

  return (
    <p className="text-sm text-red-300 bg-red-900/30 border border-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
      <CircleAlert className="size-4 shrink-0" />
      {message}
    </p>
  );
}
