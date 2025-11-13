import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAddClientActivity, ClientActivity } from "@/hooks/useClientActivities";
import { Plus } from "lucide-react";

interface ClientQuickNoteFormProps {
  clientId: string;
}

export const ClientQuickNoteForm = ({ clientId }: ClientQuickNoteFormProps) => {
  const [type, setType] = useState<ClientActivity["type"]>("napomena");
  const [note, setNote] = useState("");
  const [setFollowUp, setSetFollowUp] = useState(false);
  const addActivity = useAddClientActivity();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;

    addActivity.mutate(
      {
        clientId,
        type,
        note: note.trim(),
        setFollowUp,
      },
      {
        onSuccess: () => {
          setNote("");
          setSetFollowUp(false);
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-muted rounded-lg">
      <h4 className="font-semibold text-sm">Brza beleška</h4>
      
      <div className="space-y-2">
        <Label htmlFor="activity-type">Tip aktivnosti</Label>
        <Select value={type} onValueChange={(v) => setType(v as ClientActivity["type"])}>
          <SelectTrigger id="activity-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="poziv">Poziv</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sastanak">Sastanak</SelectItem>
            <SelectItem value="napomena">Napomena</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="activity-note">Beleška</Label>
        <Textarea
          id="activity-note"
          placeholder="Unesite detalje aktivnosti..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="set-followup"
          checked={setFollowUp}
          onCheckedChange={(checked) => setSetFollowUp(checked as boolean)}
        />
        <Label htmlFor="set-followup" className="text-sm font-normal cursor-pointer">
          Postavi follow-up za 7 dana
        </Label>
      </div>

      <Button type="submit" disabled={!note.trim() || addActivity.isPending} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Dodaj aktivnost
      </Button>
    </form>
  );
};
