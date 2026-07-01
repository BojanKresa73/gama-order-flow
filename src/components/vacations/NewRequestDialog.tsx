import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarIcon, Palmtree, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { sr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useVacationHolidays, useMyBalance, useSubmitVacation } from "@/hooks/useVacations";
import { countBusinessDaysWithHolidays, toISO } from "@/lib/vacationCalc";
import { toast } from "sonner";

export function NewRequestDialog() {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<{ from?: Date; to?: Date }>({});
  const [reason, setReason] = useState("");
  const { data: holidays = [] } = useVacationHolidays();
  const year = new Date().getFullYear();
  const { data: balance } = useMyBalance(year);
  const submit = useSubmitVacation();

  const holidaySet = useMemo(
    () => new Set(holidays.map((h) => h.holiday_date)),
    [holidays]
  );

  const days = range.from && range.to
    ? countBusinessDaysWithHolidays(range.from, range.to, holidaySet)
    : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minStart = new Date(today);
  minStart.setDate(minStart.getDate() + 7);

  const carryValid = balance?.carryover_expires_on
    ? !range.from || range.from <= new Date(balance.carryover_expires_on)
    : true;
  const availCarry = carryValid ? (balance?.carried_over ?? 0) : 0;
  const availCurrent = balance ? balance.allocated - balance.used : 21;
  const usePrev = Math.min(availCarry, days);
  const useCur = days - usePrev;

  const errors: string[] = [];
  if (range.from && range.from < minStart) errors.push("Godišnji morate najaviti najmanje 7 dana ranije.");
  if (days > 0 && useCur > availCurrent) errors.push(`Nemate dovoljno dana (traženo ${days}, dostupno ${availCarry + availCurrent}).`);

  const canSubmit = range.from && range.to && days > 0 && errors.length === 0;

  const onSubmit = async () => {
    if (!range.from || !range.to) return;
    try {
      await submit.mutateAsync({
        start: toISO(range.from),
        end: toISO(range.to),
        reason: reason.trim() || null,
      });
      toast.success("Zahtev je poslat na odobrenje");
      setOpen(false);
      setRange({});
      setReason("");
    } catch (e: any) {
      toast.error(e.message || "Greška pri slanju zahteva");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Palmtree className="h-4 w-4 mr-2" />
          Novi zahtev
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novi zahtev za godišnji odmor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Period</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !range.from && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {range.from && range.to
                    ? `${format(range.from, "dd.MM.yyyy", { locale: sr })} — ${format(range.to, "dd.MM.yyyy", { locale: sr })}`
                    : "Izaberi datume"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={range as any}
                  onSelect={(r: any) => setRange(r ?? {})}
                  numberOfMonths={2}
                  disabled={{ before: minStart }}
                  modifiers={{ holiday: holidays.map((h) => new Date(h.holiday_date)) }}
                  modifiersStyles={{ holiday: { color: "hsl(var(--destructive))", fontWeight: 600 } }}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">Najraniji datum: {format(minStart, "dd.MM.yyyy", { locale: sr })} (7 dana ranije)</p>
          </div>

          {days > 0 && (
            <div className="rounded-lg border p-3 bg-muted/40 space-y-1 text-sm">
              <div className="flex justify-between"><span>Ukupno dana (bez praznika):</span><b>{days}</b></div>
              {usePrev > 0 && <div className="flex justify-between text-emerald-700"><span>Iz prenosa {year - 1}:</span><b>{usePrev}</b></div>}
              <div className="flex justify-between"><span>Iz tekuće {year}:</span><b>{useCur}</b></div>
              <div className="flex justify-between text-muted-foreground"><span>Preostalo posle:</span><b>{Math.max(0, availCurrent - useCur)} dana</b></div>
            </div>
          )}

          {errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{e}</span>
            </div>
          ))}

          <div className="space-y-2">
            <Label>Napomena (opciono)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="npr. porodični put" maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Otkaži</Button>
          <Button onClick={onSubmit} disabled={!canSubmit || submit.isPending}>
            {submit.isPending ? "Šaljem..." : "Pošalji zahtev"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
