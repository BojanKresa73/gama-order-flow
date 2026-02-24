import { Button } from "@/components/ui/button";
import { Download, FileCode, Receipt, FileText, Loader2 } from "lucide-react";

interface WorkOrderExportActionsProps {
  selectedCount: number;
  isExporting: boolean;
  isExportingXml: boolean;
  isExportingPdf: boolean;
  isInvoicing: boolean;
  isSuper: boolean;
  isAdminPlus: boolean;
  onExportExcel: () => void;
  onExportMinimaxXml: () => void;
  onBulkInvoice: () => void;
  onBatchPdf: () => void;
}

export const WorkOrderExportActions = ({
  selectedCount,
  isExporting,
  isExportingXml,
  isExportingPdf,
  isInvoicing,
  isSuper,
  isAdminPlus,
  onExportExcel,
  onExportMinimaxXml,
  onBulkInvoice,
  onBatchPdf,
}: WorkOrderExportActionsProps) => {
  if (selectedCount === 0) return null;

  return (
    <>
      <Button onClick={onExportExcel} variant="outline" disabled={isExporting}>
        {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
        Excel ({selectedCount})
      </Button>
      {(isSuper || isAdminPlus) && (
        <Button onClick={onExportMinimaxXml} variant="outline" disabled={isExportingXml} title="Izvoz zatvorenih CTP naloga u Minimax XML">
          {isExportingXml ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCode className="h-4 w-4 mr-2" />}
          Minimax XML
        </Button>
      )}
      <Button onClick={onBulkInvoice} variant="outline" disabled={isInvoicing}>
        {isInvoicing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
        Fakturisano ({selectedCount})
      </Button>
      <Button onClick={onBatchPdf} variant="outline" disabled={isExportingPdf} title="Preuzmi sve otpremnice kao jedan PDF">
        {isExportingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
        PDF otpremnice ({selectedCount})
      </Button>
    </>
  );
};
