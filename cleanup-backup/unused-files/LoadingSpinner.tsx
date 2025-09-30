
export function LoadingSpinner({ message = "جاري التحميل..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] bg-background">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-muted-foreground text-lg">{message}</p>
      </div>
    </div>
  );
}

export function FullPageLoader({ message = "جاري تحميل التطبيق..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="animate-spin w-16 h-16 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6"></div>
        <h2 className="text-2xl font-semibold mb-2">يرجى الانتظار</h2>
        <p className="text-muted-foreground text-lg">{message}</p>
        <div className="mt-4 text-sm text-muted-foreground">
          <p>قد يستغرق هذا بضع ثوانٍ...</p>
        </div>
      </div>
    </div>
  );
}
