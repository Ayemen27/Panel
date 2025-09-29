
import React, { useState } from 'react'
import { ChevronDown, SortAsc } from 'lucide-react'

interface SortDropdownProps {
  sortBy: 'name' | 'size' | 'modified'
  onSortChange: (sort: 'name' | 'size' | 'modified') => void
}

export function SortDropdown({ sortBy, onSortChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  const sortOptions = [
    { value: 'name' as const, label: 'الاسم' },
    { value: 'size' as const, label: 'الحجم' },
    { value: 'modified' as const, label: 'تاريخ التعديل' },
  ]

  const currentOption = sortOptions.find(option => option.value === sortBy)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <SortAsc size={18} />
        <span className="text-sm">{currentOption?.label}</span>
        <ChevronDown size={16} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 min-w-[120px]">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onSortChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full text-right px-4 py-2 hover:bg-gray-50 ${
                  sortBy === option.value ? 'bg-primary/10 text-primary' : ''
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
