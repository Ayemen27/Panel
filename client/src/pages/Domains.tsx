import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Globe, CheckCircle, AlertCircle, Clock, ExternalLink } from "lucide-react";

export default function Domains() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [selectedApp, setSelectedApp] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: domains, isLoading: domainsLoading } = useQuery({
    queryKey: ["/api/domains"],
    refetchInterval: 30000, // Check DNS status every 30 seconds
  });

  const { data: applications } = useQuery({
    queryKey: ["/api/applications"],
  });

  const addDomainMutation = useMutation({
    mutationFn: async (data: { domain: string; applicationId?: string }) => {
      await apiRequest("POST", "/api/domains", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      toast({
        title: "تم إضافة النطاق",
        description: "تم إضافة النطاق بنجاح",
      });
      setNewDomain("");
      setSelectedApp("");
      setShowAddForm(false);
    },
    onError: () => {
      toast({
        title: "خطأ في إضافة النطاق",
        description: "فشل في إضافة النطاق",
        variant: "destructive",
      });
    },
  });

  const checkDnsMutation = useMutation({
    mutationFn: async (domainId: string) => {
      await apiRequest("POST", `/api/domains/${domainId}/check-dns`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      toast({
        title: "تم فحص DNS",
        description: "تم فحص حالة DNS بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ في فحص DNS",
        description: "فشل في فحص حالة DNS",
        variant: "destructive",
      });
    },
  });

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain.trim()) return;

    addDomainMutation.mutate({
      domain: newDomain,
      applicationId: selectedApp || undefined,
    });
  };

  const getDnsStatusConfig = (status: string) => {
    switch (status) {
      case 'ok':
        return {
          icon: CheckCircle,
          className: 'text-green-500',
          bgClassName: 'bg-green-500/20',
          label: 'متصل بشكل صحيح'
        };
      case 'nxdomain':
        return {
          icon: AlertCircle,
          className: 'text-red-500',
          bgClassName: 'bg-red-500/20',
          label: 'غير موجود'
        };
      case 'wrong_ip':
        return {
          icon: AlertCircle,
          className: 'text-yellow-500',
          bgClassName: 'bg-yellow-500/20',
          label: 'IP خاطئ'
        };
      default:
        return {
          icon: Clock,
          className: 'text-gray-500',
          bgClassName: 'bg-gray-500/20',
          label: 'في الانتظار'
        };
    }
  };

  return (
    <div className="space-y-6" data-testid="domains-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">إدارة النطاقات</h2>
          <p className="text-muted-foreground">إدارة أسماء النطاقات وفحص DNS</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} data-testid="button-add-domain">
          <Plus className="w-4 h-4 ml-2" />
          إضافة نطاق
        </Button>
      </div>

      {/* Add Domain Form */}
      {showAddForm && (
        <Card data-testid="add-domain-form">
          <CardHeader>
            <CardTitle>إضافة نطاق جديد</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddDomain} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="domain">اسم النطاق *</Label>
                  <Input
                    id="domain"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="example.com"
                    data-testid="input-domain-name"
                  />
                </div>
                <div>
                  <Label htmlFor="application">التطبيق (اختياري)</Label>
                  <select
                    id="application"
                    value={selectedApp}
                    onChange={(e) => setSelectedApp(e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                    data-testid="select-application"
                  >
                    <option value="">اختر تطبيقاً</option>
                    {applications?.map((app: any) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={addDomainMutation.isPending}
                  data-testid="button-create-domain"
                >
                  {addDomainMutation.isPending ? "جاري الإضافة..." : "إضافة النطاق"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddForm(false)}
                  data-testid="button-cancel-add"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Domains List */}
      <div className="grid gap-4" data-testid="domains-list">
        {domainsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : domains?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Globe className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد نطاقات</h3>
              <p className="text-muted-foreground">ابدأ بإضافة نطاقك الأول</p>
            </CardContent>
          </Card>
        ) : (
          domains?.map((domain: any) => {
            const dnsConfig = getDnsStatusConfig(domain.dnsStatus);
            const DnsIcon = dnsConfig.icon;
            
            return (
              <Card key={domain.id} className="hover:shadow-md transition-shadow" data-testid={`domain-${domain.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Globe className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold" data-testid={`domain-name-${domain.id}`}>
                            {domain.domain}
                          </h3>
                          <a
                            href={`https://${domain.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>DNS Status:</span>
                          <Badge variant="outline" className={`${dnsConfig.bgClassName} ${dnsConfig.className} border-current`}>
                            <DnsIcon className="w-3 h-3 ml-1" />
                            {dnsConfig.label}
                          </Badge>
                          {domain.sslStatus && (
                            <>
                              <span>SSL:</span>
                              <Badge variant={domain.sslStatus === 'valid' ? 'default' : 'secondary'}>
                                {domain.sslStatus === 'valid' ? 'صالح' : 'غير متوفر'}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkDnsMutation.mutate(domain.id)}
                        disabled={checkDnsMutation.isPending}
                        data-testid={`button-check-dns-${domain.id}`}
                      >
                        فحص DNS
                      </Button>
                      {domain.dnsStatus === 'ok' && domain.sslStatus !== 'valid' && (
                        <Button
                          size="sm"
                          onClick={() => {}} // TODO: Issue SSL certificate
                          data-testid={`button-issue-ssl-${domain.id}`}
                        >
                          إصدار SSL
                        </Button>
                      )}
                    </div>
                  </div>

                  {domain.dnsStatus !== 'ok' && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">إعدادات DNS المطلوبة:</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>نوع السجل: <code className="bg-background px-2 py-1 rounded">A</code></div>
                        <div>الاسم: <code className="bg-background px-2 py-1 rounded">{domain.domain}</code></div>
                        <div>القيمة: <code className="bg-background px-2 py-1 rounded">93.127.142.144</code></div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
