
import React from 'react';
import { Folder, File as FileIcon, Image, Music, Video, Archive, FileText, Code, Settings } from 'lucide-react';

interface FileIconProps {
  type: 'file' | 'directory';
  extension?: string;
  name: string;
  className?: string;
}

export function FileIconComponent({ type, extension, name, className = "w-6 h-6" }: FileIconProps) {
  // استخدام الأيقونات المستخرجة للمجلدات
  if (type === 'directory') {
    return (
      <div className={`${className} relative`}>
        <Folder className="text-blue-600" />
      </div>
    );
  }

  // تحديد نوع الملف بناءً على الامتداد
  const getFileIcon = () => {
    if (!extension) return <FileIcon className="text-gray-500" />;
    
    const ext = extension.toLowerCase().replace('.', '');
    
    // أيقونات الصور
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) {
      return <Image className="text-green-600" />;
    }
    
    // أيقونات الصوت
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) {
      return <Music className="text-purple-600" />;
    }
    
    // أيقونات الفيديو
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return <Video className="text-red-600" />;
    }
    
    // أيقونات الأرشيف
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return <Archive className="text-orange-600" />;
    }
    
    // أيقونات النصوص
    if (['txt', 'doc', 'docx', 'pdf', 'rtf'].includes(ext)) {
      return <FileText className="text-blue-600" />;
    }
    
    // أيقونات البرمجة
    if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py', 'java', 'cpp', 'c', 'php'].includes(ext)) {
      return <Code className="text-yellow-600" />;
    }
    
    // أيقونات التكوين
    if (['json', 'xml', 'yaml', 'yml', 'ini', 'conf', 'config'].includes(ext)) {
      return <Settings className="text-gray-600" />;
    }
    
    // أيقونة افتراضية
    return <FileIcon className="text-gray-500" />;
  };

  return (
    <div className={`${className} relative`}>
      {getFileIcon()}
    </div>
  );
}
