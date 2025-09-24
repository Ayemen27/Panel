import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Shield, Calendar, AlertTriangle, CheckCircle, RefreshCw, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export default function SSL() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: certificates, isLoading } = useQuery({
    queryKey: ["/api/ssl-certificates"],
    refetchInterval: 60000, // Check every minute
  });

  const { data: domains } = useQuery({
    queryKey: ["/api/domains"],
  });

  const issueCertificateMutation = useMutation({
    mutationFn: async (domainId: string) => {
      await apiRequest("POST", "/api/ssl-certificates", { domainId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ssl-certificates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/domains"] });
      toast({
        title: "تم إصدار الشهادة",
        description: "تم إصدار شهادة SSL بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ في إصدار الشهادة",
        description: "فشل في إصدار شهادة SSL",
        variant: "destructive",
      });
    },
  });

  const renewCertificateMutation = useMutation({
    mutationFn: async (certificateId: string) => {
      // TODO: Implement certificate renewal API
      await apiRequest("POST", `/api/ssl-certificates/${certificateId}/renew`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ssl-certificates"] });
      toast({
        title: "تم تجديد الشهادة",
        description: "تم تجديد شهادة SSL بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ في التجديد",
        description: "فشل في تجديد شهادة SSL",
        variant: "destructive",
      });
    },
  });

  const getStatusConfig = (status: string, expiresAt?: string) => {
    const now = new Date();
    const expiryDate = expiresAt ? new Date(expiresAt) : null;
    const daysUntilExpiry = expiryDate ? Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    if (status === 'valid' && daysUntilExpiry > 30) {
      return {
        icon: CheckCircle,
        className: 'text-green-500',
        bgClassName: 'bg-green-500/20',
        label: 'صالح',
        variant: 'default' as const
      };
    } else if (status === 'valid' && daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
      return {
        icon: AlertTriangle,
        className: 'text-yellow-500',
        bgClassName: 'bg-yellow-500/20',
        label: `تنتهي خلال ${daysUntilExpiry} يوم`,
        variant: 'secondary' as const
      };
    } else if (daysUntilExpiry <= 0) {
      return {
        icon: AlertTriangle,
        className: 'text-red-500',
        bgClassName: 'bg-red-500/20',
        label: 'منتهية',
        variant: 'destructive' as const
      };
    } else {
      return {
        icon: RefreshCw,
        className: 'text-gray-500',
        bgClassName: 'bg-gray-500/20',
        label: 'معلقة',
        variant: 'outline' as const
      };
    }
  };

  const domainsWithoutSSL = domains?.filter((domain: any) => 
    domain.dnsStatus === 'ok' && 
    !certificates?.some((cert: any) => cert.domainId === domain.id)
  ) || [];

  return (
    <div className="space-y-6" data-testid="ssl-content">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">شهادات SSL</h2>
          <p className="text-muted-foreground">إدارة وتجديد شهادات الأمان</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">شهادات صالحة</p>
                <p className="text-2xl font-bold">
                  {certificates?.filter((cert: any) => cert.status === 'valid').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">تنتهي قريباً</p>
                <p className="text-2xl font-bold">
                  {certificates?.filter((cert: any) => {
                    const daysUntilExpiry = cert.expiresAt ? 
                      Math.floor((new Date(cert.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                  }).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">منتهية</p>
                <p className="text-2xl font-bold">
                  {certificates?.filter((cert: any) => {
                    const daysUntilExpiry = cert.expiresAt ? 
                      Math.floor((new Date(cert.expiresAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;
                    return daysUntilExpiry <= 0;
                  }).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الشهادات</p>
                <p className="text-2xl font-bold">{certificates?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domains without SSL */}
      {domainsWithoutSSL.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              نطاقات بدون شهادات SSL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {domainsWithoutSSL.map((domain: any) => (
                <div key={domain.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-medium">{domain.domain}</p>
                    <p className="text-sm text-muted-foreground">DNS متصل بشكل صحيح</p>
                  </div>
                  <Button
                    onClick={() => issueCertificateMutation.mutate(domain.id)}
                    disabled={issueCertificateMutation.isPending}
                    data-testid={`button-issue-ssl-${domain.id}`}
                  >
                    {issueCertificateMutation.isPending ? "جاري الإصدار..." : "إصدار شهادة SSL"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SSL Certificates List */}
      <div className="grid gap-4" data-testid="ssl-certificates-list">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : certificates?.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد شهادات SSL</h3>
              <p className="text-muted-foreground">ابدأ بإصدار شهادة SSL لنطاقاتك</p>
            </CardContent>
          </Card>
        ) : (
          certificates?.map((certificate: any) => {
            const statusConfig = getStatusConfig(certificate.status, certificate.expiresAt);
            const StatusIcon = statusConfig.icon;
            const domain = domains?.find((d: any) => d.id === certificate.domainId);

            return (
              <Card key={certificate.id} className="hover:shadow-md transition-shadow" data-testid={`certificate-${certificate.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${statusConfig.bgClassName}`}>
                        <StatusIcon className={`w-6 h-6 ${statusConfig.className}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold" data-testid={`certificate-domain-${certificate.id}`}>
                            {domain?.domain || 'نطاق محذوف'}
                          </h3>
                          <Badge variant={statusConfig.variant} className="text-xs">
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            المُصدِر: {certificate.issuer}
                          </span>
                          {certificate.expiresAt && (
                            <span>
                              تنتهي: {formatDistanceToNow(new Date(certificate.expiresAt), { 
                                addSuffix: true, 
                                locale: ar 
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {certificate.status === 'valid' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {}} // TODO: Download certificate
                            data-testid={`button-download-${certificate.id}`}
                          >
                            <Download className="w-4 h-4 ml-2" />
                            تحميل
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => renewCertificateMutation.mutate(certificate.id)}
                            disabled={renewCertificateMutation.isPending}
                            data-testid={`button-renew-${certificate.id}`}
                          >
                            <RefreshCw className="w-4 h-4 ml-2" />
                            تجديد
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {certificate.certPath && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">مسارات الملفات:</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>الشهادة: <code className="bg-background px-2 py-1 rounded">{certificate.certPath}</code></div>
                        {certificate.keyPath && (
                          <div>المفتاح: <code className="bg-background px-2 py-1 rounded">{certificate.keyPath}</code></div>
                        )}
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
