import { useState, useMemo } from "react";
import { Client } from "@/hooks/useClients";
import { ClientQuickView } from "./ClientQuickView";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Pencil, 
  Mail, 
  Download, 
  Settings2, 
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from 'xlsx';

interface ClientsTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
}

type SortField = keyof Client | null;
type SortDirection = "asc" | "desc";

export const ClientsTable = ({ clients, onEdit }: ClientsTableProps) => {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [quickViewClient, setQuickViewClient] = useState<Client | null>(null);
  const [columnVisibility, setColumnVisibility] = useState({
    name: true,
    pib: true,
    maticni_broj: true,
    adresa: true,
    grad: true,
    postanski_broj: true,
    telefon: true,
    email: true,
    notification_email: true,
    rok_placanja_dana: true,
    rabat_procenat: true,
    next_follow_up_at: true,
    created_at: true,
  });

  // Sort clients
  const sortedClients = useMemo(() => {
    if (!sortField) return clients;

    return [...clients].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [clients, sortField, sortDirection]);

  // Paginate clients
  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedClients.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedClients, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedClients.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const toggleColumnVisibility = (column: keyof typeof columnVisibility) => {
    setColumnVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  // Helper to determine follow-up status
  const getFollowUpStatus = (date: string | null) => {
    if (!date) return null;
    
    const followUpDate = new Date(date);
    const now = new Date();
    const diffMs = followUpDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 0) return 'overdue'; // Past due
    if (diffHours <= 48) return 'soon'; // Within 48 hours
    return 'upcoming'; // Future
  };

  const getFollowUpBadge = (client: Client) => {
    if (!client.next_follow_up_at) return null;
    
    const status = getFollowUpStatus(client.next_follow_up_at);
    const dateStr = new Date(client.next_follow_up_at).toLocaleDateString("sr-RS");
    
    if (status === 'overdue') {
      return <Badge variant="destructive">{dateStr}</Badge>;
    }
    if (status === 'soon') {
      return <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30">{dateStr}</Badge>;
    }
    return <Badge variant="outline">{dateStr}</Badge>;
  };

  const exportToXLSX = () => {
    // Define column mapping with display names
    const columnMapping: Array<{ key: keyof typeof columnVisibility; header: string; accessor: (client: Client) => any }> = [
      { key: 'name', header: 'Naziv', accessor: (c) => c.name },
      { key: 'pib', header: 'PIB', accessor: (c) => c.pib || '' },
      { key: 'maticni_broj', header: 'Matični broj', accessor: (c) => c.maticni_broj || '' },
      { key: 'adresa', header: 'Adresa', accessor: (c) => c.adresa || '' },
      { key: 'grad', header: 'Grad', accessor: (c) => c.grad || '' },
      { key: 'postanski_broj', header: 'Poštanski broj', accessor: (c) => c.postanski_broj || '' },
      { key: 'telefon', header: 'Telefon', accessor: (c) => c.telefon || '' },
      { key: 'email', header: 'Email', accessor: (c) => c.email || '' },
      { key: 'notification_email', header: 'Email za obaveštenja', accessor: (c) => c.notification_email || '' },
      { key: 'rok_placanja_dana', header: 'Rok plaćanja (dana)', accessor: (c) => c.rok_placanja_dana },
      { key: 'rabat_procenat', header: 'Rabat (%)', accessor: (c) => c.rabat_procenat },
      { key: 'next_follow_up_at', header: 'Sledeći follow-up', accessor: (c) => c.next_follow_up_at ? new Date(c.next_follow_up_at).toLocaleDateString("sr-RS") : '' },
      { key: 'created_at', header: 'Datum kreiranja', accessor: (c) => new Date(c.created_at).toLocaleDateString("sr-RS") },
    ];

    // Filter to only visible columns
    const visibleColumns = columnMapping.filter(col => columnVisibility[col.key]);

    // Build headers and rows based on visible columns
    const headers = visibleColumns.map(col => col.header);
    const rows = sortedClients.map(client => 
      visibleColumns.map(col => col.accessor(client))
    );

    // Create worksheet from headers and rows
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    
    // Create workbook and add worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Klijenti');

    // Generate filename with timestamp
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `clients_export_${timestamp}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  };

  const exportToCSV = () => {
    const headers = [
      "Naziv",
      "PIB",
      "Matični broj",
      "Adresa",
      "Grad",
      "Poštanski broj",
      "Telefon",
      "Email",
      "Email za obaveštenja",
      "Rok plaćanja (dana)",
      "Rabat (%)",
      "Datum kreiranja",
    ];

    const rows = sortedClients.map((client) => [
      client.name,
      client.pib || "",
      client.maticni_broj || "",
      client.adresa || "",
      client.grad || "",
      client.postanski_broj || "",
      client.telefon || "",
      client.email || "",
      client.notification_email || "",
      client.rok_placanja_dana,
      client.rabat_procenat,
      new Date(client.created_at).toLocaleDateString("sr-RS"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `klijenti_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Count */}
      <div className="text-sm text-muted-foreground">
        Pronađeno: <span className="font-semibold text-foreground">{sortedClients.length}</span> klijenata
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="h-4 w-4 mr-2" />
              Kolone
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuCheckboxItem
              checked={columnVisibility.name}
              onCheckedChange={() => toggleColumnVisibility("name")}
            >
              Naziv
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.pib}
              onCheckedChange={() => toggleColumnVisibility("pib")}
            >
              PIB
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.maticni_broj}
              onCheckedChange={() => toggleColumnVisibility("maticni_broj")}
            >
              Matični broj
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.adresa}
              onCheckedChange={() => toggleColumnVisibility("adresa")}
            >
              Adresa
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.grad}
              onCheckedChange={() => toggleColumnVisibility("grad")}
            >
              Grad
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.postanski_broj}
              onCheckedChange={() => toggleColumnVisibility("postanski_broj")}
            >
              Poštanski broj
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.telefon}
              onCheckedChange={() => toggleColumnVisibility("telefon")}
            >
              Telefon
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.email}
              onCheckedChange={() => toggleColumnVisibility("email")}
            >
              Email
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.notification_email}
              onCheckedChange={() => toggleColumnVisibility("notification_email")}
            >
              Email za obaveštenja
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.rok_placanja_dana}
              onCheckedChange={() => toggleColumnVisibility("rok_placanja_dana")}
            >
              Rok plaćanja
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.rabat_procenat}
              onCheckedChange={() => toggleColumnVisibility("rabat_procenat")}
            >
              Rabat
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.next_follow_up_at}
              onCheckedChange={() => toggleColumnVisibility("next_follow_up_at")}
            >
              Sledeći follow-up
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={columnVisibility.created_at}
              onCheckedChange={() => toggleColumnVisibility("created_at")}
            >
              Datum kreiranja
            </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={exportToCSV}
          disabled={sortedClients.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={exportToXLSX}
          disabled={sortedClients.length === 0}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export XLSX
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Redova po stranici:</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {itemsPerPage}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuCheckboxItem
                checked={itemsPerPage === 25}
                onCheckedChange={() => {
                  setItemsPerPage(25);
                  setCurrentPage(1);
                }}
              >
                25
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={itemsPerPage === 50}
                onCheckedChange={() => {
                  setItemsPerPage(50);
                  setCurrentPage(1);
                }}
              >
                50
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={itemsPerPage === 100}
                onCheckedChange={() => {
                  setItemsPerPage(100);
                  setCurrentPage(1);
                }}
              >
                100
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columnVisibility.name && (
                <TableHead>
                  <SortButton field="name">Naziv</SortButton>
                </TableHead>
              )}
              {columnVisibility.pib && (
                <TableHead>
                  <SortButton field="pib">PIB</SortButton>
                </TableHead>
              )}
              {columnVisibility.maticni_broj && (
                <TableHead>
                  <SortButton field="maticni_broj">Matični broj</SortButton>
                </TableHead>
              )}
              {columnVisibility.adresa && (
                <TableHead>
                  <SortButton field="adresa">Adresa</SortButton>
                </TableHead>
              )}
              {columnVisibility.grad && (
                <TableHead>
                  <SortButton field="grad">Grad</SortButton>
                </TableHead>
              )}
              {columnVisibility.postanski_broj && (
                <TableHead>
                  <SortButton field="postanski_broj">Poštanski broj</SortButton>
                </TableHead>
              )}
              {columnVisibility.telefon && (
                <TableHead>
                  <SortButton field="telefon">Telefon</SortButton>
                </TableHead>
              )}
              {columnVisibility.email && (
                <TableHead>
                  <SortButton field="email">Email</SortButton>
                </TableHead>
              )}
              {columnVisibility.notification_email && (
                <TableHead>
                  <SortButton field="notification_email">Email za obaveštenja</SortButton>
                </TableHead>
              )}
              {columnVisibility.rok_placanja_dana && (
                <TableHead>
                  <SortButton field="rok_placanja_dana">Rok plaćanja (dana)</SortButton>
                </TableHead>
              )}
              {columnVisibility.rabat_procenat && (
                <TableHead>
                  <SortButton field="rabat_procenat">Rabat (%)</SortButton>
                </TableHead>
              )}
              {columnVisibility.next_follow_up_at && (
                <TableHead>
                  <SortButton field="next_follow_up_at">Sledeći follow-up</SortButton>
                </TableHead>
              )}
              {columnVisibility.created_at && (
                <TableHead>
                  <SortButton field="created_at">Datum kreiranja</SortButton>
                </TableHead>
              )}
              <TableHead className="text-right">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                  Nema klijenata za prikaz.
                </TableCell>
              </TableRow>
            ) : (
              paginatedClients.map((client) => (
                <TableRow 
                  key={client.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setQuickViewClient(client)}
                >
                   {columnVisibility.name && (
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{client.name}</span>
                        {client.is_vip && (
                          <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30">VIP</Badge>
                        )}
                        {client.is_blocked && (
                          <Badge variant="destructive">Blokiran</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {client.segment === 'novi' && 'Novi'}
                          {client.segment === 'redovan' && 'Redovan'}
                          {client.segment === 'premium' && 'Premium'}
                        </Badge>
                      </div>
                    </TableCell>
                  )}
                  {columnVisibility.pib && (
                    <TableCell>{client.pib || "-"}</TableCell>
                  )}
                  {columnVisibility.maticni_broj && (
                    <TableCell>{client.maticni_broj || "-"}</TableCell>
                  )}
                  {columnVisibility.adresa && (
                    <TableCell className="max-w-[200px] truncate">{client.adresa || "-"}</TableCell>
                  )}
                  {columnVisibility.grad && (
                    <TableCell>{client.grad || "-"}</TableCell>
                  )}
                  {columnVisibility.postanski_broj && (
                    <TableCell>{client.postanski_broj || "-"}</TableCell>
                  )}
                  {columnVisibility.telefon && (
                    <TableCell>{client.telefon || "-"}</TableCell>
                  )}
                  {columnVisibility.email && (
                    <TableCell>
                      {client.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{client.email}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  )}
                  {columnVisibility.notification_email && (
                    <TableCell>
                      {client.notification_email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{client.notification_email}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  )}
                  {columnVisibility.rok_placanja_dana && (
                    <TableCell>
                      <Badge variant="outline">{client.rok_placanja_dana} dana</Badge>
                    </TableCell>
                  )}
                  {columnVisibility.rabat_procenat && (
                    <TableCell>
                      <Badge variant="secondary">{client.rabat_procenat}%</Badge>
                    </TableCell>
                  )}
                  {columnVisibility.next_follow_up_at && (
                    <TableCell>
                      {getFollowUpBadge(client) || "-"}
                    </TableCell>
                  )}
                  {columnVisibility.created_at && (
                    <TableCell>
                      {new Date(client.created_at).toLocaleDateString("sr-RS")}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickViewClient(client);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(client);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Prikazano {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, sortedClients.length)} od {sortedClients.length} rezultata
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Prethodna
            </Button>
            <span className="text-sm">
              Strana {currentPage} od {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Sledeća
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      <ClientQuickView
        client={quickViewClient}
        open={!!quickViewClient}
        onOpenChange={(open) => !open && setQuickViewClient(null)}
        onEdit={onEdit}
      />
    </div>
  );
};
