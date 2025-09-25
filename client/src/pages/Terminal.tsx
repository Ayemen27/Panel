import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { 
  Terminal as TerminalIcon, 
  Play, 
  Trash2, 
  Copy,
  CheckCircle,
  AlertCircle,
  Clock,
  Wifi,
  WifiOff
} from "lucide-react";

interface TerminalOutput {
  id: string;
  command: string;
  output: string;
  isError?: boolean;
  status: 'running' | 'success' | 'error';
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
  'ps aux',
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
  { label: 'العمليات النشطة', command: 'ps aux' },
  { label: 'المنافذ المفتوحة', command: 'netstat -tlnp' },
];

export default function Terminal() {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<TerminalOutput[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const currentCommandRef = useRef<string>("");
  
  const { toast } = useToast();
  const { isAuthenticated: authStatus, isLoading: authLoading } = useAuth();
  const { isConnected, lastMessage, sendMessage } = useWebSocket();

  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  // Authentication check
  useEffect(() => {
    if (!authLoading && !authStatus) {
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
  }, [authStatus, authLoading, toast]);

  // WebSocket authentication  
  useEffect(() => {
    if (isConnected && authStatus && !isAuthenticated) {
      // Send authentication request (server will validate using session)
      sendMessage({
        type: 'TERMINAL_AUTH_REQUEST'
        // No token needed - server validates using HTTP session cookies
      });
    }
  }, [isConnected, authStatus, isAuthenticated, sendMessage]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'CONNECTION_CLOSED':
          // Reset authentication state when connection closes
          setIsAuthenticated(false);
          setIsExecuting(false);
          currentCommandRef.current = "";
          break;

        case 'TERMINAL_AUTH_SUCCESS':
          setIsAuthenticated(true);
          toast({
            title: "نجح الاتصال",
            description: "تم تسجيل الدخول للطرفية بنجاح",
          });
          break;

        case 'TERMINAL_AUTH_ERROR':
          setIsAuthenticated(false);
          toast({
            title: "خطأ في المصادقة",
            description: lastMessage.message || "فشل في تسجيل الدخول للطرفية",
            variant: "destructive",
          });
          break;

        case 'TERMINAL_OUTPUT':
          const outputData = lastMessage.data;
          if (outputData) {
            const outputId = `${outputData.command}-${Date.now()}`;
            setHistory(prev => {
              const existingIndex = prev.findIndex(h => h.command === outputData.command && h.status === 'running');
              if (existingIndex >= 0) {
                // Update existing output
                const updated = [...prev];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  output: updated[existingIndex].output + outputData.output,
                  isError: outputData.isError,
                  status: outputData.status
                };
                return updated;
              } else {
                // Add new output
                return [...prev, {
                  id: outputId,
                  command: outputData.command,
                  output: outputData.output,
                  isError: outputData.isError,
                  status: outputData.status,
                  timestamp: new Date()
                }];
              }
            });
          }
          break;

        case 'TERMINAL_COMPLETE':
          const completeData = lastMessage.data;
          if (completeData) {
            setHistory(prev => {
              const updated = [...prev];
              const index = updated.findIndex(h => h.command === completeData.command);
              if (index >= 0) {
                updated[index] = {
                  ...updated[index],
                  status: completeData.status,
                  output: updated[index].output + `\n[Exit code: ${completeData.exitCode}]`
                };
              }
              return updated;
            });
            setIsExecuting(false);
            currentCommandRef.current = "";
          }
          break;

        case 'TERMINAL_ERROR':
          toast({
            title: "خطأ في الطرفية",
            description: lastMessage.message || "حدث خطأ في تنفيذ الأمر",
            variant: "destructive",
          });
          setIsExecuting(false);
          currentCommandRef.current = "";
          break;
      }
    }
  }, [lastMessage, toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !isConnected || !isAuthenticated || isExecuting) return;
    
    const trimmedCommand = command.trim();
    
    if (!ALLOWED_COMMANDS.includes(trimmedCommand)) {
      toast({
        title: "أمر غير مسموح",
        description: "هذا الأمر غير مسموح لأسباب أمنية",
        variant: "destructive",
      });
      return;
    }
    
    // Send command via WebSocket
    sendMessage({
      type: 'TERMINAL_COMMAND',
      command: trimmedCommand
    });

    setIsExecuting(true);
    currentCommandRef.current = trimmedCommand;
    
    // Add to command history if not already present
    setCommandHistory(prev => {
      const filtered = prev.filter(c => c !== trimmedCommand);
      return [trimmedCommand, ...filtered].slice(0, 50); // Keep last 50 commands
    });
    
    setCommand("");
    setHistoryIndex(-1);
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
    if (!isConnected || !isAuthenticated || isExecuting) return;
    
    setCommand(cmd);
    
    // Send command via WebSocket
    sendMessage({
      type: 'TERMINAL_COMMAND',
      command: cmd
    });

    setIsExecuting(true);
    currentCommandRef.current = cmd;
    
    // Add to command history
    setCommandHistory(prev => {
      const filtered = prev.filter(c => c !== cmd);
      return [cmd, ...filtered].slice(0, 50);
    });
  };

  if (authLoading || !authStatus) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const connectionStatus = isConnected && isAuthenticated ? 'connected' : isConnected ? 'authenticating' : 'disconnected';

  return (
    <div className="space-y-6" data-testid="terminal-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">طرفية الويب التفاعلية</h2>
          <p className="text-muted-foreground">تنفيذ الأوامر الآمنة في الوقت الفعلي</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'authenticating' ? 'secondary' : 'destructive'}
            className={connectionStatus === 'connected' ? 'text-green-500 border-green-500' : ''}
          >
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="w-3 h-3 ml-1" />
                متصل
              </>
            ) : connectionStatus === 'authenticating' ? (
              <>
                <Clock className="w-3 h-3 ml-1" />
                جاري المصادقة
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 ml-1" />
                غير متصل
              </>
            )}
          </Badge>
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
                disabled={!isConnected || !isAuthenticated || isExecuting}
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
            طرفية الويب التفاعلية
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
                مرحباً بك في الطرفية التفاعلية. يمكنك تنفيذ الأوامر المسموحة فقط.
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
                <div key={result.id} className="mb-4" data-testid={`command-result-${index}`}>
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
                      {result.status === 'running' ? (
                        <div className="animate-spin w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full" />
                      ) : result.status === 'success' ? (
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
                  
                  <pre className={`whitespace-pre-wrap mb-2 p-2 rounded ${
                    result.isError 
                      ? 'text-red-400 bg-red-900/20' 
                      : 'text-green-400 bg-gray-800'
                  }`}>
                    {result.output}
                  </pre>
                </div>
              ))
            )}
            
            {isExecuting && (
              <div className="flex items-center gap-2 text-yellow-400">
                <div className="animate-spin w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full"></div>
                <span>جاري تنفيذ الأمر: {currentCommandRef.current}</span>
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
                disabled={!isConnected || !isAuthenticated || isExecuting}
                data-testid="terminal-input"
              />
              <Button
                type="submit"
                disabled={!command.trim() || !isConnected || !isAuthenticated || isExecuting}
                data-testid="button-execute-command"
              >
                <Play className="w-4 h-4" />
                تنفيذ
              </Button>
            </form>
            
            <div className="mt-2 text-xs text-muted-foreground">
              نصيحة: استخدم الأسهم ↑↓ للتنقل في سجل الأوامر. 
              {!isConnected && " | خطأ: غير متصل بالخادم"}
              {!isAuthenticated && isConnected && " | خطأ: غير مسجل دخول للطرفية"}
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
                هذه الطرفية تستخدم WebSocket للاتصال المباشر وتدفق الأوامر في الوقت الفعلي. 
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