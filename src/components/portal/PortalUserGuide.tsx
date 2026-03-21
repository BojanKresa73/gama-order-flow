import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HelpCircle, Search, Bell, ArrowUpDown, Mail, Package } from "lucide-react";

const guideSteps = [
  {
    icon: Search,
    title: "Pretraga naloga",
    description:
      "Koristite polje za pretragu da pronađete naloge po broju naloga, nazivu posla ili imenu fajla. Pretraga pokriva i CTP, film i digitalne fajlove.",
  },
  {
    icon: ArrowUpDown,
    title: "Prioritet naloga",
    description:
      'Svaki nalog ima prioritet od 1 (najniži) do 10 (najhitniji). Kliknite na dugme "Promeni prioritet" da zatražite hitnu obradu. Možete dodati i napomenu sa razlogom.',
  },
  {
    icon: Bell,
    title: "Obaveštenja",
    description:
      "Zvonce u gornjem desnom uglu prikazuje obaveštenja o vašim nalozima — kada je nalog zatvoren, prioritet promenjen ili dodata napomena.",
  },
  {
    icon: Mail,
    title: "Email obaveštenja",
    description:
      "Uključite email obaveštenja da biste primali mejl svaki put kada se status vašeg naloga promeni ili kada nalog bude zatvoren.",
  },
  {
    icon: Package,
    title: "Status naloga",
    description:
      'Filtrirajte naloge po statusu — "Otvoreni" prikazuje naloge u obradi, "Zatvoreni" završene naloge, a "Svi" prikazuje kompletnu istoriju.',
  },
];

export function PortalUserGuide() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        title="Uputstvo za upotrebu"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Uputstvo za upotrebu portala</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {guideSteps.map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{step.title}</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Za sva pitanja i podršku, kontaktirajte nas putem telefona ili emaila.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
