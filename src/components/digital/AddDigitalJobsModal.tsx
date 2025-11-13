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
import { LocalDigitalJob } from "./LocalDigitalJobsTable";

interface AddDigitalJobsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddJobs: (jobs: LocalDigitalJob[]) => void;
}

const parseDimensionsFromFilename = (filename: string): { width?: number; height?: number } => {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  
  // Match patterns like "210x297" or "210×297"
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

export const AddDigitalJobsModal = ({ open, onOpenChange, onAddJobs }: AddDigitalJobsModalProps) => {
  const [fileList, setFileList] = useState<string>("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newJobs: LocalDigitalJob[] = [];
    
    Array.from(files).forEach((file) => {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const dimensions = parseDimensionsFromFilename(file.name);
      
      newJobs.push({
        file_name: nameWithoutExt,
        finished_w_mm: dimensions.width || 0,
        finished_h_mm: dimensions.height || 0,
        pages: 1,
        qty: 1,
        is_test_print: false,
        print_sides: "4/4", // Default
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

    const newJobs: LocalDigitalJob[] = lines.map((line) => {
      const trimmedLine = line.trim();
      const dimensions = parseDimensionsFromFilename(trimmedLine);
      
      return {
        file_name: trimmedLine,
        finished_w_mm: dimensions.width || 0,
        finished_h_mm: dimensions.height || 0,
        pages: 1,
        qty: 1,
        is_test_print: false,
        print_sides: "4/4", // Default
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
                Dimenzije se automatski prepoznaju iz naziva (npr. "210x297.pdf")
              </p>
            </div>
          </TabsContent>

          <TabsContent value="paste" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paste-input">
                Nalepi listu naziva (jedan po redu)
              </Label>
              <Textarea
                id="paste-input"
                value={fileList}
                onChange={(e) => setFileList(e.target.value)}
                placeholder="210x297.pdf&#10;420x594.pdf&#10;..."
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                Dimenzije se automatski prepoznaju iz naziva (npr. "210x297")
              </p>
            </div>
            <Button onClick={handlePasteList} className="w-full">
              Dodaj {fileList.split("\n").filter((l) => l.trim()).length} stavki
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
