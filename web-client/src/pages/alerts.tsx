import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Skeleton, SkeletonRow } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { relativeTime } from "@/lib/utils";
import type { Alert } from "@/lib/types";

const SEV_VARIANTS: Record<Alert["severity"], "destructive" | "warning" | "info" | "muted"> = {
  critical: "destructive",
  high:     "destructive",
  medium:   "warning",
  low:      "info",
};

export function AlertsPage() {
  const qc = useQueryClient();
  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: api.alerts.list,
    refetchInterval: 30_000,
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => api.alerts.ack(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const unacked = alerts?.filter((a) => !a.ackedBy) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1>Alerts</h1>
          <p className="text-sm text-text-tertiary mt-1">
            System-generated alerts for indexation drops, revenue anomalies, and pipeline failures.{" "}
            {unacked.length > 0
              ? <span className="text-warning-text font-medium">{unacked.length} need acknowledgement.</span>
              : <span className="text-success-text">All clear.</span>}
          </p>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <Table>
            <Thead><Tr><Th>Severity</Th><Th>Type</Th><Th>Site</Th><Th>Age</Th><Th>Status</Th><Th /></Tr></Thead>
            <Tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}</Tbody>
          </Table>
        ) : !alerts?.length ? (
          <EmptyState
            icon={<Bell className="size-10" />}
            title="No alerts"
            description="The network is healthy. Alerts appear here when something needs attention."
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Severity</Th>
                <Th>Type</Th>
                <Th>Site</Th>
                <Th>Age</Th>
                <Th>Status</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {alerts.map((alert) => (
                <Tr key={alert.id} className={alert.ackedBy ? "opacity-50" : ""}>
                  <Td>
                    <Badge variant={SEV_VARIANTS[alert.severity]} dot>{alert.severity}</Badge>
                  </Td>
                  <Td className="text-text-secondary font-mono text-xs">{alert.type}</Td>
                  <Td className="text-text-tertiary text-xs">{alert.siteId ?? "—"}</Td>
                  <Td className="text-text-tertiary text-xs">{relativeTime(alert.createdAt)}</Td>
                  <Td>
                    {alert.ackedBy ? (
                      <span className="text-xs text-text-disabled flex items-center gap-1">
                        <CheckCheck className="size-3" />Acked
                      </span>
                    ) : (
                      <span className="text-xs text-warning-text">Unacked</span>
                    )}
                  </Td>
                  <Td>
                    {!alert.ackedBy && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => ackMutation.mutate(alert.id)}
                        loading={ackMutation.isPending}
                      >
                        <CheckCheck className="size-3.5" />Ack
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
