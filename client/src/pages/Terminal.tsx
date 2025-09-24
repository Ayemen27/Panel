import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Terminal as TerminalIcon, 
  Play, 
  Trash2, 
  Copy,
  CheckCircle,
  AlertCircle,
  Clock
} from "lucide-react";

interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  success: boolean;
  timestamp: Date;
}

const ALLOWED_COMMANDS = [
  'nginx -t',
  'systemctl reload nginx',
  'systemctl status nginx',
  'pm2 list',
  'pm2 status',
  'certbot renew --dry-run',
  'df -h',
  'free -h',
  'top -bn1',
  'ps aux | head -20',
  'netstat -tlnp',
  'systemctl status',
];

const QUICK_COMMANDS = [
  { label: 'فحص تكوين Nginx', command: 'nginx -t' },
  { label: 'إعادة تحميل Nginx', command: 'systemctl reload nginx' },
  { label: 'حالة Nginx', command: 'systemctl status nginx' },
  { label: 'قائمة PM2', command: 'pm2 list' },
  { label: 'مساحة القرص', command: 'df -h' },
  { label: 'استخدام الذاكرة', command: 'free -h' },
  { label: 'العمليات النشطة', command: 'ps aux | head -20' },
  { label: 'المنافذ المفتوحة', command: 'netstat -tlnp' },
];

export default function Terminal() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<CommandResult[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "غير مخول",
        description: "أنت غير مسجل دخول. جاري تسجيل الدخول مرة أخرى...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const executeCommandMutation = useMutation({
    mutationFn: async (cmd: string) => {
      const response = await apiRequest("POST", "/api/terminal/execute", { command: cmd });
      return response.json();
    },
    onSuccess: (data, cmd) => {
      const result: CommandResult = {
        command: cmd,
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        success: data.success,
        timestamp: new Date(),
      };
      
      setHistory(prev => [...prev, result]);
      
      // Add to command history if not already present
      setCommandHistory(prev => {
        const filtered = prev.filter(c => c !== cmd);
        return [cmd, ...filtered].slice(0, 50); // Keep last 50 commands
      });
      
      setCommand("");
      setHistoryIndex(-1);
      
      if (!data.success) {
        toast({
          title: "فشل تنفيذ الأمر",
          description: data.stderr || "حدث خطأ غير معروف",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "غير مخول",
          description: "أنت غير مسجل دخول. جاري تسجيل الدخول مرة أخرى...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "خطأ في تنفيذ الأمر",
        description: error instanceof Error ? error.message : "فشل في تنفيذ الأمر",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    
    const trimmedCommand = command.trim();
    
    if (!ALLOWED_COMMANDS.includes(trimmedCommand)) {
      toast({
        title: "أمر غير مسموح",
        description: "هذا الأمر غير مسموح لأسباب أمنية",
        variant: "destructive",
      });
      return;
    }
    
    executeCommandMutation.mutate(trimmedCommand);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand("");
      }
    }
  };

  const clearHistory = () => {
    setHistory([]);
    toast({
      title: "تم مسح السجل",
      description: "تم مسح سجل الأوامر بنجاح",
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "تم النسخ",
        description: "تم نسخ النص إلى الحافظة",
      });
    });
  };

  const executeQuickCommand = (cmd: string) => {
    setCommand(cmd);
    executeCommandMutation.mutate(cmd);
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="terminal-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">الطرفية</h2>
          <p className="text-muted-foreground">تنفيذ الأوامر الآمنة على النظام</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-500 border-green-500">
            <CheckCircle className="w-3 h-3 ml-1" />
            آمن ومحدود
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            disabled={history.length === 0}
            data-testid="button-clear-history"
          >
            <Trash2 className="w-4 h-4 ml-2" />
            مسح السجل
          </Button>
        </div>
      </div>

      {/* Quick Commands */}
      <Card data-testid="quick-commands">
        <CardHeader>
          <CardTitle className="text-lg">الأوامر السريعة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {QUICK_COMMANDS.map((quickCmd, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => executeQuickCommand(quickCmd.command)}
                disabled={executeCommandMutation.isPending}
                className="justify-start h-auto py-3 px-4"
                data-testid={`quick-command-${index}`}
              >
                <div className="text-right">
                  <div className="font-medium text-sm">{quickCmd.label}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {quickCmd.command}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Terminal Interface */}
      <Card className="min-h-[500px]" data-testid="terminal-interface">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TerminalIcon className="w-5 h-5" />
            طرفية النظام
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Output Area */}
          <div 
            ref={outputRef}
            className="bg-gray-900 text-green-400 font-mono text-sm p-4 h-96 overflow-y-auto"
            data-testid="terminal-output"
          >
            {history.length === 0 ? (
              <div className="text-gray-500">
                مرحباً بك في طرفية النظام الآمنة. يمكنك تنفيذ الأوامر المسموحة فقط.
                <br />
                استخدم الأسهم العلوية والسفلية للتنقل في سجل الأوامر.
                <br />
                <br />
                الأوامر المسموحة:
                <br />
                {ALLOWED_COMMANDS.map((cmd, i) => (
                  <span key={i}>
                    - {cmd}
                    <br />
                  </span>
                ))}
              </div>
            ) : (
              history.map((result, index) => (
                <div key={index} className="mb-4" data-testid={`command-result-${index}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-blue-400">$</span>
                    <span className="text-white">{result.command}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(result.command)}
                      className="h-auto p-1 text-gray-500 hover:text-white"
                      data-testid={`copy-command-${index}`}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                    <div className="flex items-center gap-1 mr-auto">
                      {result.success ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span className="text-xs text-gray-500">
                        {result.timestamp.toLocaleTimeString('ar-SA')}
                      </span>
                    </div>
                  </div>
                  
                  {result.stdout && (
                    <pre className="text-green-400 whitespace-pre-wrap mb-2 bg-gray-800 p-2 rounded">
                      {result.stdout}
                    </pre>
                  )}
                  
                  {result.stderr && (
                    <pre className="text-red-400 whitespace-pre-wrap bg-red-900/20 p-2 rounded">
                      {result.stderr}
                    </pre>
                  )}
                </div>
              ))
            )}
            
            {executeCommandMutation.isPending && (
              <div className="flex items-center gap-2 text-yellow-400">
                <div className="animate-spin w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full"></div>
                <span>جاري تنفيذ الأمر...</span>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-border p-4 bg-card">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TerminalIcon className="w-4 h-4" />
                <span>$</span>
              </div>
              <Input
                ref={inputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="أدخل أمراً آمناً..."
                className="flex-1 font-mono"
                disabled={executeCommandMutation.isPending}
                data-testid="terminal-input"
              />
              <Button
                type="submit"
                disabled={!command.trim() || executeCommandMutation.isPending}
                data-testid="button-execute-command"
              >
                <Play className="w-4 h-4" />
                تنفيذ
              </Button>
            </form>
            
            <div className="mt-2 text-xs text-muted-foreground">
              نصيحة: استخدم الأسهم ↑↓ للتنقل في سجل الأوامر. الأوامر محدودة لأسباب أمنية.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-medium text-yellow-500">ملاحظة أمنية</h4>
              <p className="text-sm text-muted-foreground">
                هذه الطرفية محدودة بمجموعة من الأوامر الآمنة فقط لحماية النظام. 
                جميع الأوامر المنفذة يتم تسجيلها ومراقبتها. 
                لا يمكن تنفيذ أوامر قد تؤثر على أمان أو استقرار النظام.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
