import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogIn, Eye, EyeOff } from "lucide-react";

const ClientPortalLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check user role - only allow client_user
      const { data: roleData } = await supabase.rpc("current_user_role");
      
      if (roleData && roleData !== "client_user") {
        await supabase.auth.signOut();
        throw new Error("Ovaj nalog je za interni sistem. Koristite glavnu stranicu za prijavu.");
      }

      // Check if user is a portal user
      const { data: portalUser, error: portalError } = await supabase
        .from("client_portal_users")
        .select("id, is_active")
        .eq("user_id", data.user.id)
        .single();

      if (portalError || !portalUser) {
        await supabase.auth.signOut();
        throw new Error("Ovaj nalog nema pristup klijent portalu");
      }

      if (!portalUser.is_active) {
        await supabase.auth.signOut();
        throw new Error("Vaš nalog je deaktiviran. Kontaktirajte podršku.");
      }

      navigate("/portal");
    } catch (error: any) {
      toast({
        title: "Greška pri prijavi",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Klijent Portal</CardTitle>
          <CardDescription>
            Prijavite se da biste upravljali prioritetima vaših naloga
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vas@email.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Lozinka</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              <LogIn className="h-4 w-4 mr-2" />
              {isLoading ? "Prijavljivanje..." : "Prijavi se"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Problemi sa prijavom? Kontaktirajte nas na:</p>
            <p className="font-medium">ctp@gamaunited.rs</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientPortalLogin;
