import { useState } from "react";
import { Upload, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalFilmJob } from "./LocalFilmJobsTable";

interface AddFilmJobsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddJobs: (jobs: LocalFilmJob[]) => void;
}

const parseDimensionsFromFilename = (filename: string): { width?: number; height?: number } => {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // Match patterns like "745x605" or "745×605"
  const dimensionPattern = /(\d+)[x×](\d+)/i;
  const match = nameWithoutExt.match(dimensionPattern);
  
  if (match) {
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10),
    };
  }
  
  return {};
};

export const AddFilmJobsModal = ({ open, onOpenChange, onAddJobs }: AddFilmJobsModalProps) => {
  const [fileList, setFileList] = useState<string>("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newJobs: LocalFilmJob[] = [];
    
    Array.from(files).forEach((file) => {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const dimensions = parseDimensionsFromFilename(file.name);
      
      newJobs.push({
        file_name: nameWithoutExt,
        width_mm: dimensions.width || 0,
        height_mm: dimensions.height || 0,
        qty: 1,
        allow_rotate_90: true,
        margin_mm: 0,
        note: "",
      });
    });

    if (newJobs.length > 0) {
      onAddJobs(newJobs);
      onOpenChange(false);
      // Reset file input
      e.target.value = "";
    }
  };

  const handlePasteList = () => {
    const lines = fileList.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return;

    const newJobs: LocalFilmJob[] = lines.map((line) => {
      const trimmedLine = line.trim();
      const dimensions = parseDimensionsFromFilename(trimmedLine);
      
      return {
        file_name: trimmedLine,
        width_mm: dimensions.width || 0,
        height_mm: dimensions.height || 0,
        qty: 1,
        allow_rotate_90: true,
        margin_mm: 0,
        note: "",
      };
    });

    onAddJobs(newJobs);
    setFileList("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dodaj fajlove</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files">
              <Upload className="h-4 w-4 mr-2" />
              Izaberi sa računara
            </TabsTrigger>
            <TabsTrigger value="paste">
              <FileText className="h-4 w-4 mr-2" />
              Nalepi listu
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-input">
                Izaberi fajlove (čitaju se samo nazivi, ne uploaduju se fajlovi)
              </Label>
              <Input
                id="file-input"
                type="file"
                multiple
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              <p className="text-sm text-muted-foreground">
                TIP: Ako naziv sadrži dimenzije (npr. "ime_745x605.pdf"), dimenzije će biti automatski popunjene.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-list">
                Nalepi listu naziva fajlova (jedan po liniji)
              </Label>
              <Textarea
                id="file-list"
                value={fileList}
                onChange={(e) => setFileList(e.target.value)}
                placeholder="ime_fajla_745x605&#10;drugi_fajl&#10;treci_fajl_1000x700"
                rows={10}
              />
              <p className="text-sm text-muted-foreground">
                TIP: Ako naziv sadrži dimenzije (npr. "ime_745x605"), dimenzije će biti automatski popunjene.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handlePasteList} disabled={!fileList.trim()}>
                Dodaj
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
