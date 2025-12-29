
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { OnlineUsersProvider } from "@/contexts/OnlineUsersContext";
import Index from "./pages/Index";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import WorkOrders from "./pages/WorkOrders";
import NewWorkOrder from "./pages/NewWorkOrder";
import WorkOrderDetails from "./pages/WorkOrderDetails";
import WorkOrderPrint from "./pages/WorkOrderPrint";
import Clients from "./pages/Clients";
import Inventory from "./pages/Inventory";
import Checklist from "./pages/Checklist";
import AdminPriceListDigital from "./pages/AdminPriceListDigital";
import AdminUsers from "./pages/AdminUsers";
import AdminInventory from "./pages/AdminInventory";
import DevPreview from "./pages/DevPreview";
import DeliveryNotePreview from "./pages/DeliveryNotePreview";
import OrderDeliveryNote from "./pages/OrderDeliveryNote";
import CtpStats from "./pages/CtpStats";
import DigitalStats from "./pages/DigitalStats";
import LargeFormatNew from "./pages/LargeFormatNew";
import NotFound from "./pages/NotFound";
import AdminGuard from "./components/guards/AdminGuard";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <OnlineUsersProvider>
        <TooltipProvider>
          <Toaster />
          <SonnerToaster richColors position="top-right" />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/work-orders" element={<WorkOrders />} />
              <Route path="/work-orders/new" element={<NewWorkOrder />} />
              <Route path="/work-orders/:id/edit" element={<NewWorkOrder />} />
              <Route path="/work-orders/:id/print" element={<WorkOrderPrint />} />
              <Route path="/work-orders/:id" element={<WorkOrderDetails />} />
              <Route path="/work-orders/:orderId/delivery-note" element={<OrderDeliveryNote />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/checklist" element={<Checklist />} />
              <Route path="/admin/price-list-digital" element={<AdminPriceListDigital />} />
              <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
              <Route path="/admin/inventory" element={<AdminGuard><AdminInventory /></AdminGuard>} />
              <Route path="/stats/ctp" element={<CtpStats />} />
              <Route path="/stats/digital" element={<DigitalStats />} />
              <Route path="/large-format/new" element={<LargeFormatNew />} />
              {import.meta.env.VITE_SHOW_DEV_PREVIEW === "true" && (
                <>
                  <Route path="/dev/preview" element={<DevPreview />} />
                  <Route path="/dev/preview/delivery-note" element={<DeliveryNotePreview />} />
                </>
              )}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </OnlineUsersProvider>
    </QueryClientProvider>
  );
};

export default App;
