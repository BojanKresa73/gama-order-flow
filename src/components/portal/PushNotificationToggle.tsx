import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortalPushSubscription } from "@/hooks/usePortalPushSubscription";
import { useToast } from "@/hooks/use-toast";

export const PushNotificationToggle = () => {
  const { isSubscribed, isSupported, permission, subscribe, unsubscribe } =
    usePortalPushSubscription();
  const { toast } = useToast();

  if (!isSupported) return null;

  const handleToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribe();
      if (ok) {
        toast({ title: "Push notifikacije isključene" });
      }
    } else {
      const ok = await subscribe();
      if (ok) {
        toast({ title: "Push notifikacije uključene", description: "Primićete obaveštenja o promenama naloga." });
      } else if (permission === "denied") {
        toast({
          title: "Notifikacije blokirane",
          description: "Dozvolite notifikacije u podešavanjima browsera.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Button
      variant={isSubscribed ? "default" : "outline"}
      size="sm"
      onClick={handleToggle}
      className="gap-2"
    >
      {isSubscribed ? (
        <>
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Push uključen</span>
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          <span className="hidden sm:inline">Uključi push</span>
        </>
      )}
    </Button>
  );
};
