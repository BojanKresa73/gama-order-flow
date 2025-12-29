import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import ChecklistView from "@/components/checklist/ChecklistView";
import SearchAndStats from "@/components/checklist/SearchAndStats";

const Checklist = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ctp");
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/");
      return;
    }
    
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Učitavanje...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-3 md:px-4 py-3 md:py-4">
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Nazad</span>
            </Button>
            <h1 className="text-lg md:text-2xl font-bold">Checklist</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <Card>
          <CardHeader className="px-3 md:px-6 py-3 md:py-4">
            <CardTitle className="text-base md:text-lg">Pregled radnih naloga po tipu</CardTitle>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Mobile: horizontal scroll for tabs */}
              <div className="overflow-x-auto -mx-2 px-2 pb-2">
                <TabsList className="inline-flex w-max md:grid md:w-full md:grid-cols-6 gap-1">
                  <TabsTrigger value="search" className="text-xs md:text-sm px-2 md:px-4">Pretraga</TabsTrigger>
                  <TabsTrigger value="ctp" className="text-xs md:text-sm px-2 md:px-4">CTP</TabsTrigger>
                  <TabsTrigger value="film" className="text-xs md:text-sm px-2 md:px-4">Film</TabsTrigger>
                  <TabsTrigger value="digital" className="text-xs md:text-sm px-2 md:px-4">Digitala</TabsTrigger>
                  <TabsTrigger value="large_format" className="text-xs md:text-sm px-2 md:px-4 whitespace-nowrap">V. Formati</TabsTrigger>
                  <TabsTrigger value="other" className="text-xs md:text-sm px-2 md:px-4">Ostalo</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="search" forceMount={activeTab === "search" ? true : undefined}>
                {activeTab === "search" && <SearchAndStats />}
              </TabsContent>
              
              <TabsContent value="ctp">
                <ChecklistView orderType="ctp" onNavigateToSearch={() => setActiveTab("search")} />
              </TabsContent>
              
              <TabsContent value="film">
                <ChecklistView orderType="film" onNavigateToSearch={() => setActiveTab("search")} />
              </TabsContent>
              
              <TabsContent value="digital">
                <ChecklistView orderType="digital" onNavigateToSearch={() => setActiveTab("search")} />
              </TabsContent>
              
              <TabsContent value="large_format">
                <ChecklistView orderType="large_format" onNavigateToSearch={() => setActiveTab("search")} />
              </TabsContent>
              
              <TabsContent value="other">
                <ChecklistView orderType="other" onNavigateToSearch={() => setActiveTab("search")} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Checklist;
