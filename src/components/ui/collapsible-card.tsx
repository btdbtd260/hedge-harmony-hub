import { useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

interface CollapsibleCardProps {
  title: string;
  defaultOpen?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CollapsibleCard({
  title,
  defaultOpen = true,
  action,
  children,
  className = "",
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const chevronClass = [
    "h-5 w-5 shrink-0 transition-transform text-muted-foreground",
    open ? "rotate-90" : "",
  ].filter(Boolean).join(" ");

  return (
    <Card className={className}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger className="flex-1">
            <CardHeader className="flex flex-row items-center gap-2 py-3">
              <ChevronRight className={chevronClass} />
              <CardTitle className="text-left">{title}</CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          {action && (
            <div className="pr-4" onClick={(e) => e.stopPropagation()}>
              {action}
            </div>
          )}
        </div>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
