
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { OnlineUsersProvider } from "@/contexts/OnlineUsersContext";
import { OnlinePortalUsersProvider } from "@/contexts/OnlinePortalUsersContext";
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
import Procurement from "./pages/Procurement";
import Checklist from "./pages/Checklist";
import AdminPriceListDigital from "./pages/AdminPriceListDigital";
import AdminUsers from "./pages/AdminUsers";
import AdminInventory from "./pages/AdminInventory";
import AdminPriority from "./pages/AdminPriority";
import DevPreview from "./pages/DevPreview";
import DeliveryNotePreview from "./pages/DeliveryNotePreview";
import DeliveryNotePdfPreview from "./pages/DeliveryNotePdfPreview";
import OrderDeliveryNote from "./pages/OrderDeliveryNote";
import CtpStats from "./pages/CtpStats";
import DigitalStats from "./pages/DigitalStats";
import LargeFormatNew from "./pages/LargeFormatNew";
import ClientPortal from "./pages/ClientPortal";
import ClientPortalLogin from "./pages/ClientPortalLogin";
import NotFound from "./pages/NotFound";
import AdminGuard from "./components/guards/AdminGuard";
import InternalUserGuard from "./components/guards/InternalUserGuard";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <OnlineUsersProvider>
        <OnlinePortalUsersProvider>
          <TooltipProvider>
          <Toaster />
          <SonnerToaster richColors position="top-right" />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Client Portal routes (separate from internal app) */}
              <Route path="/portal" element={<ClientPortal />} />
              <Route path="/portal/login" element={<ClientPortalLogin />} />
              
              {/* Internal app routes - protected from client_user */}
              <Route path="/dashboard" element={<InternalUserGuard><Dashboard /></InternalUserGuard>} />
              <Route path="/work-orders" element={<InternalUserGuard><WorkOrders /></InternalUserGuard>} />
              <Route path="/work-orders/new" element={<InternalUserGuard><NewWorkOrder /></InternalUserGuard>} />
              <Route path="/work-orders/:id/edit" element={<InternalUserGuard><NewWorkOrder /></InternalUserGuard>} />
              <Route path="/work-orders/:id/print" element={<InternalUserGuard><WorkOrderPrint /></InternalUserGuard>} />
              <Route path="/work-orders/:id" element={<InternalUserGuard><WorkOrderDetails /></InternalUserGuard>} />
              <Route path="/work-orders/:orderId/delivery-note" element={<InternalUserGuard><OrderDeliveryNote /></InternalUserGuard>} />
              <Route path="/clients" element={<InternalUserGuard><Clients /></InternalUserGuard>} />
              <Route path="/inventory" element={<InternalUserGuard><Inventory /></InternalUserGuard>} />
              <Route path="/nabavka" element={<InternalUserGuard><Procurement /></InternalUserGuard>} />
              <Route path="/checklist" element={<InternalUserGuard><Checklist /></InternalUserGuard>} />
              <Route path="/admin/price-list-digital" element={<InternalUserGuard><AdminPriceListDigital /></InternalUserGuard>} />
              <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
              <Route path="/admin/inventory" element={<AdminGuard><AdminInventory /></AdminGuard>} />
              <Route path="/admin/priority" element={<AdminGuard><AdminPriority /></AdminGuard>} />
              <Route path="/stats/ctp" element={<InternalUserGuard><CtpStats /></InternalUserGuard>} />
              <Route path="/stats/digital" element={<InternalUserGuard><DigitalStats /></InternalUserGuard>} />
              <Route path="/large-format/new" element={<InternalUserGuard><LargeFormatNew /></InternalUserGuard>} />
              {import.meta.env.VITE_SHOW_DEV_PREVIEW === "true" && (
              <>
                  <Route path="/dev/preview" element={<DevPreview />} />
                  <Route path="/dev/preview/delivery-note" element={<DeliveryNotePreview />} />
                  <Route path="/dev/preview/delivery-note-pdf" element={<DeliveryNotePdfPreview />} />
                </>
              )}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </TooltipProvider>
        </OnlinePortalUsersProvider>
      </OnlineUsersProvider>
    </QueryClientProvider>
  );
};

export default App;
