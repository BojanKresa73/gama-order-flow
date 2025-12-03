import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUp, ClipboardList } from "lucide-react";

interface CtpItem {
  file_name: string;
  plate_format_id: string;
  quantity: number;
}

interface AddCtpFilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddFiles: (items: CtpItem[]) => void;
  defaultQuantity?: number;
}

export const AddCtpFilesModal = ({ 
  open, 
  onOpenChange, 
  onAddFiles,
  defaultQuantity = 4 
}: AddCtpFilesModalProps) => {
  const [fileList, setFileList] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newItems: CtpItem[] = files.map(file => ({
      file_name: file.name,
      plate_format_id: "",
      quantity: defaultQuantity
    }));

    if (newItems.length > 0) {
      onAddFiles(newItems);
      onOpenChange(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePasteList = () => {
    const lines = fileList.split("\n").filter(line => line.trim() !== "");
    const newItems: CtpItem[] = lines.map(line => ({
      file_name: line.trim(),
      plate_format_id: "",
      quantity: defaultQuantity
    }));

    if (newItems.length > 0) {
      onAddFiles(newItems);
      setFileList("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dodaj fajlove</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="files" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              Izaberi fajlove
            </TabsTrigger>
            <TabsTrigger value="paste" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Dodaj iz memorije
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="files" className="mt-4">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Izaberite fajlove sa vašeg računara. Nazivi fajlova će biti dodati u nalog.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="ctp-file-upload-modal"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => document.getElementById('ctp-file-upload-modal')?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <FileUp className="h-6 w-6" />
                  <span>Kliknite za izbor fajlova</span>
                </div>
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="paste" className="mt-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-list">Nazivi fajlova (svaki u novom redu)</Label>
                <Textarea
                  id="file-list"
                  placeholder="primer1.pdf&#10;primer2.pdf&#10;primer3.pdf"
                  value={fileList}
                  onChange={(e) => setFileList(e.target.value)}
                  className="mt-2 min-h-[200px] font-mono text-sm"
                />
              </div>
              <Button
                type="button"
                onClick={handlePasteList}
                disabled={!fileList.trim()}
                className="w-full"
              >
                Dodaj {fileList.split("\n").filter(l => l.trim()).length || 0} fajlova
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
