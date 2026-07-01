import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthz } from "@/hooks/useAuthz";
import { useState } from "react";
import { Pencil, Check, X, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/vacationCalc";

interface Row {
  user_id: string;
  full_name: string;
  allocated: number;
  carried_over: number;
  used: number;
  used_from_previous: number;
  used_from_current: number;
  pending_days: number;
  carryover_expires_on: string | null;
}

export function TeamBalances() {
  const year = new Date().getFullYear();
  const { isAdminPlus } = useAuthz();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id: string; field: "carried_over" | "allocated"; value: string } | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["vacation-team-overview", year],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("vacation_team_overview", { p_year: year });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    enabled: isAdminPlus,
  });

  const setCarryMut = useMutation({
    mutationFn: async (p: { user_id: string; value: number }) => {
      const { error } = await supabase.rpc("vacation_set_carryover", {
        p_user: p.user_id, p_year: year, p_carried_over: p.value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preneseni dani ažurirani");
      qc.invalidateQueries({ queryKey: ["vacation-team-overview"] });
      qc.invalidateQueries({ queryKey: ["vacation-balance-me"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setAllocMut = useMutation({
    mutationFn: async (p: { user_id: string; value: number }) => {
      const { error } = await supabase.rpc("vacation_set_allocated", {
        p_user: p.user_id, p_year: year, p_allocated: p.value,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Godišnji fond ažuriran");
      qc.invalidateQueries({ queryKey: ["vacation-team-overview"] });
      qc.invalidateQueries({ queryKey: ["vacation-balance-me"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdminPlus) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Timski pregled bilansa je dostupan samo administratorima.
        </CardContent>
      </Card>
    );
  }

  const saveEdit = () => {
    if (!editing) return;
    const n = parseInt(editing.value, 10);
    if (isNaN(n) || n < 0) { toast.error("Nevažeća vrednost"); return; }
    if (editing.field === "carried_over") setCarryMut.mutate({ user_id: editing.id, value: n });
    else setAllocMut.mutate({ user_id: editing.id, value: n });
    setEditing(null);
  };

  const EditableCell = ({ row, field, value }: { row: Row; field: "carried_over" | "allocated"; value: number }) => {
    const isEditing = editing?.id === row.user_id && editing.field === field;
    if (isEditing) {
      return (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            className="h-8 w-20"
            value={editing.value}
            autoFocus
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
        </div>
      );
    }
    return (
      <button
        className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-muted transition-colors"
        onClick={() => setEditing({ id: row.user_id, field, value: String(value) })}
      >
        <span className="font-semibold">{value}</span>
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Bilansi tima za {year}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Klikni na broj u kolonama <b>Preneseno</b> ili <b>Godišnji fond</b> da izmeniš vrednost.
          Preneseni dani ističu na 30.06. tekuće godine.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zaposleni</TableHead>
                <TableHead className="text-center">Preneseno iz {year - 1}</TableHead>
                <TableHead className="text-center">Godišnji fond {year}</TableHead>
                <TableHead className="text-center">Ukupno pravo</TableHead>
                <TableHead className="text-center">Iskorišćeno {year}</TableHead>
                <TableHead className="text-center">Na čekanju</TableHead>
                <TableHead className="text-center">Preostalo</TableHead>
                <TableHead>Prenos ističe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Učitavanje...</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nema zaposlenih.</TableCell></TableRow>
              )}
              {rows.map((r) => {
                const total = r.allocated + r.carried_over;
                const remaining = total - r.used;
                const expired = r.carryover_expires_on ? new Date(r.carryover_expires_on) < new Date() : false;
                return (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell className="text-center">
                      <EditableCell row={r} field="carried_over" value={r.carried_over} />
                    </TableCell>
                    <TableCell className="text-center">
                      <EditableCell row={r} field="allocated" value={r.allocated} />
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{total}</TableCell>
                    <TableCell className="text-center">
                      <div className="font-semibold">{r.used}</div>
                      {(r.used_from_previous > 0 || r.used_from_current > 0) && (
                        <div className="text-xs text-muted-foreground">
                          {r.used_from_previous > 0 && <>staro: {r.used_from_previous}</>}
                          {r.used_from_previous > 0 && r.used_from_current > 0 && " · "}
                          {r.used_from_current > 0 && <>novo: {r.used_from_current}</>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.pending_days > 0
                        ? <Badge variant="secondary">{r.pending_days}</Badge>
                        : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${remaining <= 0 ? "text-destructive" : remaining <= 3 ? "text-amber-600" : "text-emerald-600"}`}>
                        {remaining}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.carryover_expires_on ? (
                        <span className={expired ? "text-destructive line-through" : r.carried_over > 0 ? "text-amber-600" : "text-muted-foreground"}>
                          {formatDate(r.carryover_expires_on)}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
