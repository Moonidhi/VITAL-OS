import React from 'react'

export default function SkeletonCard({ type = 'card', height = 'h-32', count = 1 }) {
  const items = Array.from({ length: count })

  if (type === 'kpi') {
    return (
      <>
        {items.map((_, idx) => (
          <div
            key={idx}
            className="h-[120px] rounded-xl bg-base-surface border border-base-border p-4 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-6 w-6 rounded-full" />
            </div>
            <div className="skeleton h-8 w-32" />
            <div className="skeleton h-3 w-40" />
          </div>
        ))}
      </>
    )
  }

  if (type === 'table-row') {
    return (
      <>
        {items.map((_, idx) => (
          <tr key={idx} className="border-b border-base-border h-[52px]">
            <td className="px-4"><div className="skeleton h-4 w-16" /></td>
            <td className="px-4"><div className="skeleton h-4 w-32" /></td>
            <td className="px-4"><div className="skeleton h-4 w-12" /></td>
            <td className="px-4"><div className="skeleton h-4 w-24" /></td>
            <td className="px-4"><div className="skeleton h-4 w-20" /></td>
            <td className="px-4"><div className="skeleton h-4 w-16" /></td>
          </tr>
        ))}
      </>
    )
  }

  if (type === 'chart') {
    return (
      <>
        {items.map((_, idx) => (
          <div
            key={idx}
            className={`rounded-xl bg-base-surface border border-base-border p-5 flex flex-col justify-between ${height}`}
          >
            <div className="space-y-2 mb-4">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-3 w-64" />
            </div>
            <div className="skeleton flex-1 w-full rounded-lg" />
          </div>
        ))}
      </>
    )
  }

  if (type === 'detail-panel') {
    return (
      <div className="w-[460px] bg-base-surface border-l border-base-border h-full p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-base-border">
          <div className="space-y-2">
            <div className="skeleton h-6 w-48" />
            <div className="skeleton h-4 w-24" />
          </div>
          <div className="skeleton h-8 w-8 rounded-lg" />
        </div>
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="skeleton h-40 w-full rounded-xl" />
        <div className="skeleton h-24 w-full rounded-xl" />
      </div>
    )
  }

  // Default "card" variant
  return (
    <>
      {items.map((_, idx) => (
        <div
          key={idx}
          className={`rounded-xl bg-base-surface border border-base-border p-4 space-y-3 ${height}`}
        >
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-6 w-2/3" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </>
  )
}
