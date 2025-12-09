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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Nazad
            </Button>
            <h1 className="text-2xl font-bold">Checklist</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Pregled radnih naloga po tipu</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="search">Pretraga</TabsTrigger>
                <TabsTrigger value="ctp">CTP</TabsTrigger>
                <TabsTrigger value="film">Filmovanje</TabsTrigger>
                <TabsTrigger value="digital">Digitala</TabsTrigger>
                <TabsTrigger value="large_format">Veliki Formati</TabsTrigger>
                <TabsTrigger value="other">Ostalo</TabsTrigger>
              </TabsList>
              
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
