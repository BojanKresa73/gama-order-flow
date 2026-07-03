import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { OnlineUsersProvider } from "@/contexts/OnlineUsersContext";
import { OnlinePortalUsersProvider } from "@/contexts/OnlinePortalUsersContext";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Register = lazy(() => import("./pages/Register"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const WorkOrders = lazy(() => import("./pages/WorkOrders"));
const NewWorkOrder = lazy(() => import("./pages/NewWorkOrder"));
const WorkOrderDetails = lazy(() => import("./pages/WorkOrderDetails"));
const WorkOrderPrint = lazy(() => import("./pages/WorkOrderPrint"));
const Clients = lazy(() => import("./pages/Clients"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Procurement = lazy(() => import("./pages/Procurement"));
const Checklist = lazy(() => import("./pages/Checklist"));
const AdminPriceListDigital = lazy(() => import("./pages/AdminPriceListDigital"));
const AdminDigitalCatalog = lazy(() => import("./pages/AdminDigitalCatalog"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminInventory = lazy(() => import("./pages/AdminInventory"));
const AdminPriority = lazy(() => import("./pages/AdminPriority"));
const DevPreview = lazy(() => import("./pages/DevPreview"));
const DeliveryNotePreview = lazy(() => import("./pages/DeliveryNotePreview"));
const DeliveryNotePdfPreview = lazy(() => import("./pages/DeliveryNotePdfPreview"));
const OrderDeliveryNote = lazy(() => import("./pages/OrderDeliveryNote"));
const CtpStats = lazy(() => import("./pages/CtpStats"));
const DigitalStats = lazy(() => import("./pages/DigitalStats"));
const LargeFormatNew = lazy(() => import("./pages/LargeFormatNew"));
const ClientDeliveryReport = lazy(() => import("./pages/ClientDeliveryReport"));
const ClientPortal = lazy(() => import("./pages/ClientPortal"));
const ClientPortalLogin = lazy(() => import("./pages/ClientPortalLogin"));
const SretenjeNewsletter = lazy(() => import("./pages/SretenjeNewsletter"));
const AdminNewsletter = lazy(() => import("./pages/AdminNewsletter"));
const Vacations = lazy(() => import("./pages/Vacations"));
const Quotes = lazy(() => import("./pages/Quotes"));
const QuotesPro = lazy(() => import("./pages/QuotesPro"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Guards are small - keep synchronous
import AdminGuard from "./components/guards/AdminGuard";
import InternalUserGuard from "./components/guards/InternalUserGuard";
import { ErrorBoundary } from "./components/ErrorBoundary";

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <OnlineUsersProvider>
        <OnlinePortalUsersProvider>
          <TooltipProvider>
          <Toaster />
          <SonnerToaster richColors position="top-right" />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/register" element={<Register />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                <Route path="/sretenje" element={<SretenjeNewsletter />} />
                
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
                <Route path="/admin/digital-catalog" element={<AdminGuard><AdminDigitalCatalog /></AdminGuard>} />
                <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
                <Route path="/admin/inventory" element={<AdminGuard><AdminInventory /></AdminGuard>} />
                <Route path="/admin/priority" element={<AdminGuard><AdminPriority /></AdminGuard>} />
                <Route path="/admin/newsletter" element={<AdminGuard><AdminNewsletter /></AdminGuard>} />
                <Route path="/stats/ctp" element={<InternalUserGuard><CtpStats /></InternalUserGuard>} />
                <Route path="/stats/digital" element={<InternalUserGuard><DigitalStats /></InternalUserGuard>} />
                <Route path="/large-format/new" element={<InternalUserGuard><LargeFormatNew /></InternalUserGuard>} />
                <Route path="/reports/delivery-notes" element={<InternalUserGuard><ClientDeliveryReport /></InternalUserGuard>} />
                <Route path="/vacations" element={<InternalUserGuard><Vacations /></InternalUserGuard>} />
                <Route path="/quotes" element={<AdminGuard><Quotes /></AdminGuard>} />
                <Route path="/quotes-pro" element={<AdminGuard><QuotesPro /></AdminGuard>} />
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
            </Suspense>
          </BrowserRouter>
          </TooltipProvider>
        </OnlinePortalUsersProvider>
      </OnlineUsersProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
