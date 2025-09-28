
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Folder, 
  File as FileIcon, 
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Eye
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface UnifiedFileInfo {
  id?: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  absolutePath: string;
  size: number;
  permissions: string;
  owner?: string;
  created: string;
  modified: string;
  isHidden: boolean;
  extension?: string;
  mimeType?: string;
}

interface FileItemProps {
  item: UnifiedFileInfo;
  viewMode: 'grid' | 'list';
  isSelected: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  onPreview?: () => void;
}

export function FileItem({ 
  item, 
  viewMode, 
  isSelected, 
  onClick, 
  onEdit, 
  onCopy, 
  onDelete, 
  onPreview 
}: FileItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const Icon = item.type === 'directory' ? Folder : FileIcon;

  if (viewMode === 'grid') {
    return (
      <Card
        className={cn(
          "p-4 cursor-pointer transition-all hover:shadow-md relative",
          isSelected && "ring-2 ring-blue-500 bg-blue-50"
        )}
        onClick={onClick}
      >
        <div className="flex flex-col items-center gap-3">
          <Icon className="w-8 h-8 text-muted-foreground" />
          <div className="text-center w-full">
            <p className="font-medium text-sm truncate max-w-[120px] mx-auto" title={item.name}>
              {item.name}
            </p>
            <div className="flex flex-col gap-1 mt-2">
              <Badge variant="outline" className="text-xs mx-auto">
                {item.type === 'directory' ? 'مجلد' : formatFileSize(item.size)}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(item.modified)}
              </p>
            </div>
          </div>
        </div>

        {/* Actions menu */}
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(true);
              }}
            >
              <MoreVertical className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {item.type === 'file' && onPreview && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPreview(); }}>
                <Eye className="w-4 h-4 mr-2" />
                معاينة
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit className="w-4 h-4 mr-2" />
                إعادة تسمية
              </DropdownMenuItem>
            )}
            {onCopy && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy(); }}>
                <Copy className="w-4 h-4 mr-2" />
                نسخ
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem 
                className="text-red-600"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                حذف
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
    );
  }

  // List view
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-muted/50",
        isSelected && "bg-blue-50 ring-1 ring-blue-500"
      )}
      onClick={onClick}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{item.type === 'directory' ? 'مجلد' : formatFileSize(item.size)}</span>
          <span>{formatDate(item.modified)}</span>
        </div>
      </div>
      
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(true);
            }}
          >
            <MoreVertical className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.type === 'file' && onPreview && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPreview(); }}>
              <Eye className="w-4 h-4 mr-2" />
              معاينة
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Edit className="w-4 h-4 mr-2" />
              إعادة تسمية
            </DropdownMenuItem>
          )}
          {onCopy && (
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopy(); }}>
              <Copy className="w-4 h-4 mr-2" />
              نسخ
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem 
              className="text-red-600"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              حذف
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
