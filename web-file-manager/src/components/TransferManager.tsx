
import React, { useState } from 'react'
import { Wifi, Bluetooth, Share, QrCode, Upload, Download } from 'lucide-react'

export function TransferManager() {
  const [activeTab, setActiveTab] = useState<'wifi' | 'bluetooth' | 'share'>('wifi')

  const renderWifiTransfer = () => (
    <div className="space-y-6">
      <div className="material-design-card p-6 text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wifi size={32} className="text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">النقل عبر الواي فاي</h3>
        <p className="text-gray-600 mb-4">انقل الملفات بسرعة بين الأجهزة المتصلة بنفس الشبكة</p>
        <button className="bg-primary text-on-primary px-6 py-2 rounded-lg">
          بدء الخدمة
        </button>
      </div>

      <div className="material-design-card p-6">
        <h4 className="font-semibold mb-4">الأجهزة المتاحة</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="font-medium">هاتف سامسونج</p>
                <p className="text-sm text-gray-500">192.168.1.105</p>
              </div>
            </div>
            <button className="text-primary text-sm">اتصال</button>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="font-medium">لابتوب</p>
                <p className="text-sm text-gray-500">192.168.1.102</p>
              </div>
            </div>
            <button className="text-primary text-sm">اتصال</button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderBluetoothTransfer = () => (
    <div className="space-y-6">
      <div className="material-design-card p-6 text-center">
        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bluetooth size={32} className="text-blue-500" />
        </div>
        <h3 className="text-lg font-semibold mb-2">النقل عبر البلوتوث</h3>
        <p className="text-gray-600 mb-4">شارك الملفات مع الأجهزة القريبة</p>
        <button className="bg-blue-500 text-white px-6 py-2 rounded-lg">
          تشغيل البلوتوث
        </button>
      </div>

      <div className="material-design-card p-6">
        <h4 className="font-semibold mb-4">الأجهزة المقترنة</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <div>
                <p className="font-medium">سماعات لاسلكية</p>
                <p className="text-sm text-gray-500">متصل</p>
              </div>
            </div>
            <button className="text-blue-500 text-sm">إرسال</button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderShareOptions = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="material-design-card p-6 text-center">
          <QrCode size={32} className="text-primary mx-auto mb-3" />
          <h4 className="font-medium mb-2">مشاركة برمز QR</h4>
          <p className="text-sm text-gray-600 mb-3">أنشئ رمز QR للملف</p>
          <button className="bg-primary text-on-primary px-4 py-2 rounded text-sm">
            إنشاء رمز
          </button>
        </div>

        <div className="material-design-card p-6 text-center">
          <Share size={32} className="text-green-500 mx-auto mb-3" />
          <h4 className="font-medium mb-2">مشاركة مباشرة</h4>
          <p className="text-sm text-gray-600 mb-3">شارك عبر التطبيقات</p>
          <button className="bg-green-500 text-white px-4 py-2 rounded text-sm">
            مشاركة
          </button>
        </div>
      </div>

      <div className="material-design-card p-6">
        <h4 className="font-semibold mb-4">تاريخ النقل</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Upload size={16} className="text-green-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">صورة_العطلة.jpg</p>
              <p className="text-xs text-gray-500">تم الإرسال إلى هاتف سامسونج</p>
            </div>
            <span className="text-xs text-gray-500">منذ دقيقتين</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Download size={16} className="text-blue-500" />
            <div className="flex-1">
              <p className="text-sm font-medium">مستند_مهم.pdf</p>
              <p className="text-xs text-gray-500">تم الاستلام من لابتوب</p>
            </div>
            <span className="text-xs text-gray-500">منذ 5 دقائق</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="bg-surface border-b p-4">
        <h1 className="text-xl font-semibold mb-4">إدارة النقل</h1>
        
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {[
            { key: 'wifi', label: 'واي فاي', icon: Wifi },
            { key: 'bluetooth', label: 'بلوتوث', icon: Bluetooth },
            { key: 'share', label: 'مشاركة', icon: Share },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md transition-colors ${
                activeTab === key
                  ? 'bg-white shadow-sm text-primary'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon size={18} />
              <span className="text-sm">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'wifi' && renderWifiTransfer()}
        {activeTab === 'bluetooth' && renderBluetoothTransfer()}
        {activeTab === 'share' && renderShareOptions()}
      </div>
    </div>
  )
}
