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

interface LargeFormatJob {
  file_name: string;
  width_mm: number;
  height_mm: number;
  qty: number;
  note: string;
}

interface AddLargeFormatJobsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddJobs: (jobs: LargeFormatJob[]) => void;
}

// Parse dimensions from filename like "100x200" or "100×200"
const parseDimensionsFromFilename = (filename: string): { width: number; height: number } | null => {
  const match = filename.match(/(\d+)[x×](\d+)/i);
  if (match) {
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10)
    };
  }
  return null;
};

export const AddLargeFormatJobsModal = ({ 
  open, 
  onOpenChange, 
  onAddJobs 
}: AddLargeFormatJobsModalProps) => {
  const [fileList, setFileList] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newJobs: LargeFormatJob[] = files.map(file => {
      const dimensions = parseDimensionsFromFilename(file.name);
      return {
        file_name: file.name,
        width_mm: dimensions?.width || 0,
        height_mm: dimensions?.height || 0,
        qty: 1,
        note: ""
      };
    });

    if (newJobs.length > 0) {
      onAddJobs(newJobs);
      onOpenChange(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePasteList = () => {
    const lines = fileList.split("\n").filter(line => line.trim() !== "");
    const newJobs: LargeFormatJob[] = lines.map(line => {
      const trimmedLine = line.trim();
      const dimensions = parseDimensionsFromFilename(trimmedLine);
      return {
        file_name: trimmedLine,
        width_mm: dimensions?.width || 0,
        height_mm: dimensions?.height || 0,
        qty: 1,
        note: ""
      };
    });

    if (newJobs.length > 0) {
      onAddJobs(newJobs);
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
                Dimenzije će biti automatski prepoznate ako su u formatu "širina×visina" (npr. 100x200).
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="large-format-file-upload"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => document.getElementById('large-format-file-upload')?.click()}
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
                <p className="text-sm text-muted-foreground mb-2">
                  Dimenzije će biti automatski prepoznate ako su u formatu "širina×visina" (npr. poster_100x200.pdf)
                </p>
                <Textarea
                  id="file-list"
                  placeholder="poster_100x200.pdf&#10;banner_150x50.pdf&#10;nalepnica_30x30.pdf"
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
