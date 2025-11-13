import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, ArrowRight } from "lucide-react";

export const FollowUpWidget = () => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFollowUpCount();
  }, []);

  const fetchFollowUpCount = async () => {
    try {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      const { count } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .not("next_follow_up_at", "is", null)
        .lte("next_follow_up_at", today.toISOString());

      setCount(count || 0);
    } catch (error) {
      console.error("Error fetching follow-up count:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    const today = new Date().toISOString().split('T')[0];
    navigate(`/clients?followUpDate=${today}`);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>Follow-up danas</CardTitle>
              <CardDescription>Klijenti za kontakt</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Učitavanje...</p>
        ) : (
          <div className="space-y-4">
            <div className="text-4xl font-bold text-primary">{count}</div>
            <Button 
              onClick={handleClick} 
              variant="outline" 
              className="w-full"
              disabled={count === 0}
            >
              Pogledaj klijente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
