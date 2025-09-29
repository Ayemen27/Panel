
import React from 'react'
import { HardDrive, Image, Music, Video, FileText, Archive } from 'lucide-react'

export function StorageAnalysis() {
  const storageData = [
    { label: 'الصور', icon: Image, size: '2.5 جيجابايت', percentage: 35, color: 'bg-green-500' },
    { label: 'الفيديو', icon: Video, size: '1.8 جيجابايت', percentage: 25, color: 'bg-red-500' },
    { label: 'الموسيقى', icon: Music, size: '980 ميجابايت', percentage: 15, color: 'bg-purple-500' },
    { label: 'المستندات', icon: FileText, size: '520 ميجابايت', percentage: 8, color: 'bg-blue-500' },
    { label: 'الأرشيف', icon: Archive, size: '340 ميجابايت', percentage: 5, color: 'bg-orange-500' },
    { label: 'أخرى', icon: HardDrive, size: '800 ميجابايت', percentage: 12, color: 'bg-gray-500' },
  ]

  const totalUsed = '6.9 جيجابايت'
  const totalSpace = '32 جيجابايت'
  const usedPercentage = 22

  return (
    <div className="h-full bg-background p-4">
      <div className="max-w-2xl mx-auto">
        {/* Storage Summary */}
        <div className="material-design-card p-6 mb-6">
          <div className="text-center mb-6">
            <div className="w-32 h-32 mx-auto mb-4 relative">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#1976d2"
                  strokeWidth="3"
                  strokeDasharray={`${usedPercentage}, 100`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{usedPercentage}%</div>
                  <div className="text-sm text-gray-500">مستخدم</div>
                </div>
              </div>
            </div>
            <h2 className="text-xl font-semibold mb-2">تحليل التخزين</h2>
            <p className="text-gray-600">
              {totalUsed} من {totalSpace} مستخدم
            </p>
          </div>
        </div>

        {/* Storage Breakdown */}
        <div className="space-y-4">
          {storageData.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className="material-design-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${item.color.replace('bg-', 'bg-')} bg-opacity-20`}>
                      <Icon size={20} className={item.color.replace('bg-', 'text-')} />
                    </div>
                    <div>
                      <h3 className="font-medium">{item.label}</h3>
                      <p className="text-sm text-gray-500">{item.size}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{item.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${item.color}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Actions */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <button className="material-design-card p-4 text-center hover:shadow-md transition-shadow">
            <div className="text-primary mb-2">🧹</div>
            <div className="font-medium">تنظيف الملفات</div>
            <div className="text-sm text-gray-500">إزالة الملفات غير المرغوبة</div>
          </button>
          <button className="material-design-card p-4 text-center hover:shadow-md transition-shadow">
            <div className="text-primary mb-2">📊</div>
            <div className="font-medium">تقرير مفصل</div>
            <div className="text-sm text-gray-500">عرض تحليل شامل</div>
          </button>
        </div>
      </div>
    </div>
  )
}
