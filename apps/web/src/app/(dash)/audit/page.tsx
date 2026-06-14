"use client";

import { useQuery } from "convex/react";
import { api } from "@activitytrack/backend/convex/_generated/api";
import { useI18n } from "@/lib/i18n";
import { formatTime } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AuditPage() {
  const { t, lang } = useI18n();
  const rows = useQuery(api.audit.list, {});

  if (rows === undefined) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted">
          {t("audit.empty")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("audit.when")}</TableHead>
            <TableHead>{t("audit.actor")}</TableHead>
            <TableHead>{t("audit.action")}</TableHead>
            <TableHead>{t("audit.target")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r._id}>
              <TableCell className="whitespace-nowrap text-muted">
                {formatTime(r.at, lang)}
              </TableCell>
              <TableCell className="text-fg">{r.actorName}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono">
                  {r.action}
                </Badge>
              </TableCell>
              <TableCell className="text-muted">{r.target ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
