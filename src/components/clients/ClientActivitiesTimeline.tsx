import { ClientActivity } from "@/hooks/useClientActivities";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Calendar, FileText } from "lucide-react";

interface ClientActivitiesTimelineProps {
  activities: ClientActivity[];
  isLoading: boolean;
}

export const ClientActivitiesTimeline = ({
  activities,
  isLoading,
}: ClientActivitiesTimelineProps) => {
  const getActivityIcon = (type: ClientActivity["type"]) => {
    switch (type) {
      case "poziv":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "sastanak":
        return <Calendar className="h-4 w-4" />;
      case "napomena":
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityLabel = (type: ClientActivity["type"]) => {
    switch (type) {
      case "poziv":
        return "Poziv";
      case "email":
        return "Email";
      case "sastanak":
        return "Sastanak";
      case "napomena":
        return "Napomena";
    }
  };

  const getActivityVariant = (type: ClientActivity["type"]) => {
    switch (type) {
      case "poziv":
        return "default" as const;
      case "email":
        return "secondary" as const;
      case "sastanak":
        return "outline" as const;
      case "napomena":
        return "outline" as const;
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Učitavanje aktivnosti...</div>;
  }

  if (!activities || activities.length === 0) {
    return <div className="text-sm text-muted-foreground">Nema zabeleženih aktivnosti</div>;
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex gap-3 pb-4 border-b last:border-0">
          <div className="flex-shrink-0 mt-1">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              {getActivityIcon(activity.type)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={getActivityVariant(activity.type)}>
                {getActivityLabel(activity.type)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(activity.created_at).toLocaleString("sr-RS", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {activity.note && (
              <p className="text-sm whitespace-pre-wrap">{activity.note}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
